import { useState } from 'react'
import keysySymbol from './assets/sign-in/keysy-symbol.svg'
import googleSymbol from './assets/sign-in/google-symbol.svg'
import './App.css'

function App() {
  const [signedIn, setSignedIn] = useState(false)

  if (signedIn) {
    return (
      <main className="auth-page">
        <button className="auth-button logout-button" onClick={() => setSignedIn(false)}>
          Logout
        </button>
      </main>
    )
  }

  return (
    <main className="auth-page" aria-labelledby="sign-in-title">
      <section className="sign-in-card">
        <img src={keysySymbol} width="36" height="36" alt="Keysy" />
        <div className="sign-in-copy">
          <h1 id="sign-in-title">Sign in to Keysy</h1>
          <p>Use your Google account to continue.</p>
        </div>
        <button className="auth-button" onClick={() => setSignedIn(true)}>
          <img src={googleSymbol} width="18" height="18" alt="" />
          Continue with Google
        </button>
        <p className="sign-in-terms">
          By continuing, you agree to the{' '}
          <span aria-disabled="true" title="Coming soon">Terms</span> and{' '}
          <span aria-disabled="true" title="Coming soon">Privacy Policy</span>.
        </p>
      </section>
      <footer className="sign-in-footer">
        <span>© 2026 Keysy</span>
        <span aria-disabled="true" title="Coming soon">Status</span>
        <span aria-disabled="true" title="Coming soon">Privacy</span>
        <span aria-disabled="true" title="Coming soon">Terms</span>
      </footer>
    </main>
  )
}

export default App
