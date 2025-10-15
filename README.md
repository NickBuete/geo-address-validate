# Geoscape predictive address test app

This repo contains a small React + TypeScript client (Bootstrap) and a TypeScript Express proxy server.

What it does

- Client: search form with selectable data sources (Geoscape AU, NZ Post NZ, NZ Post AU) that hits `/api/predict` and lets you pick a suggestion to confirm it against `/api/address/:id`.
- Server (`server/app.ts`): routes requests through provider modules (`server/providers/*`) so each upstream (Geoscape AU, NZ Post domestic, NZ Post Australia) is isolated and easy to inspect.

Setup

1. Copy `.env.example` to `.env` and add your Geoscape consumer key (and NZ Post credentials if you need NZ Post domestic/australian lookups):

```bash
cp .env.example .env
# edit .env and set GEOSCAPE_CONSUMER_KEY
# for NZ lookups set NZPOST_CLIENT_ID and NZPOST_CLIENT_SECRET (or provide NZPOST_BEARER_TOKEN)
```

2. Install dependencies (macOS, zsh):

```bash
npm install
```

3. Start both client and server in dev mode:

```bash
npm start
```

Notes

- The server uses Node 18+'s built-in `fetch` to forward requests. By default it calls `https://api.psma.com.au/v1/predictive/address?query=...`; override `GEOSCAPE_PREDICT_URL`, `GEOSCAPE_ADDRESS_URL`, or `GEOSCAPE_PREDICT_QUERY_PARAM` in `.env` if your tenant differs.
- If you have both a consumer key and API key, set `GEOSCAPE_CONSUMER_KEY` and optionally `GEOSCAPE_API_KEY` as a fallback.
- For New Zealand predictive search the proxy calls NZ Post’s `/addresschecker/1.0/suggest` and `/details` endpoints. Configure `NZPOST_CLIENT_ID` and `NZPOST_CLIENT_SECRET` (the proxy will fetch and cache bearer tokens automatically), or supply a manual `NZPOST_BEARER_TOKEN` override in `.env` if you prefer.
- For the NZ Post Australian endpoints the proxy hits `/parceladdress/2.0/international/addresses` (suggest) and `/parceladdress/2.0/australia/addresses/{id}` (detail). Override `NZPOST_PARCEL_BASE_URL` or `NZPOST_AU_COUNTRY` if your tenancy differs.
- This scaffolding is minimal. If you prefer Create React App, Next.js, or a different build system, I can switch.
