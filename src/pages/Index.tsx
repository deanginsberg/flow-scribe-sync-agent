
import React, { useState } from 'react';
import Header from '@/components/Header';
import ApiKeyInput from '@/components/ApiKeyInput';
import SyncDashboard from '@/components/SyncDashboard';
import AirtableStatus from '@/components/AirtableStatus';
import DataSummary from '@/components/DataSummary';

const Index = () => {
  const [apiKey, setApiKey] = useState('');

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      
      <main className="flex-1 container py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column - API Key and Sync Dashboard */}
          <div className="lg:col-span-2 space-y-6">
            <ApiKeyInput 
              apiKey={apiKey} 
              setApiKey={setApiKey} 
              onSave={() => {}} 
            />
            
            <SyncDashboard apiKey={apiKey} />
          </div>
          
          {/* Right column - Airtable Status and Data Summary */}
          <div className="space-y-6">
            <DataSummary />
            <AirtableStatus />
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
