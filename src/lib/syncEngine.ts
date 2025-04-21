import KlaviyoApiClient from './klaviyoAPI';
import AirtableApiClient from './airtableAPI';

// Define interfaces for our data models
interface KlaviyoFlow {
  id: string;
  attributes?: {
    name: string;
    status: string;
    trigger_type: string;
    created: string;
    updated: string;
    archived: boolean;
  };
}

interface KlaviyoMessage {
  id: string;
  flow_id: string;
  attributes?: {
    name: string;
    channel: string;
    subject_line?: string;
    status: string;
    created: string;
    updated: string;
  };
}

interface KlaviyoMetric {
  id: string;
  attributes?: {
    name: string;
    integration: string;
    created: string;
    updated: string;
  };
}

interface AirtableFlow {
  fields: {
    flow_id: string;
    name: string;
    status: string;
    trigger_type: string;
    created_date: string;
    updated_date: string;
    archived: boolean;
  };
}

interface AirtableMessage {
  fields: {
    message_id: string;
    flow_id: string;
    name: string;
    channel: string;
    subject_line?: string;
    status: string;
    created_date: string;
    updated_date: string;
  };
}

interface AirtableMetric {
  fields: {
    metric_id: string;
    name: string;
    integration_name: string;
    created_date: string;
    updated_date: string;
  };
}

interface Timeframe {
  start: string;
  end: string;
}

interface Timeframes {
  current_30d: Timeframe;
  prev_30d: Timeframe;
}

interface KlaviyoApiResponse<T> {
  data: T[];
}

interface KlaviyoMetricAggregateResponse {
  data: {
    attributes: {
      data: Array<{
        measurements: {
          count: number[];
        };
      }>;
    };
  };
}

export async function syncKlaviyoToAirtable() {
  try {
    console.log('Starting Klaviyo to Airtable sync...');
    const klaviyoClient = new KlaviyoApiClient({ apiKey: process.env.KLAVIYO_API_KEY || '' });
    const airtableClient = new AirtableApiClient({ 
      apiKey: process.env.AIRTABLE_API_KEY || '', 
      baseId: process.env.AIRTABLE_BASE_ID || '' 
    });

    // Get all flows from Klaviyo
    const flowsResponse = await klaviyoClient.getFlows() as KlaviyoApiResponse<KlaviyoFlow>;
    const flows = flowsResponse.data;

    // Get all metrics from Klaviyo
    const metricsResponse = await klaviyoClient.getMetrics() as KlaviyoApiResponse<KlaviyoMetric>;
    const metrics = metricsResponse.data;

    // Transform flows for Airtable
    const transformedFlows: Array<{ fields: Record<string, any> }> = [];
    const flowErrors: Array<{ flowId: string; error: string }> = [];

    for (const flow of flows) {
      try {
        // Get actions for this flow
        const actionsResponse = await klaviyoClient.getFlowActions(flow.id) as KlaviyoApiResponse<any>;
        const actions = actionsResponse.data;

        // Get messages for each action
        const messages: KlaviyoMessage[] = [];
        for (const action of actions) {
          const messagesResponse = await klaviyoClient.getFlowMessages(action.id) as KlaviyoApiResponse<KlaviyoMessage>;
          messages.push(...messagesResponse.data);
        }

        // Get metrics for this flow
        const flowMetrics = metrics.filter(m => m.attributes?.name?.includes(flow.id));

        // Calculate metrics for the current period
        const currentPayload = {
          metric_id: flowMetrics.map(m => m.id),
          interval: 'day',
          measurements: ['count'],
          timezone: 'UTC',
          filter: `greater_or_equal(datetime,2024-01-01),less_or_equal(datetime,2024-12-31)`
        };

        const currentMetricsResponse = await klaviyoClient.queryMetricAggregate(currentPayload) as KlaviyoMetricAggregateResponse;
        const currentMetrics = currentMetricsResponse.data.attributes.data;

        // Calculate metrics for the previous period
        const prevPayload = {
          metric_id: flowMetrics.map(m => m.id),
          interval: 'day',
          measurements: ['count'],
          timezone: 'UTC',
          filter: `greater_or_equal(datetime,2023-01-01),less_or_equal(datetime,2023-12-31)`
        };

        const prevMetricsResponse = await klaviyoClient.queryMetricAggregate(prevPayload) as KlaviyoMetricAggregateResponse;
        const prevMetrics = prevMetricsResponse.data.attributes.data;

        // Calculate metrics
        const currentCount = currentMetrics.reduce((sum, m) => sum + m.measurements.count.reduce((a, b) => a + b, 0), 0);
        const prevCount = prevMetrics.reduce((sum, m) => sum + m.measurements.count.reduce((a, b) => a + b, 0), 0);

        const countGrowth = prevCount > 0 ? ((currentCount - prevCount) / prevCount) * 100 : 0;

        // Transform flow data for Airtable
        transformedFlows.push({
          fields: {
            'Flow ID': flow.id,
            'Flow Name': flow.attributes?.name || 'Unnamed Flow',
            'Status': flow.attributes?.status || 'unknown',
            'Trigger Type': flow.attributes?.trigger_type || 'unknown',
            'Created At': flow.attributes?.created || new Date().toISOString(),
            'Updated At': flow.attributes?.updated || new Date().toISOString(),
            'Current Period Count': currentCount,
            'Previous Period Count': prevCount,
            'Count Growth %': countGrowth,
            'Message Count': messages.length,
            'Action Count': actions.length,
            'Metric Count': flowMetrics.length
          }
        });
      } catch (error) {
        console.warn(`Error processing flow ${flow.id}:`, error);
        flowErrors.push({
          flowId: flow.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        continue; // Skip this flow and continue with the next one
      }
    }

    // Log any errors that occurred during processing
    if (flowErrors.length > 0) {
      console.warn('Errors occurred while processing some flows:', flowErrors);
    }

    console.log('flows to create', transformedFlows.length);
    console.log('flows to update', 0);

    // Create records in Airtable
    if (transformedFlows.length > 0) {
      await airtableClient.createRecords('Flows', transformedFlows);
    }

    console.log('Sync completed successfully');
  } catch (error) {
    console.error('Error during sync:', error);
    throw error;
  }
}