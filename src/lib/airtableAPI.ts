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
    try {
      console.log(`[Airtable] Making request to: ${this.baseUrl}/${path}`);
      if (options.body) {
        // Log request body size, not content (to avoid cluttering logs)
        const bodySize = options.body ? (options.body as string).length : 0;
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
              const body = JSON.parse(options.body as string);
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
        return JSON.parse(responseText) as T;
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

  // ---------------------------------------------------------------------------
  //  Public helpers

  async testConnection(): Promise<boolean> {
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
    if (!rows || !Array.isArray(rows)) {
      console.error('[Airtable] createRecords called with invalid rows:', rows);
      throw new Error('Invalid records data: rows must be an array');
    }
    
    if (rows.length === 0) {
      console.log('[Airtable] createRecords called with empty array, returning empty result');
      return { records: [] };
    }
    
    console.log(`[Airtable] Creating ${rows.length} records in table '${table}' with batch size ${AirtableApiClient.BATCH_SIZE}`);
    
    const all: any[] = [];
    const failedBatches: { batchIndex: number, error: any }[] = [];

    for (let i = 0; i < rows.length; i += AirtableApiClient.BATCH_SIZE) {
      const batchIndex = Math.floor(i / AirtableApiClient.BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(rows.length / AirtableApiClient.BATCH_SIZE);
      const batchItems = rows.slice(i, i + AirtableApiClient.BATCH_SIZE);
      
      try {
        // Check if any items in the batch are null or undefined
        const invalidItems = batchItems.filter(item => !item || typeof item !== 'object');
        if (invalidItems.length > 0) {
          console.error(`[Airtable] Invalid items in batch ${batchIndex}:`, invalidItems);
          throw new Error(`Batch contains ${invalidItems.length} invalid items`);
        }
        
        const batch = batchItems.map(r => ({ fields: this.sanitiseCreateRow(r) }));

        console.log(`[Airtable] Processing batch ${batchIndex}/${totalBatches} – ${batch.length} records`);

        // Validate the batch to ensure it's properly formatted
        for (const record of batch) {
          if (!record.fields || typeof record.fields !== 'object') {
            console.error(`[Airtable] Invalid record format in batch ${batchIndex}:`, record);
            throw new Error('Record is missing fields object or fields is not an object');
          }
        }

        const res = await this.request<{ records: any[] }>(table, {
          method: 'POST',
          body: JSON.stringify({ records: batch }),
        });

        console.log(`[Airtable] Batch ${batchIndex}/${totalBatches} succeeded with ${res.records.length} records`);
        all.push(...res.records);

        if (i + AirtableApiClient.BATCH_SIZE < rows.length) {
          const delay = AirtableApiClient.DELAY_MS;
          console.log(`[Airtable] Waiting ${delay}ms before next batch`);
          await new Promise(r => setTimeout(r, delay));
        }
      } catch (error) {
        console.error(`[Airtable] Error creating batch ${batchIndex}/${totalBatches}:`, error);
        
        try {
          // Log a sample of the batch data without logging everything
          const batchSample = batchItems.slice(0, 2).map(item => {
            // Create a simplified version to avoid huge logs
            const keys = Object.keys(item);
            return {
              numKeys: keys.length,
              keyNames: keys.slice(0, 5), // First 5 keys
              sample: keys.length > 0 ? item[keys[0]] : null
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

    console.log(`[Airtable] Successfully created all ${rows.length} records in ${Math.ceil(rows.length / AirtableApiClient.BATCH_SIZE)} batches`);
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
    if (!rows || !Array.isArray(rows)) {
      console.error('[Airtable] updateRecords called with invalid rows:', rows);
      throw new Error('Invalid records data: rows must be an array');
    }
    
    if (rows.length === 0) {
      console.log('[Airtable] updateRecords called with empty array, returning empty result');
      return { records: [] };
    }
    
    console.log(`[Airtable] Updating ${rows.length} records in table '${table}' with batch size ${AirtableApiClient.BATCH_SIZE}`);
    
    const all: any[] = [];
    const failedBatches: { batchIndex: number, error: any }[] = [];

    for (let i = 0; i < rows.length; i += AirtableApiClient.BATCH_SIZE) {
      const batchIndex = Math.floor(i / AirtableApiClient.BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(rows.length / AirtableApiClient.BATCH_SIZE);
      const batchItems = rows.slice(i, i + AirtableApiClient.BATCH_SIZE);
      
      try {
        // Validate each record has an ID
        const missingIds = batchItems.filter(item => !item || !item.id);
        if (missingIds.length > 0) {
          console.error(`[Airtable] Records missing 'id' in batch ${batchIndex}:`, missingIds);
          throw new Error(`Batch contains ${missingIds.length} records missing ID`);
        }
        
        const batch = batchItems.map(r => this.sanitiseUpdateRow(r));

        console.log(`[Airtable] Processing update batch ${batchIndex}/${totalBatches} – ${batch.length} records`);

        // Validate the batch format
        for (const record of batch) {
          if (!record.id) {
            console.error(`[Airtable] Record missing ID in batch ${batchIndex}:`, record);
            throw new Error('Record is missing ID');
          }
          if (!record.fields || typeof record.fields !== 'object') {
            console.error(`[Airtable] Invalid record format in batch ${batchIndex}:`, record);
            throw new Error('Record is missing fields object or fields is not an object');
          }
        }

        const res = await this.request<{ records: any[] }>(table, {
          method: 'PATCH',
          body: JSON.stringify({ records: batch }),
        });

        console.log(`[Airtable] Update batch ${batchIndex}/${totalBatches} succeeded with ${res.records.length} records`);
        all.push(...res.records);

        if (i + AirtableApiClient.BATCH_SIZE < rows.length) {
          const delay = AirtableApiClient.DELAY_MS;
          console.log(`[Airtable] Waiting ${delay}ms before next batch`);
          await new Promise(r => setTimeout(r, delay));
        }
      } catch (error) {
        console.error(`[Airtable] Error updating batch ${batchIndex}/${totalBatches}:`, error);
        
        try {
          // Log a sample of the batch data (IDs only to avoid huge logs)
          const idSample = batchItems.slice(0, 5).map(item => item?.id || 'missing-id');
          console.error(`[Airtable] Batch ID sample: ${JSON.stringify(idSample)}`);
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
      const errorMessage = `${failedBatches.length} batch(es) failed during update`;
      console.error(`[Airtable] ${errorMessage}`);
      throw new Error(errorMessage);
    }

    console.log(`[Airtable] Successfully updated all ${rows.length} records in ${Math.ceil(rows.length / AirtableApiClient.BATCH_SIZE)} batches`);
    return { records: all };
  }
}

export default AirtableApiClient;
