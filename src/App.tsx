import React, { useEffect, useState } from 'react'
import axios from 'axios'

type ProviderOption = {
  id: string
  label: string
}

type Suggestion = {
  id: string
  text: string
  source?: string
}

type AddressDetails = Record<string, unknown>

const FALLBACK_PROVIDERS: ProviderOption[] = [
  { id: 'geoscape-au', label: 'Australia – Geoscape Predictive' },
  { id: 'nzpost-nz', label: 'New Zealand – NZ Post Domestic' },
  { id: 'nzpost-au', label: 'Australia – NZ Post International' },
]

export default function App() {
  const [query, setQuery] = useState('')
  const [provider, setProvider] = useState<string>('geoscape-au')
  const [providerOptions, setProviderOptions] = useState<ProviderOption[]>(FALLBACK_PROVIDERS)
  const [providersLoaded, setProvidersLoaded] = useState(false)

  const [results, setResults] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [confirmedAddress, setConfirmedAddress] = useState<AddressDetails | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [lastQuery, setLastQuery] = useState('')
  const [lastProvider, setLastProvider] = useState<string>('geoscape-au')
  const [rawResponse, setRawResponse] = useState<unknown>(null)

  useEffect(() => {
    let cancelled = false
    async function loadProviders() {
      try {
        const res = await axios.get('/api/providers')
        if (cancelled) return
        const list: ProviderOption[] = res.data?.providers || FALLBACK_PROVIDERS
        setProviderOptions(list)
        const defaultId = res.data?.default
        if (defaultId && list.some((opt) => opt.id === defaultId)) {
          setProvider(defaultId)
        }
      } catch {
        // fallback already set
      } finally {
        if (!cancelled) setProvidersLoaded(true)
      }
    }
    loadProviders()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const trimmed = query.trim()

    if (!trimmed) {
      setResults([])
      setError(null)
      setLoading(false)
      setSelectedId(null)
      setConfirmingId(null)
      setConfirmedAddress(null)
      setConfirmError(null)
      setLastQuery('')
      setLastProvider(provider)
      setRawResponse(null)
      return
    }

    setSelectedId(null)
    setConfirmedAddress(null)
    setConfirmError(null)

    const controller = new AbortController()
    const timeoutId = window.setTimeout(async () => {
      setLoading(true)
      try {
        const res = await axios.get('/api/predict', {
          params: { query: trimmed, provider },
          signal: controller.signal,
        })
        setLastQuery(trimmed)
        setLastProvider(provider)
        const suggestions = res.data.suggestions || []
        setResults(suggestions)
        setRawResponse(res.data?.raw ?? res.data)
        setError(null)
      } catch (err: any) {
        if (axios.isCancel(err) || err?.code === 'ERR_CANCELED') {
          return
        }
        setError(err?.response?.data?.message || err.message)
        setRawResponse(err?.response?.data ?? null)
      } finally {
        setLoading(false)
      }
    }, 400)

    return () => {
      clearTimeout(timeoutId)
      controller.abort()
    }
  }, [query, provider])

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault()
  }

  function handleProviderChange(next: string) {
    if (next === provider) return
    setProvider(next)
    setResults([])
    setSelectedId(null)
    setConfirmedAddress(null)
    setConfirmError(null)
    setError(null)
    setRawResponse(null)
    setLastQuery('')
    setLastProvider(next)
  }

  async function handleSelect(suggestion: Suggestion) {
    if (!suggestion.id) return

    setConfirmingId(suggestion.id)
    setSelectedId(suggestion.id)
    setConfirmError(null)
    setConfirmedAddress(null)

    try {
      const res = await axios.get(`/api/address/${encodeURIComponent(suggestion.id)}`, {
        params: { provider },
      })
      setConfirmedAddress(res.data.address || null)
    } catch (err: any) {
      setConfirmError(err?.response?.data?.message || err.message)
    } finally {
      setConfirmingId(null)
    }
  }

  const providerLabel =
    providerOptions.find((option) => option.id === provider)?.label || provider

  return (
    <div className="container py-4">
      <h1 className="mb-4">Predictive Address Test</h1>

      <div className="mb-3">
        <label className="form-label fw-semibold" htmlFor="provider-select">
          Data Source
        </label>
        <select
          id="provider-select"
          className="form-select"
          value={provider}
          onChange={(event) => handleProviderChange(event.target.value)}
          disabled={!providersLoaded}
        >
          {providerOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <form onSubmit={handleManualSubmit} className="mb-3">
        <div className="input-group">
          <input
            className="form-control"
            placeholder="Start typing an address or suburb"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            className="btn btn-primary"
            type="submit"
            disabled={loading || !query}
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>
      </form>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="row g-4">
        <div className="col-md-6">
          {results.length === 0 && !loading && (
            <p className="text-muted">No suggestions yet. Try searching above.</p>
          )}

          <div className="list-group">
            {results.map((suggestion) => (
              <button
                key={suggestion.id}
                type="button"
                className={`list-group-item list-group-item-action${selectedId === suggestion.id ? ' active' : ''}`}
                onClick={() => handleSelect(suggestion)}
                disabled={Boolean(confirmingId)}
              >
                <div className="d-flex flex-column align-items-start">
                  <span>{suggestion.text}</span>
                  {suggestion.source && (
                    <span className="text-muted small">{suggestion.source}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="col-md-6">
          {confirmingId && (
            <div className="alert alert-info">Confirming address…</div>
          )}
          {confirmError && (
            <div className="alert alert-danger">{confirmError}</div>
          )}
          {confirmedAddress && (
            <div>
              <h2 className="h5">Confirmed Address</h2>
              <pre className="bg-light p-3 border rounded">
                {JSON.stringify(confirmedAddress, null, 2)}
              </pre>
            </div>
          )}
        </div>

        <div className="col-12">
          <div className="card">
            <div className="card-body">
              <h2 className="h6">Debug Info</h2>
              <p className="mb-1">
                <strong>Current input:</strong> {query || <span className="text-muted">n/a</span>}
              </p>
              <p className="mb-3">
                <strong>Last request:</strong>{' '}
                {lastQuery ? (
                  <>
                    {lastQuery}{' '}
                    <span className="text-muted">
                      (provider: {providerOptions.find((opt) => opt.id === lastProvider)?.label ||
                        lastProvider})
                    </span>
                  </>
                ) : (
                  <span className="text-muted">n/a</span>
                )}
              </p>
              <p className="mb-3">
                <strong>Active provider:</strong> {providerLabel}
              </p>
              <div className="mb-3">
                <strong>Suggestions ({results.length}):</strong>
                <pre className="bg-light p-3 border rounded small mt-2">
                  {results.length > 0
                    ? JSON.stringify(results, null, 2)
                    : '[]'}
                </pre>
              </div>
              <div>
                <strong>Raw response:</strong>
                <pre className="bg-light p-3 border rounded small mt-2">
                  {rawResponse ? JSON.stringify(rawResponse, null, 2) : 'null'}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
