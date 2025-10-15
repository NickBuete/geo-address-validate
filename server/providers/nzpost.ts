import { Provider, SuggestResponse, DetailResponse } from './types'

const NZPOST_BASE_URL = (
  process.env.NZPOST_BASE_URL || 'https://api.nzpost.co.nz/addresschecker/1.0'
).replace(/\/$/, '')

const NZPOST_PARCEL_BASE_URL = (
  process.env.NZPOST_PARCEL_BASE_URL ||
  'https://api.nzpost.co.nz/parceladdress/2.0'
).replace(/\/$/, '')

const NZPOST_DEFAULT_TYPE = process.env.NZPOST_DEFAULT_TYPE || 'All'
const NZPOST_MAX_RESULTS = Number(process.env.NZPOST_MAX_RESULTS || '10')
const NZPOST_ACCEPT = process.env.NZPOST_ACCEPT || 'application/json'
const NZPOST_TOKEN_URL = (
  process.env.NZPOST_TOKEN_URL || 'https://oauth.nzpost.co.nz/as/token.oauth2'
).trim()
const NZPOST_SCOPE = process.env.NZPOST_SCOPE ?? ''
const NZPOST_AU_COUNTRY = process.env.NZPOST_AU_COUNTRY || 'australia'

type NzPostTokenCache = {
  token: string
  expiresAt: number
}

let nzPostTokenCache: NzPostTokenCache | null = null
let nzPostTokenPromise: Promise<string> | null = null

// Optional Vercel KV integration. Enable by setting USE_VERCEL_KV=1 or
// providing VERCEL_KV_URL in the environment (and installing @vercel/kv).
const USE_VERCEL_KV = Boolean(
  process.env.USE_VERCEL_KV ||
    process.env.VERCEL_KV_URL ||
    process.env.VERCEL_KV
)

let kvClientPromise: Promise<any> | null = null
async function getKvClient() {
  if (!USE_VERCEL_KV) return null
  if (!kvClientPromise) {
    kvClientPromise = (async () => {
      try {
        // dynamic import so local dev doesn't require @vercel/kv
        const mod = await import('@vercel/kv')
        // createClient is the recommended entry
        const client =
          typeof mod.createClient === 'function'
            ? mod.createClient()
            : mod.default?.createClient?.()
        return client || mod
      } catch (err) {
        // KV not available — fall back to memory cache
        return null
      }
    })()
  }
  return kvClientPromise
}

async function kvGet(key: string): Promise<any | null> {
  const kv = await getKvClient()
  if (!kv) return null
  try {
    const raw = await kv.get(key)
    if (!raw) return null
    // stored as JSON string or raw object
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw)
      } catch (e) {
        return raw
      }
    }
    return raw
  } catch (e) {
    return null
  }
}

async function kvSet(key: string, value: any, ttlSeconds?: number) {
  const kv = await getKvClient()
  if (!kv) return
  try {
    const payload = typeof value === 'string' ? value : JSON.stringify(value)
    if (typeof ttlSeconds === 'number' && ttlSeconds > 0) {
      // @vercel/kv supports options like { ex: seconds }
      // some clients accept a third-arg options object
      await kv.set(key, payload, { ex: ttlSeconds })
    } else {
      await kv.set(key, payload)
    }
  } catch (e) {
    // ignore KV errors — fall back to memory
    return
  }
}

async function kvDel(key: string) {
  const kv = await getKvClient()
  if (!kv) return
  try {
    await kv.del(key)
  } catch (e) {
    return
  }
}

// Upstash Redis adapter (REST-based). Enable by setting UPSTASH_REDIS_REST_URL
// and UPSTASH_REDIS_REST_TOKEN in env. We dynamically import so local dev
// doesn't require the package unless configured.
const USE_UPSTASH = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
)

let upstashClientPromise: Promise<any> | null = null
async function getUpstashClient() {
  if (!USE_UPSTASH) return null
  if (!upstashClientPromise) {
    upstashClientPromise = (async () => {
      try {
        const mod = await import('@upstash/redis')
        // Redis constructor is exported as Redis
        const RedisCtor = mod.Redis || mod.default?.Redis
        const client = RedisCtor
          ? new RedisCtor({
              url: process.env.UPSTASH_REDIS_REST_URL!,
              token: process.env.UPSTASH_REDIS_REST_TOKEN!,
            })
          : null
        return client
      } catch (e) {
        return null
      }
    })()
  }
  return upstashClientPromise
}

async function upstashGet(key: string): Promise<any | null> {
  const c = await getUpstashClient()
  if (!c) return null
  try {
    const v = await c.get(key)
    if (!v) return null
    if (typeof v === 'string') {
      try {
        return JSON.parse(v)
      } catch (e) {
        return v
      }
    }
    return v
  } catch (e) {
    return null
  }
}

async function upstashSet(key: string, value: any, ttlSeconds?: number) {
  const c = await getUpstashClient()
  if (!c) return
  try {
    const s = typeof value === 'string' ? value : JSON.stringify(value)
    if (typeof ttlSeconds === 'number' && ttlSeconds > 0) {
      // Upstash supports EX via setex
      if (typeof c.setex === 'function') {
        await c.setex(key, ttlSeconds, s)
      } else if (typeof c.set === 'function') {
        await c.set(key, s, { ex: ttlSeconds })
      } else {
        await c.set(key, s)
      }
    } else {
      await c.set(key, s)
    }
  } catch (e) {
    return
  }
}

async function upstashDel(key: string) {
  const c = await getUpstashClient()
  if (!c) return
  try {
    await c.del(key)
  } catch (e) {
    return
  }
}

function getNzPostCredentials() {
  return {
    manualToken: process.env.NZPOST_BEARER_TOKEN,
    clientId: process.env.NZPOST_CLIENT_ID,
    clientSecret: process.env.NZPOST_CLIENT_SECRET,
    userName: process.env.NZPOST_USER_NAME,
  }
}

function invalidateNzPostToken() {
  nzPostTokenCache = null
  // also remove from KV if configured
  ;(async () => {
    try {
      // prefer Upstash if configured
      if (USE_UPSTASH) {
        await upstashDel('nzpost:access_token')
      }
      await kvDel('nzpost:access_token')
    } catch (e) {
      /* ignore */
    }
  })()
}

async function getNzPostAccessToken(forceRefresh = false): Promise<string> {
  // Try KV first (shared cache across serverless instances)
  // Try Upstash (if configured), then Vercel KV (shared cache across serverless instances)
  if (!forceRefresh) {
    if (USE_UPSTASH) {
      try {
        const cached = await upstashGet('nzpost:access_token')
        if (cached && cached.token && cached.expiresAt > Date.now()) {
          return cached.token
        }
      } catch (e) {
        // continue to other flows
      }
    }

    if (USE_VERCEL_KV) {
      try {
        const cached = await kvGet('nzpost:access_token')
        if (cached && cached.token && cached.expiresAt > Date.now()) {
          return cached.token
        }
      } catch (e) {
        // continue to memory/local flow
      }
    }
  }

  if (
    !forceRefresh &&
    nzPostTokenCache &&
    nzPostTokenCache.expiresAt > Date.now()
  ) {
    return nzPostTokenCache.token
  }

  if (nzPostTokenPromise && !forceRefresh) {
    return nzPostTokenPromise
  }

  const { clientId, clientSecret } = getNzPostCredentials()
  if (!clientId || !clientSecret) {
    throw new Error(
      'NZPOST_CLIENT_ID and NZPOST_CLIENT_SECRET must be configured for automatic token retrieval'
    )
  }

  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
  })
  if (NZPOST_SCOPE) {
    params.set('scope', NZPOST_SCOPE)
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString(
    'base64'
  )

  const requestToken = async () => {
    const response = await fetch(NZPOST_TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(
        `NZ Post token request failed (${response.status}): ${text}`
      )
    }

    const data = await response.json()
    const token = data?.access_token
    if (!token) {
      throw new Error('NZ Post token response missing access_token')
    }

    const expiresIn = Number(data?.expires_in) || 1800
    const expiresAt = Date.now() + Math.max(expiresIn - 60, 60) * 1000
    nzPostTokenCache = { token, expiresAt }
    // store in Upstash or KV as available
    ;(async () => {
      try {
        if (USE_UPSTASH) {
          await upstashSet('nzpost:access_token', nzPostTokenCache, expiresIn)
        } else {
          await kvSet('nzpost:access_token', nzPostTokenCache, expiresIn)
        }
      } catch (e) {
        /* ignore */
      }
    })()
    return token
  }

  nzPostTokenPromise = requestToken()
  try {
    const token = await nzPostTokenPromise
    return token
  } finally {
    nzPostTokenPromise = null
  }
}

type HeaderResult = {
  headers: Record<string, string>
  refreshable: boolean
}

async function buildNzPostHeaders(
  forceRefresh = false
): Promise<HeaderResult | null> {
  const { manualToken, clientId, userName } = getNzPostCredentials()
  if (!clientId) {
    return null
  }

  const headers: Record<string, string> = {
    client_id: clientId,
    Accept: NZPOST_ACCEPT,
  }

  if (userName) {
    headers['user_name'] = userName
  }

  if (manualToken) {
    headers.Authorization = manualToken.startsWith('Bearer ')
      ? manualToken
      : `Bearer ${manualToken}`
    return { headers, refreshable: false }
  }

  const token = await getNzPostAccessToken(forceRefresh)
  headers.Authorization = token.startsWith('Bearer ')
    ? token
    : `Bearer ${token}`
  return { headers, refreshable: true }
}

async function requestNzPostJson(url: URL, forceRefresh = false): Promise<any> {
  let headerResult = await buildNzPostHeaders(forceRefresh)
  if (!headerResult) {
    throw new Error(
      'NZPOST_CLIENT_ID and either NZPOST_BEARER_TOKEN or NZPOST_CLIENT_SECRET must be configured'
    )
  }

  let response = await fetch(url.toString(), {
    headers: headerResult.headers,
  })

  if (response.status === 401 && headerResult.refreshable) {
    invalidateNzPostToken()
    headerResult = await buildNzPostHeaders(true)
    if (!headerResult) {
      throw new Error('NZ Post credentials missing after refresh attempt')
    }
    response = await fetch(url.toString(), {
      headers: headerResult.headers,
    })
  }

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`NZ Post request failed (${response.status}): ${text}`)
  }

  return response.json()
}

function mapNzPostSuggestion(address: any, index: number) {
  const id =
    address?.DPID ??
    address?.dpid ??
    address?.UniqueId ??
    address?.unique_id ??
    address?.address_id ??
    address?.addressId ??
    index

  const text =
    address?.FullAddress ||
    address?.full_address ||
    address?.FullPartial ||
    address?.formatted_address ||
    address?.display_address ||
    address?.address ||
    address?.description ||
    JSON.stringify(address)

  const source =
    address?.SourceDesc ||
    address?.source_desc ||
    address?.source ||
    address?.type

  return {
    id: String(id),
    text,
    source,
  }
}

function extractSuggestions(data: any) {
  const candidateArrays = [
    data?.addresses,
    data?.results,
    data?.suggestions,
    data?.items,
    data?.data?.addresses,
    data?.data?.results,
  ].filter((arr) => Array.isArray(arr))

  if (candidateArrays.length === 0) return []

  return candidateArrays[0]
}

async function nzPostDomesticPredict(query: string): Promise<SuggestResponse> {
  const url = new URL(`${NZPOST_BASE_URL}/suggest`)
  url.searchParams.set('q', query)
  url.searchParams.set('max', String(NZPOST_MAX_RESULTS))
  if (NZPOST_DEFAULT_TYPE) {
    url.searchParams.set('type', NZPOST_DEFAULT_TYPE)
  }

  const data = await requestNzPostJson(url)
  const addresses = extractSuggestions(data)
  const suggestions = addresses.map(mapNzPostSuggestion)
  return { suggestions, raw: data }
}

async function nzPostDomesticDetail(id: string): Promise<DetailResponse> {
  const url = new URL(`${NZPOST_BASE_URL}/details`)
  url.searchParams.set('dpid', id)
  url.searchParams.set('max', '1')
  if (NZPOST_DEFAULT_TYPE) {
    url.searchParams.set('type', NZPOST_DEFAULT_TYPE)
  }

  const data = await requestNzPostJson(url)
  const details = Array.isArray(data?.details) ? data.details : []
  const address = details[0] ?? data?.address ?? data
  if (!address) {
    throw new Error('NZ Post detail response missing address data')
  }
  return { address, raw: data }
}

async function nzPostAustraliaPredict(query: string): Promise<SuggestResponse> {
  const url = new URL(`${NZPOST_PARCEL_BASE_URL}/international/addresses`)
  url.searchParams.set('q', query)
  url.searchParams.set('country', NZPOST_AU_COUNTRY)
  url.searchParams.set('count', String(NZPOST_MAX_RESULTS))

  const data = await requestNzPostJson(url)
  const addresses = extractSuggestions(data)
  const suggestions = addresses.map(mapNzPostSuggestion)
  return { suggestions, raw: data }
}

async function nzPostAustraliaDetail(id: string): Promise<DetailResponse> {
  const url = new URL(
    `${NZPOST_PARCEL_BASE_URL}/australia/addresses/${encodeURIComponent(id)}`
  )

  const data = await requestNzPostJson(url)
  const address =
    data?.address ?? data?.addresses?.[0] ?? data?.details?.[0] ?? data
  if (!address) {
    throw new Error('NZ Post Australia detail response missing address')
  }
  return { address, raw: data }
}

export const nzPostDomesticProvider: Provider = {
  id: 'nzpost-nz',
  label: 'New Zealand – NZ Post Domestic',
  predict: nzPostDomesticPredict,
  detail: nzPostDomesticDetail,
}

export const nzPostAustraliaProvider: Provider = {
  id: 'nzpost-au',
  label: 'Australia – NZ Post International',
  predict: nzPostAustraliaPredict,
  detail: nzPostAustraliaDetail,
}
