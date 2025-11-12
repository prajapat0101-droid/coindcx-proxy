# CoinDCX Proxy (Cloud Run) — Ready Pack

This proxy avoids Cloudflare blocks for Google Apps Script by forwarding your requests through a stable server.

## 1) Files
- `index.js` — Express server: `/instrument`, `/candles`, `/orders/create`
- `package.json` — Node deps
- `Dockerfile` — Build for Cloud Run
- `.env.example` — reference for required variables

## 2) Quick Deploy (Console UI)
1. Open **Google Cloud Console → Cloud Run → Deploy Service**.
2. Source: **Upload folder** (this zip contents).
3. Runtime: **Node.js 20** (or build from Dockerfile).
4. Region: **asia-south1 (Mumbai)** recommended.
5. Port: **8080**.
6. Allow unauthenticated **ON**.
7. Variables:
   - `COINDCX_KEY` = your CoinDCX API key
   - `COINDCX_SECRET` = your CoinDCX API secret
8. Deploy → copy **Service URL** (looks like `https://coindcx-proxy-xxxxx.a.run.app`).

> Optional (advanced): Set up Serverless VPC + Cloud NAT if you need a fixed egress IP.

## 3) gcloud CLI (alternative)

```bash
gcloud run deploy coindcx-proxy   --source=.   --platform=managed   --region=asia-south1   --allow-unauthenticated   --set-env-vars=COINDCX_KEY=YOUR_KEY,COINDCX_SECRET=YOUR_SECRET
```

## 4) Use in Google Sheet (Apps Script)
Set in `CONFIG` sheet:
```
PROXY_BASE = https://coindcx-proxy-xxxxx.a.run.app
TEST_MODE  = FALSE
DRY_RUN    = FALSE
```
Keep other keys as per your strategy.

## 5) Health check
Open in browser:
```
https://<your-service>.a.run.app/healthz
```
You should see `{ ok: true, ts: ... }`

---

**Security**: Keep keys only in Cloud Run variables. Do not store them in the Sheet.
