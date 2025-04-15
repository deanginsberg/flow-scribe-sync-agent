
import React from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

const Header = () => {
  return (
    <header className="w-full py-4 px-6 bg-white border-b">
      <div className="flex justify-between items-center">
        <div className="flex items-center">
          <h1 className="text-2xl font-bold text-primary">Klaviyo Data Importer</h1>
          <span className="ml-3 px-2 py-1 text-xs bg-gray-100 rounded-md text-gray-500">Internal Tool</span>
        </div>
        <div className="flex items-center">
          <Button variant="outline" size="sm" className="text-gray-500">
            Documentation
          </Button>
        </div>
      </div>
      <Separator className="mt-4" />
    </header>
  );
};

export default Header;
