const CACHE_VERSION = 'v2.0.0';
const CACHE_NAMES = {
  pages: `qz-pages-${CACHE_VERSION}`,
  assets: `qz-assets-${CACHE_VERSION}`,
  data: `qz-data-${CACHE_VERSION}`,
  games: `qz-games-${CACHE_VERSION}`
};
const CACHE_WHITELIST = Object.values(CACHE_NAMES);

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(Promise.resolve());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames.map((cacheName) => {
        if (!CACHE_WHITELIST.includes(cacheName)) {
          return caches.delete(cacheName);
        }

        return Promise.resolve(false);
      })
    );

    await self.clients.claim();
  })());
});

function isSameOrigin(requestUrl) {
  return requestUrl.origin === self.location.origin;
}

function isCacheableResponse(response) {
  return Boolean(response && response.ok && (response.type === 'basic' || response.type === 'cors'));
}

function isNavigationRequest(request) {
  return request.mode === 'navigate' || request.destination === 'document';
}

function isDataRequest(url) {
  return url.pathname.endsWith('/games.json') || url.pathname.endsWith('/chnglog.txt');
}

function isStaticAssetRequest(request, url) {
  if (['script', 'style', 'image', 'font'].includes(request.destination)) {
    return true;
  }

  return /\.(?:css|js|mjs|png|jpg|jpeg|webp|gif|svg|ico|woff2?|ttf)$/i.test(url.pathname);
}

function isGameAssetRequest(url) {
  return (
    /\/Games(?:01)?\//i.test(url.pathname) ||
    /\.(?:data|wasm|unityweb|mem|mp3|ogg|wav|json)$/i.test(url.pathname)
  );
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);

  try {
    const response = await fetch(request);
    if (isCacheableResponse(response)) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    throw error;
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  const response = await fetch(request);
  if (isCacheableResponse(response)) {
    cache.put(request, response.clone());
  }

  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  const networkPromise = fetch(request)
    .then((response) => {
      if (isCacheableResponse(response)) {
        cache.put(request, response.clone());
      }

      return response;
    })
    .catch(() => null);

  return cachedResponse || networkPromise || fetch(request);
}

async function handleRequest(request) {
  const requestUrl = new URL(request.url);

  if (!isSameOrigin(requestUrl)) {
    return fetch(request);
  }

  if (isNavigationRequest(request)) {
    return networkFirst(request, CACHE_NAMES.pages);
  }

  if (isDataRequest(requestUrl)) {
    return staleWhileRevalidate(request, CACHE_NAMES.data);
  }

  if (isStaticAssetRequest(request, requestUrl)) {
    return cacheFirst(request, CACHE_NAMES.assets);
  }

  if (isGameAssetRequest(requestUrl)) {
    return cacheFirst(request, CACHE_NAMES.games);
  }

  return fetch(request);
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    handleRequest(event.request).catch(async () => {
      const cachedResponse = await caches.match(event.request);
      if (cachedResponse) {
        return cachedResponse;
      }

      return new Response('Offline - No cached version available', {
        status: 503,
        statusText: 'Service Unavailable'
      });
    })
  );
});

self.addEventListener('message', (event) => {
  if (!event.data) {
    return;
  }

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName))))
        .then(() => {
          if (event.ports && event.ports[0]) {
            event.ports[0].postMessage({ success: true });
          }
        })
    );
  }
});
