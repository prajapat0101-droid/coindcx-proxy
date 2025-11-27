// package.json me "type": "module" mat rakhna to require hi use kar sakte ho
const express = require('express');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());

/**
 * GET /candles
 * Query: pair, interval, limit
 * Forwards to CoinDCX public candles endpoint
 */
app.get('/candles', async (req, res) => {
  try {
    const { pair, interval, limit } = req.query;
    if (!pair || !interval) {
      return res.status(400).json({ error: 'pair and interval required' });
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

    res
      .status(r.status)
      .set('content-type', r.headers.get('content-type') || 'application/json')
      .send(text);
  } catch (err) {
    console.error('candles proxy error', err);
    res.status(500).json({ error: 'candles proxy error', detail: '' + err });
  }
});

/**
 * POST /futures
 * Body: { path, payload, apiKey, signature }
 * Forwards to CoinDCX Futures REST
 */
app.post('/futures', async (req, res) => {
  try {
    const { path, payload, apiKey, signature } = req.body || {};
    if (!path || !payload || !apiKey || !signature) {
      return res
        .status(400)
        .json({ error: 'path, payload, apiKey, signature required' });
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
    console.error('futures proxy error', err);
    res.status(500).json({ error: 'futures proxy error', detail: '' + err });
  }
});

// health check
app.get('/', (req, res) => res.send('OK'));

const port = process.env.PORT || 8080;
app.listen(port, () => console.log('Proxy listening on', port));
