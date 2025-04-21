// In syncEngine.ts, replace the mock metrics section with:

// Fetch actual metrics data
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
      const currentResponse = await klaviyoClient.queryMetricAggregate(currentPayload);
      
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
      const prevResponse = await klaviyoClient.queryMetricAggregate(prevPayload);
      
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

metricsCount = metricsData.length;
console.log(`Retrieved ${metricsCount} metric records`);