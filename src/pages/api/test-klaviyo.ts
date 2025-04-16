
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { apiKey } = req.body;

    if (!apiKey) {
      return res.status(400).json({ message: 'API key is required' });
    }

    // Make the request to Klaviyo
    const response = await fetch('https://a.klaviyo.com/api/accounts/', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Klaviyo-API-Key ${apiKey}`,
        'revision': '2023-10-15',
      },
    });

    // Read the response
    const data = await response.json();

    // Handle Klaviyo API errors
    if (!response.ok) {
      const errorMessage = data.detail || data.message || response.statusText;
      return res.status(response.status).json({ 
        message: `Klaviyo API Error: ${response.status} - ${errorMessage}`,
        error: data
      });
    }

    // Return successful response
    return res.status(200).json({ 
      success: true,
      message: 'Klaviyo connection successful',
      data
    });
  } catch (error) {
    console.error('Error in test-klaviyo API route:', error);
    return res.status(500).json({ 
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      error: error
    });
  }
}
