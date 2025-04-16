
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CircleOff, Database, BarChart4 } from 'lucide-react';
import AirtableApiClient from '@/lib/airtableAPI';

interface DataSummaryProps {
  airtableApiKey: string;
  airtableBaseId: string;
}

interface DataCounts {
  flows: number;
  messages: number;
  metrics: number;
  lastUpdated: Date | null;
}

// Define a type for Airtable API responses
interface AirtableResponse {
  records: Array<any>;
}

const DataSummary = ({ airtableApiKey, airtableBaseId }: DataSummaryProps) => {
  const [dataCounts, setDataCounts] = useState<DataCounts>({
    flows: 0,
    messages: 0,
    metrics: 0,
    lastUpdated: null
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDataCounts = async () => {
      if (!airtableApiKey || !airtableBaseId) {
        setError(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const airtableClient = new AirtableApiClient({ 
          apiKey: airtableApiKey, 
          baseId: airtableBaseId 
        });

        // Get counts from each table
        const flowsResponse = await airtableClient.getRecords('Flows', { maxRecords: 1 })
          .catch(() => ({ records: [] })) as AirtableResponse;
        
        const messagesResponse = await airtableClient.getRecords('Flow Messages', { maxRecords: 1 })
          .catch(() => ({ records: [] })) as AirtableResponse;
        
        const metricsResponse = await airtableClient.getRecords('Metrics', { maxRecords: 1 })
          .catch(() => ({ records: [] })) as AirtableResponse;

        // Update the data counts
        setDataCounts({
          flows: flowsResponse.records.length,
          messages: messagesResponse.records.length,
          metrics: metricsResponse.records.length,
          lastUpdated: new Date()
        });
      } catch (err) {
        console.error("Error fetching data counts:", err);
        setError(err instanceof Error ? err.message : "Unknown error fetching data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDataCounts();
  }, [airtableApiKey, airtableBaseId]);

  const hasData = dataCounts.flows > 0 || dataCounts.messages > 0 || dataCounts.metrics > 0;
  const hasCredentials = airtableApiKey && airtableBaseId;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center">
          <BarChart4 className="mr-2 h-5 w-5" /> Data Summary
        </CardTitle>
        <CardDescription>
          Overview of synchronized Klaviyo data
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground text-center">
            <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mb-4" />
            <p className="text-lg font-medium">Loading data...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 text-red-500 text-center">
            <CircleOff className="h-12 w-12 mb-4 opacity-30" />
            <p className="text-lg font-medium">Error loading data</p>
            <p className="text-sm max-w-xs mt-2">{error}</p>
          </div>
        ) : !hasCredentials ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground text-center">
            <Database className="h-12 w-12 mb-4 opacity-30" />
            <p className="text-lg font-medium">No Airtable connection</p>
            <p className="text-sm max-w-xs mt-2">
              Configure your Airtable API Key and Base ID to view data statistics
            </p>
          </div>
        ) : !hasData ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground text-center">
            <CircleOff className="h-12 w-12 mb-4 opacity-30" />
            <p className="text-lg font-medium">No data synced yet</p>
            <p className="text-sm max-w-xs mt-2">
              Use the Sync Control Panel to import your Klaviyo data into Airtable
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg text-center">
              <p className="text-2xl font-bold text-primary">{dataCounts.flows}</p>
              <p className="text-sm text-gray-500">Flows</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg text-center">
              <p className="text-2xl font-bold text-primary">{dataCounts.messages}</p>
              <p className="text-sm text-gray-500">Messages</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg text-center">
              <p className="text-2xl font-bold text-primary">{dataCounts.metrics}</p>
              <p className="text-sm text-gray-500">Metrics</p>
            </div>
            {dataCounts.lastUpdated && (
              <div className="col-span-3 text-center text-xs text-muted-foreground mt-2">
                Last updated: {dataCounts.lastUpdated.toLocaleString()}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DataSummary;
