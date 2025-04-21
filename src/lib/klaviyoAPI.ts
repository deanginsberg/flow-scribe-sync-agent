// src/lib/klaviyoAPI.ts

// API client for Klaviyo API
interface KlaviyoApiOptions {
  apiKey: string;
  baseUrl?: string;
  useProxy?: boolean;
}

export class KlaviyoApiClient {
  private apiKey: string;
  private baseUrl: string;
  private useProxy: boolean;
  
  constructor({ apiKey, baseUrl = 'https://a.klaviyo.com/api', useProxy = true }: KlaviyoApiOptions) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.useProxy = useProxy;
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
        
        // If not JSON, handle differently
        if (!contentType || !contentType.includes('application/json')) {
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
            'Accept': 'application/json',
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
        
        // If not JSON, handle differently
        if (!contentType || !contentType.includes('application/json')) {
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
      
      // Use our proxy API instead of calling Klaviyo directly
      const response = await fetch('/api/test-klaviyo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiKey: this.apiKey }),
      });
      
      // Check content type of response to help with debugging
      const contentType = response.headers.get('content-type');
      console.log('Response content type:', contentType);
      
      // If not JSON, handle differently
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response received:', text.substring(0, 500));
        throw new Error(`Invalid response: Expected JSON but got ${contentType || 'unknown'}`);
      }
      
      try {
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(`${response.status} - ${data.message || data.error || data.detail || response.statusText}`);
        }
        
        return data;
      } catch (jsonError) {
        console.error('JSON parse error:', jsonError);
        
        if (jsonError.message.includes('Unexpected end of JSON input')) {
          // Try to get the raw response again to see what's happening
          const retryText = await response.clone().text().catch(() => 'Could not read response');
          console.error('Raw response that caused JSON error:', retryText.substring(0, 500));
          throw new Error(`JSON parse error: ${jsonError.message}. Check API endpoint configuration.`);
        }
        
        throw jsonError;
      }
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
      return await this.fetch(`/flows/${flowId}/actions`);
    } catch (error) {
      console.error(`Error fetching actions for flow ${flowId}:`, error);
      throw error;
    }
  }
  
  async getFlowMessages(flowActionId: string) {
    try {
      // Add delay to respect rate limits (3 per second, 60 per minute)
      await new Promise(resolve => setTimeout(resolve, 1000));
      return await this.fetch(`/flow-actions/${flowActionId}/messages`);
    } catch (error) {
      console.error(`Error fetching messages for flow action ${flowActionId}:`, error);
      throw error;
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