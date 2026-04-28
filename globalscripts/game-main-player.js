(function() {
  const isModernGameShell = () => Boolean(document.querySelector('.loading-overlay'));

  function getGameParams() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const game = params.get('game');
    const name = params.get('name');
    let type = params.get('type');

    if (type === 'null' || type === null) {
      type = 'unset';
    }

    return { params, id, game, name, type };
  }

  function sanitizeGameType(type) {
    return type === 'flash' || type === 'unity' || type === 'html'
      ? type
      : 'html';
  }

  async function getResolvedGameContext() {
    // Dev fallback: skip catalog UI entirely on localhost when no game/id param is present.
    const _h = location.hostname;
    const isLocalhost = _h === 'localhost' || _h === '[::1]' || /^\d+\.\d+\.\d+\.\d+$/.test(_h);
    if (isLocalhost) {
      const { id, game } = getGameParams();
      if (!id && !game) {
        console.info('[QZ Dev] Localhost with no game param — loading Slope as dev fallback');
        return { url: '../Games/Slope.html', type: 'html', id: null, name: 'Slope (dev)' };
      }
    }

    if (window.QZGamePage && typeof window.QZGamePage.resolveRequestedGame === 'function') {
      const resolvedContext = await window.QZGamePage.resolveRequestedGame();
      if (!resolvedContext || !resolvedContext.game || !resolvedContext.game.link) {
        return null;
      }

      return {
        url: resolvedContext.game.link,
        type: sanitizeGameType(resolvedContext.game.type),
        id: resolvedContext.id,
        name: resolvedContext.game.name
      };
    }

    const { game, type } = getGameParams();
    if (!game) {
      return null;
    }

    return {
      url: game,
      type: sanitizeGameType(type),
      id: null,
      name: null
    };
  }

  function backhome() {
    window.location = '../index.html';
  }

  function getFullscreenTarget() {
    const { game, type } = getGameParams();

    if (type === 'flash' || (game && game.toLowerCase().includes('.swf'))) {
      return document.getElementById('rufflePlayer') || document.getElementById('maingamestuff');
    }

    return document.getElementById('gameiframe');
  }

  function toggleFullscreen() {
    const targetElement = getFullscreenTarget();

    if (!targetElement) {
      console.error('Fullscreen Function Not Available');
      return;
    }

    if (document.fullscreenElement || document.webkitFullscreenElement ||
        document.mozFullScreenElement || document.msFullscreenElement) {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
      return;
    }

    if (targetElement.requestFullscreen) {
      targetElement.requestFullscreen();
    } else if (targetElement.webkitRequestFullscreen) {
      targetElement.webkitRequestFullscreen();
    } else if (targetElement.mozRequestFullScreen) {
      targetElement.mozRequestFullScreen();
    } else if (targetElement.msRequestFullscreen) {
      targetElement.msRequestFullscreen();
    } else {
      console.warn('Fullscreen API is not supported by this browser.');
    }
  }

  function loadRuffleScript() {
    return new Promise((resolve, reject) => {
      if (window.RufflePlayer) {
        resolve();
        return;
      }

      window.RufflePlayer = window.RufflePlayer || {};
      window.RufflePlayer.config = {
        publicPath: 'https://unpkg.com/@ruffle-rs/ruffle/',
        autoplay: 'on',
        unmuteOverlay: 'hidden',
        letterbox: 'on',
        allowFullscreen: true,
        allowNetworking: 'all'
      };

      const script = document.createElement('script');
      script.src = 'https://unpkg.com/@ruffle-rs/ruffle';
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function loadRuffle(swfUrl) {
    try {
      const container = document.getElementById('maingamestuff');
      if (!container) {
        throw new Error('#maingamestuff not found');
      }

      container.innerHTML = '';
      container.style.display = 'block';
      container.style.position = 'fixed';
      container.style.width = '100%';
      container.style.height = '100%';
      if (container.offsetHeight < 100) {
        container.style.minHeight = '600px';
      }

      if (!window.RufflePlayer) {
        await loadRuffleScript();
      }

      await new Promise((resolve) => window.setTimeout(resolve, 100));

      const ruffle = window.RufflePlayer.newest();
      const player = ruffle.createPlayer();
      player.id = 'rufflePlayer';
      player.style.width = '100%';
      player.style.height = '100%';
      player.style.display = 'block';
      player.addEventListener('loadeddata', () => {
        if (typeof window.doneloading === 'function') {
          window.doneloading();
        }
      });

      container.appendChild(player);
      await player.load(swfUrl);
    } catch (error) {
      console.error('Failed to load Ruffle:', error);
    }
  }

  async function waitForIncomingPageTransition() {
    if (!window.QZPageTransition || typeof window.QZPageTransition.consumeIncomingToken !== 'function') {
      return;
    }

    await window.QZPageTransition.consumeIncomingToken();
  }

  async function initGame(url, type) {
    await waitForIncomingPageTransition();

    const container = document.getElementById('maingamestuff');
    const modernShell = isModernGameShell();

    switch (type) {
      case 'flash':
        if (container) {
          container.style.display = 'block';
        }
        await loadRuffle(url);
        break;

      case 'unity':
      case 'html':
      default: {
        if (container && !modernShell) {
          container.style.display = 'block';

          if (!document.getElementById('gameiframe')) {
            container.innerHTML = '<iframe src="" class="gameiframe" id="gameiframe" allowfullscreen></iframe>';
          }
        } else if (container) {
          container.style.display = 'none';
        }

        const iframe = document.getElementById('gameiframe');
        if (iframe) {
          iframe.style.display = 'block';
          let loadingCompleted = false;
          let loadingFallbackTimer;
          const completeLoading = () => {
            if (loadingCompleted) {
              return;
            }

            loadingCompleted = true;
            if (loadingFallbackTimer) {
              window.clearTimeout(loadingFallbackTimer);
            }

            if (typeof window.doneloading === 'function') {
              window.doneloading();
            }
          };

          iframe.addEventListener('load', completeLoading, { once: true });
          iframe.src = url;
          loadingFallbackTimer = window.setTimeout(completeLoading, 3500);
          break;
        }

        console.error('#gameiframe not found');
      }
    }
  }

  async function init() {
    if (window.__qzGamePlayerInitialized) {
      return;
    }

    window.__qzGamePlayerInitialized = true;

    const resolvedGame = await getResolvedGameContext();
    if (resolvedGame && resolvedGame.url) {
      const selectorOverlay = document.getElementById('game-selector-overlay');
      if (selectorOverlay) {
        selectorOverlay.classList.remove('active');
        selectorOverlay.hidden = true;
        selectorOverlay.style.display = 'none';
      }
      initGame(resolvedGame.url, resolvedGame.type);
      return;
    }

    if (window.QZGamePage && typeof window.QZGamePage.resolveRequestedGame === 'function') {
      console.warn('No matching catalog game was resolved for this player request.');
      return;
    }

    console.warn('No game parameter found');
    initGame('error.html', 'html');
  }

  if (typeof window.Backhome !== 'function') {
    window.Backhome = backhome;
  }

  if (typeof window.ToggleFullscreen !== 'function') {
    window.ToggleFullscreen = toggleFullscreen;
  }

  window.QZGameMainPlayer = {
    getGameParams,
    init,
    initGame,
    loadRuffle,
    loadRuffleScript
  };
})();
