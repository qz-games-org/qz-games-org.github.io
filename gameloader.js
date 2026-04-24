let gamesData = null;

const AD_CONFIG = {
  frequency: 9,
  client: 'ca-pub-1654900800235927',
  slot: '8647420788',
  format: 'auto',
  responsive: true,
};

function ensureCatalogHelper() {
  if (window.GameCatalog) {
    return Promise.resolve(window.GameCatalog);
  }

  return new Promise((resolve, reject) => {
    const existing = document.getElementById('game-catalog-helper');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.GameCatalog));
      existing.addEventListener('error', () => reject(new Error('Failed to load game catalog helper')));
      return;
    }

    const script = document.createElement('script');
    script.id = 'game-catalog-helper';
    script.src = './globalscripts/game-catalog.js';
    script.onload = () => resolve(window.GameCatalog);
    script.onerror = () => reject(new Error('Failed to load game catalog helper'));
    document.head.appendChild(script);
  });
}

function createAdElement() {
  const gameItem = document.createElement('div');
  gameItem.classList.add('gameitem', 'ad-item', 'hide');

  const adContainer = document.createElement('div');
  adContainer.style.cssText = `
    position: relative;
    width: 100%;
    height: 100%;
    max-width: none;
    max-height: none;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto;
  `;

  const adElement = document.createElement('ins');
  adElement.className = 'adsbygoogle ad-lazy';
  adElement.style.cssText = `
    display: block;
    width: 100%;
    height: 100%;
    max-width: none !important;
    max-height: none !important;
  `;
  adElement.setAttribute('data-ad-client', AD_CONFIG.client);
  adElement.setAttribute('data-ad-slot', AD_CONFIG.slot);
  adElement.setAttribute('data-ad-format', 'fixed');
  adElement.setAttribute('data-full-width-responsive', 'false');

  adContainer.appendChild(adElement);
  gameItem.appendChild(adContainer);

  return gameItem;
}

function loadAdSenseScript() {
  if (!document.querySelector('script[src*="adsbygoogle.js"]')) {
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${AD_CONFIG.client}`;
    script.crossOrigin = 'anonymous';
    document.head.appendChild(script);
  }
}

function publishCatalogCount(data) {
  const count = data ? Object.keys(data).length : 0;
  window.qzCatalogGameCount = count;
  window.dispatchEvent(new CustomEvent('qz:catalog-count', {
    detail: { count },
  }));
}

function markCardVisible(gameItem) {
  if (!gameItem) {
    return;
  }

  gameItem.classList.remove('hide');
  gameItem.classList.add('is-visible');
}

function revealGameImage(img, observer) {
  if (!img || img.dataset.revealed === 'true') {
    return;
  }

  img.dataset.revealed = 'true';
  markCardVisible(img.closest('.gameitem'));

  const source = img.getAttribute('data-src');
  const finishLoading = () => img.classList.remove('loading');
  img.addEventListener('load', finishLoading, { once: true });
  img.addEventListener('error', finishLoading, { once: true });

  if (source && img.getAttribute('src') !== source) {
    img.src = source;
  }

  if (img.complete) {
    finishLoading();
  }

  if (observer) {
    observer.unobserve(img);
  }
}

function revealAd(adElement, observer) {
  if (!adElement || adElement.dataset.revealed === 'true') {
    return;
  }

  adElement.dataset.revealed = 'true';
  markCardVisible(adElement.closest('.gameitem'));

  setTimeout(() => {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      console.log('AdSense ad loaded');
    } catch (error) {
      console.error('AdSense error:', error);
    }
  }, 100);

  if (observer) {
    observer.unobserve(adElement);
  }
}

function revealNearViewport(container, observer) {
  const viewportPadding = 700;
  const topLimit = -viewportPadding;
  const bottomLimit = window.innerHeight + viewportPadding;

  container.querySelectorAll('.gamecover[data-src]').forEach(img => {
    const card = img.closest('.gameitem') || img;
    const rect = card.getBoundingClientRect();
    if (rect.bottom >= topLimit && rect.top <= bottomLimit) {
      revealGameImage(img, observer);
    }
  });

  container.querySelectorAll('.ad-lazy').forEach(ad => {
    const card = ad.closest('.gameitem') || ad;
    const rect = card.getBoundingClientRect();
    if (rect.bottom >= topLimit && rect.top <= bottomLimit) {
      revealAd(ad, observer);
    }
  });
}

function isFeedGameVisible(gameItem) {
  return Boolean(
    gameItem
    && !gameItem.hidden
    && gameItem.style.display !== 'none'
  );
}

function getOrderedVisibleGames(container) {
  const games = Array.from(container.querySelectorAll('.gameitem:not(.ad-item)'));
  const domOrder = new Map(games.map((game, index) => [game, index]));

  return games
    .filter(isFeedGameVisible)
    .sort((left, right) => {
      const leftOrder = Number.parseFloat(left.style.order);
      const rightOrder = Number.parseFloat(right.style.order);
      const leftHasOrder = Number.isFinite(leftOrder);
      const rightHasOrder = Number.isFinite(rightOrder);

      if (leftHasOrder && rightHasOrder) {
        return leftOrder - rightOrder || domOrder.get(left) - domOrder.get(right);
      }

      if (leftHasOrder) return -1;
      if (rightHasOrder) return 1;
      return domOrder.get(left) - domOrder.get(right);
    });
}

function redistributeFeedAds() {
  const container = document.getElementById('games');
  if (!container) {
    return;
  }

  const visibleGames = getOrderedVisibleGames(container);
  const ads = Array.from(container.querySelectorAll('.gameitem.ad-item'));
  const visibleAdCount = visibleGames.length > 0
    ? Math.min(ads.length, Math.ceil(visibleGames.length / AD_CONFIG.frequency))
    : 0;

  visibleGames.forEach((game, index) => {
    game.style.order = String(index * 2);
  });

  ads.forEach((ad, index) => {
    if (index >= visibleAdCount) {
      ad.style.display = 'none';
      ad.style.order = '';
      return;
    }

    const insertAfterGameCount = Math.min(
      (index + 1) * AD_CONFIG.frequency,
      visibleGames.length
    );
    ad.style.display = '';
    ad.style.order = String((insertAfterGameCount * 2) - 1);
  });

  window.requestAnimationFrame(() => revealNearViewport(container));
}

function renderGames(data, isSearch = false) {
  const container = document.getElementById('games');
  if (!container || !window.GameCatalog) {
    return;
  }

  container.innerHTML = '';

  const gameKeys = Object.keys(data);
  const fragment = document.createDocumentFragment();
  let gameCount = 0;

  gameKeys.forEach((key, index) => {
    const game = data[key];
    const gameItem = window.GameCatalog.createGameCard(game, {
      gameId: key,
      onClick: typeof trackActivity === 'function' ? trackActivity : null,
    });

    gameItem.dataset.originalOrder = String(gameCount);
    fragment.appendChild(gameItem);
    gameCount++;

    if (!isSearch && gameCount % AD_CONFIG.frequency === 0 && index < gameKeys.length - 1) {
      fragment.appendChild(createAdElement());
    }
  });

  container.appendChild(fragment);

  if (typeof initializeGameSearch === 'function') {
    initializeGameSearch();
  }

  if (!('IntersectionObserver' in window)) {
    container.querySelectorAll('.gamecover[data-src]').forEach(img => revealGameImage(img));
    if (!isSearch) {
      container.querySelectorAll('.ad-lazy').forEach(ad => revealAd(ad));
    }
    return;
  }

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;

      if (entry.target.classList.contains('gamecover')) {
        revealGameImage(entry.target, obs);
      }

      if (entry.target.classList.contains('ad-lazy')) {
        revealAd(entry.target, obs);
      }
    });
  }, {
    rootMargin: '600px 0px',
    threshold: 0.01,
  });

  container.querySelectorAll('.gamecover').forEach(img => observer.observe(img));
  if (!isSearch) {
    container.querySelectorAll('.ad-lazy').forEach(ad => observer.observe(ad));
  }

  window.requestAnimationFrame(() => revealNearViewport(container, observer));
  window.setTimeout(() => revealNearViewport(container, observer), 350);
  window.redistributeFeedAds = redistributeFeedAds;
  window.requestAnimationFrame(redistributeFeedAds);
}

function fetchGames() {
  if (!window.GameCatalog) {
    return Promise.reject(new Error('Game catalog helper not available'));
  }

  return window.GameCatalog.fetchGamesData()
    .then(data => {
      gamesData = data;
      window.GameCatalog.setGamesData(data);
      publishCatalogCount(data);
      renderGames(data);
      return data;
    })
    .catch(error => {
      console.error('Error fetching games:', error);
      throw error;
    });
}

function startCatalog() {
  loadAdSenseScript();
  fetchGames();
}

ensureCatalogHelper()
  .then(() => {
    startCatalog();
  })
  .catch(error => {
    console.error(error);
  });

window.restoreAds = function() {
  if (gamesData) {
    renderGames(gamesData, false);
  }
};

window.redistributeFeedAds = redistributeFeedAds;
