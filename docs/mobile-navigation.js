// Close the mobile navigation drawer as soon as a page link is chosen, so it
// slides out while the next page loads.
document.addEventListener('click', (event) => {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const link = event.target.closest('#mobile-nav a[href]');
  if (!link || link.target === '_blank') return;
  document.querySelector('#mobile-nav [aria-label="Close navigation"]')?.click();
});
