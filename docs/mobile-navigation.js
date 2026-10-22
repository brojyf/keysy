// Close the mobile navigation drawer as soon as a page link is chosen, so it
// slides out while the next page loads, then fade the new page content in.
document.addEventListener('click', (event) => {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const link = event.target.closest('#mobile-nav a[href]');
  if (!link || link.target === '_blank') return;
  document.querySelector('#mobile-nav [aria-label="Close navigation"]')?.click();
  fadeInContentAfterNavigation(location.pathname);
});

function fadeInContentAfterNavigation(previousPath) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const startedAt = performance.now();
  requestAnimationFrame(function waitForNextPage() {
    if (location.pathname !== previousPath) {
      document.getElementById('content-area')?.animate(
        [
          { opacity: 0, transform: 'translateY(0.5rem)' },
          { opacity: 1, transform: 'none' },
        ],
        { duration: 200, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
      );
    } else if (performance.now() - startedAt < 5000) {
      requestAnimationFrame(waitForNextPage);
    }
  });
}
