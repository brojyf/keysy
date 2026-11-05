'use client'

import { useSyncExternalStore } from 'react'

export type Theme = 'system' | 'light' | 'dark'

let selected: Theme | undefined
const listeners = new Set<() => void>()

export function readTheme(): Theme {
  try {
    const value = document.cookie.split('; ').find((cookie) => cookie.startsWith('keysy-theme='))?.slice(12)
    return value === 'light' || value === 'dark' ? value : 'system'
  } catch {
    return 'system'
  }
}

function getTheme(): Theme {
  return selected ??= readTheme()
}

export function applyTheme(theme: Theme) {
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
}

export function setTheme(theme: Theme) {
  try {
    const { hostname, protocol } = window.location
    const domain = hostname === 'keysy.net' || hostname.endsWith('.keysy.net') ? '; Domain=keysy.net' : ''
    const secure = protocol === 'https:' ? '; Secure' : ''
    document.cookie = `keysy-theme=${theme === 'system' ? '' : theme}; Path=/; SameSite=Lax; Max-Age=${theme === 'system' ? 0 : 31536000}${domain}${secure}`
  } catch { /* Cookies may be unavailable. */ }
  selected = theme
  applyTheme(theme)
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const onChange = () => { if (getTheme() === 'system') applyTheme('system') }
  media.addEventListener('change', onChange)
  return () => {
    listeners.delete(listener)
    media.removeEventListener('change', onChange)
  }
}

export function useTheme() {
  return useSyncExternalStore(subscribe, getTheme, () => 'system' as Theme)
}
