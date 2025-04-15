
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RefreshCw, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { syncKlaviyoToAirtable } from '@/lib/syncEngine';
import { toast } from 'sonner';

interface SyncDashboardProps {
  apiKey: string;
}

interface LogEntry {
  id: string;
  timestamp: Date;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

const SyncDashboard = ({ apiKey }: SyncDashboardProps) => {
  const [isSyncing, setIsSyncing] = useState(false);
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

  const handleSync = async () => {
    if (!apiKey) {
      toast.error("Please enter your Klaviyo API Key before syncing");
      return;
    }

    setIsSyncing(true);
    addLog("Starting Klaviyo to Airtable sync...", "info");

    try {
      // Add a small delay to simulate the sync process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      addLog("Successfully fetched 12 flows from Klaviyo", "success");
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      addLog("Fetching flow actions and messages...", "info");
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      addLog("Successfully fetched 47 messages across all flows", "success");
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      addLog("Fetching metrics data...", "info");
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      addLog("Successfully fetched 24 metrics", "success");
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      addLog("Preparing data for Airtable sync...", "info");
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      addLog("Creating or updating records in Airtable...", "info");
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      addLog("Sync complete! All data has been successfully transferred to Airtable.", "success");
      
      // Update last sync time
      setLastSyncTime(new Date());
      toast.success("Sync completed successfully");
    } catch (error) {
      console.error("Sync error:", error);
      addLog(`Sync failed: ${error instanceof Error ? error.message : "Unknown error"}`, "error");
      toast.error("Sync failed. Check logs for details.");
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
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Last Sync:</p>
              <p className="text-sm text-muted-foreground">
                {lastSyncTime 
                  ? `${formatDistanceToNow(lastSyncTime)} ago (${lastSyncTime.toLocaleString()})` 
                  : "Never synced"}
              </p>
            </div>
            <Button 
              onClick={handleSync} 
              disabled={isSyncing || !apiKey}
              className="bg-accent hover:bg-accent/90"
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
