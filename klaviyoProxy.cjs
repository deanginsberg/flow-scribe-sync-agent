const express = require('express');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const cors = require('cors');

const app = express();
const port = 3001;

// Enable CORS for all routes
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  credentials: true
}));

app.use(express.json());

// Test Klaviyo connection
app.post('/api/test-klaviyo', async (req, res) => {
  const { apiKey } = req.body;

  console.log('[Received POST to /api/test-klaviyo]');

  if (!apiKey) {
    console.log('[Error] No API key received');
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
      console.error('[JSON Parse Error]', parseError);
      console.error('[Raw Response]', text);
      return res.status(500).json({ error: 'Invalid JSON from Klaviyo' });
    }

    if (!result.ok) {
      return res.status(result.status).json({ error: data.detail || 'Klaviyo error' });
    }

    res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('[Klaviyo Proxy Error]', err);
    res.status(500).json({ error: 'Failed to fetch Klaviyo data' });
  }
});

// Generic proxy for Klaviyo API
app.post('/api/klaviyo-proxy', async (req, res) => {
  try {
    const { endpoint, method = 'GET', body, apiKey } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({ error: 'Missing API key' });
    }
    
    if (!endpoint) {
      return res.status(400).json({ error: 'Missing endpoint' });
    }
    
    console.log(`[Klaviyo Proxy] ${method} ${endpoint}`);
    
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
    console.log(`[Klaviyo Proxy] Requesting: ${url}`);
    
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));
    
    if (!response.ok) {
      console.error(`[Klaviyo Proxy Error] ${response.status}: ${JSON.stringify(data)}`);
      return res.status(response.status).json({
        error: data.detail || 'Klaviyo API Error',
        status: response.status,
        data
      });
    }
    
    return res.status(200).json(data);
  } catch (err) {
    console.error('[Klaviyo Proxy Error]', err);
    res.status(500).json({ error: 'Failed to fetch Klaviyo data' });
  }
});

app.listen(port, () => {
  console.log(`✅ Klaviyo proxy running at http://localhost:${port}`);
});
