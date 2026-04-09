(function () {
  const DEFAULT_CATALOG_URL = 'games.json';

  let gamesDataCache = null;
  let gamesDataPromise = null;

  function getGameLink(game) {
    if (!game) {
      return '#';
    }

    if (game.type === 'html') {
      return `./Games/game.html?game=${game.link}&type=html&name=${game.name.toLowerCase()}`;
    }

    if (game.type === 'buckshot') {
      return './Games/Buckshot-Roulette.html';
    }

    if (game.type === 'unity') {
      return `./Games/game.html?game=${game.link}&type=unity&name=${game.name.toLowerCase()}`;
    }

    if (game.type === 'flash') {
      return `./Games/game.html?game=${game.link}&type=flash&name=${game.name.toLowerCase()}`;
    }

    return game.link;
  }

  function getGameCoverLink(game) {
    return `./covers/${game.cover}`;
  }

  function createGameCard(game, options = {}) {
    const gameItem = document.createElement('div');
    gameItem.classList.add('gameitem', 'hide');
    gameItem.id = game.name;
    gameItem.setAttribute('tags', game.catagory);

    if (typeof options.onClick === 'function') {
      gameItem.addEventListener('click', options.onClick);
    }

    gameItem.innerHTML = `
      <a href="${getGameLink(game)}">
        <div class="gametextover">${game.name}</div>
        <img
          class="gamecover loading"
          data-src="${getGameCoverLink(game)}"
          alt="${game.name} Cover"
        >
      </a>
    `;

    return gameItem;
  }

  function fetchGamesData(url = DEFAULT_CATALOG_URL) {
    if (gamesDataCache) {
      return Promise.resolve(gamesDataCache);
    }

    if (!gamesDataPromise) {
      gamesDataPromise = fetch(url)
        .then(response => {
          if (!response.ok) {
            throw new Error(`Failed to load ${url}: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          gamesDataCache = data;
          return data;
        })
        .catch(error => {
          gamesDataPromise = null;
          throw error;
        });
    }

    return gamesDataPromise;
  }

  function setGamesData(data) {
    gamesDataCache = data;
    gamesDataPromise = Promise.resolve(data);
  }

  function clearGamesData() {
    gamesDataCache = null;
    gamesDataPromise = null;
  }

  window.GameCatalog = {
    fetchGamesData,
    getGameLink,
    getGameCoverLink,
    createGameCard,
    setGamesData,
    clearGamesData,
    get gamesData() {
      return gamesDataCache;
    },
  };
})();
