export const resolveAPIURL = (configured: string | undefined) => configured || 'http://localhost:8081'

export function serviceURLs() {
  return {
    apiURL: resolveAPIURL(import.meta.env.VITE_API_URL),
    authURL: import.meta.env.VITE_AUTH_URL || 'http://localhost:8080',
  }
}
