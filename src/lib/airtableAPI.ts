// lib/airtableAPI.ts
// -----------------------------------------------------------------------------
//  Airtable helper with automatic 10‑record batching, rate‑limit padding and
//  *safe* record‑shaping so the API never sees an unexpected "fields" column.
// -----------------------------------------------------------------------------

interface AirtableApiOptions {
  apiKey: string;
  baseId: string;
}

/**
 * The public methods you will typically call are:
 *   • testConnection()
 *   • getRecords(table, params?)            – thin wrapper around list endpoint
 *   • createRecords(table, rows[])          – rows **without** id / fields
 *   • updateRecords(table, rowsWithId[])    – objects that include id + columns
 */
export class AirtableApiClient {
  private token: string;
  private baseId: string;
  private baseUrl: string;
  private static readonly BATCH_SIZE = 10;
  private static readonly DELAY_MS   = 120; // small cushion < 5 req/s

  constructor({ apiKey, baseId }: AirtableApiOptions) {
    this.token   = apiKey;
    this.baseId  = baseId;
    this.baseUrl = `https://api.airtable.com/v0/${this.baseId}`;
  }

  // ---------------------------------------------------------------------------
  //  Low‑level fetch helper
  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.baseUrl}/${path}`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      ...options,
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const msg = errBody?.error?.message || res.statusText;
      throw new Error(`Airtable API Error: ${res.status} – ${msg}`);
    }

    return (await res.json()) as T;
  }

  // ---------------------------------------------------------------------------
  //  Public helpers

  async testConnection(): Promise<boolean> {
    // list a single record from any known table (Flows is fine)
    await this.request('Flows?maxRecords=1');
    return true;
  }

  async getRecords(
    table: string,
    params: { maxRecords?: number; view?: string; filterByFormula?: string } = {}
  ) {
    const qs = new URLSearchParams();
    if (params.maxRecords) qs.set('maxRecords', params.maxRecords.toString());
    if (params.view)       qs.set('view', params.view);
    if (params.filterByFormula) qs.set('filterByFormula', params.filterByFormula);

    const path = `${table}${qs.toString() ? `?${qs.toString()}` : ''}`;
    return this.request<{ records: any[] }>(path);
  }

  // ---------------------------------------------------------------------------
  //  CREATE helpers -----------------------------------------------------------

  private sanitiseCreateRow(row: Record<string, any>): Record<string, any> {
    // Strip properties Airtable wouldn't expect inside "fields"
    const clone = { ...row };
    delete (clone as any).id;
    delete (clone as any).fields; // <- prevents "Unknown field name: fields"
    return clone;
  }

  async createRecords(table: string, rows: Record<string, any>[]) {
    const all: any[] = [];

    for (let i = 0; i < rows.length; i += AirtableApiClient.BATCH_SIZE) {
      const batch = rows
        .slice(i, i + AirtableApiClient.BATCH_SIZE)
        .map(r => ({ fields: this.sanitiseCreateRow(r) }));

      console.log(`[Airtable] create batch ${Math.floor(i / AirtableApiClient.BATCH_SIZE) + 1}/${Math.ceil(rows.length / AirtableApiClient.BATCH_SIZE)} – ${batch.length} records`);

      try {
        const res = await this.request<{ records: any[] }>(table, {
          method: 'POST',
          body: JSON.stringify({ records: batch }),
        });

        all.push(...res.records);

        if (i + AirtableApiClient.BATCH_SIZE < rows.length) {
          await new Promise(r => setTimeout(r, AirtableApiClient.DELAY_MS));
        }
      } catch (error) {
        console.error('Error creating batch:', error);
        console.error('Batch data:', JSON.stringify(batch, null, 2));
        throw error;
      }
    }

    return { records: all };
  }

  // ---------------------------------------------------------------------------
  //  UPDATE helpers -----------------------------------------------------------

  private sanitiseUpdateRow(row: { id: string } & Record<string, any>) {
    const { id, fields, ...rest } = row as any;
    // if caller already supplied "fields", keep it, otherwise use rest
    return fields ? { id, fields } : { id, fields: rest };
  }

  async updateRecords(table: string, rows: { id: string } & Record<string, any>[]) {
    const all: any[] = [];

    for (let i = 0; i < rows.length; i += AirtableApiClient.BATCH_SIZE) {
      const batch = rows
        .slice(i, i + AirtableApiClient.BATCH_SIZE)
        .map(r => this.sanitiseUpdateRow(r));

      console.log(`[Airtable] update batch ${Math.floor(i / AirtableApiClient.BATCH_SIZE) + 1}/${Math.ceil(rows.length / AirtableApiClient.BATCH_SIZE)} – ${batch.length} records`);

      try {
        const res = await this.request<{ records: any[] }>(table, {
          method: 'PATCH',
          body: JSON.stringify({ records: batch }),
        });

        all.push(...res.records);

        if (i + AirtableApiClient.BATCH_SIZE < rows.length) {
          await new Promise(r => setTimeout(r, AirtableApiClient.DELAY_MS));
        }
      } catch (error) {
        console.error('Error updating batch:', error);
        console.error('Batch data:', JSON.stringify(batch, null, 2));
        throw error;
      }
    }

    return { records: all };
  }
}

export default AirtableApiClient;
