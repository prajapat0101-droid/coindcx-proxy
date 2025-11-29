// index.js — FULL COINDCX PROXY (NO CUT, NO SHORT VERSION)

const express = require("express");
const fetch = require("node-fetch");

const app = express();
app.use(express.json());

// Helper: map interval like "1m", "5m", "1h" -> CoinDCX resolution
function mapIntervalToResolution(interval) {
  const iv = String(interval || "").toLowerCase();

  if (iv === "1m") return "1";
  if (iv === "3m") return "3";
  if (iv === "5m") return "5";
  if (iv === "15m") return "15";
  if (iv === "30m") return "30";
  if (iv === "45m") return "45";
  if (iv === "1h" || iv === "60m" || iv === "60") return "60";
  if (iv === "2h" || iv === "120m") return "120";
  if (iv === "4h" || iv === "240m") return "240";
  if (iv === "6h" || iv === "360m") return "360";
  if (iv === "12h" || iv === "720m") return "720";
  if (iv === "1d" || iv === "1D" || iv === "24h") return "1D";

  // default
  return "1";
}

// ---------------------------
// PUBLIC CANDLES (OLD, SPOT)  — still available
// ---------------------------
app.get("/candles", async (req, res) => {
  try {
    const { pair, interval, limit } = req.query;

    if (!pair || !interval) {
      return res.status(400).json({
        error: "pair and interval required"
      });
    }

    const url =
      "https://public.coindcx.com/market_data/candles/?pair=" +
      encodeURIComponent(pair) +
      "&interval=" +
      encodeURIComponent(interval) +
      "&limit=" +
      encodeURIComponent(limit || 50);

    const r = await fetch(url);
    const text = await r.text();

    res
      .status(r.status)
      .set("content-type", r.headers.get("content-type") || "application/json")
      .send(text);
  } catch (err) {
    console.error("candles proxy error:", err);
    res.status(500).json({ error: "candles proxy error", detail: String(err) });
  }
});

// ---------------------------
// NEW: FUTURES CANDLESTICKS (for HH3/LL3 Sheet)
// PATH EXACTLY: /candlesticks
// Query: ?pair=B-BTC_USDT&interval=1m&minutesBack=60
// ---------------------------
app.get("/candlesticks", async (req, res) => {
  try {
    const pair        = req.query.pair;
    const intervalStr = req.query.interval || "1m";
    const minutesBack = Number(req.query.minutesBack || "60"); // default 60 min

    if (!pair) {
      return res.status(400).json({ error: "pair required" });
    }

    const resolution = mapIntervalToResolution(intervalStr);

    const nowSec  = Math.floor(Date.now() / 1000);
    const fromSec = nowSec - minutesBack * 60;

    const url =
      "https://public.coindcx.com/market_data/candlesticks"
      + "?pair=" + encodeURIComponent(pair)
      + "&from=" + fromSec
      + "&to=" + nowSec
      + "&resolution=" + encodeURIComponent(resolution)
      + "&pcode=f"; // futures price code

    const r   = await fetch(url);
    const txt = await r.text();

    // Forward status + body exactly to Apps Script
    res
      .status(r.status)
      .set("content-type", r.headers.get("content-type") || "application/json")
      .send(txt);
  } catch (err) {
    console.error("candlesticks proxy error:", err);
    res
      .status(500)
      .json({ error: "candlesticks proxy error", detail: String(err) });
  }
});

// ---------------------------
// FUTURES AUTH ROUTE (POST)
// ---------------------------
app.post("/futures", async (req, res) => {
  try {
    const { path, payload, apiKey, signature } = req.body || {};

    if (!path || !payload || !apiKey || !signature) {
      return res.status(400).json({
        error: "path, payload, apiKey, signature required"
      });
    }

    const url = "https://api.coindcx.com" + path;

    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-AUTH-APIKEY": apiKey,
        "X-AUTH-SIGNATURE": signature
      },
      body: payload
    });

    const text = await r.text();

    res
      .status(r.status)
      .set("content-type", r.headers.get("content-type") || "application/json")
      .send(text);
  } catch (err) {
    console.error("futures proxy error:", err);
    res
      .status(500)
      .json({ error: "futures proxy error", detail: String(err) });
  }
});

// ---------------------------
// HEALTH CHECK
// ---------------------------
app.get("/", (req, res) => {
  res.send("CoinDCX Proxy Running OK");
});

// ---------------------------
// START SERVER
// ---------------------------
const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log("Proxy running on port", port);
});
