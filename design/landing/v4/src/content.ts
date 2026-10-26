// Copy from the landing page Figma frames. Product data is illustrative.

export type SecretRow = { path: string; version: string; expires: string }

export const productWindow = {
  breadcrumb: 'keysy / acme / production',
  navGroup: 'Workspace',
  navItems: ['Secrets', 'Access policies', 'Version history', 'Audit logs', 'AI assistant'],
  title: 'Secrets',
  subtitle: 'Everything in its right place.',
  environments: ['Production', 'Development'],
  newSecret: '+ New secret',
  search: 'Search secrets',
  columns: ['Path', 'Changed in', 'Expires'],
  rows: [
    { path: 'production/shared/STRIPE_SECRET_KEY', version: 'v5', expires: 'in 14 days' },
    { path: 'production/shared/RESEND_API_KEY', version: 'v5', expires: '—' },
    { path: 'production/api/DATABASE_URL', version: 'v8', expires: '—' },
    { path: 'production/api/REDIS_URL', version: 'v6', expires: '—' },
    { path: 'production/api/SENTRY_DSN', version: 'v7', expires: '—' },
    { path: 'production/payments/WEBHOOK_SECRET', version: 'v3', expires: 'in 30 days' },
    { path: 'production/ci/DEPLOY_TOKEN', version: 'v2', expires: '—' },
  ] satisfies SecretRow[],
  footnote: '7 secrets · Values hidden by default',
}

export const assistant = {
  title: 'AI assistant',
  prompt: 'Move the Stripe and Resend keys into production/shared.',
  thinking: ['Finding affected policies…', 'Moving 2 secrets…', 'Verifying permissions…'],
  reply: 'Done. I moved 2 secrets and updated the policies that use them.',
  results: ['2 secrets moved', '2 policies updated', 'Permissions verified'],
  link: 'View changes →',
  placeholder: 'Ask about your secrets',
  // Where the two secrets were before the assistant moved them into production/shared.
  moves: [
    { from: 'production/payments/STRIPE_SECRET_KEY', to: 'production/shared/STRIPE_SECRET_KEY' },
    { from: 'production/email/RESEND_API_KEY', to: 'production/shared/RESEND_API_KEY' },
  ],
}
