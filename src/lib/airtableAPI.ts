
// API client for Airtable API

interface AirtableApiOptions {
  apiKey: string;
  baseId: string;
}

export class AirtableApiClient {
  private apiKey: string;
  private baseId: string;
  private baseUrl: string = 'https://api.airtable.com/v0';

  constructor({ apiKey, baseId }: AirtableApiOptions) {
    this.apiKey = apiKey;
    this.baseId = baseId;
  }

  private async fetch<T>(tableName: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}/${this.baseId}/${tableName}`;
    
    const defaultOptions: RequestInit = {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      ...options,
    };

    const response = await fetch(url, defaultOptions);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const errorMessage = error.error?.message || response.statusText;
      const errorCode = response.status;
      throw new Error(`Airtable API Error: ${errorCode} - ${errorMessage}`);
    }

    return await response.json() as T;
  }

  async testConnection() {
    try {
      // Try to get metadata from the base to test connection
      const response = await fetch(`${this.baseUrl}/${this.baseId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(`${response.status} - ${error.error?.message || response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Airtable connection test failed:", error);
      throw error;
    }
  }

  async createRecords(tableName: string, records: any[]) {
    try {
      // In a production environment, we'd want to handle batching for large record sets
      const payload = {
        records: records.map(record => ({ fields: record }))
      };

      return await this.fetch(tableName, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    } catch (error) {
      console.error(`Error creating records in ${tableName}:`, error);
      throw error;
    }
  }

  async updateRecords(tableName: string, records: any[]) {
    try {
      const payload = {
        records: records.map(record => ({
          id: record.id,
          fields: record.fields
        }))
      };

      return await this.fetch(tableName, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
    } catch (error) {
      console.error(`Error updating records in ${tableName}:`, error);
      throw error;
    }
  }

  async getRecords(tableName: string, params: any = {}) {
    try {
      // Build query string from params
      const queryParams = new URLSearchParams();
      
      if (params.maxRecords) {
        queryParams.append('maxRecords', params.maxRecords.toString());
      }
      
      if (params.view) {
        queryParams.append('view', params.view);
      }
      
      if (params.filterByFormula) {
        queryParams.append('filterByFormula', params.filterByFormula);
      }

      const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
      
      return await this.fetch(`${tableName}${queryString}`);
    } catch (error) {
      console.error(`Error fetching records from ${tableName}:`, error);
      throw error;
    }
  }
}

export default AirtableApiClient;
