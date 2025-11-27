// index.js  — FULL proxy server for CoinDCX

const express = require('express');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());

/**
 * GET /candles
 * Query params:
 *   pair     -> e.g. B-BTC_USDT
 *   interval -> e.g. 1m
 *   limit    -> optional, default 50
 *
 * Forwards request to CoinDCX PUBLIC candles endpoint.
 */
app.get('/candles', async (req, res) => {
  try {
    const { pair, interval, limit } = req.query;

    if (!pair || !interval) {
      return res
        .status(400)
        .json({ error: 'pair and interval query parameters are required' });
    }

    const url =
      'https://public.coindcx.com/market_data/candles/?pair=' +
      encodeURIComponent(pair) +
      '&interval=' +
      encodeURIComponent(interval) +
      '&limit=' +
      encodeURIComponent(limit || 50);

    const r = await fetch(url);
    const text = await r.text();

    // Pass-through status + body
    res
      .status(r.status)
      .set('content-type', r.headers.get('content-type') || 'application/json')
      .send(text);
  } catch (err) {
    console.error('candles proxy error:', err);
    res.status(500).json({
      error: 'candles proxy error',
      detail: String(err)
    });
  }
});

/**
 * POST /futures
 * Body JSON from Apps Script:
 * {
 *   "path": "/exchange/v1/derivatives/futures/positions",
 *   "payload": "{...JSON string with timestamp...}",
 *   "apiKey": "FUTC_KEY",
 *   "signature": "hex_signature"
 * }
 *
 * Forwards request to CoinDCX Futures API with correct headers.
 */
app.post('/futures', async (req, res) => {
  try {
    const { path, payload, apiKey, signature } = req.body || {};

    if (!path || !payload || !apiKey || !signature) {
      return res.status(400).json({
        error: 'path, payload, apiKey, signature are required'
      });
    }

    const url = 'https://api.coindcx.com' + path;

    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AUTH-APIKEY': apiKey,
        'X-AUTH-SIGNATURE': signature
      },
      body: payload
    });

    const text = await r.text();

    res
      .status(r.status)
      .set('content-type', r.headers.get('content-type') || 'application/json')
      .send(text);
  } catch (err) {
    console.error('futures proxy error:', err);
    res.status(500).json({
      error: 'futures proxy error',
      detail: String(err)
    });
  }
});

// Simple health check
app.get('/', (req, res) => {
  res.send('CoinDCX proxy OK');
});

// Start server
const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log('CoinDCX proxy listening on port', port);
});
