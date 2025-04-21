import { syncKlaviyoToAirtable } from '@/lib/syncEngine';
import { Request, Response } from 'express';

export async function handleSync(req: Request, res: Response) {
  try {
    const { klaviyoApiKey, airtableApiKey, airtableBaseId } = req.body;

    console.log('API: Starting sync operation...');
    
    // Validate required parameters
    if (!klaviyoApiKey) {
      console.error('API: Missing Klaviyo API key');
      return res.status(400).json({ 
        success: false, 
        error: 'Missing Klaviyo API key' 
      });
    }
    
    if (!airtableApiKey) {
      console.error('API: Missing Airtable API key');
      return res.status(400).json({ 
        success: false, 
        error: 'Missing Airtable API key' 
      });
    }
    
    if (!airtableBaseId) {
      console.error('API: Missing Airtable Base ID');
      return res.status(400).json({ 
        success: false, 
        error: 'Missing Airtable Base ID' 
      });
    }
    
    console.log('API: All required parameters received, starting sync');
    
    const result = await syncKlaviyoToAirtable(klaviyoApiKey, airtableApiKey, airtableBaseId);
    
    console.log('API: Sync completed successfully');
    res.json({ 
      success: true,
      result
    });
  } catch (error) {
    console.error('API: Sync failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
} 