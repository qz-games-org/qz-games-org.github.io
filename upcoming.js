// Upcoming Games Page - Load and display upcoming games with progress tracking

(function() {
    'use strict';

    // Configuration
    const CONFIG = {
        JSON_FILE: './upcoming.json',
        COVERS_PATH: './covers/',
        STEPS: {
            1: { name: 'Planned', tooltip: 'Game request has been reviewed and is planned to be added' },
            2: { name: 'In Progress', tooltip: 'The game is being prepared for release' },
            3: { name: 'Ready', tooltip: 'Game is ready for release and undergoing final checks' },
            4: { name: 'Added', tooltip: 'Game has been added to the site - go play it now!' },
            5: { name: 'Fix in Progress', tooltip: 'Game is being fixed before release and will be available very soon' }
        }
    };

    // DOM Elements
    let gamesList = null;

    // Initialize the page
    function init() {
        gamesList = document.querySelector('.games-list');

        if (!gamesList) {
            console.error('Games list container not found');
            return;
        }

        // Load and display games
        loadGames();
    }

    // Load games from JSON
    async function loadGames() {
        showLoading(true);

        try {
            const response = await fetch(CONFIG.JSON_FILE);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const games = await response.json();

            // Hide loading
            showLoading(false);

            // Check if we have any games
            if (Object.keys(games).length === 0) {
                showEmptyState();
                return;
            }

            // Display games
            displayGames(games);

        } catch (error) {
            console.error('Error loading games:', error);
            showLoading(false);
            showError();
        }
    }

    // Display games in the list
    function displayGames(games) {
        // Clear existing content
        gamesList.innerHTML = '';

        // Add delay for staggered animation
        let delay = 0;

        // Create game card for each game
        for (const [gameId, gameData] of Object.entries(games)) {
            const gameCard = createGameCard(gameId, gameData, delay);
            gamesList.appendChild(gameCard);
            delay += 100; // Stagger by 100ms
        }
    }

    // Create a game card element
    function createGameCard(gameId, gameData, delay) {
        const card = document.createElement('div');
        card.className = 'game-card';
        card.style.animationDelay = `${delay}ms`;

        // Game cover
        const cover = document.createElement('img');
        cover.className = 'game-cover';
        cover.src = `${CONFIG.COVERS_PATH}${gameData.cover}`;
        cover.alt = gameData.name;
        cover.onerror = function() {
            // Fallback to placeholder if image doesn't exist
            this.src = './covers/placeholder.png';
        };

        // Game info container
        const info = document.createElement('div');
        info.className = 'game-info';

        // Game name
        const name = document.createElement('h3');
        name.className = 'game-name';
        name.textContent = gameData.name;

        // Progress bar
        const progressContainer = createProgressBar(gameData.step);

        // Assemble the card
        info.appendChild(name);
        info.appendChild(progressContainer);
        card.appendChild(cover);
        card.appendChild(info);

        return card;
    }

    // Create progress bar with 4 or 5 steps (5 if game is being fixed)
    function createProgressBar(currentStep) {
        const container = document.createElement('div');
        container.className = 'progress-container';

        const progressBar = document.createElement('div');
        progressBar.className = 'progress-bar';

        let stepOrder;

        // If step is 5 (Fix in Progress), show 5 steps: Planned → In Progress → Ready → Fix in Progress → Added
        if (currentStep === 5) {
            stepOrder = [1, 2, 3, 5, 4]; // Added (4) is LAST
        } else {
            // Normal 4 steps: Planned → In Progress → Ready → Added
            stepOrder = [1, 2, 3, 4];
        }

        // Create each step
        for (let i = 0; i < stepOrder.length; i++) {
            const stepNum = stepOrder[i];
            const step = createProgressStep(stepNum, currentStep, i + 1);
            progressBar.appendChild(step);
        }

        container.appendChild(progressBar);
        return container;
    }

    // Create individual progress step
    function createProgressStep(stepNumber, currentStep, displayPosition) {
        const stepDiv = document.createElement('div');
        stepDiv.className = 'progress-step';

        // Determine step state based on logic
        let isCompleted = false;
        let isCurrent = false;

        if (currentStep === 5) {
            // When step is 5 (Fix in Progress):
            // - Steps 1, 2, 3 are completed
            // - Step 5 is current
            // - Step 4 (Added) is pending (not completed, not current)
            if (stepNumber < 5 && stepNumber !== 4) {
                isCompleted = true;
            } else if (stepNumber === 5) {
                isCurrent = true;
            }
        } else {
            // Normal flow (steps 1-4)
            if (stepNumber < currentStep) {
                isCompleted = true;
            } else if (stepNumber === currentStep) {
                isCurrent = true;
            }
        }

        if (isCompleted) {
            stepDiv.classList.add('completed');
        } else if (isCurrent) {
            stepDiv.classList.add('current');
        }

        // Step circle
        const circle = document.createElement('div');
        circle.className = 'step-circle';

        // Add wrench icon for step 5 (Fix in Progress)
        if (stepNumber === 5) {
            circle.innerHTML = '🔧';
        } else {
            // Show number only if not completed
            if (!isCompleted) {
                const number = document.createElement('span');
                number.className = 'step-number';
                number.textContent = displayPosition;
                circle.appendChild(number);
            }
        }

        // Step label
        const label = document.createElement('div');
        label.className = 'step-label';
        label.textContent = CONFIG.STEPS[stepNumber].name;

        // Add tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'step-tooltip';
        tooltip.textContent = CONFIG.STEPS[stepNumber].tooltip;

        stepDiv.appendChild(circle);
        stepDiv.appendChild(label);
        stepDiv.appendChild(tooltip);

        return stepDiv;
    }

    // Show loading state
    function showLoading(show) {
        if (show) {
            gamesList.innerHTML = `
                <div class="loading">
                    <div class="loading-spinner"></div>
                    <p>Loading upcoming games...</p>
                </div>
            `;
        }
    }

    // Show empty state
    function showEmptyState() {
        gamesList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🎮</div>
                <p class="empty-state-text">No upcoming games at the moment. Check back soon!</p>
            </div>
        `;
    }

    // Show error state
    function showError() {
        gamesList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⚠️</div>
                <p class="empty-state-text">Failed to load upcoming games. Please try again later.</p>
            </div>
        `;
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
