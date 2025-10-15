// Clean single implementation — no duplicate fragments or type-only imports.

function resolveUpstashConfig() {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_REST_API_URL ||
    process.env.REDIS_URL ||
    process.env.KV_URL ||
    ''
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN ||
    process.env.KV_REST_API_READ_ONLY_TOKEN ||
    ''
  return { url: url || null, token: token || null }
}

async function safeGetUpstashKey(key: string) {
  try {
    const cfg = resolveUpstashConfig()
    if (!cfg.url || !cfg.token) return { available: false }
    const mod = await import('@upstash/redis')
    const RedisCtor = mod.Redis || mod.default?.Redis
    if (!RedisCtor) return { available: false }
    const client = new RedisCtor({ url: cfg.url, token: cfg.token })
    const val = await client.get(key)
    return { available: true, value: val }
  } catch (e) {
    return { available: false }
  }
}

export default async function handler(req: any, res: any) {
  const secret = process.env.INTERNAL_CHECK_SECRET
  if (!secret)
    return res
      .status(403)
      .json({ ok: false, message: 'INTERNAL_CHECK_SECRET not configured' })
  const hdr = req.headers['x-internal-secret']
  if (hdr !== secret)
    return res.status(401).json({ ok: false, message: 'unauthorized' })

  const cfg = resolveUpstashConfig()
  if (!cfg.url || !cfg.token)
    return res.json({
      ok: true,
      upstash: false,
      message: 'upstash not configured',
    })

  const result = await safeGetUpstashKey('nzpost:access_token')
  if (!result.available) return res.json({ ok: true, upstash: false })
  return res.json({ ok: true, upstash: true, key: result.value ?? null })
}
