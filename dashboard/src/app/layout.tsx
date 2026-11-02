import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import '../index.css'
import '../App.css'
import '../dashboard/dashboard.css'
import App from '../App'

export const metadata: Metadata = {
  title: 'Sign in — Keysy',
  icons: { icon: '/sign-in/keysy-symbol.svg' },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <App>{children}</App>
      </body>
    </html>
  )
}
