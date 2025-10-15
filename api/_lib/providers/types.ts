export type Suggestion = {
  id: string
  text: string
  source?: string
}

export type SuggestResponse = {
  suggestions: Suggestion[]
  raw: any
}

export type DetailResponse = {
  address: any
  raw: any
}

export interface Provider {
  id: string
  label: string
  predict(query: string): Promise<SuggestResponse>
  detail(id: string): Promise<DetailResponse>
}
