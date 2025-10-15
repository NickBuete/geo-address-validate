import { geoscapeProvider } from '../../server/providers/geoscape'
import { nzPostDomesticProvider, nzPostAustraliaProvider } from '../../server/providers/nzpost'
import type { Provider } from '../../server/providers/types'

const providers: Record<string, Provider> = {
  [geoscapeProvider.id]: geoscapeProvider,
  [nzPostDomesticProvider.id]: nzPostDomesticProvider,
  [nzPostAustraliaProvider.id]: nzPostAustraliaProvider,
}

const providerAliases: Record<string, string> = {
  AU: nzPostAustraliaProvider.id,
  AUS: nzPostAustraliaProvider.id,
  AUSTRALIA: nzPostAustraliaProvider.id,
  NZ: nzPostDomesticProvider.id,
}

function resolveProviderId(req: any): string {
  const providerRaw = Array.isArray(req.query.provider) ? req.query.provider[0] : req.query.provider
  const providerParam = providerRaw == null ? undefined : String(providerRaw)
  if (providerParam && providers[providerParam]) return providerParam

  const countryRaw = Array.isArray(req.query.country) ? req.query.country[0] : req.query.country
  const countryParam = countryRaw == null ? undefined : String(countryRaw)
  if (countryParam) {
    const alias = providerAliases[String(countryParam).toUpperCase()]
    if (alias && providers[alias]) return alias
  }

  return geoscapeProvider.id
}

export default async function handler(req: any, res: any) {
  try {
    const { id } = req.query
    if (!id) return res.status(400).json({ message: 'Address id required' })

    const providerId = resolveProviderId(req)
    const provider = providers[providerId]
    if (!provider) return res.status(400).json({ message: `Unknown provider: ${providerId}` })

    const result = await provider.detail(String(id))
    res.json(result)
  } catch (err) {
    console.error('api/address detail error:', err)
    res.status(500).json({ message: String(err) })
  }
}
