export function serviceURLs() {
  return {
    apiURL: import.meta.env.VITE_API_URL || 'http://localhost:8081',
    authURL: import.meta.env.VITE_AUTH_URL || 'http://localhost:8080',
  }
}
