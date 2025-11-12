import express from "express";
import crypto from "crypto";
import axios from "axios";

const app = express();
app.use(express.json({ limit: "1mb" }));

// Read API keys from environment (set these in Cloud Run)
const KEY = process.env.COINDCX_KEY || "";
const SECRET = process.env.COINDCX_SECRET || "";

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

function sign(body) {
  const payload = JSON.stringify(body);
  return crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
}

app.get("/healthz", (req, res) => res.json({ ok: true, ts: Date.now() }));

// Futures instruments
app.get("/instrument", async (req, res) => {
  try {
    const pair = req.query.pair;
    const url = `https://api.coindcx.com/exchange/v1/derivatives/futures/data/instrument?pair=${encodeURIComponent(pair)}`;
    const r = await axios.get(url, { headers: { "User-Agent": UA, "Accept": "application/json" }, timeout: 8000 });
    res.status(r.status).json(r.data);
  } catch (e) {
    res.status(502).json({ message: String(e.message || e) });
  }
});

// Public futures candles (pcode=f)
app.get("/candles", async (req, res) => {
  try {
    const { pair, from, to, resolution, pcode = "f" } = req.query;
    const url = `https://public.coindcx.com/market_data/candlesticks?pair=${encodeURIComponent(pair)}&from=${from}&to=${to}&resolution=${resolution}&pcode=${pcode}`;
    const r = await axios.get(url, { headers: { "User-Agent": UA, "Accept": "application/json" }, timeout: 8000 });
    res.status(r.status).json(r.data);
  } catch (e) {
    res.status(502).json({ message: String(e.message || e) });
  }
});

// Create market order (Futures)
app.post("/orders/create", async (req, res) => {
  try {
    if (!KEY || !SECRET) return res.status(500).json({ message: "Keys not set on proxy (COINDCX_KEY/COINDCX_SECRET)" });
    const body = req.body || {};
    const sig = sign(body);
    const r = await axios.post(
      "https://api.coindcx.com/exchange/v1/derivatives/futures/orders/create",
      JSON.stringify(body),
      {
        headers: {
          "Content-Type": "application/json",
          "X-AUTH-APIKEY": KEY,
          "X-AUTH-SIGNATURE": sig,
          "X-AUTH-TIMESTAMP": String(body.timestamp || Date.now()),
          "User-Agent": UA,
          "Accept": "application/json"
        },
        timeout: 8000,
        validateStatus: () => true
      }
    );
    res.status(r.status).send(r.data);
  } catch (e) {
    res.status(502).json({ message: String(e.message || e) });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log("CoinDCX proxy running on", PORT));
