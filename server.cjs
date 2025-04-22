const express = require('express');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

// Initialize Express app
const app = express();
const PORT = 3000;

// =============================================================================
// Middleware
// =============================================================================
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  credentials: true
}));
app.use(express.json());

// =============================================================================
// API Client Classes
// =============================================================================

// -----------------------------------------------------------------------------
// Klaviyo API Client
// -----------------------------------------------------------------------------
class KlaviyoApiClient {
  constructor({ apiKey, baseUrl = 'https://a.klaviyo.com/api', useProxy = false }) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.useProxy = useProxy;
    this.failedFlows = []; // Track failed flows and actions
  }
  
  // Helper method to implement exponential backoff
  async retryWithBackoff(fn, maxRetries = 3, initialDelay = 2000) {
    let retries = 0;
    while (true) {
      try {
        return await fn();
      } catch (error) {
        retries++;
        // Don't retry if we've hit max retries or it's not a retryable error
        if (retries > maxRetries || !(error.status === 429 || error.status >= 500)) {
          throw error;
        }
        
        // Calculate backoff delay with jitter
        const delay = initialDelay * Math.pow(2, retries - 1) * (0.8 + Math.random() * 0.4);
        console.warn(`[Klaviyo] Rate limited or server error. Retrying in ${Math.round(delay)}ms (attempt ${retries}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  async fetch(endpoint, options = {}) {
    // Implement the request as a function we can retry
    const makeRequest = async () => {
      try {
        // Direct API call since we're in a Node.js environment
        const url = `${this.baseUrl}${endpoint}`;
        
        // Extract flow ID from endpoint for better error messages (if present)
        let flowId = null;
        const flowMatch = endpoint.match(/\/flows\/([^\/]+)/);
        if (flowMatch && flowMatch[1]) {
          flowId = flowMatch[1];
        }
        
        // Extract action ID if present
        let actionId = null;
        const actionMatch = endpoint.match(/\/flow-actions\/([^\/]+)/);
        if (actionMatch && actionMatch[1]) {
          actionId = actionMatch[1];
        }
        
        const defaultOptions = {
          headers: {
            'Accept': 'application/json, application/vnd.api+json',  // Accept Klaviyo's JSONAPI format
            'Authorization': `Klaviyo-API-Key ${this.apiKey}`,
            'revision': '2023-10-15',
            'Content-Type': 'application/json',
          },
          ...options,
        };
        
        console.log(`[Klaviyo] Making request to: ${url}`);
        const response = await fetch(url, defaultOptions);
        
        // Check for rate limiting headers
        const rateLimit = {
          limit: parseInt(response.headers.get('x-ratelimit-limit') || '0'),
          remaining: parseInt(response.headers.get('x-ratelimit-remaining') || '0'),
          reset: parseInt(response.headers.get('x-ratelimit-reset') || '0')
        };
        
        if (rateLimit.remaining <= 1) {
          console.warn(`[Klaviyo] Rate limit nearly reached: ${rateLimit.remaining}/${rateLimit.limit} remaining`);
        }
        
        // Handle 429 rate limit error with custom error object containing status
        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('retry-after') || '5');
          const error = new Error(`Rate limit exceeded — Retry after ${retryAfter} seconds`);
          error.status = 429;
          error.retryAfter = retryAfter;
          throw error;
        }
        
        // Check content type of response
        const contentType = response.headers.get('content-type');
        console.log(`[Klaviyo] Response content type:`, contentType);
        
        // Get the response text first
        const responseText = await response.text();
        
        // Check if response is empty
        if (!responseText || responseText.trim() === '') {
          console.error('[Klaviyo] Empty response received');
          throw new Error('Empty response received from Klaviyo API');
        }
        
        // Try to parse as JSON - Handles both regular JSON and JSON:API format
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (parseError) {
          console.error(`[Klaviyo] JSON parse error:`, parseError);
          console.error(`[Klaviyo] Raw response:`, responseText.substring(0, 500));
          throw new Error(`Failed to parse JSON response: ${parseError.message}`);
        }
        
        if (!response.ok) {
          const errorMessage = data.detail || data.message || (data.errors && data.errors[0]?.detail) || response.statusText;
          const errorCode = response.status;
          
          // Create error object with status code
          const error = new Error();
          error.status = errorCode;
          
          // Enhanced error handling for specific status codes
          if (errorCode === 404) {
            if (flowId) {
              console.error(`[Klaviyo] Flow ID ${flowId} not found - it may have been deleted or the ID is incorrect`);
              error.message = `Flow not found (ID: ${flowId}) — it may have been deleted or the ID is incorrect`;
            } else if (actionId) {
              console.error(`[Klaviyo] Action ID ${actionId} not found - it may have been deleted or the ID is incorrect`);
              error.message = `Action not found (ID: ${actionId}) — it may have been deleted or the ID is incorrect`;
            } else {
              console.error(`[Klaviyo] Resource not found at ${endpoint}`);
              error.message = `Resource not found — the requested endpoint (${endpoint}) doesn't exist`;
            }
          } else if (errorCode === 401) {
            error.message = `Authentication failed — please check your Klaviyo API key`;
          } else if (errorCode === 403) {
            error.message = `Access forbidden — your API key doesn't have permission for this operation`;
          } else if (errorCode === 429) {
            error.message = `Rate limit exceeded — Klaviyo API rate limit reached, please try again later`;
          } else if (errorCode >= 500) {
            error.message = `Klaviyo server error (${errorCode}) — please try again later`;
          } else {
            error.message = `Klaviyo API Error: ${errorCode} - ${errorMessage}`;
          }
          
          throw error;
        }
        
        return data;
      } catch (error) {
        // Add better error handling for network errors
        console.error("[Klaviyo] API error:", error);
        
        if (error instanceof TypeError && error.message.includes('fetch')) {
          const networkError = new Error('Network error: Unable to connect to Klaviyo API. Please check your internet connection.');
          networkError.status = -1; // Custom code for network errors
          throw networkError;
        }
        
        // Make sure error has status property for retry logic
        if (!error.status && error.message && error.message.includes('429')) {
          error.status = 429;
        } else if (!error.status && error.message && error.message.includes('50')) {
          error.status = 500;
        }
        
        // Rethrow the enhanced error
        throw error;
      }
    };
    
    // Use the retry mechanism for the request
    try {
      return await this.retryWithBackoff(makeRequest);
    } catch (error) {
      // This is the final error after retries are exhausted
      console.error(`[Klaviyo] Final error after retries for ${endpoint}:`, error.message);
      throw error;
    }
  }
  
  async testConnection() {
    try {
      console.log('[Klaviyo] Testing connection...');
      const response = await this.fetch('/accounts');
      console.log('[Klaviyo] Connection successful');
      return true;
    } catch (error) {
      console.error("[Klaviyo] Connection test failed:", error);
      throw error;
    }
  }
  
  async getFlows(page = 1, pageSize = 50) {
    try {
      // Add delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
      return await this.fetch('/flows');
    } catch (error) {
      console.error("[Klaviyo] Error fetching flows:", error);
      throw error;
    }
  }
  
  async getFlowActions(flowId) {
    try {
      // Validate flow ID format (should be alphanumeric)
      if (!flowId || !/^[a-zA-Z0-9]+$/.test(flowId)) {
        console.warn(`[Klaviyo] Invalid flow ID format: ${flowId}. Flow ID should be alphanumeric.`);
        return { data: [] };
      }
      
      // We'll handle rate limiting with the retry mechanism in fetch now
      const response = await this.fetch(`/flows/${flowId}/flow-actions/`, {
        headers: {
          // Ensure we specifically request JSON:API format that Klaviyo uses
          'Accept': 'application/vnd.api+json',
          'revision': '2023-10-15',
        }
      });
      
      // Handle both standard JSON and JSON:API format responses
      if (response && response.data) {
        console.log(`[Klaviyo] Successfully fetched ${response.data.length} flow actions for flow ${flowId}`);
        
        // Check if we need to transform the data
        const sampleItem = response.data[0];
        if (sampleItem && typeof sampleItem === 'object' && sampleItem.type === 'flow-action') {
          // The data is already in the right format, return as is
          return response;
        } else {
          // Transform the response to match expected format
          return {
            data: response.data.map(action => ({
              id: action.id || '',
              type: action.type || 'flow-action',
              attributes: {
                name: action.attributes?.name || 'Unnamed Action',
                action_type: action.attributes?.action_type || 'unknown',
                created: action.attributes?.created || new Date().toISOString(),
                updated: action.attributes?.updated || new Date().toISOString()
              }
            }))
          };
        }
      } else {
        console.warn(`[Klaviyo] Empty or invalid response for flow ${flowId}`);
        return { data: [] };
      }
    } catch (error) {
      console.error(`[Klaviyo] Error fetching actions for flow ${flowId}:`, error);
      
      // Return empty data array instead of throwing to prevent sync process from crashing
      console.warn(`[Klaviyo] Returning empty result for flow ${flowId} due to error`);
      return { data: [] };
    }
  }
  
  async getFlowMessages(flowActionId) {
    try {
      // Validate action ID format (should be alphanumeric)
      if (!flowActionId || !/^[a-zA-Z0-9]+$/.test(flowActionId)) {
        const reason = "Invalid action ID format";
        console.warn(`[Klaviyo] Skipping flow action ${flowActionId}: ${reason}`);
        this.failedFlows.push({ flowActionId, reason });
        return { data: [] };
      }
      
      // Use the new API endpoint format with include parameter
      const response = await this.fetch(`/flow-actions/${flowActionId}?include=flow-message`, {
        headers: {
          'Accept': 'application/vnd.api+json',
          'revision': '2023-10-15',
        }
      });
      
      // Check if we have included flow-message objects
      if (response && response.included && Array.isArray(response.included)) {
        // Extract only the flow-message objects from the included array
        const flowMessages = response.included.filter(item => 
          item && item.type === 'flow-message'
        );
        
        console.log(`[Klaviyo] Successfully extracted ${flowMessages.length} messages for flow action ${flowActionId}`);
        
        // Return in the format expected by the rest of the application
        return {
          data: flowMessages.map(message => ({
            id: message.id,
            type: message.type,
            attributes: message.attributes || {}
          }))
        };
      } else {
        // Missing included array - record as a failure but don't log stack trace
        const reason = "No flow messages found in response";
        console.warn(`[Klaviyo] Skipping flow action ${flowActionId}: ${reason}`);
        this.failedFlows.push({ flowActionId, reason });
        return { data: [] };
      }
    } catch (error) {
      // Determine reason based on error type
      let reason = "Unknown error";
      
      if (error.status === 404) {
        reason = "Action not found (404)";
      } else if (error.status === 401 || error.status === 403) {
        reason = "Authentication or permission error";
      } else if (error.status === 429) {
        reason = "Rate limit exceeded";
      } else if (error.message) {
        // Use error message but keep it concise
        reason = error.message.split('\n')[0].substring(0, 100);
      }
      
      // Log a simplified warning instead of full stack trace for common errors
      console.warn(`[Klaviyo] Skipping flow action ${flowActionId}: ${reason}`);
      
      // Track the failure
      this.failedFlows.push({ 
        flowActionId, 
        reason,
        status: error.status || 'unknown',
        timestamp: new Date().toISOString()
      });
      
      // Return empty data array instead of throwing to prevent sync process from crashing
      return { data: [] };
    }
  }
  
  // Helper method to access the failed flows
  getFailedFlows() {
    return this.failedFlows;
  }
  
  async getMetrics() {
    try {
      // Add delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 600));
      return await this.fetch('/metrics');
    } catch (error) {
      console.error("[Klaviyo] Error fetching metrics:", error);
      throw error;
    }
  }
  
  async queryMetricAggregate(payload) {
    try {
      console.log('[Klaviyo] Query metric aggregate payload:', JSON.stringify(payload));
      
      // Add delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return await this.fetch('/metric-aggregates', {
        method: 'POST',
        body: JSON.stringify({
          data: {
            type: "metric-aggregate",
            attributes: payload
          }
        })
      });
    } catch (error) {
      console.error('[Klaviyo] Error querying metric aggregates:', error);
      console.error('[Klaviyo] Payload was:', JSON.stringify(payload));
      throw error;
    }
  }
}

// -----------------------------------------------------------------------------
// Airtable API Client
// -----------------------------------------------------------------------------
class AirtableApiClient {
  constructor({ apiKey, baseId }) {
    this.token = apiKey;
    this.baseId = baseId;
    this.baseUrl = `https://api.airtable.com/v0/${this.baseId}`;
    this.BATCH_SIZE = 10;
    this.DELAY_MS = 120; // Small cushion for rate limiting
  }
  
  // Low-level fetch helper
  async request(path, options = {}) {
    try {
      console.log(`[Airtable] Making request to: ${this.baseUrl}/${path}`);
      if (options.body) {
        // Log request body size, not content (to avoid cluttering logs)
        const bodySize = options.body ? options.body.length : 0;
        console.log(`[Airtable] Request body size: ${bodySize} bytes, method: ${options.method || 'GET'}`);
      }
      
      const res = await fetch(`${this.baseUrl}/${path}`, {
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        ...options,
      });

      if (!res.ok) {
        // Attempt to parse error response as JSON
        const errorText = await res.text();
        let errBody;
        try {
          errBody = JSON.parse(errorText);
        } catch (parseError) {
          console.error('[Airtable] Failed to parse error response:', errorText);
          errBody = { error: { message: `Could not parse error response: ${errorText.substring(0, 100)}...` } };
        }
        
        const msg = errBody?.error?.message || res.statusText;
        const error = new Error(`Airtable API Error: ${res.status} – ${msg}`);
        console.error('[Airtable] Request failed:', error);
        
        // Enhanced error message for specific status codes
        if (res.status === 422) {
          console.error('[Airtable] Validation error - request body may be malformed');
          if (options.body) {
            try {
              // Try to log a sanitized version of the body to debug
              const body = JSON.parse(options.body);
              console.error('[Airtable] Records count:', body.records?.length || 0);
              // Log a sample record (first one) if available
              if (body.records && body.records.length > 0) {
                console.error('[Airtable] First record sample:', JSON.stringify(body.records[0]));
              }
            } catch (e) {
              console.error('[Airtable] Could not parse request body for debugging');
            }
          }
        }
        
        throw error;
      }

      // Get response text to handle parsing manually
      const responseText = await res.text();
      
      try {
        return JSON.parse(responseText);
      } catch (parseError) {
        console.error('[Airtable] Failed to parse successful response:', responseText);
        throw new Error(`Failed to parse Airtable response: ${parseError.message}`);
      }
    } catch (error) {
      // Catch and enhance any network errors
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        console.error('[Airtable] Network error:', error);
        throw new Error(`Airtable network error: ${error.message}. Check your internet connection and API key.`);
      }
      
      // Re-throw other errors
      throw error;
    }
  }
  
  // Public helper methods
  async testConnection() {
    try {
      console.log('[Airtable] Testing API connection...');
      // list a single record from any known table (Flows is fine)
      const result = await this.request('Flows?maxRecords=1');
      console.log('[Airtable] Connection test successful');
      return true;
    } catch (error) {
      console.error('[Airtable] Connection test failed:', error);
      // Check for specific error types and provide more helpful messages
      if (error.message && error.message.includes('401')) {
        throw new Error('Airtable authentication failed: Check your API key');
      } else if (error.message && error.message.includes('404')) {
        throw new Error('Airtable base or table not found: Check your base ID and ensure "Flows" table exists');
      }
      throw error;
    }
  }
  
  // Helper method to sanitize records
  sanitiseCreateRow(row) {
    // Strip properties Airtable wouldn't expect inside "fields"
    const clone = { ...row };
    delete clone.id;
    delete clone.fields; // <- prevents "Unknown field name: fields"
    return clone;
  }
  
  // Create records in batches
  async createRecords(table, rows) {
    if (!rows || !Array.isArray(rows)) {
      console.error('[Airtable] createRecords called with invalid rows:', rows);
      throw new Error('Invalid records data: rows must be an array');
    }
    
    if (rows.length === 0) {
      console.log('[Airtable] createRecords called with empty array, returning empty result');
      return { records: [] };
    }
    
    console.log(`[Airtable] Creating ${rows.length} records in table '${table}' with batch size ${this.BATCH_SIZE}`);
    
    const all = [];
    const failedBatches = [];

    for (let i = 0; i < rows.length; i += this.BATCH_SIZE) {
      const batchIndex = Math.floor(i / this.BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(rows.length / this.BATCH_SIZE);
      const batchItems = rows.slice(i, i + this.BATCH_SIZE);
      
      try {
        // Check if any items in the batch are null or undefined
        const invalidItems = batchItems.filter(item => !item || typeof item !== 'object');
        if (invalidItems.length > 0) {
          console.error(`[Airtable] Invalid items in batch ${batchIndex}:`, invalidItems);
          throw new Error(`Batch contains ${invalidItems.length} invalid items`);
        }
        
        const batch = batchItems.map(r => ({ fields: this.sanitiseCreateRow(r.fields || r) }));

        console.log(`[Airtable] Processing batch ${batchIndex}/${totalBatches} – ${batch.length} records`);

        // Validate the batch to ensure it's properly formatted
        for (const record of batch) {
          if (!record.fields || typeof record.fields !== 'object') {
            console.error(`[Airtable] Invalid record format in batch ${batchIndex}:`, record);
            throw new Error('Record is missing fields object or fields is not an object');
          }
        }

        const res = await this.request(table, {
          method: 'POST',
          body: JSON.stringify({ records: batch }),
        });

        console.log(`[Airtable] Batch ${batchIndex}/${totalBatches} succeeded with ${res.records.length} records`);
        all.push(...res.records);

        if (i + this.BATCH_SIZE < rows.length) {
          const delay = this.DELAY_MS;
          console.log(`[Airtable] Waiting ${delay}ms before next batch`);
          await new Promise(r => setTimeout(r, delay));
        }
      } catch (error) {
        console.error(`[Airtable] Error creating batch ${batchIndex}/${totalBatches}:`, error);
        
        try {
          // Log a sample of the batch data without logging everything
          const batchSample = batchItems.slice(0, 2).map(item => {
            // Create a simplified version to avoid huge logs
            const keys = Object.keys(item.fields || item);
            return {
              numKeys: keys.length,
              keyNames: keys.slice(0, 5), // First 5 keys
              sample: keys.length > 0 ? (item.fields || item)[keys[0]] : null
            };
          });
          console.error(`[Airtable] Batch data sample: ${JSON.stringify(batchSample)}`);
        } catch (logError) {
          console.error('[Airtable] Could not log batch sample:', logError);
        }
        
        failedBatches.push({ batchIndex, error });
        
        // Decide whether to continue or throw the error
        if (failedBatches.length >= 3) {
          console.error(`[Airtable] Too many failed batches (${failedBatches.length}), aborting`);
          throw new Error(`Multiple batch failures: ${error.message}`);
        }
        
        console.log('[Airtable] Continuing with next batch despite error');
      }
    }

    // Report on failures if any
    if (failedBatches.length > 0) {
      const errorMessage = `${failedBatches.length} batch(es) failed during creation`;
      console.error(`[Airtable] ${errorMessage}`);
      throw new Error(errorMessage);
    }

    console.log(`[Airtable] Successfully created all ${rows.length} records in ${Math.ceil(rows.length / this.BATCH_SIZE)} batches`);
    return { records: all };
  }
}

// =============================================================================
// Sync Function Implementation (from syncKlaviyoToAirtable in syncEngine.ts)
// =============================================================================
async function syncKlaviyoToAirtable(klaviyoApiKey, airtableApiKey, airtableBaseId) {
  try {
    console.log('Starting Klaviyo to Airtable sync');
    
    // Initialize clients
    const klaviyoClient = new KlaviyoApiClient({ 
      apiKey: klaviyoApiKey 
    });
    const airtableClient = new AirtableApiClient({ 
      apiKey: airtableApiKey, 
      baseId: airtableBaseId 
    });

    // Test connections
    console.log('Testing Klaviyo connection...');
    await klaviyoClient.testConnection();
    console.log('Klaviyo connection successful');

    console.log('Testing Airtable connection...');
    await airtableClient.testConnection();
    console.log('Airtable connection successful');

    // Get all flows from Klaviyo
    console.log('Fetching flows from Klaviyo...');
    const flowsResponse = await klaviyoClient.getFlows();
    const flows = flowsResponse.data;
    console.log(`Found ${flows.length} flows`);

    // Get all metrics from Klaviyo
    console.log('Fetching metrics from Klaviyo...');
    const metricsResponse = await klaviyoClient.getMetrics();
    const metrics = metricsResponse.data;
    console.log(`Found ${metrics.length} metrics`);

    // Transform flows for Airtable
    const transformedFlows = [];
    const flowErrors = [];

    for (const flow of flows) {
      try {
        console.log(`Processing flow ${flow.id} (${flow.attributes?.name || 'Unnamed'})...`);
        
        // Get actions for this flow - now with improved error handling
        const actionsResponse = await klaviyoClient.getFlowActions(flow.id);
        const actions = actionsResponse.data || [];
        console.log(`Found ${actions.length} actions for flow ${flow.id}`);

        // Get messages for each action
        const messages = [];
        for (const action of actions) {
          try {
            const messagesResponse = await klaviyoClient.getFlowMessages(action.id);
            if (messagesResponse && messagesResponse.data) {
              messages.push(...messagesResponse.data);
            }
          } catch (messageError) {
            console.error(`Error fetching messages for action ${action.id} in flow ${flow.id}:`, messageError);
            console.warn(`Continuing with next action despite message retrieval error`);
            // Continue with other actions instead of failing the whole flow
          }
        }
        console.log(`Found ${messages.length} messages for flow ${flow.id}`);

        // Get metrics for this flow
        const flowMetrics = metrics.filter(m => m.attributes?.name?.includes(flow.id));
        console.log(`Found ${flowMetrics.length} metrics for flow ${flow.id}`);

        // Calculate metrics for the current period
        const now = new Date();
        const currentYear = now.getFullYear();
        const previousYear = currentYear - 1;
        
        const currentPayload = {
          metric_id: flowMetrics.map(m => m.id),
          interval: 'day',
          measurements: ['count'],
          timezone: 'UTC',
          filter: `greater_or_equal(datetime,${currentYear}-01-01),less_or_equal(datetime,${currentYear}-12-31)`
        };

        console.log('Fetching current period metrics...');
        const currentMetricsResponse = await klaviyoClient.queryMetricAggregate(currentPayload);
        const currentMetricsData = currentMetricsResponse.data.attributes.data || [];
        
        // Calculate metrics for the previous period
        const prevPayload = {
          metric_id: flowMetrics.map(m => m.id),
          interval: 'day',
          measurements: ['count'],
          timezone: 'UTC',
          filter: `greater_or_equal(datetime,${previousYear}-01-01),less_or_equal(datetime,${previousYear}-12-31)`
        };

        console.log('Fetching previous period metrics...');
        const prevMetricsResponse = await klaviyoClient.queryMetricAggregate(prevPayload);
        const prevMetricsData = prevMetricsResponse.data.attributes.data || [];

        // Calculate metrics - safely handle potentially missing or malformed data
        let currentCount = 0;
        if (currentMetricsData.length > 0 && currentMetricsData[0].measurements && currentMetricsData[0].measurements.count) {
          currentCount = currentMetricsData.reduce((sum, m) => {
            if (m.measurements && m.measurements.count && Array.isArray(m.measurements.count)) {
              return sum + m.measurements.count.reduce((a, b) => a + (b || 0), 0);
            }
            return sum;
          }, 0);
        }
        
        let prevCount = 0;
        if (prevMetricsData.length > 0 && prevMetricsData[0].measurements && prevMetricsData[0].measurements.count) {
          prevCount = prevMetricsData.reduce((sum, m) => {
            if (m.measurements && m.measurements.count && Array.isArray(m.measurements.count)) {
              return sum + m.measurements.count.reduce((a, b) => a + (b || 0), 0);
            }
            return sum;
          }, 0);
        }

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
        console.log(`Successfully processed flow ${flow.id}`);
      } catch (error) {
        console.error(`Error processing flow ${flow.id}:`, error);
        flowErrors.push({
          flowId: flow.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        continue;
      }
    }

    // Log any errors that occurred during processing
    if (flowErrors.length > 0) {
      console.warn('Errors occurred while processing some flows:', flowErrors);
    }

    console.log(`Preparing to create ${transformedFlows.length} records in Airtable...`);

    // Get the failed flows from the Klaviyo client
    const failedFlows = klaviyoClient.getFailedFlows();
    console.log(`Found ${failedFlows.length} failed flow actions to report`);
    
    // Prepare failed flows for Airtable if there are any
    const failedFlowRecords = [];
    if (failedFlows.length > 0) {
      for (const failedFlow of failedFlows) {
        failedFlowRecords.push({
          fields: {
            'Flow Action ID': failedFlow.flowActionId,
            'Error Reason': failedFlow.reason,
            'Status Code': failedFlow.status || 'unknown',
            'Timestamp': failedFlow.timestamp || new Date().toISOString(),
            'Is Error': true
          }
        });
      }
      console.log(`Prepared ${failedFlowRecords.length} failed flow records for reporting`);
    }

    // Create flow records in Airtable
    let flowResult = { records: [] };
    let failedResult = { records: [] };
    
    if (transformedFlows.length > 0) {
      console.log('Creating flow records in Airtable...');
      flowResult = await airtableClient.createRecords('Flows', transformedFlows);
      console.log(`Successfully created ${flowResult.records?.length || 0} flow records in Airtable`);
    } else {
      console.warn('No flow records to create in Airtable');
    }
    
    // Create failed flow records if there are any
    if (failedFlowRecords.length > 0) {
      try {
        console.log('Creating failed flow records in Airtable...');
        // Try to create a Failed_Flows table, but don't crash if it doesn't exist
        failedResult = await airtableClient.createRecords('Failed_Flows', failedFlowRecords);
        console.log(`Successfully created ${failedResult.records?.length || 0} failed flow records in Airtable`);
      } catch (error) {
        console.error('Error creating failed flow records:', error);
        console.log('You may need to create a "Failed_Flows" table in your Airtable base with fields: Flow Action ID, Error Reason, Status Code, Timestamp, Is Error');
        // Don't fail the entire sync process if recording errors fails
      }
    }
    
    return {
      success: true,
      flowsProcessed: flows.length,
      flowsCreated: flowResult.records?.length || 0,
      flowsWithErrors: flowErrors.length,
      failedFlowsReported: failedResult.records?.length || 0,
      metrics: {
        totalMetrics: metrics.length,
        totalMessages: flows.reduce((sum, flow) => sum + (flow.messageCount || 0), 0),
        totalFailedFlows: failedFlows.length
      }
    };
  } catch (error) {
    console.error('Error during sync:', error);
    throw error;
  }
}

// =============================================================================
// API Routes
// =============================================================================

// Test Klaviyo connection
app.post('/api/test-klaviyo', async (req, res) => {
  const { apiKey } = req.body;

  console.log('[Server] Received POST to /api/test-klaviyo');

  if (!apiKey) {
    console.log('[Server] Error: No API key received');
    return res.status(400).json({ error: 'Missing API key' });
  }

  try {
    const klaviyoClient = new KlaviyoApiClient({ apiKey });
    await klaviyoClient.testConnection();
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('[Server] Klaviyo Connection Error', err);
    res.status(500).json({ 
      success: false,
      error: err instanceof Error ? err.message : 'Failed to connect to Klaviyo' 
    });
  }
});

// Generic proxy for Klaviyo API
app.post('/api/klaviyo-proxy', async (req, res) => {
  try {
    const { endpoint, method = 'GET', body, apiKey } = req.body;
    
    console.log('[Server] Klaviyo proxy request:', {
      endpoint,
      method,
      hasBody: !!body
    });
    
    if (!apiKey) {
      return res.status(400).json({ error: 'Missing API key' });
    }
    
    if (!endpoint) {
      return res.status(400).json({ error: 'Missing endpoint' });
    }
    
    // Use our enhanced KlaviyoApiClient to make the call with retries and better error handling
    try {
      const klaviyoClient = new KlaviyoApiClient({ apiKey });
      
      // Extract the path from the endpoint URL
      let path = endpoint;
      if (endpoint.startsWith('http')) {
        const url = new URL(endpoint);
        path = url.pathname + url.search;
      }
      
      // Use our client's improved fetch method with retry capability
      const result = await klaviyoClient.fetch(path, {
        method,
        ...(body && ['POST', 'PUT', 'PATCH'].includes(method) 
          ? { body: JSON.stringify(body) } 
          : {})
      });
      
      return res.status(200).json(result);
    } catch (error) {
      console.error('[Klaviyo Proxy] Error from Klaviyo client:', error);
      
      // Get appropriate status code
      const statusCode = error.status || 500;
      
      // Return a properly formatted error response
      return res.status(statusCode).json({
        success: false,
        error: error.message || 'Unknown error',
        status: statusCode
      });
    }
  } catch (err) {
    console.error('[Server] Klaviyo Proxy Error', err);
    
    // Generic error handler for proxy route
    res.status(500).json({ 
      success: false,
      error: 'Failed to process Klaviyo request: ' + (err.message || 'Unknown error'),
      status: 500
    });
  }
});

// Sync API route
app.post('/api/sync', async (req, res) => {
  try {
    const { klaviyoApiKey, airtableApiKey, airtableBaseId } = req.body;

    console.log('[Server] Starting sync operation...');
    
    // Validate required parameters
    if (!klaviyoApiKey) {
      console.error('[Server] Missing Klaviyo API key');
      return res.status(400).json({ 
        success: false, 
        error: 'Missing Klaviyo API key' 
      });
    }
    
    if (!airtableApiKey) {
      console.error('[Server] Missing Airtable API key');
      return res.status(400).json({ 
        success: false, 
        error: 'Missing Airtable API key' 
      });
    }
    
    if (!airtableBaseId) {
      console.error('[Server] Missing Airtable Base ID');
      return res.status(400).json({ 
        success: false, 
        error: 'Missing Airtable Base ID' 
      });
    }
    
    console.log('[Server] All required parameters received, starting sync');
    
    const result = await syncKlaviyoToAirtable(klaviyoApiKey, airtableApiKey, airtableBaseId);
    
    console.log('[Server] Sync completed successfully');
    res.json({ 
      success: true,
      result
    });
  } catch (error) {
    console.error('[Server] Sync failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// =============================================================================
// Start Server
// =============================================================================
app.listen(PORT, () => {
  console.log(`API server running at http://localhost:${PORT}`);
  console.log(`
Available endpoints:
- POST /api/test-klaviyo  (Test Klaviyo API connection)
- POST /api/klaviyo-proxy (Generic proxy for Klaviyo API)
- POST /api/sync          (Sync data from Klaviyo to Airtable)
  `);
});