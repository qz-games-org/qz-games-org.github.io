(function () {
  const DEFAULT_CATALOG_URL = 'games.json';
  const GAME_STATUS_DETAILS = {
    bugged: {
      label: 'Bugged',
      message: 'This game may have loading or gameplay issues.',
    },
    broken: {
      label: 'Broken',
      message: 'This game is currently not working correctly.',
    },
    maintenance: {
      label: 'Fixing',
      message: 'This game is being worked on and may change soon.',
    },
  };
  const GAME_STATUS_ALIASES = {
    issue: 'bugged',
    issues: 'bugged',
    buggy: 'bugged',
    unstable: 'bugged',
    down: 'broken',
    disabled: 'broken',
    unavailable: 'broken',
    wip: 'maintenance',
    repair: 'maintenance',
  };

  let gamesDataCache = null;
  let gamesDataPromise = null;

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function isEnabledFlag(value) {
    if (value === true || value === 1) {
      return true;
    }

    if (typeof value === 'string') {
      return ['true', '1', 'yes', 'y', 'on'].includes(value.trim().toLowerCase());
    }

    return false;
  }

  function safeDecode(value) {
    if (typeof value !== 'string') {
      return value || '';
    }

    try {
      return decodeURIComponent(value);
    } catch (error) {
      return value;
    }
  }

  function normalizeGameLookup(value) {
    return safeDecode(String(value || ''))
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[._-]+/g, ' ')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function compactGameLookup(value) {
    return normalizeGameLookup(value).replace(/\s+/g, '');
  }

  function normalizeGameLinkPath(value) {
    return safeDecode(String(value || ''))
      .replace(/\\/g, '/')
      .toLowerCase()
      .replace(/\?.*$/, '')
      .replace(/^\.?\//, '')
      .replace(/\/index\.html$/, '')
      .replace(/\/$/, '')
      .trim();
  }

  function getPathBasename(value) {
    const normalizedPath = normalizeGameLinkPath(value);
    if (!normalizedPath) {
      return '';
    }

    const segments = normalizedPath.split('/').filter(Boolean);
    return segments.length ? segments[segments.length - 1] : normalizedPath;
  }

  function getCatalogEntries(data = gamesDataCache) {
    if (!data) {
      return [];
    }

    return Object.entries(data).map(([id, game]) => ({ id, game }));
  }

  function findGameIdForGame(game, data = gamesDataCache) {
    if (!game || !data) {
      return '';
    }

    return Object.keys(data).find((key) => data[key] === game) || game.key || normalizeGameLookup(game.name);
  }

  function getGamesBasePath() {
    const pathname = (window.location.pathname || '').replace(/\\/g, '/').toLowerCase();
    return pathname.includes('/games/') ? './' : './Games/';
  }

  function getCoversBasePath() {
    const pathname = (window.location.pathname || '').replace(/\\/g, '/').toLowerCase();
    return pathname.includes('/games/') ? '../covers/' : './covers/';
  }

  function calculateSimilarity(left, right) {
    const a = normalizeGameLookup(left);
    const b = normalizeGameLookup(right);

    if (!a || !b) {
      return 0;
    }

    if (a === b) {
      return 1;
    }

    if (a.includes(b) || b.includes(a)) {
      const shorterLength = Math.min(a.length, b.length);
      const longerLength = Math.max(a.length, b.length);
      return 0.82 + Math.min(0.16, (shorterLength / Math.max(1, longerLength)) * 0.16);
    }

    const matrix = Array.from({ length: a.length + 1 }, () => []);
    for (let index = 0; index <= a.length; index += 1) {
      matrix[index][0] = index;
    }

    for (let index = 0; index <= b.length; index += 1) {
      matrix[0][index] = index;
    }

    for (let row = 1; row <= a.length; row += 1) {
      for (let column = 1; column <= b.length; column += 1) {
        const cost = a[row - 1] === b[column - 1] ? 0 : 1;
        matrix[row][column] = Math.min(
          matrix[row - 1][column] + 1,
          matrix[row][column - 1] + 1,
          matrix[row - 1][column - 1] + cost
        );
      }
    }

    const distance = matrix[a.length][b.length];
    return 1 - (distance / Math.max(a.length, b.length));
  }

  function getGameAliases(id, game) {
    const aliases = new Set();
    [id, game && game.name, game && game.link, getPathBasename(game && game.link)].forEach((value) => {
      const normalizedValue = normalizeGameLookup(value);
      if (normalizedValue) {
        aliases.add(normalizedValue);
      }

      const compactValue = compactGameLookup(value);
      if (compactValue) {
        aliases.add(compactValue);
      }
    });

    return Array.from(aliases);
  }

  function scoreGameEntry(query, entry) {
    const queryNormalized = normalizeGameLookup(query);
    const queryCompact = compactGameLookup(query);

    if (!queryNormalized && !queryCompact) {
      return { score: 0, alias: '' };
    }

    let bestScore = 0;
    let bestAlias = '';

    getGameAliases(entry.id, entry.game).forEach((alias) => {
      if (!alias) {
        return;
      }

      if (alias === queryNormalized || alias === queryCompact) {
        bestScore = 1;
        bestAlias = alias;
        return;
      }

      const similarity = Math.max(
        calculateSimilarity(queryNormalized, alias),
        calculateSimilarity(queryCompact, alias) * 0.97
      );

      const queryTokens = queryNormalized ? queryNormalized.split(' ') : [];
      const aliasTokens = alias.split(' ');
      const overlappingTokens = queryTokens.filter((token) => aliasTokens.includes(token)).length;
      const tokenScore = aliasTokens.length
        ? overlappingTokens / aliasTokens.length
        : 0;

      const containsScore = (queryNormalized && alias.includes(queryNormalized)) || (queryCompact && alias.includes(queryCompact))
        ? 0.9
        : 0;

      const score = Math.max(similarity, tokenScore * 0.88, containsScore);
      if (score > bestScore) {
        bestScore = score;
        bestAlias = alias;
      }
    });

    return { score: bestScore, alias: bestAlias };
  }

  function getPlayerGameUrl(gameId, fileName = 'game.html') {
    return `${getGamesBasePath()}${fileName}?id=${encodeURIComponent(String(gameId || ''))}`;
  }

  function resolveGameReference(reference, data = gamesDataCache, options = {}) {
    const entries = getCatalogEntries(data);
    const request = reference || {};
    const idQuery = safeDecode(request.id || '');
    const nameQuery = safeDecode(request.name || '');
    const linkQuery = safeDecode(request.link || '');

    if (idQuery && data && data[idQuery]) {
      return {
        entry: { id: idQuery, game: data[idQuery] },
        suggestions: [],
        matchedBy: 'id-exact',
        query: idQuery
      };
    }

    const normalizedIdQuery = normalizeGameLookup(idQuery);
    const compactIdQuery = compactGameLookup(idQuery);
    if (normalizedIdQuery || compactIdQuery) {
      const exactIdMatch = entries.find((entry) => {
        const normalizedId = normalizeGameLookup(entry.id);
        const compactId = compactGameLookup(entry.id);
        return normalizedId === normalizedIdQuery || compactId === compactIdQuery;
      });

      if (exactIdMatch) {
        return {
          entry: exactIdMatch,
          suggestions: [],
          matchedBy: 'id-normalized',
          query: idQuery
        };
      }
    }

    const normalizedNameQuery = normalizeGameLookup(nameQuery);
    const compactNameQuery = compactGameLookup(nameQuery);
    if (normalizedNameQuery || compactNameQuery) {
      const exactNameMatch = entries.find((entry) => {
        const normalizedId = normalizeGameLookup(entry.id);
        const normalizedName = normalizeGameLookup(entry.game.name);
        const compactName = compactGameLookup(entry.game.name);
        return (
          normalizedId === normalizedNameQuery
          || normalizedName === normalizedNameQuery
          || compactName === compactNameQuery
        );
      });

      if (exactNameMatch) {
        return {
          entry: exactNameMatch,
          suggestions: [],
          matchedBy: 'name-exact',
          query: nameQuery
        };
      }
    }

    const normalizedLinkQuery = normalizeGameLinkPath(linkQuery);
    const linkBasenameQuery = getPathBasename(linkQuery);
    if (normalizedLinkQuery || linkBasenameQuery) {
      const exactLinkMatch = entries.find((entry) => {
        const normalizedLink = normalizeGameLinkPath(entry.game.link);
        const linkBasename = getPathBasename(entry.game.link);
        return normalizedLink === normalizedLinkQuery || linkBasename === linkBasenameQuery;
      });

      if (exactLinkMatch) {
        return {
          entry: exactLinkMatch,
          suggestions: [],
          matchedBy: 'link-exact',
          query: linkQuery
        };
      }
    }

    const fuzzyQuery = idQuery || nameQuery || linkBasenameQuery || linkQuery || '';
    const suggestions = fuzzyQuery
      ? entries
          .map((entry) => {
            const { score, alias } = scoreGameEntry(fuzzyQuery, entry);
            return {
              id: entry.id,
              game: entry.game,
              score,
              alias
            };
          })
          .filter((entry) => entry.score >= (options.minScore || 0.42))
          .sort((left, right) => right.score - left.score)
          .slice(0, options.limit || 12)
      : [];

    const bestMatch = suggestions[0];
    const runnerUp = suggestions[1];
    const isConfidentMatch = bestMatch && (
      bestMatch.score >= 0.92
      || (
        bestMatch.score >= 0.84
        && (!runnerUp || bestMatch.score - runnerUp.score >= 0.08)
      )
    );

    return {
      entry: isConfidentMatch ? { id: bestMatch.id, game: bestMatch.game } : null,
      suggestions,
      matchedBy: isConfidentMatch ? 'fuzzy' : null,
      query: fuzzyQuery
    };
  }

  function getGameLink(game, options = {}) {
    if (!game) {
      return '#';
    }

    const gameId = options.gameId || findGameIdForGame(game);

    if (game.type === 'html' || game.type === 'unity' || game.type === 'flash') {
      return getPlayerGameUrl(gameId, 'game.html');
    }

    if (game.type === 'buckshot') {
      return getPlayerGameUrl(gameId, 'Buckshot-Roulette.html');
    }

    return game.link;
  }

  function getGameCoverLink(game) {
    return `${getCoversBasePath()}${game.cover}`;
  }

  function normalizeGameStatusKey(game) {
    if (!game) {
      return '';
    }

    const rawStatus = String(game.status || '')
      .trim()
      .toLowerCase()
      .replace(/[\s_]+/g, '-');
    const normalizedStatus = GAME_STATUS_ALIASES[rawStatus] || rawStatus;

    if (normalizedStatus && normalizedStatus !== 'ok' && normalizedStatus !== 'working' && GAME_STATUS_DETAILS[normalizedStatus]) {
      return normalizedStatus;
    }

    if (isEnabledFlag(game.gameisbroken) || isEnabledFlag(game.isBroken)) {
      return 'broken';
    }

    if (isEnabledFlag(game.gameisbugged) || isEnabledFlag(game.isBugged)) {
      return 'bugged';
    }

    if (isEnabledFlag(game.maintenance)) {
      return 'maintenance';
    }

    return '';
  }

  function getGameStatus(game) {
    const statusKey = normalizeGameStatusKey(game);
    const statusDetails = GAME_STATUS_DETAILS[statusKey];

    if (!statusDetails) {
      return null;
    }

    return {
      key: statusKey,
      label: game.statusLabel || statusDetails.label,
      message: game.statusMessage || game.brokenMessage || statusDetails.message,
      updated: game.statusUpdated || '',
    };
  }

  function createGameStatusBadgeMarkup(status) {
    if (!status) {
      return '';
    }

    const message = status.updated
      ? `${status.message} Updated ${status.updated}.`
      : status.message;

    return `
        <span
          class="game-status-badge game-status-badge--${escapeHtml(status.key)}"
          title="${escapeHtml(message)}"
          aria-label="${escapeHtml(`${status.label}: ${message}`)}"
        >
          <span class="game-status-badge-mark" aria-hidden="true">!</span>
          <span class="game-status-badge-label">${escapeHtml(status.label)}</span>
        </span>
    `;
  }

  function createGameCard(game, options = {}) {
    const gameItem = document.createElement('div');
    gameItem.classList.add('gameitem', 'hide');
    gameItem.id = game.name;
    gameItem.setAttribute('tags', game.catagory);

    const gameId = options.gameId || findGameIdForGame(game);
    gameItem.dataset.gameId = gameId;
    gameItem.dataset.gameName = game.name;

    if (typeof options.onClick === 'function') {
      gameItem.addEventListener('click', options.onClick);
    }

    const status = getGameStatus(game);
    const statusMessage = status ? `${status.label}: ${status.message}` : '';
    if (status) {
      gameItem.classList.add('has-game-status', `game-status-card--${status.key}`);
      gameItem.dataset.gameStatus = status.key;
    }

    gameItem.innerHTML = `
      <a href="${escapeHtml(getGameLink(game, { gameId }))}" aria-label="${escapeHtml(`Play ${game.name}${statusMessage ? `. ${statusMessage}` : ''}`)}">
        <div class="gametextover">${escapeHtml(game.name)}</div>
        ${createGameStatusBadgeMarkup(status)}
        <img
          class="gamecover loading"
          data-src="${escapeHtml(getGameCoverLink(game))}"
          alt="${escapeHtml(game.name)} Cover"
          loading="lazy"
          decoding="async"
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
    getGameStatus,
    createGameStatusBadgeMarkup,
    getCatalogEntries,
    resolveGameReference,
    normalizeGameLookup,
    calculateSimilarity,
    getPlayerGameUrl,
    findGameIdForGame,
    setGamesData,
    clearGamesData,
    get gamesData() {
      return gamesDataCache;
    },
  };
})();
