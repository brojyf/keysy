// Mock data from the Figma Account screens (7.2, 7.4, 7.5) until account APIs exist.

export const mockOrganizations = [
  { name: 'platform', role: 'Developer', members: 12 },
  { name: 'marketing-site', role: 'Admin', members: 4 },
]

export const mockSessions = [
  { id: 'web', client: 'Web', device: 'Chrome on macOS', lastUsed: 'Now', current: true },
  { id: 'cli-mbp', client: 'CLI', device: 'jordan-mbp', lastUsed: '2 hours ago', current: false },
  { id: 'extension', client: 'Browser extension', device: 'Chrome on macOS', lastUsed: 'Yesterday', current: false },
  { id: 'cli-desktop', client: 'CLI', device: 'work-desktop', lastUsed: 'Oct 12', current: false },
]
