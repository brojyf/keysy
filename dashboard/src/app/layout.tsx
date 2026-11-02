import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'
import '../components/sign-in.css'
import '../components/dashboard.css'
import '../components/account.css'
import SessionGate from '../components/session-gate'

export const metadata: Metadata = {
  title: 'Sign in — Keysy',
  icons: {
    icon: [
      { url: '/favicon-light.svg', type: 'image/svg+xml', media: '(prefers-color-scheme: light)' },
      { url: '/favicon-dark.svg', type: 'image/svg+xml', media: '(prefers-color-scheme: dark)' },
    ],
  },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SessionGate>{children}</SessionGate>
      </body>
    </html>
  )
}
