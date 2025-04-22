// src/lib/klaviyoAPI.ts

// API client for Klaviyo API
interface KlaviyoApiOptions {
  apiKey: string;
  baseUrl?: string;
  useProxy?: boolean;
}

// Interface for tracking failed flows
interface FailedFlow {
  flowActionId: string;
  reason: string;
  status?: string | number;
  timestamp?: string;
}

export class KlaviyoApiClient {
  private apiKey: string;
  private baseUrl: string;
  private useProxy: boolean;
  private failedFlows: FailedFlow[] = [];
  
  constructor({ apiKey, baseUrl = 'https://a.klaviyo.com/api', useProxy = true }: KlaviyoApiOptions) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.useProxy = useProxy;
  }
  
  // Method to get failed flows for reporting
  getFailedFlows(): FailedFlow[] {
    return this.failedFlows;
  }
  
  private async fetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    try {
      // If using proxy, modify the request to go through our backend proxy
      if (this.useProxy) {
        console.log(`Using proxy for Klaviyo API request: ${endpoint}`);
        
        // Handle the body differently based on its type
        let bodyForProxy;
        if (options.body) {
          if (typeof options.body === 'string') {
            try {
              // Try to parse if it's a JSON string
              bodyForProxy = JSON.parse(options.body);
            } catch (e) {
              // If not JSON, use as is
              bodyForProxy = options.body;
            }
          } else {
            // If it's already an object, use directly
            bodyForProxy = options.body;
          }
        }
        
        const proxyOptions = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            apiKey: this.apiKey,
            endpoint: endpoint,
            method: options.method || 'GET',
            body: bodyForProxy
          })
        };
        
        console.log(`Proxy request options: ${JSON.stringify({
          endpoint,
          method: options.method || 'GET',
          hasBody: !!bodyForProxy
        })}`);
        
        const response = await fetch('/api/klaviyo-proxy', proxyOptions);
        
        // Check content type of response
        const contentType = response.headers.get('content-type');
        console.log(`Response from ${endpoint} content type:`, contentType);
        
        // Accept both standard JSON and API JSON format
        if (!contentType || (!contentType.includes('json') && !contentType.includes('vnd.api+json'))) {
          const text = await response.text();
          console.error(`Non-JSON response from ${endpoint}:`, text.substring(0, 500));
          throw new Error(`Invalid response: Expected JSON but got ${contentType || 'unknown'}`);
        }
        
        if (!response.ok) {
          try {
            const error = await response.json();
            const errorMessage = error.error || error.detail || error.message || response.statusText;
            const errorCode = response.status;
            throw new Error(`Klaviyo API Error: ${errorCode} - ${errorMessage}`);
          } catch (jsonError) {
            // If we can't parse the error as JSON, try to get the raw text
            const text = await response.clone().text().catch(() => 'Could not read response');
            console.error(`Error parsing error response from ${endpoint}:`, text.substring(0, 500));
            throw new Error(`Klaviyo API Error: ${response.status} - Could not parse error response`);
          }
        }
        
        try {
          return await response.json() as T;
        } catch (jsonError) {
          console.error(`JSON parse error for ${endpoint}:`, jsonError);
          const text = await response.clone().text().catch(() => 'Could not read response');
          console.error(`Raw response that caused JSON error for ${endpoint}:`, text.substring(0, 500));
          throw new Error(`Failed to parse JSON response: ${jsonError.message}`);
        }
      } else {
        // Direct API call (not recommended for browser use due to CORS)
        const url = `${this.baseUrl}${endpoint}`;
        
        const defaultOptions: RequestInit = {
          headers: {
            'Accept': 'application/json, application/vnd.api+json',
            'Authorization': `Klaviyo-API-Key ${this.apiKey}`,
            'revision': '2023-10-15',
            'Content-Type': 'application/json',
          },
          ...options,
        };
        
        const response = await fetch(url, defaultOptions);
        
        // Check content type of response
        const contentType = response.headers.get('content-type');
        console.log(`Direct API response from ${endpoint} content type:`, contentType);
        
        // Accept both standard JSON and API JSON format
        if (!contentType || (!contentType.includes('json') && !contentType.includes('vnd.api+json'))) {
          const text = await response.text();
          console.error(`Non-JSON direct API response from ${endpoint}:`, text.substring(0, 500));
          throw new Error(`Invalid response: Expected JSON but got ${contentType || 'unknown'}`);
        }
        
        if (!response.ok) {
          try {
            const error = await response.json();
            const errorMessage = error.detail || error.message || response.statusText;
            const errorCode = response.status;
            throw new Error(`Klaviyo API Error: ${errorCode} - ${errorMessage}`);
          } catch (jsonError) {
            // If we can't parse the error as JSON, try to get the raw text
            const text = await response.clone().text().catch(() => 'Could not read response');
            console.error(`Error parsing direct API error response from ${endpoint}:`, text.substring(0, 500));
            throw new Error(`Klaviyo API Error: ${response.status} - Could not parse error response`);
          }
        }
        
        try {
          return await response.json() as T;
        } catch (jsonError) {
          console.error(`JSON parse error for direct API ${endpoint}:`, jsonError);
          const text = await response.clone().text().catch(() => 'Could not read response');
          console.error(`Raw direct API response that caused JSON error for ${endpoint}:`, text.substring(0, 500));
          throw new Error(`Failed to parse JSON response: ${jsonError.message}`);
        }
      }
    } catch (error) {
      // Add better error handling for network errors
      console.error("Klaviyo API error:", error);
      
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        throw new Error('Network error: Unable to connect to Klaviyo API. Please check your internet connection or verify that the proxy server is running.');
      }
      throw error;
    }
  }
  
  async testConnection() {
    try {
      console.log('Testing Klaviyo connection with API key:', this.apiKey.substring(0, 5) + '...');
      
      // Make direct API call to Klaviyo
      const response = await this.fetch('/accounts');
      
      console.log('Klaviyo connection test successful');
      return response;
    } catch (error) {
      console.error("Klaviyo connection test failed:", error);
      throw error;
    }
  }
  
  async getFlows(page?: number, pageSize = 50) {
    try {
      // Add delay to respect rate limits (3 per second, 60 per minute)
      await new Promise(resolve => setTimeout(resolve, 1000));
      return await this.fetch('/flows');
    } catch (error) {
      console.error("Error fetching Klaviyo flows:", error);
      throw error;
    }
  }
  
  async getFlowActions(flowId: string) {
    try {
      // Add delay to respect rate limits (3 per second, 60 per minute)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Validate flow ID format (should be alphanumeric)
      if (!/^[a-zA-Z0-9]+$/.test(flowId)) {
        console.warn(`[Klaviyo] Invalid flow ID format: ${flowId}. Flow ID should be alphanumeric.`);
        return { data: [] };
      }

      const response = await this.fetch(`/flows/${flowId}/flow-actions/`, {
        headers: {
          'Authorization': `Klaviyo-API-Key ${this.apiKey}`,
          'revision': '2023-10-15', // Updated to latest revision
          'Content-Type': 'application/json'
        }
      });

      if (!response || !response.data) {
        console.warn(`[Klaviyo] No flow actions found for flow ID: ${flowId}`);
        return { data: [] };
      }

      // Transform the response to match the expected format
      return {
        data: response.data.map((action: any) => ({
          id: action.id,
          type: action.type,
          attributes: {
            name: action.attributes?.name || 'Unnamed Action',
            action_type: action.attributes?.action_type || 'unknown',
            created: action.attributes?.created || new Date().toISOString(),
            updated: action.attributes?.updated || new Date().toISOString()
          }
        }))
      };
    } catch (error: any) {
      console.error(`[Klaviyo] Error fetching actions for flow ${flowId}:`, error);
      
      // Provide specific error message for 404 errors
      if (error.response?.status === 404 || (error.message && error.message.includes('404'))) {
        console.warn(`[Klaviyo] Flow not found (ID: ${flowId}) — it may have been deleted or the ID is incorrect`);
      }
      
      // Return empty data array instead of throwing to prevent sync process from crashing
      console.warn(`[Klaviyo] Returning empty result for flow ${flowId} due to error`);
      return { data: [] };
    }
  }
  
  async getFlowMessages(flowActionId: string) {
    try {
      // Validate action ID format (should be alphanumeric)
      if (!flowActionId || !/^[a-zA-Z0-9]+$/.test(flowActionId)) {
        const reason = "Invalid action ID format";
        console.warn(`[Klaviyo] Skipping flow action ${flowActionId}: ${reason}`);
        this.failedFlows.push({ flowActionId, reason });
        return { data: [] };
      }
      
      // Add delay to respect rate limits (3 per second, 60 per minute)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Use the new API endpoint format with include parameter
      const response = await this.fetch<any>(`/flow-actions/${flowActionId}?include=flow-message`, {
        headers: {
          'Accept': 'application/vnd.api+json',
          'revision': '2023-10-15',
        }
      });
      
      // Check if we have included flow-message objects
      if (response && response.included && Array.isArray(response.included)) {
        // Extract only the flow-message objects from the included array
        const flowMessages = response.included.filter((item: any) => 
          item && item.type === 'flow-message'
        );
        
        console.log(`[Klaviyo] Successfully extracted ${flowMessages.length} messages for flow action ${flowActionId}`);
        
        // Return in the format expected by the rest of the application
        return {
          data: flowMessages.map((message: any) => ({
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
    } catch (error: any) {
      // Determine reason based on error type
      let reason = "Unknown error";
      let status = 'unknown';
      
      if (error.response?.status === 404 || (error.message && error.message.includes('404'))) {
        reason = "Action not found (404)";
        status = 404;
      } else if (error.response?.status === 401 || error.response?.status === 403 || 
                (error.message && (error.message.includes('401') || error.message.includes('403')))) {
        reason = "Authentication or permission error";
        status = error.response?.status || (error.message.includes('401') ? 401 : 403);
      } else if (error.response?.status === 429 || (error.message && error.message.includes('429'))) {
        reason = "Rate limit exceeded";
        status = 429;
      } else if (error.message) {
        // Use error message but keep it concise
        reason = error.message.split('\n')[0].substring(0, 100);
      }
      
      // Log a simplified warning instead of full stack trace
      console.warn(`[Klaviyo] Skipping flow action ${flowActionId}: ${reason}`);
      
      // Track the failure
      this.failedFlows.push({ 
        flowActionId, 
        reason,
        status,
        timestamp: new Date().toISOString()
      });
      
      // Return empty data array instead of throwing to prevent sync process from crashing
      return { data: [] };
    }
  }
  
  async getMetrics() {
    try {
      // Add delay to respect rate limits (10 per second, 150 per minute)
      await new Promise(resolve => setTimeout(resolve, 600));
      return await this.fetch('/metrics');
    } catch (error) {
      console.error("Error fetching Klaviyo metrics:", error);
      throw error;
    }
  }
  
  async getMetricAggregate(metricId: string) {
    try {
      // Add delay to respect rate limits (3 per second, 60 per minute)
      await new Promise(resolve => setTimeout(resolve, 1000));
      return await this.fetch(`/metrics/${metricId}/aggregate`);
    } catch (error) {
      console.error(`Error fetching aggregate for metric ${metricId}:`, error);
      throw error;
    }
  }
  
  async queryMetricAggregate(payload: any) {
    try {
      console.log('Query metric aggregate payload:', JSON.stringify(payload));
      
      // Add delay to respect rate limits (3 per second, 60 per minute)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // When using the proxy, we don't need to stringify the body as it will be
      // stringified in the fetch method when sent to the proxy
      if (this.useProxy) {
        return await this.fetch('/metric-aggregates', {
          method: 'POST',
          body: payload
        });
      } else {
        return await this.fetch('/metric-aggregates', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }
    } catch (error) {
      console.error('Error querying metric aggregates:', error);
      console.error('Payload was:', JSON.stringify(payload));
      throw error;
    }
  }
}

export default KlaviyoApiClient;