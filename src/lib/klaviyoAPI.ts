// src/lib/klaviyoAPI.ts

// API client for Klaviyo API
interface KlaviyoApiOptions {
  apiKey: string;
  baseUrl?: string;
}

export class KlaviyoApiClient {
  private apiKey: string;
  private baseUrl: string;
  
  constructor({ apiKey, baseUrl = 'https://a.klaviyo.com/api' }: KlaviyoApiOptions) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }
  
  private async fetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
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
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const errorMessage = error.detail || error.message || response.statusText;
      const errorCode = response.status;
      throw new Error(`Klaviyo API Error: ${errorCode} - ${errorMessage}`);
    }
    
    return await response.json() as T;
  }
  
  async testConnection() {
    try {
      // Use our proxy API instead of calling Klaviyo directly
      const response = await fetch('/api/test-klaviyo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiKey: this.apiKey }),
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(`${response.status} - ${error.message || error.detail || response.statusText}`);
      }
      
      return await response.json();
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
      // Add delay to respect rate limits (3 per second, 60 per minute)
      await new Promise(resolve => setTimeout(resolve, 1000));
      return await this.fetch('/metric-aggregates', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    } catch (error) {
      console.error('Error querying metric aggregates:', error);
      throw error;
    }
  }
}

export default KlaviyoApiClient;