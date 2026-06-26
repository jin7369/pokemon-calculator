export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    const serviceWorkerUrl = new URL('service-worker.js', window.location.href);
    navigator.serviceWorker.register(serviceWorkerUrl, { scope: './' }).catch(() => undefined);
  });
}
