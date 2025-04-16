
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import AirtableApiClient from '@/lib/airtableAPI';

interface AirtableStatusProps {
  airtableApiKey: string;
  airtableBaseId: string;
}

const AirtableStatus = ({ airtableApiKey, airtableBaseId }: AirtableStatusProps) => {
  const [status, setStatus] = useState<'checking' | 'connected' | 'disconnected' | 'error'>('checking');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  useEffect(() => {
    const checkConnection = async () => {
      if (!airtableApiKey || !airtableBaseId) {
        setStatus('disconnected');
        return;
      }
      
      setStatus('checking');
      
      try {
        const airtableClient = new AirtableApiClient({ 
          apiKey: airtableApiKey, 
          baseId: airtableBaseId 
        });
        
        await airtableClient.testConnection();
        setStatus('connected');
        setErrorMessage(null);
      } catch (error) {
        setStatus('error');
        setErrorMessage(error instanceof Error ? error.message : 'Unknown error');
      }
    };
    
    checkConnection();
  }, [airtableApiKey, airtableBaseId]);
  
  const renderStatusContent = () => {
    switch (status) {
      case 'checking':
        return (
          <div className="flex items-center justify-center p-6">
            <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full" />
            <p className="ml-4 text-muted-foreground">Checking connection...</p>
          </div>
        );
      
      case 'connected':
        return (
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
            <h3 className="text-xl font-semibold text-green-600 mb-2">Connected</h3>
            <p className="text-sm text-muted-foreground">
              Successfully connected to Airtable
            </p>
          </div>
        );
      
      case 'disconnected':
        return (
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <AlertCircle className="h-12 w-12 text-amber-500 mb-4" />
            <h3 className="text-xl font-semibold text-amber-600 mb-2">Not Connected</h3>
            <p className="text-sm text-muted-foreground">
              Please configure your Airtable API Key and Base ID
            </p>
          </div>
        );
      
      case 'error':
        return (
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <XCircle className="h-12 w-12 text-red-500 mb-4" />
            <h3 className="text-xl font-semibold text-red-600 mb-2">Connection Error</h3>
            <p className="text-sm text-red-500 max-w-xs mx-auto">
              {errorMessage || 'Failed to connect to Airtable'}
            </p>
          </div>
        );
    }
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Airtable Connection Status</CardTitle>
        <CardDescription>
          Status of connection to your Airtable database
        </CardDescription>
      </CardHeader>
      <CardContent>
        {renderStatusContent()}
      </CardContent>
    </Card>
  );
};

export default AirtableStatus;
