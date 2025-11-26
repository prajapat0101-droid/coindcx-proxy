// index.js — CoinDCX proxy (candles + futures private)
// -----------------------------------------------

import express from "express";
import crypto from "crypto";
import axios from "axios";

const app = express();
app.use(express.json({ limit: "1mb" }));

// ====== ENV KEYS (Cloud Run pe set kiye hue) ======
const KEY    = process.env.COINDCX_KEY   || "";
const SECRET = process.env.COINDCX_SECRET || "";

// Public + private base URLs
const PUBLIC_BASE  = "https://public.coindcx.com";
const PRIVATE_BASE = "https://api.coindcx.com";
const FUTURES_BASE = "https://fapi.coindcx.com";

// Simple UA so CoinDCX 403 na de
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120 Safari/537.36";

// ====== SIGNING HELPERS (for private REST) ======
function sign(body) {
  const payload = JSON.stringify(body);
  return crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
}

function authHeaders(body) {
  return {
    "Content-Type": "application/json",
    "X-AUTH-APIKEY": KEY,
    "X-AUTH-SIGNATURE": sign(body),
    "User-Agent": UA,
  };
}

// ====== HEALTH ======
app.get("/health", (req, res) => {
  res.json({ s: "ok", service: "coindcx-proxy" });
});

// ====== PUBLIC CANDLES (used by Google Sheet) ======
// Sheet call:  GET /candles?pair=B-BTC_USDT&from=...&to=...&resolution=1&pcode=f
app.get("/candles", async (req, res) => {
  try {
    const pair       = req.query.pair;
    const resolution = String(req.query.resolution || "1");
    const fromSec    = req.query.from ? Number(req.query.from) : null;
    const toSec      = req.query.to   ? Number(req.query.to)   : null;

    if (!pair) {
      return res.status(400).json({ s: "error", msg: "pair is required" });
    }

    // resolution -> interval map (minutes -> CoinDCX string)
    const intervalMap = {
      "1":  "1m",
      "3":  "3m",
      "5":  "5m",
      "15": "15m",
      "30": "30m",
      "60": "1h",
      "120": "2h",
      "240": "4h",
      "360": "6h",
      "480": "8h",
      "720": "12h",
      "1440": "1d",
      "4320": "3d",
      "10080": "1w",
      "43200": "1M",
    };

    const interval = intervalMap[resolution] || "1m";

    const params = {
      pair,
      interval,
    };

    // CoinDCX candles doc: startTime / endTime in milliseconds (optional)
    if (fromSec) params.startTime = fromSec * 1000;
    if (toSec)   params.endTime   = toSec   * 1000;

    const url = `${PUBLIC_BASE}/market_data/candles`;

    const resp = await axios.get(url, {
      params,
      headers: { "User-Agent": UA },
      timeout: 10000,
    });

    // Direct response from CoinDCX is an array. We wrap into {s,data}
    const raw = resp.data;

    if (!Array.isArray(raw)) {
      console.error("Unexpected candles shape:", raw);
      return res.status(502).json({
        s: "error",
        msg: "unexpected candles response format",
      });
    }

    // Wrap for Apps Script: {s:'ok', data:[ ... ]}
    res.json({ s: "ok", data: raw });
  } catch (err) {
    const status = err.response?.status || 500;
    const body   = err.response?.data || String(err);
    console.error("CANDLES_ERROR", status, body);
    res.status(status).json({
      s: "error",
      msg: "candles_error",
      detail: body,
    });
  }
});

// ====== ACCOUNT BALANCES (SPOT/MARGIN) ======
app.post("/account/balances", async (req, res) => {
  try {
    const body = {
      timestamp: Date.now(),
      ...req.body,
    };

    const url = `${PRIVATE_BASE}/exchange/v1/users/balances`;

    const resp = await axios.post(url, body, {
      headers: authHeaders(body),
      timeout: 10000,
    });

    res.json(resp.data);
  } catch (err) {
    const status = err.response?.status || 500;
    const body   = err.response?.data || String(err);
    console.error("BALANCES_ERROR", status, body);
    res.status(status).json({ s: "error", detail: body });
  }
});

// ====== FUTURES POSITIONS ======
app.post("/futures/positions", async (req, res) => {
  try {
    const body = {
      timestamp: Date.now(),
      ...req.body,
    };

    const url = `${FUTURES_BASE}/exchange/v1/derivatives/futures/positions`;

    const resp = await axios.post(url, body, {
      headers: authHeaders(body),
      timeout: 10000,
    });

    res.json(resp.data);
  } catch (err) {
    const status = err.response?.status || 500;
    const body   = err.response?.data || String(err);
    console.error("FUT_POSITIONS_ERROR", status, body);
    res.status(status).json({ s: "error", detail: body });
  }
});

// ====== FUTURES ORDERS LIST ======
app.post("/futures/orders", async (req, res) => {
  try {
    const body = {
      timestamp: Date.now(),
      status: "open",
      page: "1",
      size: "50",
      ...req.body,
    };

    const url = `${FUTURES_BASE}/exchange/v1/derivatives/futures/orders`;

    const resp = await axios.post(url, body, {
      headers: authHeaders(body),
      timeout: 10000,
    });

    res.json(resp.data);
  } catch (err) {
    const status = err.response?.status || 500;
    const body   = err.response?.data || String(err);
    console.error("FUT_ORDERS_ERROR", status, body);
    res.status(status).json({ s: "error", detail: body });
  }
});

// ====== FUTURES ORDER CREATE (MARKET etc) ======
app.post("/futures/orders/create", async (req, res) => {
  try {
    const order = req.body.order || {};

    const body = {
      timestamp: Date.now(),
      ...order,
    };

    const url = `${FUTURES_BASE}/exchange/v1/derivatives/futures/new_order`;

    const resp = await axios.post(url, body, {
      headers: authHeaders(body),
      timeout: 10000,
    });

    res.json(resp.data);
  } catch (err) {
    const status = err.response?.status || 500;
    const body   = err.response?.data || String(err);
    console.error("FUT_NEW_ORDER_ERROR", status, body);
    res.status(status).json({ s: "error", detail: body });
  }
});

// ====== SERVER START (Cloud Run uses PORT env) ======
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`CoinDCX proxy running on ${PORT}`);
});
