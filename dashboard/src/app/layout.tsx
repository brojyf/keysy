import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'
import '../components/sign-in.css'
import '../components/dashboard.css'
import '../components/account.css'
import SessionGate from '../components/session-gate'
import ThemeSync from '../components/theme-sync'

export const metadata: Metadata = {
  title: { template: '%s | Keysy', default: 'Keysy' },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '48x48', type: 'image/x-icon' },
      { url: '/favicon-light.svg', type: 'image/svg+xml', media: '(prefers-color-scheme: light)' },
      { url: '/favicon-dark.svg', type: 'image/svg+xml', media: '(prefers-color-scheme: dark)' },
    ],
  },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){var v;try{v=document.cookie.split('; ').find(function(c){return c.indexOf('keysy-theme=')===0})?.slice(12)}catch(e){}var d=v==='dark'||(v!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);document.documentElement.style.colorScheme=d?'dark':'light'})()` }} />
      </head>
      <body>
        <ThemeSync />
        <SessionGate>{children}</SessionGate>
      </body>
    </html>
  )
}
