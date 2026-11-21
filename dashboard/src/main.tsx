import { createRoot } from 'react-dom/client'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { canonicalURL } from './lib/canonical-url'
import './app/globals.css'
import './components/sign-in.css'
import './components/dashboard.css'
import './components/loading-skeleton.css'
import './components/account.css'
import './components/member-list.css'
import './components/organization-settings.css'
import './components/dialog.css'
import './components/button.css'
import './components/icon-button.css'

const url = canonicalURL(window.location)
if (url) window.history.replaceState(window.history.state, '', url)

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register { router: typeof router }
}

createRoot(document.getElementById('root')!).render(<RouterProvider router={router} />)
