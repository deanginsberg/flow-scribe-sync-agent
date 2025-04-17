import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RefreshCw, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { syncKlaviyoToAirtable } from '@/lib/syncEngine';
import { toast } from 'sonner';
import KlaviyoApiClient from '@/lib/klaviyoAPI';
import AirtableApiClient from '@/lib/airtableAPI';

interface SyncDashboardProps {
  klaviyoApiKey: string;
  airtableApiKey: string;
  airtableBaseId: string;
}

interface LogEntry {
  id: string;
  timestamp: Date;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

const SyncDashboard = ({ klaviyoApiKey, airtableApiKey, airtableBaseId }: SyncDashboardProps) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isTestingKlaviyo, setIsTestingKlaviyo] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const addLog = (message: string, type: 'info' | 'success' | 'error' | 'warning') => {
    const newLog: LogEntry = {
      id: Date.now().toString(),
      timestamp: new Date(),
      message,
      type,
    };
    setLogs(prev => [newLog, ...prev]);
  };

  const testKlaviyoConnection = async () => {
    if (!klaviyoApiKey) {
      toast.error("Please enter your Klaviyo API Key before testing");
      return;
    }

    setIsTestingKlaviyo(true);
    addLog("Testing Klaviyo API connection...", "info");

    try {
      const response = await fetch('/api/test-klaviyo', { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiKey: klaviyoApiKey,
        }),
      });

                
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Unknown error');
      }
      
      console.log('Klaviyo connection test response:', data);
      
      addLog("Klaviyo API connection successful", "success");
      toast.success("Successfully connected to Klaviyo API");
    } catch (error) {
      console.error("Klaviyo connection error:", error);
      
      if (error instanceof Error) {
        addLog(`Klaviyo connection error: ${error.message}`, "error");
        toast.error(`Klaviyo connection error: ${error.message}`);
      } else {
        addLog("Unknown error connecting to Klaviyo", "error");
        toast.error("Unknown error connecting to Klaviyo");
      }
    } finally {
      setIsTestingKlaviyo(false);
    }
  };

  const handleSync = async () => {
    if (!klaviyoApiKey) {
      toast.error("Please enter your Klaviyo API Key before syncing");
      return;
    }

    if (!airtableApiKey || !airtableBaseId) {
      toast.error("Please configure your Airtable API Key and Base ID before syncing");
      return;
    }

    setIsSyncing(true);
    addLog("Starting Klaviyo to Airtable sync...", "info");

    try {
      const klaviyoClient = new KlaviyoApiClient({ apiKey: klaviyoApiKey });
      const airtableClient = new AirtableApiClient({ 
        apiKey: airtableApiKey, 
        baseId: airtableBaseId 
      });

      addLog("Verifying Klaviyo API connection...", "info");
      await klaviyoClient.testConnection();
      addLog("Klaviyo API connection verified", "success");

      addLog("Verifying Airtable API connection...", "info");
      await airtableClient.testConnection();
      addLog("Airtable API connection verified", "success");

      addLog("Fetching data from Klaviyo...", "info");
      
      await syncKlaviyoToAirtable(klaviyoApiKey, airtableApiKey, airtableBaseId);
      
      setLastSyncTime(new Date());
      addLog("Sync complete! All data has been successfully transferred to Airtable.", "success");
      toast.success("Sync completed successfully");
    } catch (error) {
      console.error("Sync error:", error);
      
      if (error instanceof Error) {
        addLog(`Sync failed: ${error.message}`, "error");
        toast.error(`Sync failed: ${error.message}`);
      } else {
        addLog("Sync failed: Unknown error", "error");
        toast.error("Sync failed. Check logs for details.");
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const getSyncStatusBadge = () => {
    if (isSyncing) {
      return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300 flex items-center gap-1">
        <RefreshCw className="h-3 w-3 animate-spin" /> Syncing...
      </Badge>;
    }
    
    if (!lastSyncTime) {
      return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-300">Never Synced</Badge>;
    }
    
    return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300 flex items-center gap-1">
      <CheckCircle className="h-3 w-3" /> Synced
    </Badge>;
  };

  const getLogIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-500 flex-shrink-0" />;
      default:
        return <RefreshCw className="h-4 w-4 text-blue-500 flex-shrink-0" />;
    }
  };

  const isSyncButtonDisabled = isSyncing || !klaviyoApiKey || !airtableApiKey || !airtableBaseId;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Sync Control Panel</CardTitle>
            {getSyncStatusBadge()}
          </div>
          <CardDescription>
            Manually trigger a sync between Klaviyo and Airtable
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Last Sync:</p>
                <p className="text-sm text-muted-foreground">
                  {lastSyncTime 
                    ? `${formatDistanceToNow(lastSyncTime)} ago (${lastSyncTime.toLocaleString()})` 
                    : "Never synced"}
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-2">
                <Button 
                  onClick={testKlaviyoConnection} 
                  variant="outline"
                  disabled={isTestingKlaviyo || !klaviyoApiKey}
                  className="whitespace-nowrap"
                >
                  {isTestingKlaviyo ? "Testing..." : "Test Klaviyo Connection"}
                </Button>
                
                <Button 
                  onClick={handleSync} 
                  disabled={isSyncButtonDisabled}
                  className="bg-accent hover:bg-accent/90 whitespace-nowrap"
                >
                  {isSyncing ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Sync Now
                    </>
                  )}
                </Button>
              </div>
            </div>
            
            {isSyncButtonDisabled && !isSyncing && (
              <div className="text-sm text-amber-500 bg-amber-50 p-2 rounded border border-amber-200">
                <AlertCircle className="inline-block h-4 w-4 mr-1 mb-0.5" />
                {!klaviyoApiKey 
                  ? "Enter Klaviyo API Key to enable sync" 
                  : (!airtableApiKey || !airtableBaseId) 
                    ? "Complete Airtable configuration to enable sync" 
                    : ""}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sync Logs</CardTitle>
          <CardDescription>
            View the history of sync operations and any errors encountered
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[240px] rounded-md border">
            {logs.length > 0 ? (
              <div className="p-4 space-y-3">
                {logs.map((log) => (
                  <div key={log.id} className="flex items-start gap-2 text-sm">
                    {getLogIcon(log.type)}
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <span className={`font-medium ${
                          log.type === 'error' ? 'text-red-700' : 
                          log.type === 'warning' ? 'text-yellow-700' : 
                          log.type === 'success' ? 'text-green-700' : 
                          'text-gray-700'
                        }`}>
                          {log.message}
                        </span>
                        <span className="text-xs text-gray-500">
                          {log.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No sync logs yet. Start a sync to see activity here.
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default SyncDashboard;
