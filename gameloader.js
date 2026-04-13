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
    width: 185px;
    height: 185px;
    max-width: 185px;
    max-height: 185px;
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
    width: 185px;
    height: 185px;
    max-width: 185px !important;
    max-height: 185px !important;
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

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;

      if (entry.target.classList.contains('gamecover')) {
        const img = entry.target;
        img.parentElement.parentElement.classList.remove('hide');
        img.parentElement.parentElement.style.animation = 'showGame 0.5s';
        img.addEventListener('load', () => img.classList.remove('loading'), { once: true });
        img.src = img.getAttribute('data-src');
        obs.unobserve(img);
      }

      if (entry.target.classList.contains('ad-lazy')) {
        const adElement = entry.target;
        const gameItem = adElement.closest('.gameitem');
        gameItem.classList.remove('hide');
        gameItem.style.animation = 'showGame 0.5s';

        setTimeout(() => {
          try {
            (window.adsbygoogle = window.adsbygoogle || []).push({});
            console.log('AdSense ad loaded');
          } catch (error) {
            console.error('AdSense error:', error);
          }
        }, 100);

        obs.unobserve(adElement);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.gamecover').forEach(img => observer.observe(img));
  if (!isSearch) {
    document.querySelectorAll('.ad-lazy').forEach(ad => observer.observe(ad));
  }
}

function fetchGames() {
  if (!window.GameCatalog) {
    return Promise.reject(new Error('Game catalog helper not available'));
  }

  return window.GameCatalog.fetchGamesData()
    .then(data => {
      gamesData = data;
      window.GameCatalog.setGamesData(data);
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
