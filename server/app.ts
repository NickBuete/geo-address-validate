import express, { Request, Response } from 'express'
import dotenv from 'dotenv'
import path from 'path'

import { geoscapeProvider } from './providers/geoscape'
import {
  nzPostDomesticProvider,
  nzPostAustraliaProvider,
} from './providers/nzpost'
import type { Provider } from './providers/types'

dotenv.config()

const app = express()
const PORT = Number(process.env.PORT) || 4000

// Use project root instead of import.meta.url to avoid ESM/CJS loader issues with ts-node
const PROJECT_ROOT = process.cwd()

const providers: Record<string, Provider> = {
  [geoscapeProvider.id]: geoscapeProvider,
  [nzPostDomesticProvider.id]: nzPostDomesticProvider,
  [nzPostAustraliaProvider.id]: nzPostAustraliaProvider,
}

const providerAliases: Record<string, string> = {
  // Map common country codes and synonyms to providers
  AU: nzPostAustraliaProvider.id,
  AUS: nzPostAustraliaProvider.id,
  AUSTRALIA: nzPostAustraliaProvider.id,
  NZ: nzPostDomesticProvider.id,
  'NZPOST-AU': nzPostAustraliaProvider.id,
  AU_NZPOST: nzPostAustraliaProvider.id,
}

const DEFAULT_PROVIDER_ID = geoscapeProvider.id

function resolveProviderId(req: Request): string {
  const providerRaw = Array.isArray(req.query.provider)
    ? req.query.provider[0]
    : req.query.provider
  const providerParam = providerRaw == null ? undefined : String(providerRaw)
  if (providerParam && providers[providerParam]) return providerParam

  const countryRaw = Array.isArray(req.query.country)
    ? req.query.country[0]
    : req.query.country
  const countryParam = countryRaw == null ? undefined : String(countryRaw)
  if (countryParam) {
    const alias = providerAliases[String(countryParam).toUpperCase()]
    if (alias && providers[alias]) return alias
  }

  return DEFAULT_PROVIDER_ID
}

function handleProviderError(res: Response, error: unknown) {
  const message =
    typeof error === 'string'
      ? error
      : error instanceof Error
      ? error.message
      : 'Unknown provider error'
  res.status(500).json({ message })
}

// Serve static client in production (if you build and put in /build)
app.use(express.static(path.join(PROJECT_ROOT, 'build')))

app.get('/api/providers', (_req, res) => {
  const list = Object.values(providers).map((provider) => ({
    id: provider.id,
    label: provider.label,
  }))
  res.json({ providers: list, default: DEFAULT_PROVIDER_ID })
})

app.get('/api/predict', async (req, res) => {
  const queryValue = req.query.query ?? req.query.q ?? req.query.text
  if (!queryValue)
    return res.status(400).json({ message: 'query parameter required' })

  const searchValue = String(queryValue).trim()
  if (!searchValue)
    return res.status(400).json({ message: 'query parameter required' })

  const providerId = resolveProviderId(req)
  const provider = providers[providerId]
  if (!provider)
    return res.status(400).json({ message: `Unknown provider: ${providerId}` })

  try {
    const result = await provider.predict(searchValue)
    res.json(result)
  } catch (error) {
    handleProviderError(res, error)
  }
})

app.get('/api/address/:id', async (req, res) => {
  const id = req.params.id
  if (!id) return res.status(400).json({ message: 'Address id required' })

  const providerId = resolveProviderId(req)
  const provider = providers[providerId]
  if (!provider)
    return res.status(400).json({ message: `Unknown provider: ${providerId}` })

  try {
    const result = await provider.detail(id)
    res.json(result)
  } catch (error) {
    handleProviderError(res, error)
  }
})

// Internal upstash check - guarded by INTERNAL_CHECK_SECRET env var
app.get('/api/internal/upstash-check', async (req, res) => {
  const secret = process.env.INTERNAL_CHECK_SECRET
  if (!secret)
    return res
      .status(403)
      .json({ ok: false, message: 'INTERNAL_CHECK_SECRET not configured' })
  const hdr = req.headers['x-internal-secret']
  if (hdr !== secret)
    return res.status(401).json({ ok: false, message: 'unauthorized' })

  // Resolve Upstash config using common environment variable names
  const upstashUrl =
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_REST_API_URL ||
    process.env.REDIS_URL ||
    process.env.KV_URL ||
    null
  const upstashToken =
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN ||
    process.env.KV_REST_API_READ_ONLY_TOKEN ||
    null
  if (!upstashUrl || !upstashToken)
    return res.json({
      ok: true,
      upstash: false,
      message: 'upstash not configured',
    })

  try {
    const mod = await import('@upstash/redis')
    const RedisCtor = mod.Redis || mod.default?.Redis
    if (!RedisCtor) return res.json({ ok: true, upstash: false })
    const client = new RedisCtor({ url: upstashUrl, token: upstashToken })
    const val = await client.get('nzpost:access_token')
    return res.json({ ok: true, upstash: true, key: val ?? null })
  } catch (e) {
    return res.json({ ok: true, upstash: false })
  }
})

// Fallback to client index
app.get('*', (_req, res) => {
  res.sendFile(path.join(PROJECT_ROOT, 'build', 'index.html'))
})

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`)
})

export default app
