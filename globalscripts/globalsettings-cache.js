(function() {
  const CACHE_ENABLED_KEY = 'cacheEnabled';

  function getRootBase() {
    const currentScript = document.currentScript;
    if (currentScript && currentScript.src) {
      return new URL('../', currentScript.src).href;
    }

    return window.location.pathname.includes('/Games/')
      ? '../'
      : './';
  }

  const ROOT_BASE = getRootBase();
  const SERVICE_WORKER_URL = new URL('service-worker.js', ROOT_BASE).href;

  function isCachingEnabled() {
    try {
      return window.localStorage.getItem(CACHE_ENABLED_KEY) === 'true';
    } catch (error) {
      console.error('Failed to read cache preference.', error);
      return false;
    }
  }

  async function getRegistration() {
    if (!('serviceWorker' in navigator)) {
      return null;
    }

    try {
      return await navigator.serviceWorker.getRegistration(ROOT_BASE);
    } catch (error) {
      return navigator.serviceWorker.getRegistration();
    }
  }

  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      return null;
    }

    return navigator.serviceWorker.register(SERVICE_WORKER_URL, {
      updateViaCache: 'none'
    });
  }

  async function unregisterServiceWorkers() {
    if (!('serviceWorker' in navigator)) {
      return false;
    }

    const registrations = await navigator.serviceWorker.getRegistrations();
    if (!registrations.length) {
      return false;
    }

    const results = await Promise.all(registrations.map((registration) => registration.unregister()));
    return results.some(Boolean);
  }

  async function clearAllCaches() {
    if (!('caches' in window)) {
      return false;
    }

    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
    return true;
  }

  async function calculateCacheSize() {
    if (!('caches' in window)) {
      return 'Not supported';
    }

    const cacheNames = await caches.keys();
    let totalSize = 0;

    for (const cacheName of cacheNames) {
      const cache = await caches.open(cacheName);
      const keys = await cache.keys();

      for (const request of keys) {
        const response = await cache.match(request);
        if (!response) {
          continue;
        }

        const blob = await response.blob();
        totalSize += blob.size;
      }
    }

    if (totalSize === 0) {
      return '0 KB';
    }

    if (totalSize < 1024) {
      return `${totalSize} bytes`;
    }

    if (totalSize < 1024 * 1024) {
      return `${(totalSize / 1024).toFixed(2)} KB`;
    }

    return `${(totalSize / (1024 * 1024)).toFixed(2)} MB`;
  }

  async function getServiceWorkerStatus() {
    if (!('serviceWorker' in navigator)) {
      return 'Not supported';
    }

    const registration = await getRegistration();
    if (!registration) {
      return isCachingEnabled() ? 'Not registered' : 'Disabled';
    }

    if (registration.installing) {
      return 'Installing';
    }

    if (registration.waiting) {
      return 'Waiting';
    }

    if (registration.active) {
      return 'Active';
    }

    return 'Unknown';
  }

  async function forceUpdate() {
    const registration = await getRegistration();
    if (!registration) {
      return false;
    }

    await registration.update();
    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }

    return true;
  }

  async function setCachingEnabled(enabled, options = {}) {
    const { clearOnDisable = true } = options;

    try {
      window.localStorage.setItem(CACHE_ENABLED_KEY, String(enabled));
    } catch (error) {
      console.error('Failed to persist cache preference.', error);
    }

    if (!('serviceWorker' in navigator)) {
      if (!enabled && clearOnDisable) {
        await clearAllCaches();
      }
      return null;
    }

    if (enabled) {
      return registerServiceWorker();
    }

    await unregisterServiceWorkers();
    if (clearOnDisable) {
      await clearAllCaches();
    }

    return null;
  }

  async function syncRegistration() {
    if (!('serviceWorker' in navigator)) {
      return null;
    }

    if (isCachingEnabled()) {
      return registerServiceWorker();
    }

    await unregisterServiceWorkers();
    return null;
  }

  window.QZCacheControl = {
    CACHE_ENABLED_KEY,
    SERVICE_WORKER_URL,
    isCachingEnabled,
    getRegistration,
    registerServiceWorker,
    unregisterServiceWorkers,
    clearAllCaches,
    calculateCacheSize,
    getServiceWorkerStatus,
    forceUpdate,
    setCachingEnabled,
    syncRegistration
  };

  syncRegistration().catch((error) => {
    console.error('Failed to sync service worker registration.', error);
  });
})();
