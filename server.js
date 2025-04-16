
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// API route for testing Klaviyo connection
app.post('/api/test-klaviyo', async (req, res) => {
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
});

app.listen(PORT, () => {
  console.log(`API server running at http://localhost:${PORT}`);
});
