
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Database, MessageSquare, BarChart } from 'lucide-react';

const AirtableStatus = () => {
  const tables = [
    {
      id: 1,
      name: 'Flows',
      icon: <Database className="h-4 w-4 text-primary" />,
      recordCount: 0,
      lastUpdated: null,
      fields: ['Flow ID', 'Flow Name', 'Status', 'Trigger Type', 'Created Date', 'Updated Date', 'Archived']
    },
    {
      id: 2,
      name: 'Flow Messages',
      icon: <MessageSquare className="h-4 w-4 text-primary" />,
      recordCount: 0,
      lastUpdated: null,
      fields: ['Message ID', 'Linked Flow ID', 'Name', 'Channel', 'Subject Line', 'Status', 'Created Date', 'Updated Date']
    },
    {
      id: 3,
      name: 'Metrics',
      icon: <BarChart className="h-4 w-4 text-primary" />,
      recordCount: 0,
      lastUpdated: null,
      fields: ['Metric ID', 'Name', 'Integration Name', 'Created Date', 'Updated Date']
    }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Airtable Tables Schema</CardTitle>
        <CardDescription>
          Data structure for Klaviyo information in Airtable
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {tables.map((table) => (
            <div key={table.id} className="border rounded-md">
              <div className="bg-gray-50 p-3 flex items-center gap-2 border-b">
                {table.icon}
                <h3 className="font-medium">{table.name}</h3>
              </div>
              <div className="p-3">
                <div className="text-sm mb-2">
                  <span className="text-muted-foreground">Fields:</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {table.fields.map((field, index) => (
                    <span key={index} className="text-xs bg-gray-100 px-2 py-1 rounded">
                      {field}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default AirtableStatus;
