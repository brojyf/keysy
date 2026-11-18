export const NAME_MAX_LENGTH = 32

export type NameIssue = { kind: 'required' } | { kind: 'too-long'; count: number }

export function validateName(value: string): NameIssue | null {
  const count = [...value.trim()].length
  if (count === 0) return { kind: 'required' }
  if (count > NAME_MAX_LENGTH) return { kind: 'too-long', count }
  return null
}
