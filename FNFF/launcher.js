// FNF Launcher - Player-first layout and mod selection flow

(function() {
    'use strict';

    const MOBILE_QUERY = window.matchMedia('(max-width: 980px)');
    const WIDE_LAYOUT_QUERY = window.matchMedia('(min-width: 1220px)');
    const FALLBACK_ICON = '../Q.png';
    const BASE_COVER = '../covers/fnf.png';
    const BASE_KEY = 'base-game';
    const SCRIPT_ROOT = (() => {
        const currentScript = document.currentScript;

        if (currentScript && currentScript.src) {
            return new URL('./', currentScript.src);
        }

        const scriptElement = document.querySelector('script[src*="FNFF/launcher.js"]');
        return scriptElement && scriptElement.src
            ? new URL('./', scriptElement.src)
            : new URL('./', window.location.href);
    })();

    let mods = {};
    let modKeys = [];
    let selectedKey = BASE_KEY;
    let baseGameData = null;
    let isGameRunning = false;
    let notificationTimer = null;
    let pendingLaunch = null;

    const body = document.body;
    const launcherBackdrop = document.getElementById('launcher-backdrop');
    const modsGrid = document.getElementById('mods-grid');
    const heroLaunchSelectionBtn = document.getElementById('hero-launch-selection');
    const openModsBtn = document.getElementById('open-mods-btn');
    const playerPlaceholder = document.getElementById('player-placeholder');
    const playerContainer = document.getElementById('player-container');
    const gameFrame = document.getElementById('game-frame');
    const topbarMenuBtn = document.getElementById('topbar-menu-btn');
    const playerBackBtn = document.getElementById('player-back-btn');
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    const hideHudBtn = document.getElementById('hide-hud-btn');
    const showHudBtn = document.getElementById('show-hud-btn');
    const closeLauncherBtn = document.getElementById('close-launcher-btn');

    const modsCount = document.getElementById('mods-count');
    const heroTitle = document.getElementById('hero-title');
    const heroDescription = document.getElementById('hero-description');
    const heroArt = document.getElementById('hero-art');

    const selectionCover = document.getElementById('selection-cover');
    const selectionBadge = document.getElementById('selection-badge');
    const selectionTitle = document.getElementById('selection-title');
    const selectionMeta = document.getElementById('selection-meta');
    const selectionWarning = document.getElementById('selection-warning');

    const playerStateLabel = document.getElementById('player-state-label');
    const playerStatusName = document.getElementById('player-status-name');
    const playerStatusMeta = document.getElementById('player-status-meta');

    const notification = document.getElementById('notification');
    const notificationTitle = document.getElementById('notification-title');
    const notificationMessage = document.getElementById('notification-message');
    const notificationClose = document.getElementById('notification-close');

    function isMobileViewport() {
        return MOBILE_QUERY.matches;
    }

    function isWideLayoutViewport() {
        return WIDE_LAYOUT_QUERY.matches;
    }

    function usesOverlayLibrary() {
        return isMobileViewport() || isGameRunning;
    }

    function getBaseSelection() {
        return {
            key: BASE_KEY,
            name: baseGameData?.name || "Friday Night Funkin'",
            icon: baseGameData?.icon || BASE_COVER,
            cover: BASE_COVER,
            warning: baseGameData?.warning || '',
            launchMeta: 'Base game'
        };
    }

    function getSelectionData() {
        if (selectedKey !== BASE_KEY && mods[selectedKey]) {
            const mod = mods[selectedKey];
            return {
                key: selectedKey,
                name: mod.name,
                icon: mod.icon || FALLBACK_ICON,
                cover: mod.icon || BASE_COVER,
                warning: mod.warning || '',
                launchMeta: 'Community mod'
            };
        }

        return getBaseSelection();
    }

    function getImageSource(data) {
        return data.cover || data.icon || FALLBACK_ICON;
    }

    function setImageSource(element, primary, fallback) {
        if (!element) {
            return;
        }

        const targetSrc = primary || fallback;
        element.dataset.fallbackApplied = 'false';
        if (element.src !== targetSrc) {
            element.src = targetSrc;
        }
        element.onerror = () => {
            if (element.dataset.fallbackApplied === 'true') {
                return;
            }

            element.dataset.fallbackApplied = 'true';
            element.src = fallback;
        };
    }

    function replayAnimation(element, className) {
        if (!element) {
            return;
        }
        element.classList.remove(className);
        // Force reflow so the animation restarts
        void element.offsetWidth;
        element.classList.add(className);
    }

    function updateCounts() {
        if (!modsCount) {
            return;
        }
        modsCount.textContent = `${modKeys.length} ${modKeys.length === 1 ? 'mod' : 'mods'}`;
    }

    let isInitialSelectionUpdate = true;

    function updateSelectionUI() {
        const data = getSelectionData();
        const warningText = data.warning ? data.warning.trim() : '';
        const hasWarning = warningText.length > 0;
        const isMod = data.key !== BASE_KEY;
        const animate = !isInitialSelectionUpdate;

        if (heroTitle) {
            heroTitle.textContent = isMod
                ? `${data.name} is ready.`
                : 'Pick a game and hit play.';
            if (animate) replayAnimation(heroTitle, 'refresh-pulse');
        }

        if (heroDescription) {
            heroDescription.textContent = isMod
                ? 'Press play to launch, or choose a different mod from the library.'
                : 'Start with the base game or choose a community mod from the library.';
            if (animate) replayAnimation(heroDescription, 'refresh-pulse');
        }

        if (selectionBadge) {
            selectionBadge.textContent = isMod ? 'Selected mod' : 'Base game';
        }

        if (selectionTitle) {
            selectionTitle.textContent = data.name;
            if (animate) replayAnimation(selectionTitle, 'refresh-pulse');
        }

        if (selectionMeta) {
            selectionMeta.textContent = isMod ? 'Community mod' : 'Official base game';
        }

        if (selectionWarning) {
            selectionWarning.hidden = !hasWarning;
            selectionWarning.textContent = hasWarning ? warningText : '';
        }

        const previousHeroSrc = heroArt?.src;
        const previousCoverSrc = selectionCover?.src;
        setImageSource(heroArt, getImageSource(data), BASE_COVER);
        setImageSource(selectionCover, getImageSource(data), BASE_COVER);

        if (animate) {
            if (heroArt && heroArt.src !== previousHeroSrc) {
                replayAnimation(heroArt, 'hero-art-swap');
            }
            if (selectionCover && selectionCover.src !== previousCoverSrc) {
                replayAnimation(selectionCover, 'image-swap');
            }
        }

        if (heroLaunchSelectionBtn) {
            const actionLabel = isMod ? `Play ${data.name}` : 'Play Base Game';
            const textNode = heroLaunchSelectionBtn.querySelector('.launch-btn-label');
            const iconNode = heroLaunchSelectionBtn.querySelector('.material-icons');
            if (textNode) {
                textNode.textContent = actionLabel;
            }

            if (iconNode) {
                iconNode.textContent = isMod ? 'extension' : 'play_arrow';
            }

            heroLaunchSelectionBtn.title = actionLabel;
        }

        updateSelectedCardHighlight();
        isInitialSelectionUpdate = false;
    }

    function setPlayerStatus(state, name, meta) {
        if (playerStateLabel) {
            playerStateLabel.textContent = state;
        }

        if (playerStatusName) {
            playerStatusName.textContent = name;
        }

        if (playerStatusMeta) {
            playerStatusMeta.textContent = meta;
        }
    }

    function updateSelectedCardHighlight() {
        document.querySelectorAll('.mod-card').forEach((card) => {
            const isSelected = card.dataset.modKey === selectedKey;
            card.classList.toggle('selected', isSelected);
            card.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
        });
    }

    function selectEntry(key) {
        if (key !== BASE_KEY && !mods[key]) {
            return;
        }

        selectedKey = key;
        updateSelectionUI();
    }

    function buildCard({ key, name, icon, warning, isBase, index }) {
        const hasWarning = Boolean(warning && warning.trim());
        const card = document.createElement('button');
        const thumbWrap = document.createElement('div');
        const thumb = document.createElement('img');
        const copy = document.createElement('div');
        const name_el = document.createElement('div');

        card.type = 'button';
        card.className = 'mod-card';
        card.dataset.modKey = key;
        card.setAttribute('aria-pressed', 'false');
        if (typeof index === 'number') {
            card.style.setProperty('--mod-index', index);
        }

        thumbWrap.className = 'mod-thumb';
        thumb.alt = name;
        setImageSource(thumb, icon || FALLBACK_ICON, FALLBACK_ICON);
        thumbWrap.appendChild(thumb);

        copy.className = 'mod-copy';
        name_el.className = 'mod-name';

        const nameText = document.createElement('span');
        nameText.textContent = name;
        name_el.appendChild(nameText);

        if (isBase) {
            const badge = document.createElement('span');
            badge.className = 'mod-badge';
            badge.textContent = 'Base';
            name_el.appendChild(badge);
        }

        copy.appendChild(name_el);

        if (hasWarning) {
            const warn = document.createElement('span');
            warn.className = 'mod-warning';
            const icon_el = document.createElement('span');
            icon_el.className = 'material-icons';
            icon_el.textContent = 'warning';
            const warnText = document.createElement('span');
            warnText.textContent = 'Contains warning';
            warn.appendChild(icon_el);
            warn.appendChild(warnText);
            copy.appendChild(warn);
        }

        card.appendChild(thumbWrap);
        card.appendChild(copy);
        card.addEventListener('click', () => selectEntry(key));

        return card;
    }

    function renderMods() {
        modsGrid.innerHTML = '';

        const baseSelection = getBaseSelection();
        modsGrid.appendChild(buildCard({
            key: BASE_KEY,
            name: baseSelection.name,
            icon: baseSelection.icon,
            warning: baseSelection.warning,
            isBase: true,
            index: 0
        }));

        if (modKeys.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'mod-empty';
            emptyState.textContent = 'No mods were found in the launcher data.';
            modsGrid.appendChild(emptyState);
        } else {
            modKeys.forEach((key, i) => {
                const mod = mods[key];
                modsGrid.appendChild(buildCard({
                    key,
                    name: mod.name,
                    icon: mod.icon,
                    warning: mod.warning,
                    isBase: false,
                    index: i + 1
                }));
            });
        }

        updateSelectedCardHighlight();
    }

    function showNotification(title, message) {
        if (!notification || !notificationTitle || !notificationMessage) {
            return;
        }

        notificationTitle.textContent = title;
        notificationMessage.textContent = message;
        notification.classList.add('show');

        if (notificationTimer) {
            window.clearTimeout(notificationTimer);
        }

        notificationTimer = window.setTimeout(() => {
            hideNotification();
        }, 5200);
    }

    function hideNotification() {
        if (!notification) {
            return;
        }

        notification.classList.remove('show');

        if (notificationTimer) {
            window.clearTimeout(notificationTimer);
            notificationTimer = null;
        }
    }

    function openLauncherMenu() {
        if (usesOverlayLibrary()) {
            body.classList.add('launcher-open');
            body.classList.remove('launcher-collapsed');
        } else {
            body.classList.remove('launcher-collapsed');
        }

        updateCloseLauncherButton();
    }

    function hideLauncherMenu() {
        if (usesOverlayLibrary()) {
            body.classList.remove('launcher-open');
            body.classList.add('launcher-collapsed');
        } else {
            body.classList.add('launcher-collapsed');
        }

        updateCloseLauncherButton();
    }

    function toggleLauncherMenu() {
        if (usesOverlayLibrary()) {
            const nowOpen = !body.classList.contains('launcher-open');
            body.classList.toggle('launcher-open', nowOpen);
            body.classList.toggle('launcher-collapsed', !nowOpen);
        } else {
            body.classList.toggle('launcher-collapsed');
        }

        updateCloseLauncherButton();
    }

    function updateCloseLauncherButton() {
        if (!closeLauncherBtn) {
            return;
        }

        const shouldShow = usesOverlayLibrary()
            ? body.classList.contains('launcher-open')
            : isGameRunning && !body.classList.contains('launcher-collapsed');

        closeLauncherBtn.hidden = !shouldShow;
    }

    function showHud() {
        body.classList.remove('hud-hidden');
    }

    function hideHud() {
        if (!isGameRunning) {
            return;
        }

        body.classList.add('hud-hidden');
    }

    function syncViewportState() {
        if (isMobileViewport()) {
            body.classList.remove('launcher-collapsed');
            body.classList.remove('hud-hidden');
        } else {
            if (isGameRunning) {
                body.classList.remove('launcher-open');
                body.classList.add('launcher-collapsed');
            } else if (!isWideLayoutViewport()) {
                body.classList.remove('launcher-open');
                body.classList.add('launcher-collapsed');
            } else {
                body.classList.remove('launcher-open');
                body.classList.remove('launcher-collapsed');
            }
        }

        updateCloseLauncherButton();
    }

    function focusModsSection() {
        openLauncherMenu();
        modsGrid.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function loadGame(url, name, warning, metaLabel) {
        if (!url) {
            showNotification('Error', 'This entry is missing a launch link.');
            return;
        }

        const hasWarning = Boolean(warning && warning.trim());
        pendingLaunch = {
            name,
            meta: hasWarning ? `${metaLabel} · warning noted` : metaLabel
        };

        if (hasWarning) {
            showNotification('Warning', warning.trim());
        }

        setPlayerStatus('Opening game', name, metaLabel);

        if (gameFrame) {
            gameFrame.classList.remove('is-loaded');
        }

        if (playerPlaceholder) {
            playerPlaceholder.dataset.state = 'leaving';
        }
        if (playerContainer) {
            playerContainer.dataset.state = 'entering';
            requestAnimationFrame(() => {
                playerContainer.dataset.state = 'active';
            });
        }

        body.classList.add('game-running');
        showHud();
        isGameRunning = true;

        gameFrame.src = url;
        hideLauncherMenu();
    }

    function launchCurrentSelection() {
        if (selectedKey !== BASE_KEY && mods[selectedKey]) {
            const mod = mods[selectedKey];
            loadGame(mod.link, mod.name, mod.warning || '', 'Community mod');
            return;
        }

        if (!baseGameData) {
            showNotification('Error', 'Base game data was not found.');
            return;
        }

        const baseSelection = getBaseSelection();
        loadGame(baseGameData.link, baseSelection.name, baseSelection.warning, baseSelection.launchMeta);
    }

    function returnToSelection() {
        if (!isGameRunning) {
            return;
        }

        isGameRunning = false;
        pendingLaunch = null;

        if (gameFrame) {
            gameFrame.classList.remove('is-loaded');
            gameFrame.src = 'about:blank';
        }

        if (playerContainer) {
            playerContainer.dataset.state = 'inactive';
        }

        if (playerPlaceholder) {
            playerPlaceholder.dataset.state = 'active';
        }

        body.classList.remove('game-running');
        body.classList.remove('hud-hidden');

        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
        }

        syncViewportState();
    }

    function toggleFullscreen() {
        const playerStage = document.querySelector('.player-stage');

        if (!document.fullscreenElement) {
            playerStage.requestFullscreen().catch((error) => {
                console.error('Failed to enter fullscreen mode.', error);
            });
            return;
        }

        document.exitFullscreen().catch((error) => {
            console.error('Failed to exit fullscreen mode.', error);
        });
    }

    function onFrameLoaded() {
        if (gameFrame && gameFrame.src && !gameFrame.src.endsWith('about:blank')) {
            gameFrame.classList.add('is-loaded');
        }

        if (!pendingLaunch) {
            return;
        }

        setPlayerStatus('Now playing', pendingLaunch.name, pendingLaunch.meta);
    }

    function handleKeydown(event) {
        if (event.key !== 'Escape') {
            return;
        }

        if (body.classList.contains('hud-hidden')) {
            showHud();
            return;
        }

        if (body.classList.contains('launcher-open')) {
            hideLauncherMenu();
        }
    }

    function setupEventListeners() {
        heroLaunchSelectionBtn?.addEventListener('click', launchCurrentSelection);
        openModsBtn?.addEventListener('click', focusModsSection);
        topbarMenuBtn?.addEventListener('click', toggleLauncherMenu);
        playerBackBtn?.addEventListener('click', returnToSelection);
        closeLauncherBtn?.addEventListener('click', hideLauncherMenu);
        launcherBackdrop?.addEventListener('click', hideLauncherMenu);
        fullscreenBtn?.addEventListener('click', toggleFullscreen);
        hideHudBtn?.addEventListener('click', hideHud);
        showHudBtn?.addEventListener('click', showHud);
        notificationClose?.addEventListener('click', hideNotification);
        gameFrame?.addEventListener('load', onFrameLoaded);
        if (typeof MOBILE_QUERY.addEventListener === 'function') {
            MOBILE_QUERY.addEventListener('change', syncViewportState);
        } else if (typeof MOBILE_QUERY.addListener === 'function') {
            MOBILE_QUERY.addListener(syncViewportState);
        }
        if (typeof WIDE_LAYOUT_QUERY.addEventListener === 'function') {
            WIDE_LAYOUT_QUERY.addEventListener('change', syncViewportState);
        } else if (typeof WIDE_LAYOUT_QUERY.addListener === 'function') {
            WIDE_LAYOUT_QUERY.addListener(syncViewportState);
        }
        document.addEventListener('keydown', handleKeydown);
    }

    async function init() {
        try {
            const modsUrl = new URL('./assets/fnf-mods.json', SCRIPT_ROOT).href;
            const response = await fetch(modsUrl);

            if (!response.ok) {
                throw new Error(`Failed to fetch mods: ${response.status}`);
            }

            const data = await response.json();
            baseGameData = data[BASE_KEY] || null;
            delete data[BASE_KEY];

            mods = data;
            modKeys = Object.keys(mods);

            renderMods();
            updateCounts();
            updateSelectionUI();
            setPlayerStatus('Now playing', getBaseSelection().name, 'Base game');
            setupEventListeners();
            syncViewportState();
        } catch (error) {
            console.error('Error loading mods:', error);
            showNotification('Error', 'Failed to load the FNF launcher data. Refresh and try again.');
        }
    }

    window.addEventListener('DOMContentLoaded', init);
})();
