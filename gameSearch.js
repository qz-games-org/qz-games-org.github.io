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

    // Index all games for searching
    indexGames() {
        const gameElements = this.container.querySelectorAll('.gameitem:not(.ad-item)');
        this.games = Array.from(gameElements).map(element => {
            // Store original display state
            this.originalDisplay.set(element, element.style.display || '');
            
            return {
                element: element,
                id: element.id || '',
                name: this.extractGameName(element),
                tags: this.extractTags(element),
                link: element.querySelector('a')?.href || '',
                cover: this.extractCover(element),
                status: this.extractStatus(element)
            };
        });
    }

    // Extract game name from the element
    extractGameName(element) {
        const textOver = element.querySelector('.gametextover');
        if (textOver) return textOver.textContent.trim();
        
        const img = element.querySelector('img');
        if (img) return img.alt.replace(' Cover', '').trim();
        
        return element.id || '';
    }

    // Extract tags from the element
    extractTags(element) {
        const tagsAttr = element.getAttribute('tags');
        if (!tagsAttr) return [];
        
        // Split by comma to support multi-word tags like "casual shooter"
        // If no commas found, fall back to space separation for backward compatibility
        if (tagsAttr.includes(',')) {
            return tagsAttr.split(',').map(tag => tag.trim().toLowerCase());
        } else {
            // For backward compatibility with space-separated single words
            return tagsAttr.split(' ').map(tag => tag.trim().toLowerCase());
        }
    }

    extractCover(element) {
        const img = element.querySelector('.gamecover, img');
        if (!img) return '';
        return img.getAttribute('src') || img.getAttribute('data-src') || '';
    }

    extractStatus(element) {
        const label = element.querySelector('.game-status-badge-label');
        return label ? label.textContent.trim() : '';
    }

    // Calculate similarity between two strings (Levenshtein distance based)
    calculateSimilarity(str1, str2) {
        str1 = str1.toLowerCase();
        str2 = str2.toLowerCase();
        
        // Exact match
        if (str1 === str2) return 1;
        
        // Check if one string contains the other
        if (str1.includes(str2) || str2.includes(str1)) {
            return 0.8;
        }

        // Levenshtein distance calculation
        const matrix = [];
        const len1 = str1.length;
        const len2 = str2.length;

        if (len1 === 0) return len2 === 0 ? 1 : 0;
        if (len2 === 0) return 0;

        // Initialize matrix
        for (let i = 0; i <= len1; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= len2; j++) {
            matrix[0][j] = j;
        }

        // Fill matrix
        for (let i = 1; i <= len1; i++) {
            for (let j = 1; j <= len2; j++) {
                const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,      // deletion
                    matrix[i][j - 1] + 1,      // insertion
                    matrix[i - 1][j - 1] + cost // substitution
                );
            }
        }

        const maxLen = Math.max(len1, len2);
        return 1 - (matrix[len1][len2] / maxLen);
    }

    findByName(query, threshold = 0.6) {
        if (!query || query.trim() === '') return [];
        query = query.trim();
        const results = [];

        this.games.forEach(game => {
            const similarity = this.calculateSimilarity(query, game.name);
            
            // Also check if query is contained in name (for partial matches)
            const containsMatch = game.name.toLowerCase().includes(query.toLowerCase());
            
            if (similarity >= threshold || containsMatch) {
                results.push({
                    ...game,
                    score: containsMatch ? Math.max(similarity, 0.9) : similarity
                });
            }
        });

        // Sort by score (highest first)
        results.sort((a, b) => b.score - a.score);
        return results;
    }

    // Search games by name with fuzzy matching
    searchByName(query, threshold = 0.6) {
        if (!query || query.trim() === '') {
            return this.showAllGames();
        }

        const results = this.findByName(query, threshold);
        this.displayResults(results.map(r => r.element));
        return results;
    }

    // Filter games by tags
    searchByTags(tags, matchAll = false) {
        if (!tags || tags.length === 0) {
            return this.showAllGames();
        }

        // Ensure tags is an array and normalize to lowercase
        const searchTags = Array.isArray(tags) 
            ? tags.map(tag => tag.toLowerCase().trim())
            : [tags.toLowerCase().trim()];

        const results = this.games.filter(game => {
            if (matchAll) {
                // Game must have ALL specified tags
                return searchTags.every(tag => game.tags.includes(tag));
            } else {
                // Game must have AT LEAST ONE of the specified tags
                return searchTags.some(tag => game.tags.includes(tag));
            }
        });

        this.displayResults(results.map(r => r.element));
        return results;
    }

    // Combined search (name + tags)
    search(query, tags = null, options = {}) {
        const {
            nameThreshold = 0.6,
            matchAllTags = false,
            combineResults = true
        } = options;

        let nameResults = [];
        let tagResults = [];

        // Search by name if query provided
        if (query && query.trim() !== '') {
            nameResults = this.searchByName(query, nameThreshold);
        }

        // Search by tags if tags provided
        if (tags && tags.length > 0) {
            tagResults = this.searchByTags(tags, matchAllTags);
        }

        // If both search types were performed, combine results
        if (query && tags && combineResults) {
            // Find games that match both criteria
            const nameElements = new Set(nameResults.map(r => r.element || r));
            const combinedResults = tagResults.filter(game => 
                nameElements.has(game.element || game)
            );
            
            this.displayResults(combinedResults.map(r => r.element || r));
            return combinedResults;
        }

        // Return the results from whichever search was performed
        return nameResults.length > 0 ? nameResults : tagResults;
    }

    // Show all games
    showAllGames() {
        this.games.forEach(game => {
            game.element.style.display = this.originalDisplay.get(game.element) || '';
            game.element.style.order = '';
        });

        if (typeof redistributeFeedAds === 'function') {
            redistributeFeedAds();
        }

        return this.games;
    }

    // Display search results
    displayResults(elements) {
        // Hide indexed game cards only. Ad cards stay in the feed.
        this.games.forEach(game => {
            game.element.style.display = 'none';
        });

        // Show and order the results
        elements.forEach((element, index) => {
            element.style.display = this.originalDisplay.get(element) || '';
            element.style.order = index; // Maintain search result order
        });

        if (typeof redistributeFeedAds === 'function') {
            redistributeFeedAds();
        }
    }

    // Get all available tags
    getAllTags() {
        const allTags = new Set();
        this.games.forEach(game => {
            game.tags.forEach(tag => allTags.add(tag));
        });
        return Array.from(allTags).sort();
    }

    // Debug function to see what tags are being parsed
    debugTags() {
        console.log('=== TAG DEBUG INFO ===');
        this.games.forEach(game => {
            console.log(`Game: ${game.name}`);
            console.log(`Raw tags attribute: "${game.element.getAttribute('tags')}"`);
            console.log(`Parsed tags:`, game.tags);
            console.log('---');
        });
        console.log('All available tags:', this.getAllTags());
    }

    // Get games by specific tag
    getGamesByTag(tag) {
        return this.games.filter(game => 
            game.tags.includes(tag.toLowerCase().trim())
        );
    }

    // Clear search (show all games)
    clearSearch() {
        return this.showAllGames();
    }

    // Get search suggestions based on partial input
    getSuggestions(query, limit = 5) {
        if (!query || query.trim().length < 2) return [];
        
        const suggestions = [];
        query = query.toLowerCase().trim();

        this.games.forEach(game => {
            if (game.name.toLowerCase().includes(query)) {
                suggestions.push({
                    type: 'game',
                    value: game.name,
                    element: game.element
                });
            }
        });

        // Also suggest tags
        this.getAllTags().forEach(tag => {
            if (tag.includes(query)) {
                suggestions.push({
                    type: 'tag',
                    value: tag,
                    count: this.getGamesByTag(tag).length
                });
            }
        });

        return suggestions.slice(0, limit);
    }
}

// Usage example and helper functions
function createGameSearchEngine() {
    // Initialize the search engine
    const searchEngine = new GameSearchEngine('#games');
    
    // Example usage functions:
    
    // Simple name search with fuzzy matching
    window.searchGames = function(query) {
        return searchEngine.findByName(query);
    };
    
    
    // Search by tags
    window.filterByTag = function(tags, matchAll = false) {
        return searchEngine.searchByTags(tags, matchAll);
    };
    
    // Combined search
    window.searchGamesAdvanced = function(query, tags = null, options = {}) {
        return searchEngine.search(query, tags, options);
    };
    
    // Clear search
    window.clearGameSearch = function() {
        return searchEngine.clearSearch();
    };
    
    // Get all available tags
    window.getGameTags = function() {
        return searchEngine.getAllTags();
    };
    
    // Get suggestions for autocomplete
    window.getSearchSuggestions = function(query, limit = 5) {
        return searchEngine.getSuggestions(query, limit);
    };
    
    // Debug function to check tag parsing
    window.debugGameTags = function() {
        return searchEngine.debugTags();
    };
    
    // Re-index games (useful for dynamic content)
    window.reindexGames = function() {
        return searchEngine.indexGames();
    };
    
    return searchEngine;
}

// Global search engine instance
let gameSearchEngine = null;

// Function to initialize the search engine (call this after games are loaded)
window.initializeGameSearch = function() {
    gameSearchEngine = createGameSearchEngine();
    console.log('Game search engine initialized with', gameSearchEngine.games.length, 'games');
    return gameSearchEngine;
};

// Example usage:
/*
// Search for games with fuzzy matching
searchGames('minecaft'); // Will find 'Minecraft'

// Filter by single tag
filterByTag('horror');

// Filter by multiple tags (at least one match)
filterByTag(['horror', 'casual'], false);

// Filter by multiple tags (must have all tags)
filterByTag(['horror', 'casual'], true);

// Combined search: name + tags
searchGamesAdvanced('minecraft', ['casual'], {
    nameThreshold: 0.6,
    matchAllTags: false,
    combineResults: true
});

// Clear all filters
clearGameSearch();

// Get all available tags
console.log(getGameTags());

// Get search suggestions
console.log(getSearchSuggestions('min')); // Might suggest 'Minecraft', etc.
*/

// Debounced search functionality for search bar


  
class SearchBarHandler {
    constructor(searchInputSelector, options = {}) {
        this.searchInput = document.querySelector(searchInputSelector);
        this.debounceTimer = null;
        this.options = {
            delay: 300, // Default delay in milliseconds
            minLength: 1, // Minimum characters before searching
            clearOnEmpty: true, // Clear results when input is empty
            showSuggestions: false, // Show search suggestions
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
        this.createSuggestionsContainer();
    }

    // Create suggestions dropdown container
    createSuggestionsContainer() {
        if (!this.options.showSuggestions) return;
        
        this.suggestionsContainer = document.createElement('div');
        this.suggestionsContainer.className = 'search-suggestions qz-search-results';
        this.suggestionsContainer.hidden = true;
        this.suggestionsContainer.setAttribute('role', 'listbox');
        this.suggestionsContainer.setAttribute('aria-label', 'Game search results');
        
        // Make search input container relative if not already
        const parent = this.searchInput.parentElement;
        if (getComputedStyle(parent).position === 'static') {
            parent.style.position = 'relative';
        }
        
        parent.appendChild(this.suggestionsContainer);
    }

    // Attach event listeners
    attachEventListeners() {
        // Main search input event
        this.searchInput.addEventListener('input', (event) => {
            this.handleSearchInput(event.target.value);
        });

        // Clear search on escape key
        this.searchInput.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                this.clearSearch();
                this.searchInput.blur();
            }
        });

        this.searchInput.addEventListener('focus', () => {
            const query = this.searchInput.value.trim();
            if (query.length >= this.options.minLength) {
                this.performSearch(query);
            }
        });

        this.handleDocumentClick = (event) => {
            if (
                event.target === this.searchInput
                || this.searchInput.parentElement?.contains(event.target)
                || this.suggestionsContainer?.contains(event.target)
            ) {
                return;
            }

            this.hideSuggestions();
        };
        document.addEventListener('click', this.handleDocumentClick);

        // Optional: Clear button functionality
        const clearButton = document.querySelector('.search-clear-btn');
        if (clearButton) {
            clearButton.addEventListener('click', () => {
                this.clearSearch();
            });
        }
    }

    // Handle search input with debouncing
    handleSearchInput(query) {
        // Clear previous timer
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        // Handle empty input
        if (query.trim() === '') {
            if (this.options.clearOnEmpty) {
                this.hideSuggestions();
                this.updateSearchStats('', 0);
            }
          
            return;
        }

        // Check minimum length
        if (query.trim().length < this.options.minLength) {
            return;
        }
        
        // Set new timer
        this.debounceTimer = setTimeout(() => {
            this.performSearch(query.trim());
            
         
        }, this.options.delay);
    }

    // Perform the actual search
    performSearch(query) {
        // Check if search functions are available
        if (typeof searchGames !== 'function') {
            console.warn('Search engine not initialized yet');
            return;
        }
        
        if (query === '') {
            this.hideSuggestions();
            this.updateSearchStats('', 0);
        } else {
            const results = searchGames(query);
            console.log(`Search for "${query}" returned ${results.length} results`);
            this.renderSearchResults(query, results);
            this.updateSearchStats(query, results.length);
        }
    }

    // Show search suggestions
    renderSearchResults(query, results) {
        if (!this.suggestionsContainer) return;

        const visibleResults = results.slice(0, 8);
        this.suggestionsContainer.innerHTML = '';

        const header = document.createElement('div');
        header.className = 'search-results-header';

        const title = document.createElement('span');
        title.textContent = query;

        const count = document.createElement('strong');
        count.textContent = `${results.length} result${results.length === 1 ? '' : 's'}`;

        header.append(title, count);
        this.suggestionsContainer.appendChild(header);

        if (visibleResults.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'search-results-empty';
            empty.textContent = 'No matching games found.';
            this.suggestionsContainer.appendChild(empty);
            this.showSuggestions();
            return;
        }

        visibleResults.forEach((result) => {
            const item = document.createElement('a');
            item.className = 'search-result-item';
            item.href = result.link || '#';
            item.setAttribute('role', 'option');

            const coverWrap = document.createElement('span');
            coverWrap.className = 'search-result-cover';

            if (result.cover) {
                const img = document.createElement('img');
                img.src = result.cover;
                img.alt = `${result.name} cover`;
                img.loading = 'lazy';
                img.decoding = 'async';
                coverWrap.appendChild(img);
            }

            const text = document.createElement('span');
            text.className = 'search-result-text';

            const name = document.createElement('span');
            name.className = 'search-result-name';
            name.textContent = result.name;

            const meta = document.createElement('span');
            meta.className = 'search-result-meta';
            meta.textContent = result.status ? result.status : 'Play game';

            text.append(name, meta);
            item.append(coverWrap, text);
            this.suggestionsContainer.appendChild(item);
        });

        if (results.length > visibleResults.length) {
            const more = document.createElement('div');
            more.className = 'search-results-more';
            more.textContent = `Showing ${visibleResults.length} of ${results.length}`;
            this.suggestionsContainer.appendChild(more);
        }

        this.showSuggestions();
    }

    showSuggestions() {
        if (!this.suggestionsContainer) return;
        this.suggestionsContainer.hidden = false;
        this.suggestionsContainer.classList.add('is-visible');
    }

    hideSuggestions() {
        if (!this.suggestionsContainer) return;
        this.suggestionsContainer.hidden = true;
        this.suggestionsContainer.classList.remove('is-visible');
    }


    // Update search statistics (optional)
    updateSearchStats(query, resultsCount) {
        const statsElement = document.querySelector('.search-stats');
        if (statsElement) {
            if (resultsCount === 0) {
                statsElement.textContent = `No results found for "${query}"`;
            } else {
                statsElement.textContent = `Found ${resultsCount} game${resultsCount === 1 ? '' : 's'} for "${query}"`;
            }
        }
    }

    // Clear search
    clearSearch() {
        this.searchInput.value = '';
        this.hideSuggestions();

        // Clear search stats
        const statsElement = document.querySelector('.search-stats');
        if (statsElement) {
            statsElement.textContent = '';
        }
    }

    // Update search delay
    setDelay(newDelay) {
        this.options.delay = newDelay;
    }

    // Destroy the handler
    destroy() {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        
        if (this.suggestionsContainer) {
            this.suggestionsContainer.remove();
        }

        if (this.handleDocumentClick) {
            document.removeEventListener('click', this.handleDocumentClick);
        }
    }
}

// Initialize search bar handler
function initializeSearchBar(searchInputSelector = '#searchInput', options = {}) {
    return new SearchBarHandler(searchInputSelector, options);
}

// Auto-initialize with common search input selectors
function autoInitializeSearchBar() {
    const commonSelectors = [
        '#searchInput',
        '#search',
        '.search-input',
        'input[placeholder*="search" i]', // Case insensitive
        'input[placeholder*="Search" i]'
    ];
    
    for (const selector of commonSelectors) {
        const element = document.querySelector(selector);
        if (element) {
            console.log(`Initializing search bar with selector: ${selector}`);
            return initializeSearchBar(selector, {
                delay: 500, // Wait 500ms after typing stops
                minLength: 2, // Start searching after 2 characters
                showSuggestions: true, // Show search suggestions
                clearOnEmpty: true
            });
        }
    }
    
    console.warn('No search input found. Please specify a selector when calling initializeSearchBar()');
    return null;
}



initializeSearchBar('#gamesearch', {
    delay: 300,           // Wait 300ms after typing stops
    minLength: 1,         // Start searching after 1 character
    showSuggestions: true,// Show dropdown suggestions
    clearOnEmpty: true    // Clear results when input is empty
});

