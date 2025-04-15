
import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff, Key } from 'lucide-react';
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

interface ApiKeyInputProps {
  apiKey: string;
  setApiKey: (key: string) => void;
  onSave: () => void;
}

const ApiKeyInput = ({ apiKey, setApiKey, onSave }: ApiKeyInputProps) => {
  const [showKey, setShowKey] = useState(false);
  const [tempKey, setTempKey] = useState(apiKey);

  const handleSave = () => {
    setApiKey(tempKey);
    onSave();
    toast.success("API Key saved");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Key className="mr-2 h-5 w-5" /> Klaviyo API Configuration
        </CardTitle>
        <CardDescription>
          Enter your Klaviyo Private API Key to enable data synchronization
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <Label htmlFor="apiKey">Private API Key</Label>
          <div className="flex mt-1.5 relative">
            <Input
              id="apiKey"
              type={showKey ? "text" : "password"} 
              value={tempKey}
              onChange={(e) => setTempKey(e.target.value)}
              placeholder="pk_**************************************"
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
            Obtain from Klaviyo &gt; Account &gt; Settings &gt; API Keys
          </p>
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          onClick={handleSave} 
          className="w-full" 
          disabled={!tempKey || tempKey.length < 10}
        >
          Save API Key
        </Button>
      </CardFooter>
    </Card>
  );
};

export default ApiKeyInput;
