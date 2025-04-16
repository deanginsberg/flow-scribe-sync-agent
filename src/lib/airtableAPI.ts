// lib/airtableAPI.ts

interface AirtableApiOptions {
  apiKey: string;
  baseId: string;
}

export class AirtableApiClient {
  private token: string;
  private baseId: string;
  private baseUrl: string;

  constructor({ apiKey, baseId }: AirtableApiOptions) {
    this.token = apiKey;
    this.baseId = baseId;
    this.baseUrl = `https://api.airtable.com/v0/${this.baseId}`;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}/${path}`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      ...options,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const message = error?.error?.message || response.statusText;
      throw new Error(`Airtable API Error: ${response.status} - ${message}`);
    }

    return await response.json() as T;
  }

  async testConnection(): Promise<boolean> {
    try {
      // Safely test by listing a few records from a known table
      await this.request<{ records: unknown[] }>('Flows?maxRecords=1');
      return true;
    } catch (error) {
      console.error("Airtable test connection failed:", error);
      throw error;
    }
  }

  async getRecords(tableName: string, params: { maxRecords?: number; view?: string; filterByFormula?: string } = {}) {
    const query = new URLSearchParams();
    if (params.maxRecords) query.set('maxRecords', params.maxRecords.toString());
    if (params.view) query.set('view', params.view);
    if (params.filterByFormula) query.set('filterByFormula', params.filterByFormula);

    const path = `${tableName}${query.toString() ? `?${query.toString()}` : ''}`;
    return this.request<{ records: any[] }>(path);
  }

  async createRecords(tableName: string, records: Record<string, any>[]) {
    const payload = {
      records: records.map(fields => ({ fields })),
    };

    return this.request<{ records: any[] }>(tableName, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateRecords(tableName: string, records: { id: string; fields: Record<string, any> }[]) {
    const payload = {
      records,
    };

    return this.request<{ records: any[] }>(tableName, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }
}

export default AirtableApiClient;
