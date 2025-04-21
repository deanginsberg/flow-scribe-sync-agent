const express = require('express');
const cors = require('cors');
const { handleSync } = require('./src/server/api/sync');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Add test-klaviyo endpoint to this server too
app.post('/api/test-klaviyo', async (req, res) => {
  const { apiKey } = req.body;

  console.log('[Server] Received POST to /api/test-klaviyo');

  if (!apiKey) {
    console.log('[Server] Error: No API key received');
    return res.status(400).json({ error: 'Missing API key' });
  }

  try {
    const result = await fetch('https://a.klaviyo.com/api/accounts/', {
      headers: {
        'Authorization': `Klaviyo-API-Key ${apiKey}`,
        'revision': '2023-10-15',
        'Accept': 'application/json',
      },
    });

    const text = await result.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch (parseError) {
      console.error('[Server] JSON Parse Error', parseError);
      console.error('[Server] Raw Response', text);
      return res.status(500).json({ error: 'Invalid JSON from Klaviyo' });
    }

    if (!result.ok) {
      return res.status(result.status).json({ error: data.detail || 'Klaviyo error' });
    }

    res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('[Server] Klaviyo Proxy Error', err);
    res.status(500).json({ error: 'Failed to fetch Klaviyo data' });
  }
});

// Add klaviyo-proxy endpoint to this server
app.post('/api/klaviyo-proxy', async (req, res) => {
  try {
    const { endpoint, method = 'GET', body, apiKey } = req.body;
    
    console.log('[Server] Klaviyo proxy request:', {
      endpoint,
      method,
      hasBody: !!body
    });
    
    if (!apiKey) {
      return res.status(400).json({ error: 'Missing API key' });
    }
    
    if (!endpoint) {
      return res.status(400).json({ error: 'Missing endpoint' });
    }
    
    const options = {
      method,
      headers: {
        'Authorization': `Klaviyo-API-Key ${apiKey}`,
        'revision': '2023-10-15',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      }
    };
    
    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.body = JSON.stringify(body);
    }
    
    const url = `https://a.klaviyo.com/api${endpoint}`;
    console.log(`[Server] Requesting: ${url}`);
    
    const response = await fetch(url, options);
    
    // Get the response text first
    const responseText = await response.text();
    
    // Try to parse as JSON
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[Server] Error parsing response:', parseError);
      console.error('[Server] Response text:', responseText.substring(0, 500));
      
      // If it's not JSON, return the raw text
      if (!response.ok) {
        return res.status(response.status).json({
          error: 'Invalid JSON response from Klaviyo',
          status: response.status,
          responseText: responseText.substring(0, 200)
        });
      }
      
      return res.status(200).send(responseText);
    }
    
    if (!response.ok) {
      console.error(`[Server] Klaviyo Proxy Error ${response.status}:`, JSON.stringify(data));
      return res.status(response.status).json({
        error: data.detail || 'Klaviyo API Error',
        status: response.status,
        data
      });
    }
    
    return res.status(200).json(data);
  } catch (err) {
    console.error('[Server] Klaviyo Proxy Error', err);
    res.status(500).json({ error: 'Failed to fetch Klaviyo data: ' + err.message });
  }
});

// API routes
app.post('/api/sync', handleSync);

// Start server
app.listen(PORT, () => {
  console.log(`API server running at http://localhost:${PORT}`);
});