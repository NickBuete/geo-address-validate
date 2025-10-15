# Geo Address Validate - PoC

Address validation API proof-of-concept supporting New Zealand and Australian address lookups via NZ Post and Geoscape providers.

**Live Demo:** https://address-validate.vercel.app

## Overview

This application provides:
- **React frontend** (Create React App) with Bootstrap UI for address search
- **Serverless API** (Vercel) with TypeScript endpoints:
  - `/api/predict?q={query}&country={NZ|AU}` - Get address suggestions
  - `/api/address/{id}?provider={provider}` - Get full address details
- **Provider isolation** - Each data source (Geoscape AU, NZ Post NZ, NZ Post AU) is modularized
- **OAuth token caching** - Uses Upstash Redis to share NZ Post OAuth tokens across serverless instances

## Current Status

✅ **Working:**
- New Zealand address search via NZ Post (predictive + details)
- Geoscape Australian address search (predictive + details)
- OAuth token caching in Upstash Redis
- Vercel serverless deployment

⚠️ **Known Issues:**
- Australian address search via NZ Post is not functional yet

## Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   Create a `.env` file with:
   ```bash
   # Geoscape (for Australian addresses)
   GEOSCAPE_CONSUMER_KEY=your_consumer_key_here
   
   # NZ Post (for NZ addresses)
   NZPOST_CLIENT_ID=your_client_id_here
   NZPOST_CLIENT_SECRET=your_client_secret_here
   NZPOST_USER_NAME=your_username_here
   
   # Upstash Redis (for OAuth token caching)
   KV_REST_API_URL=https://your-instance.upstash.io
   KV_REST_API_TOKEN=your_token_here
   
   # Internal API security
   INTERNAL_CHECK_SECRET=your_secret_here
   ```

3. **Start development server:**
   ```bash
   npm start
   ```

## Production Deployment (Vercel)

The application is configured for Vercel serverless deployment:

1. **Environment Variables:**
   Configure all environment variables listed above in the Vercel dashboard

2. **Deploy:**
   ```bash
   vercel --prod
   ```

### Architecture Notes

- **ES Modules:** The project uses `"type": "module"` in `package.json`
- **Serverless Functions:** API endpoints are in `/api` directory
- **Shared Code:** Provider modules are in `/api/_lib/providers/` (copied from `/server/providers/`)
- **Import Extensions:** ES module imports require `.js` extensions even for `.ts` files
- **Token Caching:** Upstash Redis REST API shares OAuth tokens across serverless function invocations

## API Endpoints

### Predict Address
```bash
GET /api/predict?q={query}&country={NZ|AU}
```
Returns array of address suggestions.

**Example:**
```bash
curl "https://address-validate.vercel.app/api/predict?q=123+Queen+St&country=NZ"
```

### Get Address Details
```bash
GET /api/address/{id}?provider={nzpost-nz|nzpost-au|geoscape}
```
Returns full address details for selected suggestion.

**Example:**
```bash
curl "https://address-validate.vercel.app/api/address/12345?provider=nzpost-nz"
```

## Provider Details

### NZ Post (New Zealand Domestic)
- Endpoints: `/addresschecker/1.0/suggest`, `/addresschecker/1.0/details`
- Auth: OAuth2 client credentials flow
- Token caching: Upstash Redis (shared across serverless instances)

### Geoscape (Australia)
- Endpoints: `/v1/predictive/address`, `/v1/addresses/{id}`
- Auth: Consumer key in query params

### NZ Post (Australia) - Not Yet Working
- Endpoints: `/parceladdress/2.0/international/addresses`, `/parceladdress/2.0/australia/addresses/{id}`
- Status: Implementation incomplete

## Project Structure

```
api/
  predict.ts              # Main prediction endpoint
  address/[id].ts         # Address detail endpoint
  _lib/providers/         # Provider modules (NZ Post, Geoscape)
    geoscape.ts
    nzpost.ts
    types.ts
  internal/
    upstash-check.ts      # Internal health check endpoint

src/
  App.tsx                 # React frontend
  index.tsx

server/                   # Original server code (for local dev)
  app.ts
  providers/
```

## Development Notes

- The project was originally built with an Express server (`server/app.ts`) for local development
- Production uses Vercel serverless functions with code duplicated to `/api/_lib/providers/`
- Vercel serverless functions can only import from within `/api` directory or `node_modules`
- ES module imports must include `.js` extensions even when importing `.ts` files
