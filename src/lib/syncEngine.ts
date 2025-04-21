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

export const syncKlaviyoToAirtable = async (
  klaviyoApiKey: string, 
  airtableApiKey: string, 
  airtableBaseId: string
) => {
  try {
    console.log('Starting Klaviyo to Airtable sync');
    
    // Generate a unique sync batch ID
    const syncBatchId = `sync_${Date.now()}`;
    const clientId = "demo_client";
    const clientName = "Demo Client";
    
    // 1. Initialize clients
    const klaviyoClient = new KlaviyoApiClient({ apiKey: klaviyoApiKey });
    const airtableClient = new AirtableApiClient({ 
      apiKey: airtableApiKey, 
      baseId: airtableBaseId 
    });
    
    // 2. Define timeframes for metrics
    const now = new Date();
    const timeframes: Timeframes = {
      current_30d: {
        start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        end: now.toISOString()
      },
      prev_30d: {
        start: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        end: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
      }
    };
    
    // 3. Fetch all data from Klaviyo
    console.log('Fetching flows from Klaviyo');
    const flowsResponse = await klaviyoClient.getFlows() as KlaviyoApiResponse<KlaviyoFlow>;
    const flows: KlaviyoFlow[] = flowsResponse?.data || [];
    console.log(`Found ${flows.length} flows`);
    
    console.log('Fetching messages for all flows');
    const allMessages: KlaviyoMessage[] = [];
    
    for (const flow of flows) {
      try {
        // Get all actions for this flow
        const actionsResponse = await klaviyoClient.getFlowActions(flow.id) as KlaviyoApiResponse<any>;
        const actions = actionsResponse?.data || [];
        
        for (const action of actions) {
          // Get all messages for this action
          try {
            const messagesResponse = await klaviyoClient.getFlowMessages(action.id) as KlaviyoApiResponse<KlaviyoMessage>;
            const messages = messagesResponse?.data || [];
            
            // Add flow_id to each message for reference
            const messagesWithFlowId = messages.map(msg => ({
              ...msg,
              flow_id: flow.id
            }));
            
            allMessages.push(...messagesWithFlowId);
          } catch (error) {
            console.error(`Error fetching messages for action ${action.id}:`, error);
          }
        }
      } catch (error) {
        console.error(`Error fetching actions for flow ${flow.id}:`, error);
      }
    }
    
    console.log(`Found ${allMessages.length} messages total`);
    
    console.log('Fetching metrics from Klaviyo');
    const metricsResponse = await klaviyoClient.getMetrics() as KlaviyoApiResponse<KlaviyoMetric>;
    const metrics = metricsResponse?.data || [];
    console.log(`Found ${metrics.length} metrics`);
    
    // 4. Transform data for Airtable
    console.log('Transforming data for Airtable');
    const transformedFlows: AirtableFlow[] = flows.map(flow => ({
      fields: {
        flow_id: flow.id,
        name: flow.attributes?.name || 'Unnamed Flow',
        status: flow.attributes?.status || 'unknown',
        trigger_type: flow.attributes?.trigger_type || 'unknown',
        created_date: flow.attributes?.created || new Date().toISOString(),
        updated_date: flow.attributes?.updated || new Date().toISOString(),
        archived: flow.attributes?.archived || false
      }
    }));

    console.log('flows to create', transformedFlows.length);
    console.log('flows to update', 0);
    
    const transformedMessages: AirtableMessage[] = allMessages.map(message => ({
      fields: {
        message_id: message.id,
        flow_id: message.flow_id,
        name: message.attributes?.name || 'Unnamed Message',
        channel: message.attributes?.channel || 'unknown',
        subject_line: message.attributes?.subject_line,
        status: message.attributes?.status || 'unknown',
        created_date: message.attributes?.created || new Date().toISOString(),
        updated_date: message.attributes?.updated || new Date().toISOString()
      }
    }));
    
    const transformedMetrics: AirtableMetric[] = metrics.map(metric => ({
      fields: {
        metric_id: metric.id,
        name: metric.attributes?.name || 'Unnamed Metric',
        integration_name: metric.attributes?.integration || 'unknown',
        created_date: metric.attributes?.created || new Date().toISOString(),
        updated_date: metric.attributes?.updated || new Date().toISOString()
      }
    }));
    
    // 5. Metrics data collection
    console.log('Fetching metric data for each message');
    const metricsData = [];
    
    // Standard metric types we want to track for each message
    const metricTypes = [
      { id: "", name: "Sent Email" },
      { id: "", name: "Opened Email" },
      { id: "", name: "Clicked Email" },
      { id: "", name: "Placed Order" },
      { id: "", name: "Unsubscribed" },
      { id: "", name: "Marked Email as Spam" }
    ];
    
    // First, get all the metric IDs for our metric types
    console.log('Getting metric IDs for standard metrics');
    for (const metricType of metricTypes) {
      // Look for this metric in the metrics list
      const matchedMetric = metrics.find(m => m.attributes?.name === metricType.name);
      if (matchedMetric) {
        metricType.id = matchedMetric.id;
        console.log(`Found ID for ${metricType.name}: ${metricType.id}`);
      } else {
        console.log(`Could not find ID for metric: ${metricType.name}`);
      }
    }
    
    // Only proceed with metrics that we found IDs for
    const validMetricTypes = metricTypes.filter(m => m.id);
    console.log(`Processing ${validMetricTypes.length} valid metrics`);
    
    // For each message, get metrics for both timeframes
    for (const message of allMessages) {
      console.log(`Fetching metrics for message: ${message.id} (${message.attributes?.name || 'Unnamed'})`);
      
      // Process each metric type
      for (const metricType of validMetricTypes) {
        // Current 30-day window
        try {
          console.log(`Fetching ${metricType.name} metrics for current 30-day window`);
          
          // Create the query payload
          const currentPayload = {
            data: {
              type: "metric-aggregate",
              attributes: {
                metric_id: metricType.id,
                measurements: ["count"],
                filter: [
                  `greater-or-equal(datetime,${timeframes.current_30d.start})`,
                  `less-than(datetime,${timeframes.current_30d.end})`,
                  `equals($message,"${message.id}")`
                ],
                timezone: "UTC"
              }
            }
          };
          
          // Query for this metric
          const currentResponse = await klaviyoClient.queryMetricAggregate(currentPayload) as KlaviyoMetricAggregateResponse;
          
          // Extract the value from the response
          let metricValue = 0;
          if (currentResponse?.data?.attributes?.data?.[0]?.measurements?.count) {
            // Sum up the values if there are multiple data points
            metricValue = currentResponse.data.attributes.data[0].measurements.count.reduce(
              (sum, val) => sum + (val || 0), 0
            );
          }
          
          // Add to our metrics data
          metricsData.push({
            fields: {
              client_id: clientId,
              client_name: clientName,
              flow_id: message.flow_id,
              flow_name: flows.find(f => f.id === message.flow_id)?.attributes?.name || 'Unknown Flow',
              flow_message_id: message.id,
              message_name: message.attributes?.name || 'Unnamed Message',
              metric_type: metricType.name,
              value: metricValue,
              timeframe_type: 'current_30d',
              timeframe_start: timeframes.current_30d.start,
              timeframe_end: timeframes.current_30d.end,
              sync_date: new Date().toISOString(),
              sync_batch_id: syncBatchId
            }
          });
        } catch (error) {
          console.error(`Error fetching current metrics for message ${message.id}:`, error);
        }
        
        // Previous 30-day window
        try {
          console.log(`Fetching ${metricType.name} metrics for previous 30-day window`);
          
          // Create the query payload
          const prevPayload = {
            data: {
              type: "metric-aggregate",
              attributes: {
                metric_id: metricType.id,
                measurements: ["count"],
                filter: [
                  `greater-or-equal(datetime,${timeframes.prev_30d.start})`,
                  `less-than(datetime,${timeframes.prev_30d.end})`,
                  `equals($message,"${message.id}")`
                ],
                timezone: "UTC"
              }
            }
          };
          
          // Query for this metric
          const prevResponse = await klaviyoClient.queryMetricAggregate(prevPayload) as KlaviyoMetricAggregateResponse;
          
          // Extract the value from the response
          let metricValue = 0;
          if (prevResponse?.data?.attributes?.data?.[0]?.measurements?.count) {
            // Sum up the values if there are multiple data points
            metricValue = prevResponse.data.attributes.data[0].measurements.count.reduce(
              (sum, val) => sum + (val || 0), 0
            );
          }
          
          // Add to our metrics data
          metricsData.push({
            fields: {
              client_id: clientId,
              client_name: clientName,
              flow_id: message.flow_id,
              flow_name: flows.find(f => f.id === message.flow_id)?.attributes?.name || 'Unknown Flow',
              flow_message_id: message.id,
              message_name: message.attributes?.name || 'Unnamed Message',
              metric_type: metricType.name,
              value: metricValue,
              timeframe_type: 'prev_30d',
              timeframe_start: timeframes.prev_30d.start,
              timeframe_end: timeframes.prev_30d.end,
              sync_date: new Date().toISOString(),
              sync_batch_id: syncBatchId
            }
          });
        } catch (error) {
          console.error(`Error fetching previous metrics for message ${message.id}:`, error);
        }
      }
    }
    
    const metricsCount = metricsData.length;
    console.log(`Retrieved ${metricsCount} metric records`);
    
    // 6. Sync to Airtable
    try {
      console.log('Syncing flows to Airtable');
      const flowsResult = await airtableClient.createRecords('Flows', transformedFlows);
      console.log(`Successfully synced ${flowsResult.records.length} flows`);
    } catch (error) {
      console.error('Error syncing flows to Airtable:', error);
      throw new Error(`Failed to sync flows: ${error.message}`);
    }
    
    try {
      console.log('Syncing messages to Airtable');
      const messagesResult = await airtableClient.createRecords('Flow Messages', transformedMessages);
      console.log(`Successfully synced ${messagesResult.records.length} messages`);
    } catch (error) {
      console.error('Error syncing messages to Airtable:', error);
      throw new Error(`Failed to sync messages: ${error.message}`);
    }
    
    try {
      console.log('Syncing metrics to Airtable');
      const metricsResult = await airtableClient.createRecords('Metrics', transformedMetrics);
      console.log(`Successfully synced ${metricsResult.records.length} metrics`);
    } catch (error) {
      console.error('Error syncing metrics to Airtable:', error);
      throw new Error(`Failed to sync metrics: ${error.message}`);
    }
    
    try {
      console.log('Syncing metric data to Airtable');
      const metricsDataResult = await airtableClient.createRecords('Flow Metrics', metricsData);
      console.log(`Successfully synced ${metricsDataResult.records.length} metric data records`);
    } catch (error) {
      console.error('Error syncing metric data to Airtable:', error);
      throw new Error(`Failed to sync metric data: ${error.message}`);
    }
    
    console.log('Sync completed successfully');
    return { 
      success: true,
      summary: {
        flows: transformedFlows.length,
        messages: transformedMessages.length,
        metrics: transformedMetrics.length,
        metricRecords: metricsCount
      }
    };
    
  } catch (error) {
    console.error('Sync error:', error);
    throw error;
  }
};