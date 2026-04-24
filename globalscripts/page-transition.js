(function() {
  const VERSION = 1;
  const TOKEN_KEY = 'qzPageTransition';
  const TOKEN_TTL_MS = 10000;
  const OUTGOING_MIN_MS = 760;
  const INCOMING_READY_MS = 560;
  const COMPLETE_HOLD_MS = 360;
  const EXIT_MS = 420;

  if (window.QZPageTransition && window.QZPageTransition.__version >= VERSION) {
    if (typeof window.QZPageTransition.bindGameLinks === 'function') {
      window.QZPageTransition.bindGameLinks();
    }
    return;
  }

  const rootBase = getRootBase();
  let clickHandlerBound = false;
  let activeOverlay = null;
  let incomingState = null;
  let stylesInjected = false;
  let outgoingStarted = false;

  function getRootBase() {
    const currentScript = document.currentScript;
    if (currentScript && currentScript.src) {
      return new URL('../', currentScript.src).href;
    }

    return window.location.pathname.toLowerCase().includes('/games/') ? '../' : './';
  }

  function readCookie(name) {
    if (typeof getCookie === 'function') {
      return getCookie(name);
    }

    const encodedName = encodeURIComponent(name) + '=';
    const parts = document.cookie ? document.cookie.split('; ') : [];
    for (let index = 0; index < parts.length; index += 1) {
      if (parts[index].indexOf(encodedName) === 0) {
        return decodeURIComponent(parts[index].slice(encodedName.length));
      }
    }

    return null;
  }

  function getLocalStorageItem(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function isEnabled() {
    if (readCookie('disableAnimations') === 'true') {
      return false;
    }

    return getLocalStorageItem('pageLoadingTransitions') !== 'false';
  }

  function shouldUseSimpleMotion() {
    if (getLocalStorageItem('reduceVisualEffects') === 'true') {
      return true;
    }

    return Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function toUrl(value) {
    try {
      return new URL(value, window.location.href);
    } catch (error) {
      return null;
    }
  }

  function normalizeUrlForCompare(url) {
    return `${url.origin}${url.pathname}${url.search}`;
  }

  function isGamePlayerUrl(url) {
    if (!url || url.origin !== window.location.origin) {
      return false;
    }

    const path = url.pathname.replace(/\\/g, '/').toLowerCase();
    return path.endsWith('/games/game.html') || path.endsWith('/games/buckshot-roulette.html');
  }

  function getNavigationType() {
    const entries = performance && typeof performance.getEntriesByType === 'function'
      ? performance.getEntriesByType('navigation')
      : [];
    return entries && entries[0] ? entries[0].type : 'navigate';
  }

  function delay(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function resolveAssetPath(value, fallback) {
    const candidate = value || fallback;
    const url = toUrl(candidate || fallback);
    return url ? url.href : fallback;
  }

  function getAnchorCover(anchor) {
    const image = anchor && anchor.querySelector('img');
    if (!image) {
      return '';
    }

    return image.currentSrc || image.src || image.getAttribute('data-src') || '';
  }

  function getAnchorGameName(anchor) {
    if (!anchor) {
      return '';
    }

    const card = anchor.closest('.gameitem, .r-card');
    if (card && card.dataset.gameName) {
      return card.dataset.gameName;
    }

    const label = anchor.querySelector('.gametextover, .r-name');
    return label ? label.textContent.trim() : (anchor.getAttribute('aria-label') || '').replace(/^Play\s+/i, '').trim();
  }

  function getAnchorGameId(anchor, url) {
    const card = anchor && anchor.closest('.gameitem, .r-card');
    return (card && card.dataset.gameId) || url.searchParams.get('id') || '';
  }

  function buildToken(url, anchor, options) {
    return {
      v: VERSION,
      kind: 'game',
      from: window.location.href,
      to: normalizeUrlForCompare(url),
      gameId: options.gameId || getAnchorGameId(anchor, url),
      gameName: options.gameName || getAnchorGameName(anchor) || 'Loading game',
      cover: resolveAssetPath(options.cover || getAnchorCover(anchor), `${rootBase}Q-BIG.png`),
      createdAt: Date.now()
    };
  }

  function writeToken(token) {
    try {
      window.sessionStorage.setItem(TOKEN_KEY, JSON.stringify(token));
    } catch (error) {
      console.warn('Could not store page transition token.', error);
    }
  }

  function readAndRemoveToken() {
    try {
      const rawToken = window.sessionStorage.getItem(TOKEN_KEY);
      window.sessionStorage.removeItem(TOKEN_KEY);
      return rawToken ? JSON.parse(rawToken) : null;
    } catch (error) {
      return null;
    }
  }

  function validateIncomingToken(token) {
    if (!token || token.v !== VERSION || token.kind !== 'game' || !isEnabled()) {
      return false;
    }

    if (Date.now() - Number(token.createdAt || 0) > TOKEN_TTL_MS) {
      return false;
    }

    const fromUrl = toUrl(token.from);
    if (!fromUrl || fromUrl.origin !== window.location.origin) {
      return false;
    }

    if (document.referrer) {
      const referrerUrl = toUrl(document.referrer);
      if (referrerUrl && referrerUrl.origin !== window.location.origin) {
        return false;
      }
    }

    if (normalizeUrlForCompare(window.location) !== token.to) {
      return false;
    }

    return getNavigationType() === 'navigate';
  }

  function injectStyles() {
    if (stylesInjected || document.getElementById('qz-page-transition-styles')) {
      stylesInjected = true;
      return;
    }

    const style = document.createElement('style');
    style.id = 'qz-page-transition-styles';
    style.textContent = `
      .qz-page-transition {
        position: fixed;
        inset: 0;
        z-index: 2147483000;
        display: grid;
        place-items: center;
        overflow: hidden;
        background: #050608;
        color: var(--text-color, #fff);
        font-family: 'Poppins', Arial, sans-serif;
        opacity: 0;
        visibility: hidden;
        pointer-events: auto;
        transform: scale(1.015);
        transition: opacity 0.42s cubic-bezier(0.22, 1, 0.36, 1), transform 0.42s cubic-bezier(0.22, 1, 0.36, 1), visibility 0.42s linear;
      }

      .qz-page-transition.is-visible {
        opacity: 1;
        visibility: visible;
        transform: scale(1);
      }

      .qz-page-transition.is-exiting {
        opacity: 0;
        visibility: hidden;
        transform: scale(1.025);
        pointer-events: none;
      }

      .qz-page-transition-bg {
        position: absolute;
        inset: -9%;
        width: 118%;
        height: 118%;
        object-fit: cover;
        opacity: 0;
        filter: blur(30px) saturate(0.82) brightness(0.24);
        transform: scale(1.1);
        transition: opacity 0.58s ease, transform 0.78s cubic-bezier(0.22, 1, 0.36, 1);
      }

      .qz-page-transition.is-visible .qz-page-transition-bg {
        opacity: 0.64;
        transform: scale(1.03);
      }

      .qz-page-transition-scrim {
        position: absolute;
        inset: 0;
        background:
          radial-gradient(circle at center, rgba(255, 255, 255, 0.06) 0%, rgba(6, 8, 10, 0.28) 34%, rgba(2, 3, 5, 0.92) 100%),
          linear-gradient(180deg, rgba(10, 12, 16, 0.84) 0%, rgba(3, 4, 6, 0.95) 100%);
      }

      .qz-page-transition-core {
        position: relative;
        z-index: 1;
        display: grid;
        place-items: center;
        opacity: 0;
        transform: translateY(12px) scale(0.88);
        transition: opacity 0.36s ease, transform 0.58s cubic-bezier(0.22, 1, 0.36, 1);
      }

      .qz-page-transition.is-visible .qz-page-transition-core {
        opacity: 1;
        transform: translateY(0) scale(1);
      }

      .qz-page-transition-logo-wrap {
        width: 66px;
        height: 66px;
        border-radius: 999px;
        display: grid;
        place-items: center;
        background: linear-gradient(180deg, var(--sidenav-bg-start, rgba(26, 26, 26, 0.86)) 0%, var(--sidenav-bg-end, #0d0d0d) 100%);
        border: 1px solid var(--sidenav-border, rgba(255, 255, 255, 0.12));
        box-shadow: 0 20px 70px rgba(0, 0, 0, 0.54), inset 0 1px 0 rgba(255, 255, 255, 0.08);
      }

      .qz-page-transition-logo {
        width: 40px;
        height: 40px;
        object-fit: contain;
        border-radius: 999px;
      }

      .qz-page-transition-ring {
        position: absolute;
        width: 96px;
        height: 96px;
        transform: rotate(-90deg);
        filter: drop-shadow(0 0 16px rgba(255, 255, 255, 0.1));
      }

      .qz-page-transition.is-loading .qz-page-transition-ring {
        animation: qzPageTransitionSpin 1.12s linear infinite;
      }

      .qz-page-transition-ring-track,
      .qz-page-transition-ring-progress {
        fill: none;
        stroke-width: 4;
      }

      .qz-page-transition-ring-track {
        stroke: var(--sidenav-icon-btn-border, rgba(255, 255, 255, 0.12));
      }

      .qz-page-transition-ring-progress {
        stroke: var(--sidenav-menu-highlight-border-hover, rgba(255, 255, 255, 0.72));
        stroke-linecap: round;
        stroke-dasharray: 226.19;
        stroke-dashoffset: 226.19;
        transition: stroke-dashoffset 0.52s cubic-bezier(0.22, 1, 0.36, 1);
      }

      .qz-page-transition.is-visible .qz-page-transition-ring-progress {
        stroke-dashoffset: 72;
      }

      .qz-page-transition.is-complete .qz-page-transition-ring {
        animation: none;
      }

      .qz-page-transition.is-complete .qz-page-transition-ring-progress {
        stroke-dashoffset: 0;
        transition-duration: 0.34s;
      }

      .qz-page-transition-copy {
        position: absolute;
        top: calc(50% + 76px);
        left: 50%;
        z-index: 1;
        width: min(320px, calc(100vw - 40px));
        transform: translateX(-50%) translateY(10px);
        text-align: center;
        opacity: 0;
        transition: opacity 0.36s ease 0.08s, transform 0.5s cubic-bezier(0.22, 1, 0.36, 1) 0.08s;
      }

      .qz-page-transition.is-visible .qz-page-transition-copy {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }

      .qz-page-transition-label {
        margin-bottom: 7px;
        color: rgba(255, 255, 255, 0.54);
        font-size: 0.66rem;
        font-weight: 700;
        letter-spacing: 1.7px;
        text-transform: uppercase;
      }

      .qz-page-transition-title {
        color: #fff;
        font-size: clamp(1rem, 2.2vw, 1.22rem);
        font-weight: 700;
        line-height: 1.2;
        text-shadow: 0 12px 34px rgba(0, 0, 0, 0.7);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .qz-page-transition.is-simple .qz-page-transition-bg {
        display: none;
      }

      .qz-page-transition.is-simple,
      .qz-page-transition.is-simple * {
        animation: none !important;
        transition-duration: 0.16s !important;
      }

      body.qz-page-transition-lock {
        overflow: hidden;
      }

      @keyframes qzPageTransitionSpin {
        to {
          transform: rotate(270deg);
        }
      }

      @media (max-width: 560px) {
        .qz-page-transition-logo-wrap {
          width: 58px;
          height: 58px;
          border-radius: 999px;
        }

        .qz-page-transition-logo {
          width: 35px;
          height: 35px;
        }

        .qz-page-transition-ring {
          width: 86px;
          height: 86px;
        }

        .qz-page-transition-copy {
          top: calc(50% + 68px);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .qz-page-transition,
        .qz-page-transition * {
          animation: none !important;
          transition-duration: 0.16s !important;
        }
      }
    `;
    document.head.appendChild(style);
    stylesInjected = true;
  }

  function createOverlay(token, mode) {
    injectStyles();

    if (activeOverlay) {
      activeOverlay.remove();
    }

    const overlay = document.createElement('div');
    overlay.className = `qz-page-transition is-${mode}`;
    overlay.setAttribute('aria-hidden', 'true');
    if (shouldUseSimpleMotion()) {
      overlay.classList.add('is-simple');
    }

    const background = document.createElement('img');
    background.className = 'qz-page-transition-bg';
    background.alt = '';
    background.setAttribute('aria-hidden', 'true');
    background.decoding = 'async';
    background.src = resolveAssetPath(token.cover, `${rootBase}Q-BIG.png`);

    const scrim = document.createElement('div');
    scrim.className = 'qz-page-transition-scrim';

    const core = document.createElement('div');
    core.className = 'qz-page-transition-core';

    const ring = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    ring.classList.add('qz-page-transition-ring');
    ring.setAttribute('viewBox', '0 0 88 88');
    ring.setAttribute('aria-hidden', 'true');

    const track = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    track.classList.add('qz-page-transition-ring-track');
    track.setAttribute('cx', '44');
    track.setAttribute('cy', '44');
    track.setAttribute('r', '36');

    const progress = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    progress.classList.add('qz-page-transition-ring-progress');
    progress.setAttribute('cx', '44');
    progress.setAttribute('cy', '44');
    progress.setAttribute('r', '36');

    ring.appendChild(track);
    ring.appendChild(progress);

    const logoWrap = document.createElement('div');
    logoWrap.className = 'qz-page-transition-logo-wrap';

    const logo = document.createElement('img');
    logo.className = 'qz-page-transition-logo';
    logo.alt = 'Qz Games';
    logo.src = `${rootBase}Q.png`;

    logoWrap.appendChild(logo);
    core.appendChild(ring);
    core.appendChild(logoWrap);

    const copy = document.createElement('div');
    copy.className = 'qz-page-transition-copy';

    const label = document.createElement('div');
    label.className = 'qz-page-transition-label';
    label.textContent = mode === 'incoming' ? 'Loading game' : 'Opening game';

    const title = document.createElement('div');
    title.className = 'qz-page-transition-title';
    title.textContent = token.gameName || 'Loading game';

    copy.appendChild(label);
    copy.appendChild(title);

    overlay.appendChild(background);
    overlay.appendChild(scrim);
    overlay.appendChild(core);
    overlay.appendChild(copy);
    document.body.appendChild(overlay);
    document.body.classList.add('qz-page-transition-lock');

    activeOverlay = overlay;
    return overlay;
  }

  function revealOverlay(overlay) {
    const waitTime = overlay.classList.contains('is-simple') ? 130 : INCOMING_READY_MS;

    window.requestAnimationFrame(() => {
      overlay.classList.add('is-visible');
      overlay.classList.add('is-loading');
    });

    return delay(waitTime);
  }

  function clearActiveOverlay() {
    if (activeOverlay) {
      activeOverlay.remove();
      activeOverlay = null;
    }

    document.body.classList.remove('qz-page-transition-lock');
  }

  function startOutgoingNavigation(target, options = {}) {
    if (outgoingStarted || !isEnabled()) {
      return false;
    }

    const anchor = target instanceof HTMLAnchorElement ? target : null;
    const url = toUrl(anchor ? anchor.href : target);
    if (!isGamePlayerUrl(url)) {
      return false;
    }

    outgoingStarted = true;
    const token = buildToken(url, anchor, options);
    writeToken(token);

    const overlay = createOverlay(token, 'outgoing');
    const minTime = overlay.classList.contains('is-simple') ? 160 : OUTGOING_MIN_MS;
    revealOverlay(overlay);

    window.setTimeout(() => {
      window.location.assign(url.href);
    }, minTime);

    window.setTimeout(() => {
      if (!document.hidden && outgoingStarted) {
        outgoingStarted = false;
        clearActiveOverlay();
        try {
          window.sessionStorage.removeItem(TOKEN_KEY);
        } catch (error) {
          // Ignore storage cleanup failures.
        }
      }
    }, minTime + 8000);

    return true;
  }

  function shouldHandleClick(event, anchor) {
    if (!anchor || event.defaultPrevented || event.button !== 0) {
      return false;
    }

    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return false;
    }

    if (anchor.target && anchor.target.toLowerCase() !== '_self') {
      return false;
    }

    if (anchor.hasAttribute('download') || anchor.dataset.qzNoTransition === 'true') {
      return false;
    }

    return isGamePlayerUrl(toUrl(anchor.href));
  }

  function bindGameLinks() {
    if (clickHandlerBound || !document || !document.addEventListener) {
      return;
    }

    clickHandlerBound = true;
    document.addEventListener('click', (event) => {
      const anchor = event.target && event.target.closest
        ? event.target.closest('a[href]')
        : null;

      if (!shouldHandleClick(event, anchor)) {
        return;
      }

      if (startOutgoingNavigation(anchor)) {
        event.preventDefault();
      }
    });
  }

  function consumeIncomingToken() {
    if (incomingState) {
      return incomingState.readyPromise;
    }

    const token = readAndRemoveToken();
    if (!validateIncomingToken(token)) {
      return null;
    }

    const overlay = createOverlay(token, 'incoming');
    incomingState = {
      token,
      overlay,
      completed: false,
      readyPromise: revealOverlay(overlay),
      completionPromise: null
    };

    return incomingState.readyPromise;
  }

  function completeIncoming() {
    if (!incomingState || !incomingState.overlay) {
      return null;
    }

    if (incomingState.completionPromise) {
      return incomingState.completionPromise;
    }

    incomingState.completed = true;
    const overlay = incomingState.overlay;
    incomingState.completionPromise = Promise.resolve(incomingState.readyPromise)
      .then(() => {
        overlay.classList.remove('is-loading');
        overlay.classList.add('is-complete');
        return delay(overlay.classList.contains('is-simple') ? 140 : COMPLETE_HOLD_MS);
      })
      .then(() => {
        overlay.classList.add('is-exiting');
        return delay(overlay.classList.contains('is-simple') ? 180 : EXIT_MS);
      })
      .then(() => {
        overlay.remove();
        if (activeOverlay === overlay) {
          activeOverlay = null;
        }
        incomingState = null;
        document.body.classList.remove('qz-page-transition-lock');
        return true;
      });

    return incomingState.completionPromise;
  }

  window.QZPageTransition = {
    __version: VERSION,
    isEnabled,
    bindGameLinks,
    startOutgoingNavigation,
    consumeIncomingToken,
    completeIncoming
  };

  bindGameLinks();
})();
