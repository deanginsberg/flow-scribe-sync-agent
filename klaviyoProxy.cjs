const express = require('express');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const app = express();
const port = 3001;

app.use(express.json());

app.post('/api/test-klaviyo', async (req, res) => {
  const { apiKey } = req.body;

  console.log('[Received POST to /api/test-klaviyo]');
  console.log('API Key:', apiKey);

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

app.listen(port, () => {
  console.log(`✅ Klaviyo proxy running at http://localhost:${port}/api/test-klaviyo`);
});
