import { createFileRoute } from '@tanstack/react-router'
import AuthFooter from '../components/auth-footer'
import KeysySymbol from '../components/keysy-symbol'
import { serviceURLs } from '../lib/service-urls'


export default function SignInPage() {
  const { authURL } = serviceURLs()
  return (
    <main className="auth-page" aria-labelledby="sign-in-title">
      <section className="sign-in-card">
        <KeysySymbol size={36} />
        <div className="sign-in-copy">
          <h1 id="sign-in-title">Sign in to Keysy</h1>
        </div>
        <a className="auth-button" href={new URL('/v0/auth/google', authURL).href}>
          <img src="/google-symbol.svg" width="18" height="18" alt="" />
          Continue with Google
        </a>
        <p className="sign-in-terms">
          By continuing, you agree to the{' '}
          <span>Terms</span> and{' '}
          <span>Privacy Policy</span>.
        </p>
      </section>
      <AuthFooter />
    </main>
  )
}

export const Route = createFileRoute('/signin')({ component: SignInPage, head: () => ({ meta: [{ title: 'Sign in | Keysy' }] }) })
