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

    // Index all games for searching
    indexGames() {
        const gameElements = this.container.querySelectorAll('.gameitem');
        this.games = Array.from(gameElements).map(element => {
            // Store original display state
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

    // Search games by name with fuzzy matching
    searchByName(query, threshold = 0.6) {
        if (!query || query.trim() === '') {
            return this.showAllGames();
        }

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
        return this.games;
    }

    // Display search results
    displayResults(elements) {
        // Hide all games first
        this.games.forEach(game => {
            game.element.style.display = 'none';
        });

        // Show and order the results
        elements.forEach((element, index) => {
            element.style.display = this.originalDisplay.get(element) || '';
            element.style.order = index; // Maintain search result order
        });
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
        removeAds()
        const results = searchEngine.searchByName(query);
    
        // Hide everything first
        gameSearchEngine.games.forEach(game => {
            // Only hide if it's not an ad
            if (!game.element.classList.contains('ad-item')) {
                game.element.style.display = 'none';
            }
        });
    
        // Show matched results
        results.forEach(result => {
            result.element.style.display = '';
        });
    
        return results;
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
        if (gamesData) {
            renderGames(gamesData, false); // full render with ads
        }
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
        this.suggestionsContainer.className = 'search-suggestions';
        this.suggestionsContainer.style.cssText = `
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: white;
            border: 1px solid #ddd;
            border-top: none;
            border-radius: 0 0 4px 4px;
            max-height: 200px;
            overflow-y: auto;
            z-index: 1000;
            display: none;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        `;
        
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
                this.performSearch('');
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
            // Clear search
            clearGameSearch();
        } else {
            // Perform search
            const results = searchGames(query);

            // Optional: Log search results
            console.log(`Search for "${query}" returned ${results.length} results`);
           
            // Optional: Update UI with search stats
            this.updateSearchStats(query, results.length);
        }
    }

    // Show search suggestions


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
        
        if (typeof clearGameSearch === 'function') {
            clearGameSearch();
        }
        
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

