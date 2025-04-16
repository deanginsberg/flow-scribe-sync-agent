
import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff, Database } from 'lucide-react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { AirtableApiClient } from '@/lib/airtableAPI';

interface AirtableConfigProps {
  airtableApiKey: string;
  airtableBaseId: string;
  setAirtableApiKey: (key: string) => void;
  setAirtableBaseId: (baseId: string) => void;
  onSave: () => void;
}

const AirtableConfig = ({ 
  airtableApiKey, 
  airtableBaseId, 
  setAirtableApiKey, 
  setAirtableBaseId, 
  onSave 
}: AirtableConfigProps) => {
  const [showKey, setShowKey] = useState(false);
  const [tempApiKey, setTempApiKey] = useState(airtableApiKey);
  const [tempBaseId, setTempBaseId] = useState(airtableBaseId);
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  const handleSave = () => {
    setAirtableApiKey(tempApiKey);
    setAirtableBaseId(tempBaseId);
    onSave();
    toast.success("Airtable configuration saved");
  };

  const testConnection = async () => {
    if (!tempApiKey || !tempBaseId) {
      toast.error("Please enter both Airtable API Key and Base ID");
      return;
    }

    setIsTestingConnection(true);
    try {
      const airtableClient = new AirtableApiClient({ 
        apiKey: tempApiKey, 
        baseId: tempBaseId 
      });
      
      // Try to get a test record to verify connection
      await airtableClient.testConnection();
      toast.success("Successfully connected to Airtable");
    } catch (error) {
      console.error("Airtable connection error:", error);
      if (error instanceof Error) {
        if (error.message.includes("401")) {
          toast.error("Invalid Airtable API Key");
        } else if (error.message.includes("404")) {
          toast.error("Invalid Airtable Base ID");
        } else {
          toast.error(`Airtable connection error: ${error.message}`);
        }
      } else {
        toast.error("Unknown error connecting to Airtable");
      }
    } finally {
      setIsTestingConnection(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Database className="mr-2 h-5 w-5" /> Airtable Configuration
        </CardTitle>
        <CardDescription>
          Enter your Airtable API Key and Base ID to enable data synchronization
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Label htmlFor="airtableApiKey">Airtable API Key</Label>
          <div className="flex mt-1.5 relative">
            <Input
              id="airtableApiKey"
              type={showKey ? "text" : "password"} 
              value={tempApiKey}
              onChange={(e) => setTempApiKey(e.target.value)}
              placeholder="key********************"
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full"
              onClick={() => setShowKey(!showKey)}
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            Obtain from Airtable &gt; Account &gt; API
          </p>
        </div>

        <div className="relative">
          <Label htmlFor="airtableBaseId">Airtable Base ID</Label>
          <Input
            id="airtableBaseId"
            type="text" 
            value={tempBaseId}
            onChange={(e) => setTempBaseId(e.target.value)}
            placeholder="app***********"
            className="mt-1.5"
          />
          <p className="text-xs text-muted-foreground mt-1.5">
            Found in your Airtable base URL: airtable.com/{'{base-id}'}
          </p>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col space-y-3 sm:flex-row sm:justify-between sm:space-y-0">
        <Button 
          onClick={testConnection} 
          variant="outline"
          disabled={isTestingConnection || !tempApiKey || !tempBaseId}
          className="w-full sm:w-auto"
        >
          {isTestingConnection ? "Testing..." : "Test Connection"}
        </Button>
        <Button 
          onClick={handleSave} 
          className="w-full sm:w-auto" 
          disabled={!tempApiKey || !tempBaseId || tempApiKey.length < 10}
        >
          Save Configuration
        </Button>
      </CardFooter>
    </Card>
  );
};

export default AirtableConfig;
