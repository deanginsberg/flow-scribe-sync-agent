
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CircleOff } from 'lucide-react';

const DataSummary = () => {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Data Summary</CardTitle>
        <CardDescription>
          Overview of synchronized Klaviyo data
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground text-center">
          <CircleOff className="h-12 w-12 mb-4 opacity-30" />
          <p className="text-lg font-medium">No data synced yet</p>
          <p className="text-sm max-w-xs mt-2">
            Use the Sync Control Panel to import your Klaviyo data into Airtable
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default DataSummary;
