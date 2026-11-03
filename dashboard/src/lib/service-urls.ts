export function serviceURLs() {
  return {
    apiURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081',
    authURL: process.env.NEXT_PUBLIC_AUTH_URL || 'http://localhost:8080',
  }
}
