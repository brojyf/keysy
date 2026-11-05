export type Organization = { id: string; name: string; role: 'owner' | 'admin' | 'developer'; memberCount: number }

export function parseCreatedOrganization(value: unknown): { id: string; name: string } {
  if (!value || typeof value !== 'object') throw new Error('Invalid organization')
  const item = value as Record<string, unknown>
  if (typeof item.id !== 'string' || !item.id || typeof item.name !== 'string' || !item.name.trim()) throw new Error('Invalid organization')
  return { id: item.id, name: item.name }
}

export function parseOrganizations(value: unknown): Organization[] {
  if (!Array.isArray(value)) throw new Error('Invalid organizations')
  return value.map((item: unknown) => {
    const organization = parseCreatedOrganization(item)
    const fields = item as Record<string, unknown>
    if ((fields.role !== 'owner' && fields.role !== 'admin' && fields.role !== 'developer') || !Number.isInteger(fields.memberCount) || (fields.memberCount as number) < 1) throw new Error('Invalid organization')
    return { ...organization, role: fields.role, memberCount: fields.memberCount as number }
  })
}
