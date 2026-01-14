// FNF Launcher - Mod Selection and Game Launch System

(function() {
    'use strict';

    let mods = {};
    let modKeys = [];
    let selectedMod = null;
    let baseGameData = null;

    // DOM Elements
    const launcherPanel = document.getElementById('launcher-panel');
    const modsGrid = document.getElementById('mods-grid');
    const launchBaseBtn = document.getElementById('launch-base');
    const launchModBtn = document.getElementById('launch-mod');
    const playerPlaceholder = document.getElementById('player-placeholder');
    const playerContainer = document.getElementById('player-container');
    const gameFrame = document.getElementById('game-frame');
    const menuToggleBtn = document.getElementById('menu-toggle-btn');
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    const hideHudBtn = document.getElementById('hide-hud-btn');
    const showHudBtn = document.getElementById('show-hud-btn');
    const closeLauncherBtn = document.getElementById('close-launcher-btn');
    const notification = document.getElementById('notification');
    const notificationTitle = document.getElementById('notification-title');
    const notificationMessage = document.getElementById('notification-message');
    const notificationClose = document.getElementById('notification-close');

    let isGameRunning = false;
    let isHudVisible = true;

    // Initialize
    async function init() {
        try {
            // Load mods from JSON
            const response = await fetch('./FNF/assets/fnf-mods.json');
            const data = await response.json();

            // Separate base game from mods
            modKeys = Object.keys(data);

            if (data['base-game']) {
                baseGameData = data['base-game'];
                delete data['base-game'];
            }

            mods = data;
            modKeys = Object.keys(mods);

            // Render mods grid
            renderMods();

            // Setup event listeners
            setupEventListeners();

        } catch (error) {
            console.error('Error loading mods:', error);
            showNotification('Error', 'Failed to load mods. Please refresh the page.');
        }
    }

    // Render Mods Grid
    function renderMods() {
        modsGrid.innerHTML = '';

        modKeys.forEach(key => {
            const mod = mods[key];

            const card = document.createElement('div');
            card.className = 'mod-card';
            card.dataset.modKey = key;

            // Mod icon
            const icon = document.createElement('img');
            icon.className = 'mod-icon';
            icon.src = mod.icon;
            icon.alt = mod.name;
            icon.onerror = () => {
                // Fallback if icon fails to load
                icon.src = '../Q.png';
            };

            // Mod name
            const name = document.createElement('div');
            name.className = 'mod-name';
            name.textContent = mod.name;

            card.appendChild(icon);
            card.appendChild(name);

            // Add warning badge if warning exists
            if (mod.warning && mod.warning.trim() !== '') {
                const badge = document.createElement('div');
                badge.className = 'warning-badge';
                badge.title = 'This mod has a warning';
                badge.innerHTML = '<span class="material-icons">warning</span>';
                card.appendChild(badge);
            }

            // Click handler
            card.addEventListener('click', () => selectMod(key));

            modsGrid.appendChild(card);
        });
    }

    // Select Mod
    function selectMod(key) {
        // Remove previous selection
        document.querySelectorAll('.mod-card').forEach(card => {
            card.classList.remove('selected');
        });

        // Select new mod
        const card = document.querySelector(`[data-mod-key="${key}"]`);
        if (card) {
            card.classList.add('selected');
            selectedMod = key;

            // Enable and update mod launch button
            launchModBtn.disabled = false;
            const modName = mods[key].name;
            launchModBtn.querySelector('span:last-child').textContent = `Launch ${modName}`;
        }
    }

    // Launch Base Game
    function launchBaseGame() {
        if (!baseGameData) {
            showNotification('Error', 'Base game data not found.');
            return;
        }

        loadGame(baseGameData.link, baseGameData.name, baseGameData.warning);
    }

    // Launch Modded Game
    function launchModdedGame() {
        if (!selectedMod || !mods[selectedMod]) {
            showNotification('Error', 'Please select a mod first.');
            return;
        }

        const mod = mods[selectedMod];
        loadGame(mod.link, mod.name, mod.warning);
    }

    // Load Game into Player
    function loadGame(url, name, warning) {
        // Show warning notification if exists
        if (warning && warning.trim() !== '') {
            showNotification('Warning', warning);
        }

        // Load game into iframe
        gameFrame.src = url;

        // Show player, hide placeholder
        playerPlaceholder.style.display = 'none';
        playerContainer.style.display = 'flex';

        // Mark game as running and show close button
        isGameRunning = true;
        updateCloseLauncherButton();

        // Hide launcher menu when game starts
        hideLauncherMenu();

        console.log(`Loading: ${name}`);
    }


    // Toggle Launcher Menu
    function toggleLauncherMenu() {
        launcherPanel.classList.toggle('launcher-panel-visible');
    }

    // Hide Launcher Menu
    function hideLauncherMenu() {
        launcherPanel.classList.remove('launcher-panel-visible');
    }

    // Update Close Launcher Button Visibility
    function updateCloseLauncherButton() {
        if (isGameRunning) {
            closeLauncherBtn.style.display = 'flex';
        } else {
            closeLauncherBtn.style.display = 'none';
        }
    }

    // Hide HUD
    function hideHud() {
        const hudWrap = document.querySelector('.hud-wrap');
        const showHudWrap = document.querySelector('.show-hud-wrap');

        hudWrap.classList.add('hidden');
        showHudWrap.style.display = 'block';
        isHudVisible = false;
    }

    // Show HUD
    function showHud() {
        const hudWrap = document.querySelector('.hud-wrap');
        const showHudWrap = document.querySelector('.show-hud-wrap');

        hudWrap.classList.remove('hidden');
        showHudWrap.style.display = 'none';
        isHudVisible = true;
    }

    // Toggle Fullscreen
    function toggleFullscreen() {
        const playerPanel = document.querySelector('.player-panel');

        if (!document.fullscreenElement) {
            playerPanel.requestFullscreen().catch(err => {
                console.error('Error attempting to enable fullscreen:', err);
            });
        } else {
            document.exitFullscreen();
        }
    }

    // Show Notification
    function showNotification(title, message) {
        notificationTitle.textContent = title;
        notificationMessage.textContent = message;

        notification.classList.add('show');

        // Auto-dismiss after 5 seconds
        setTimeout(() => {
            hideNotification();
        }, 5000);
    }

    // Hide Notification
    function hideNotification() {
        notification.classList.remove('show');
    }

    // Setup Event Listeners
    function setupEventListeners() {
        // Launch buttons
        launchBaseBtn.addEventListener('click', launchBaseGame);
        launchModBtn.addEventListener('click', launchModdedGame);

        // Player controls
        menuToggleBtn.addEventListener('click', toggleLauncherMenu);
        fullscreenBtn.addEventListener('click', toggleFullscreen);
        hideHudBtn.addEventListener('click', hideHud);
        showHudBtn.addEventListener('click', showHud);
        closeLauncherBtn.addEventListener('click', hideLauncherMenu);

        // Notification close
        notificationClose.addEventListener('click', hideNotification);
    }

    // Initialize on page load
    window.addEventListener('DOMContentLoaded', init);

})();
