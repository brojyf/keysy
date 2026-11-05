export type SessionUser = {
  id: string
  email: string
  displayName: string
  agentAutoApply: boolean
  avatarUrl?: string
  memberships?: unknown
}

export function parseSessionUser(session: unknown): SessionUser {
  if (typeof session !== 'object' || session === null) throw new Error('Invalid session response')
  const user = session as Record<string, unknown>
  if (typeof user.id !== 'string' || !user.id || typeof user.email !== 'string' || typeof user.displayName !== 'string' || typeof user.agentAutoApply !== 'boolean' || (user.avatarUrl !== undefined && typeof user.avatarUrl !== 'string')) {
    throw new Error('Invalid session response')
  }
  return user as SessionUser
}
