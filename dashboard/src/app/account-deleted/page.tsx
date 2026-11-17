import { Check } from 'lucide-react'
import type { Metadata } from 'next'
import AuthFooter from '../../components/auth-footer'

export const metadata: Metadata = { title: 'Account deleted' }

export default function AccountDeletedPage() {
  return (
    <main className="auth-page" aria-labelledby="account-deleted-title">
      <section className="sign-in-card account-deleted-card">
        <span className="account-deleted-badge"><Check size={20} strokeWidth={2} aria-hidden /></span>
        <div className="sign-in-copy">
          <h1 id="account-deleted-title">Account deleted</h1>
          <p>Thanks for building with Keysy.<br />Changed your mind? Sign in within 30 days to cancel.</p>
        </div>
        <a className="button button-primary account-deleted-link" href="https://keysy.net">Go to Keysy</a>
      </section>
      <AuthFooter />
    </main>
  )
}
