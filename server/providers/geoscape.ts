import { Provider, SuggestResponse, DetailResponse } from './types'

const GEOSCAPE_PREDICT_URL = (process.env.GEOSCAPE_PREDICT_URL ||
  'https://api.psma.com.au/v1/predictive/address'
).replace(/\/$/, '')

const GEOSCAPE_ADDRESS_URL = (process.env.GEOSCAPE_ADDRESS_URL || GEOSCAPE_PREDICT_URL).replace(
  /\/$/,
  ''
)

const GEOSCAPE_PREDICT_QUERY_PARAM =
  process.env.GEOSCAPE_PREDICT_QUERY_PARAM || process.env.GEOSCAPE_QUERY_PARAM || 'query'

function getGeoscapeAuthToken() {
  return process.env.GEOSCAPE_CONSUMER_KEY || process.env.GEOSCAPE_API_KEY
}

function normaliseSuggestions(data: any) {
  const candidateArrays: any[] = []

  const direct = [
    data?.suggestions,
    data?.results,
    data?.predictions,
    data?.addresses,
    data?.items,
    data?.addressList,
    data?.suggestedAddresses,
    data?.suggest,
  ]
  candidateArrays.push(...direct)

  candidateArrays.push(data?.response?.suggestions)
  candidateArrays.push(data?.response?.results)
  candidateArrays.push(data?.content?.suggestions)
  candidateArrays.push(data?.content?.results)
  candidateArrays.push(data?.data?.suggestions)
  candidateArrays.push(data?.data?.results)
  candidateArrays.push(data?.data?.items)
  candidateArrays.push(data?.result?.suggestions)
  candidateArrays.push(data?.result?.results)
  candidateArrays.push(data?.result?.items)
  candidateArrays.push(data?.result?.addresses)
  candidateArrays.push(data?.addresses?.results)

  const flattened = candidateArrays
    .filter((value) => Array.isArray(value))
    .flat()
    .filter(Boolean)

  if (flattened.length > 0) {
    return flattened
  }

  if (data && typeof data === 'object') {
    const maybeSingle =
      data.suggestion || data.result || data.prediction || data.address || data.item
    if (maybeSingle) {
      return [maybeSingle]
    }
  }

  return []
}

function suggestionText(suggestion: any) {
  return (
    suggestion?.text ||
    suggestion?.address ||
    suggestion?.formattedAddress ||
    suggestion?.fullAddress ||
    suggestion?.addressLine ||
    suggestion?.displayAddress ||
    suggestion?.label ||
    suggestion?.name ||
    suggestion?.address?.formattedAddress ||
    suggestion?.address?.fullAddress ||
    suggestion?.summary ||
    JSON.stringify(suggestion)
  )
}

async function geoscapePredict(query: string): Promise<SuggestResponse> {
  const authToken = getGeoscapeAuthToken()
  if (!authToken) {
    throw new Error('GEOSCAPE_CONSUMER_KEY (or GEOSCAPE_API_KEY fallback) not configured')
  }

  const url = new URL(GEOSCAPE_PREDICT_URL)
  url.searchParams.set(GEOSCAPE_PREDICT_QUERY_PARAM, query)
  if (GEOSCAPE_PREDICT_QUERY_PARAM !== 'query') {
    url.searchParams.set('query', query)
  }
  if (GEOSCAPE_PREDICT_QUERY_PARAM !== 'q') {
    url.searchParams.set('q', query)
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: authToken,
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Geoscape request failed (${response.status}): ${text}`)
  }

  const data = await response.json()
  const suggestionsRaw = normaliseSuggestions(data)

  const suggestions = suggestionsRaw.map((suggestion: any, index: number) => ({
    id: String(
      suggestion?.id ??
        suggestion?.addressId ??
        suggestion?.addressIdentifier ??
        suggestion?.identifier ??
        suggestion?.address?.id ??
        suggestion?.address?.addressId ??
        index
    ),
    text: suggestionText(suggestion),
  }))

  return { suggestions, raw: data }
}

async function geoscapeDetail(id: string): Promise<DetailResponse> {
  const authToken = getGeoscapeAuthToken()
  if (!authToken) {
    throw new Error('GEOSCAPE_CONSUMER_KEY (or GEOSCAPE_API_KEY fallback) not configured')
  }

  const url = new URL(`${GEOSCAPE_ADDRESS_URL}/${encodeURIComponent(id)}`)
  const response = await fetch(url.toString(), {
    headers: {
      Authorization: authToken,
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Geoscape details failed (${response.status}): ${text}`)
  }

  const data = await response.json()
  return { address: data, raw: data }
}

export const geoscapeProvider: Provider = {
  id: 'geoscape-au',
  label: 'Australia – Geoscape Predictive (PSMA)',
  predict: geoscapePredict,
  detail: geoscapeDetail,
}
