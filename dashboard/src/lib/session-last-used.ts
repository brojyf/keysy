const minute = 60_000
const hour = 60 * minute

export function formatLastUsed(lastUsedAt: string, current: boolean, now = new Date()): string {
  const lastUsed = new Date(lastUsedAt)
  const elapsed = now.getTime() - lastUsed.getTime()
  if (current || elapsed < minute) return 'Now'
  if (elapsed < hour) {
    const minutes = Math.floor(elapsed / minute)
    return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`
  }
  if (elapsed < 24 * hour) {
    const hours = Math.floor(elapsed / hour)
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`
  }
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  if (lastUsed.getFullYear() === yesterday.getFullYear() && lastUsed.getMonth() === yesterday.getMonth() && lastUsed.getDate() === yesterday.getDate()) return 'Yesterday'
  const sameYear = lastUsed.getFullYear() === now.getFullYear()
  return lastUsed.toLocaleDateString('en-US', sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' })
}
