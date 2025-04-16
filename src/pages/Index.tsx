
import React, { useState } from 'react';
import Header from '@/components/Header';
import ApiKeyInput from '@/components/ApiKeyInput';
import AirtableConfig from '@/components/AirtableConfig';
import SyncDashboard from '@/components/SyncDashboard';
import AirtableStatus from '@/components/AirtableStatus';
import DataSummary from '@/components/DataSummary';

const Index = () => {
  const [klaviyoApiKey, setKlaviyoApiKey] = useState('');
  const [airtableApiKey, setAirtableApiKey] = useState('');
  const [airtableBaseId, setAirtableBaseId] = useState('');

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      
      <main className="flex-1 container py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column - API Keys and Sync Dashboard */}
          <div className="lg:col-span-2 space-y-6">
            <ApiKeyInput 
              apiKey={klaviyoApiKey} 
              setApiKey={setKlaviyoApiKey} 
              onSave={() => {}} 
            />
            
            <AirtableConfig 
              airtableApiKey={airtableApiKey}
              airtableBaseId={airtableBaseId}
              setAirtableApiKey={setAirtableApiKey}
              setAirtableBaseId={setAirtableBaseId}
              onSave={() => {}}
            />
            
            <SyncDashboard 
              klaviyoApiKey={klaviyoApiKey} 
              airtableApiKey={airtableApiKey}
              airtableBaseId={airtableBaseId}
            />
          </div>
          
          {/* Right column - Airtable Status and Data Summary */}
          <div className="space-y-6">
            <DataSummary 
              airtableApiKey={airtableApiKey}
              airtableBaseId={airtableBaseId}
            />
            <AirtableStatus 
              airtableApiKey={airtableApiKey}
              airtableBaseId={airtableBaseId}
            />
          </div>
        </div>
      </main>
      
      <footer className="py-4 border-t bg-white">
        <div className="container text-center text-sm text-muted-foreground">
          Klaviyo Data Importer &copy; {new Date().getFullYear()} - Internal Tool
        </div>
      </footer>
    </div>
  );
};

export default Index;
