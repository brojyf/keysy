// Close the mobile navigation drawer as soon as a page or tab link is chosen.
// Tab links live in a dropdown portal outside the drawer. Mintlify remounts the
// page on navigation, which removes the drawer mid-transition, so the
// navigation runs inside a view transition that slides the drawer's snapshot
// out (see style.css).
document.addEventListener('click', (event) => {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const link = event.target.closest('#mobile-nav a[href], a.mobile-nav-tabs-item[href]');
  if (!link || link.target === '_blank') return;
  const drawer = document.getElementById('mobile-nav');
  document.querySelector('#mobile-nav [aria-label="Close navigation"]')?.click();
  const leavesPage = link.origin === location.origin && link.pathname !== location.pathname;
  if (!drawer || !leavesPage || !document.startViewTransition) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.startViewTransition(() => waitForRemoval(drawer));
});

function waitForRemoval(element) {
  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      if (!element.isConnected) finish();
    });
    // Stay under the browser's 4 s limit for view transition updates.
    const timeout = setTimeout(finish, 3000);
    function finish() {
      observer.disconnect();
      clearTimeout(timeout);
      resolve();
    }
    observer.observe(document.body, { childList: true, subtree: true });
  });
}
