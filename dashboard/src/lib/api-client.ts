import { fetchWithSessionRefresh } from './session-refresh'
import { serviceURLs } from './service-urls'

export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const { apiURL, authURL } = serviceURLs()
  return fetchWithSessionRefresh(new URL(path, apiURL).href, authURL, init)
}
