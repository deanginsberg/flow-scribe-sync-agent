import { syncKlaviyoToAirtable } from '@/lib/syncEngine';
import { json } from '@remix-run/node';

export async function loader() {
  try {
    console.log('API: Starting sync operation...');
    await syncKlaviyoToAirtable();
    console.log('API: Sync completed successfully');
    return json({ success: true });
  } catch (error) {
    console.error('API: Sync failed:', error);
    return json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
} 