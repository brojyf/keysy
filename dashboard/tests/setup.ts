// Browsers have IntersectionObserver. Without it, next/link falls back to a timer
// that updates state after act finishes, so React warns in every test with a Link.
// Next reads this when its module loads, so it must exist before any test imports it.
globalThis.IntersectionObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return [] }
} as unknown as typeof IntersectionObserver
