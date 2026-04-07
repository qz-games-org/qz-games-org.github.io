// ========================================
// QZ Games - Bundled JavaScript
// Combines: main.js, note.js, gameSearch.js
// ========================================

// ============ main.js ============
var sidenavstatus = false
var translatemenustatus = false
var filtermenustatus = false

//elements
var sidenavcont = document.getElementById('sidenavcont')
var backdropside = document.getElementById('backdropside')
var sidenav = document.getElementById('sidenav')
var filtermenu = document.getElementById('filterM')
var translatemenu = document.getElementById('translateM')

//functions
function ToggleSideNav() {
    if (!sidenavstatus) {
      // OPEN
      sidenavcont.style.visibility = 'visible';
      backdropside.style.visibility = 'visible';
      backdropside.style.opacity    = '1';
      sidenav.style.animation       = 'sidenavin 0.5s forwards';
      sidenavstatus = true;
    } else {
      // CLOSE
      sidenavstatus = false;
      backdropside.style.opacity = '0';

      function onNavDone(e) {
        if (e.animationName === 'sidenavout') {
          sidenavcont.style.visibility  = 'hidden';
          backdropside.style.visibility = 'hidden';
          sidenav.removeEventListener('animationend', onNavDone);
        }
      }
      sidenav.addEventListener('animationend', onNavDone);

      sidenav.style.animation    = 'sidenavout 0.5s forwards';
    }
  }


function ToggleTranslate() {
    if(translatemenustatus===false) {
        loadGoogleTranslate();

        translatemenustatus = true
        translatemenu.style.visibility = 'visible'
        translatemenu.style.opacity = 1
        translatemenu.style.animation = 'translatemenuin 0.5s'

    } else if (translatemenustatus===true) {
        translatemenustatus = false
        translatemenu.style.opacity = 0
        translatemenu.style.animation = 'translatemenuout 0.5s'

        setTimeout(() => {
            translatemenu.style.visibility = 'hidden'
        }, 450);
    }
}

// Load Google Translate script (used by both manual and auto-translate)
function loadGoogleTranslate() {
    if(document.getElementById('translatescript')) {
        return;
    }
    var translatesc = document.createElement('script')
    translatesc.setAttribute('src', 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit')
    translatesc.type = 'text/javascript'
    translatesc.id = "translatescript"
    document.body.appendChild(translatesc)
}

// Auto-load translate script if auto-translate is enabled
if (window.autoTranslate && window.autoTranslate.isAutoTranslateEnabled()) {
    loadGoogleTranslate();
}

function ToggleFilter() {
    if(filtermenustatus===false) {
        filtermenustatus = true
        filtermenu.style.visibility = 'visible'
        filtermenu.style.opacity = 1
        filtermenu.style.animation = 'filterwin 0.5s'

    } else if (filtermenustatus===true) {
        filtermenu.style.opacity = 0
        filtermenu.style.animation = 'filterwout 0.5s'
        filtermenustatus = false
        setTimeout(() => {
            filtermenu.style.visibility = 'hidden'
        }, 450);
    }
}

// ============ note.js ============
const notecont      = document.getElementById('notafication');
const notetitle     = document.getElementById('titlenote');
const notedesc      = document.getElementById('descnote');
const cookiepicnote = document.getElementById('cookiepic');
const noteclose     = document.getElementById('closenote');
const notebottom    = document.getElementById('notification-bottom');
const noteSpinner   = document.getElementById('notification-spinner');

const noteQueue = [];
let noteBusy = false;
let cookienote = false;

function issuenote(title, desc, close, type, showLearnMore) {
  noteQueue.push({ title, desc, close, type, showLearnMore });
  if (!noteBusy) showNextNote();
}

function closeNote() {
  if(cookienote === true) {
    setCookie('confirmedcookie', 'true');
    cookienote = false
  }

  notecont.style.animation = "notehide 0.5s";
  const onEnd = () => {
    notecont.dataset.noteStyle = '';
    notecont.style.display = "none";
    notecont.removeEventListener("animationend", onEnd);
    showNextNote();
  };
  notecont.addEventListener("animationend", onEnd);
}

function showNextNote() {
  if (noteQueue.length === 0) {
    noteBusy = false;
    return;
  }
  noteBusy = true;

  const { title, desc, close, type, showLearnMore } = noteQueue.shift();
  notecont.dataset.noteStyle = '';
  if (noteSpinner) {
    noteSpinner.style.display = 'none';
  }

  if (type === "cookie") {
    cookienote = true
    notetitle.textContent = "We Use Cookies";
    notedesc.textContent  = "By using our site you agree to cookies for analytics and personalization.";
    cookiepicnote.style.display = "block";
    noteclose.style.display     = "block";
    notebottom.style.display    = "block";
  } else if (type === "theme-loading") {
    cookienote = false
    notetitle.textContent = title;
    notedesc.textContent = desc;
    notecont.dataset.noteStyle = 'theme-loading';
    cookiepicnote.style.display = "none";
    if (noteSpinner) {
      noteSpinner.style.display = "block";
    }
    noteclose.style.display = "none";
    notebottom.style.display = "none";
  } else {
    cookienote = false
    notetitle.textContent      = title;
    notedesc.textContent       = desc;
    cookiepicnote.style.display = "none";
    noteclose.style.display     = close === false ? "none" : "block";
    notebottom.style.display    = showLearnMore ? "block" : "none";
  }

  noteclose.onclick = closeNote;

  notecont.style.display   = "block";
  notecont.style.animation = "noteshow 0.5s";
}

function checkConfirmedCookie() {
    const val = getCookie('confirmedcookie');
    if (!val || val === 'false') {
        issuenote('cookie', 'cookie', true, 'cookie')
    }
}
document.addEventListener('DOMContentLoaded', checkConfirmedCookie);

// ============ gameSearch.js ============
function removeAds() {
    document.querySelectorAll('.ad-item').forEach(ad => ad.remove());
}

class GameSearchEngine {
    constructor(containerSelector = '#games') {
        this.container = document.querySelector(containerSelector);
        this.games = [];
        this.originalDisplay = new Map();
        this.init();
    }

    init() {
        if (!this.container) {
            console.error('Games container not found');
            return;
        }
        this.indexGames();
    }

    indexGames() {
        const gameElements = this.container.querySelectorAll('.gameitem');
        this.games = Array.from(gameElements).map(element => {
            this.originalDisplay.set(element, element.style.display || '');

            return {
                element: element,
                id: element.id || '',
                name: this.extractGameName(element),
                tags: this.extractTags(element),
                link: element.querySelector('a')?.href || ''
            };
        });
    }

    extractGameName(element) {
        const textOver = element.querySelector('.gametextover');
        if (textOver) return textOver.textContent.trim();

        const img = element.querySelector('img');
        if (img) return img.alt.replace(' Cover', '').trim();

        return element.id || '';
    }

    extractTags(element) {
        const tagsAttr = element.getAttribute('tags');
        if (!tagsAttr) return [];

        if (tagsAttr.includes(',')) {
            return tagsAttr.split(',').map(tag => tag.trim().toLowerCase());
        } else {
            return tagsAttr.split(' ').map(tag => tag.trim().toLowerCase());
        }
    }

    calculateSimilarity(str1, str2) {
        str1 = str1.toLowerCase();
        str2 = str2.toLowerCase();

        if (str1 === str2) return 1;
        if (str1.includes(str2) || str2.includes(str1)) return 0.8;

        const matrix = [];
        const len1 = str1.length;
        const len2 = str2.length;

        if (len1 === 0) return len2 === 0 ? 1 : 0;
        if (len2 === 0) return 0;

        for (let i = 0; i <= len1; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= len2; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= len1; i++) {
            for (let j = 1; j <= len2; j++) {
                const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j - 1] + cost
                );
            }
        }

        const maxLen = Math.max(len1, len2);
        return 1 - (matrix[len1][len2] / maxLen);
    }

    searchByName(query, threshold = 0.6) {
        if (!query || query.trim() === '') {
            return this.showAllGames();
        }

        query = query.trim();
        const results = [];

        this.games.forEach(game => {
            const similarity = this.calculateSimilarity(query, game.name);
            const containsMatch = game.name.toLowerCase().includes(query.toLowerCase());

            if (similarity >= threshold || containsMatch) {
                results.push({
                    ...game,
                    score: containsMatch ? Math.max(similarity, 0.9) : similarity
                });
            }
        });

        results.sort((a, b) => b.score - a.score);
        this.displayResults(results.map(r => r.element));
        return results;
    }

    searchByTags(tags, matchAll = false) {
        if (!tags || tags.length === 0) {
            return this.showAllGames();
        }

        const searchTags = Array.isArray(tags)
            ? tags.map(tag => tag.toLowerCase().trim())
            : [tags.toLowerCase().trim()];

        const results = this.games.filter(game => {
            if (matchAll) {
                return searchTags.every(tag => game.tags.includes(tag));
            } else {
                return searchTags.some(tag => game.tags.includes(tag));
            }
        });

        this.displayResults(results.map(r => r.element));
        return results;
    }

    showAllGames() {
        this.games.forEach(game => {
            game.element.style.display = this.originalDisplay.get(game.element) || '';
            game.element.style.order = '';
        });
        return this.games;
    }

    displayResults(elements) {
        this.games.forEach(game => {
            game.element.style.display = 'none';
        });

        elements.forEach((element, index) => {
            element.style.display = this.originalDisplay.get(element) || '';
            element.style.order = index;
        });
    }

    getAllTags() {
        const allTags = new Set();
        this.games.forEach(game => {
            game.tags.forEach(tag => allTags.add(tag));
        });
        return Array.from(allTags).sort();
    }

    clearSearch() {
        return this.showAllGames();
    }
}

function createGameSearchEngine() {
    const searchEngine = new GameSearchEngine('#games');

    window.searchGames = function(query) {
        removeAds()
        const results = searchEngine.searchByName(query);

        gameSearchEngine.games.forEach(game => {
            if (!game.element.classList.contains('ad-item')) {
                game.element.style.display = 'none';
            }
        });

        results.forEach(result => {
            result.element.style.display = '';
        });

        return results;
    };

    window.filterByTag = function(tags, matchAll = false) {
        return searchEngine.searchByTags(tags, matchAll);
    };

    window.clearGameSearch = function() {
        if (gamesData) {
            renderGames(gamesData, false);
        }
        return searchEngine.clearSearch();
    };

    window.getGameTags = function() {
        return searchEngine.getAllTags();
    };

    window.reindexGames = function() {
        return searchEngine.indexGames();
    };

    return searchEngine;
}

let gameSearchEngine = null;

window.initializeGameSearch = function() {
    gameSearchEngine = createGameSearchEngine();
    console.log('Game search engine initialized with', gameSearchEngine.games.length, 'games');
    return gameSearchEngine;
};

class SearchBarHandler {
    constructor(searchInputSelector, options = {}) {
        this.searchInput = document.querySelector(searchInputSelector);
        this.debounceTimer = null;
        this.options = {
            delay: 300,
            minLength: 1,
            clearOnEmpty: true,
            showSuggestions: false,
            ...options
        };

        this.init();
    }

    init() {
        if (!this.searchInput) {
            console.error('Search input element not found');
            return;
        }

        this.attachEventListeners();
    }

    attachEventListeners() {
        this.searchInput.addEventListener('input', (event) => {
            this.handleSearchInput(event.target.value);
        });

        this.searchInput.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                this.clearSearch();
                this.searchInput.blur();
            }
        });
    }

    handleSearchInput(query) {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        if (query.trim() === '') {
            if (this.options.clearOnEmpty) {
                this.performSearch('');
            }
            return;
        }

        if (query.trim().length < this.options.minLength) {
            return;
        }

        this.debounceTimer = setTimeout(() => {
            this.performSearch(query.trim());
        }, this.options.delay);
    }

    performSearch(query) {
        if (typeof searchGames !== 'function') {
            console.warn('Search engine not initialized yet');
            return;
        }

        if (query === '') {
            clearGameSearch();
        } else {
            const results = searchGames(query);
            console.log(`Search for "${query}" returned ${results.length} results`);
        }
    }

    clearSearch() {
        this.searchInput.value = '';

        if (typeof clearGameSearch === 'function') {
            clearGameSearch();
        }
    }

    setDelay(newDelay) {
        this.options.delay = newDelay;
    }

    destroy() {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
    }
}

function initializeSearchBar(searchInputSelector = '#searchInput', options = {}) {
    return new SearchBarHandler(searchInputSelector, options);
}

initializeSearchBar('#gamesearch', {
    delay: 300,
    minLength: 1,
    showSuggestions: true,
    clearOnEmpty: true
});
