import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { resolveAPIURL } from './src/lib/service-urls.ts'

export function validateServiceURLs(command: string, env: Record<string, string | undefined>) {
  for (const name of ['VITE_AUTH_URL', 'VITE_API_URL']) {
    const value = env[name]
    if (!value && command === 'build') throw new Error(`${name} is required at build time`)
    if (value) {
      let url: URL
      try { url = new URL(value) } catch { throw new Error(`${name} must be a valid origin`) }
      const localHTTP = url.protocol === 'http:' && url.hostname === 'localhost'
      if ((url.protocol !== 'https:' && !localHTTP) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
        throw new Error(`${name} requires an HTTPS origin, except HTTP localhost; credentials, paths, query, and fragment are forbidden`)
      }
    }
  }
}

// Starts the session check while the JavaScript downloads. Uses the same URL rule as apiFetch('/v0/me').
export function sessionPreload(env: Record<string, string | undefined>): Plugin {
  const href = new URL('/v0/me', resolveAPIURL(env.VITE_API_URL)).href
  return {
    name: 'keysy-session-preload',
    transformIndexHtml: () => [{ tag: 'link', attrs: { rel: 'preload', as: 'fetch', crossorigin: 'use-credentials', href }, injectTo: 'head' }],
  }
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), 'VITE_')
  validateServiceURLs(command, env)
  return {
    plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react(), sessionPreload(env)],
    server: { host: 'localhost', port: 5173, strictPort: true, fs: { allow: [fileURLToPath(new URL('..', import.meta.url))] } },
  }
})
