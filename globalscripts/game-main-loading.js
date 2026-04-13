(function() {
  const isModernGameShell = () => Boolean(document.querySelector('.loading-overlay'));

  function getGameJsonUrl() {
    return new URL('../games.json', window.location.href).href;
  }

  function getLegacyElements() {
    return {
      gameCover: document.getElementById('gameCover'),
      gradientBg: document.getElementById('gradientBg'),
      gameTitle: document.getElementById('gameTitle'),
      errorMessage: document.getElementById('errorMessage'),
      loadingContainer: document.getElementById('loadingcont'),
      progbar: document.getElementById('progbar'),
      loadAnimation: document.getElementById('loadan'),
      options: document.getElementById('options'),
      mainGameStuff: document.getElementById('maingamestuff')
    };
  }

  function hasLegacyLoadingSurface() {
    if (isModernGameShell()) {
      return false;
    }

    const elements = getLegacyElements();
    return Boolean(elements.gameCover && elements.loadingContainer);
  }

  function getUrlParameter(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function applyGradientColor(color) {
    const { gradientBg } = getLegacyElements();
    if (!gradientBg || !color) {
      return;
    }

    if (color.toLowerCase() === 'black') {
      gradientBg.style.background = 'radial-gradient(circle, rgba(50, 50, 50, 0.4), rgba(30, 30, 30, 0.3), transparent)';
    } else if (color.startsWith('#') || color.startsWith('rgb') || color.startsWith('hsl')) {
      gradientBg.style.background = `radial-gradient(circle, ${color}40, ${color}20, transparent)`;
    } else {
      gradientBg.style.background = `radial-gradient(circle, ${color}, transparent)`;
    }
  }

  function showError(message) {
    const { errorMessage, gameTitle } = getLegacyElements();
    if (gameTitle) {
      gameTitle.textContent = 'Error';
      gameTitle.classList.remove('pulse');
    }
    if (errorMessage) {
      errorMessage.textContent = message;
      errorMessage.style.display = 'block';
    }
  }

  async function loadGameFromJSON() {
    if (!hasLegacyLoadingSurface()) {
      return;
    }

    try {
      const { gameTitle, gameCover } = getLegacyElements();
      if (gameTitle) {
        gameTitle.textContent = '';
        gameTitle.style.opacity = '0';
      }

      const gamesData = window.GameCatalog && typeof window.GameCatalog.fetchGamesData === 'function'
        ? await window.GameCatalog.fetchGamesData(getGameJsonUrl())
        : await fetch(getGameJsonUrl()).then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          return response.json();
        });
      const gameName = (getUrlParameter('name') || '').toLowerCase();
      if (!gameName) {
        showError('No game id found in URL. Add ?id=your-game-id to the URL.');
        return;
      }

      const gameData = gamesData[gameName];
      if (!gameData) {
        showError(`Game "${gameName}" not found in database`);
        return;
      }

      if (gameCover) {
        gameCover.src = `../covers/${gameData.cover}`;
        gameCover.style.display = 'block';
      }

      if (gameTitle) {
        gameTitle.textContent = gameData.name;
        window.setTimeout(() => {
          gameTitle.style.opacity = '1';
        }, 100);
        gameTitle.classList.remove('pulse');
      }

      applyGradientColor(gameData.gradient);
    } catch (error) {
      showError(`Failed to load game data: ${error.message}`);
      console.error('Error loading JSON:', error);
    }
  }

  function attachLegacyImageEvents() {
    const { gameCover, gradientBg } = getLegacyElements();
    if (!gameCover) {
      return;
    }

    gameCover.addEventListener('error', function handleCoverError() {
      this.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTgwIiBoZWlnaHQ9IjI0MCIgdmlld0JveD0iMCAwIDE4MCAyNDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxODAiIGhlaWdodD0iMjQwIiBmaWxsPSIjNDA0MDQwIi8+Cjx0ZXh0IHg9IjkwIiB5PSIxMTAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiNiMGIwYjAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNiI+R2FtZTwvdGV4dD4KPHRleHQgeD0iOTAiIHk9IjEzMCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iI2IwYjBiMCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE2Ij5Db3ZlcjwvdGV4dD4KPC9zdmc+';
    }, { once: true });

    gameCover.addEventListener('load', function handleCoverLoad() {
      if (gradientBg) {
        window.setTimeout(() => {
          gradientBg.style.opacity = '1';
        }, 100);
      }

      window.setTimeout(() => {
        this.style.opacity = '1';
      }, 300);
    }, { once: true });
  }

  function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function animateElement(element, styles, duration = 0) {
    if (!element) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      Object.assign(element.style, styles);
      if (duration > 0) {
        window.setTimeout(resolve, duration);
      } else {
        resolve();
      }
    });
  }

  async function doneloading() {
    const elements = getLegacyElements();
    try {
      if (!elements.progbar || !elements.gameCover) {
        return;
      }

      await animateElement(elements.progbar, { opacity: '0' });
      await wait(500);

      await animateElement(elements.progbar, {
        background: 'lightgreen',
        width: '100%',
        animation: 'none'
      });
      await wait(50);

      await animateElement(elements.loadAnimation, { opacity: '0' });
      await animateElement(elements.progbar, { opacity: '1' });
      await wait(500);

      await Promise.all([
        animateElement(elements.gameCover, { transform: 'scale(0.95)', opacity: '0' }),
        animateElement(elements.gradientBg, { opacity: '0' }),
        animateElement(elements.gameTitle, { opacity: '0' }),
        animateElement(elements.options, { display: 'none' })
      ]);

      await wait(200);
      await hideLoadingContainer();

      const gameType = getUrlParameter('type');
      if (elements.mainGameStuff) {
        elements.mainGameStuff.style.display = gameType === 'flash' ? 'block' : 'none';
      }
    } catch (error) {
      console.error('Error during loading completion:', error);
      if (elements.loadingContainer) {
        elements.loadingContainer.style.display = 'none';
      }
    }
  }

  function hideLoadingContainer() {
    const { loadingContainer } = getLegacyElements();

    return new Promise((resolve) => {
      if (!loadingContainer) {
        resolve();
        return;
      }

      let resolved = false;

      function finish() {
        if (resolved) {
          return;
        }
        resolved = true;
        loadingContainer.style.display = 'none';
        resolve();
      }

      function onTransitionEnd(event) {
        if (event.propertyName === 'opacity') {
          loadingContainer.removeEventListener('transitionend', onTransitionEnd);
          finish();
        }
      }

      loadingContainer.addEventListener('transitionend', onTransitionEnd);
      window.setTimeout(finish, 1000);
      loadingContainer.style.opacity = '0';
    });
  }

  async function doneloadingWithClasses() {
    const elements = getLegacyElements();
    try {
      if (!elements.progbar || !elements.loadingContainer) {
        return;
      }

      elements.progbar.classList.add('completing');
      await wait(500);

      elements.progbar.classList.add('complete');
      if (elements.loadAnimation) {
        elements.loadAnimation.classList.add('hidden');
      }

      await wait(550);

      if (elements.gameCover) {
        elements.gameCover.classList.add('fade-out');
      }
      if (elements.gradientBg) {
        elements.gradientBg.classList.add('fade-out');
      }
      if (elements.gameTitle) {
        elements.gameTitle.classList.add('fade-out');
      }
      if (elements.options) {
        elements.options.classList.add('hidden');
      }

      await wait(200);
      elements.loadingContainer.classList.add('fade-out');
      await hideLoadingContainer();
    } catch (error) {
      console.error('Error during CSS loading completion:', error);
      if (elements.loadingContainer) {
        elements.loadingContainer.style.display = 'none';
      }
    }
  }

  function init() {
    if (window.__qzGameLoadingInitialized || !hasLegacyLoadingSurface()) {
      return;
    }

    window.__qzGameLoadingInitialized = true;
    attachLegacyImageEvents();
    loadGameFromJSON();
  }

  if (typeof window.doneloading !== 'function') {
    window.doneloading = doneloading;
  }

  if (typeof window.doneloadingWithClasses !== 'function') {
    window.doneloadingWithClasses = doneloadingWithClasses;
  }

  window.QZGameMainLoading = {
    applyGradientColor,
    init,
    loadGameFromJSON,
    showError
  };
})();
