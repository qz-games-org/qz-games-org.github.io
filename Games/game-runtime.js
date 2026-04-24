// Game page runtime helpers
// Kept separate from the markup so the shell stays thin and the loader logic is easier to maintain.

window.addEventListener('error', function(e) {
    console.error('Error occurred:', e.error);
    showErrorNotification();
});

window.addEventListener('unhandledrejection', function(e) {
    console.error('Promise rejection:', e.reason);
    showErrorNotification();
});

function showErrorNotification() {
    if (document.getElementById('error-notification-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'error-notification-overlay';
    overlay.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.8);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;

    const card = document.createElement('div');
    card.style.cssText = `
        background: linear-gradient(180deg, var(--sidenav-bg-start, rgba(26, 26, 26, 0.95)) 0%, var(--sidenav-bg-end, #0d0d0d) 100%);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border-radius: 20px;
        padding: 40px;
        border: 1px solid var(--sidenav-border, rgba(255, 255, 255, 0.1));
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        width: min(400px, 90vw);
        text-align: center;
        font-family: 'Poppins', Arial, sans-serif;
    `;

    card.innerHTML = `
        <span class="material-icons" style="font-size: 64px; color: #ff6b6b; margin-bottom: 16px;">error_outline</span>
        <h2 style="margin: 0 0 12px; font-size: 1.5rem; color: white; font-weight: 600;">An Error Occurred</h2>
        <p style="margin: 0 0 28px; font-size: 0.95rem; color: rgba(255, 255, 255, 0.7); line-height: 1.6;">
            Something went wrong while loading the game. Please report this issue and return to the home page.
        </p>
        <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
            <button onclick="reportIssue()" style="
                background: var(--sidenav-icon-btn-bg, rgba(255, 255, 255, 0.05));
                border: 1px solid var(--sidenav-icon-btn-border, rgba(255, 255, 255, 0.1));
                color: white;
                padding: 12px 24px;
                border-radius: 12px;
                font-size: 0.9rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s;
                font-family: 'Poppins', Arial, sans-serif;
            " onmouseover="this.style.background='var(--sidenav-icon-btn-bg-hover, rgba(255, 255, 255, 0.1))'" onmouseout="this.style.background='var(--sidenav-icon-btn-bg, rgba(255, 255, 255, 0.05))'">
                <span class="material-icons" style="font-size: 18px; vertical-align: middle; margin-right: 6px;">bug_report</span>
                Report Bug
            </button>
            <button onclick="document.getElementById('error-notification-overlay').remove(); doneloading();" style="
                background: linear-gradient(135deg, rgba(255, 193, 7, 0.2), rgba(255, 193, 7, 0.3));
                border: 1px solid rgba(255, 193, 7, 0.4);
                color: white;
                padding: 12px 24px;
                border-radius: 12px;
                font-size: 0.9rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s;
                font-family: 'Poppins', Arial, sans-serif;
            " onmouseover="this.style.background='linear-gradient(135deg, rgba(255, 193, 7, 0.3), rgba(255, 193, 7, 0.4))'" onmouseout="this.style.background='linear-gradient(135deg, rgba(255, 193, 7, 0.2), rgba(255, 193, 7, 0.3))'">
                <span class="material-icons" style="font-size: 18px; vertical-align: middle; margin-right: 6px;">play_arrow</span>
                Continue Anyway
            </button>
            <button onclick="window.location.href='../index.html'" style="
                background: linear-gradient(135deg, rgba(255, 107, 107, 0.2), rgba(255, 107, 107, 0.3));
                border: 1px solid rgba(255, 107, 107, 0.4);
                color: white;
                padding: 12px 24px;
                border-radius: 12px;
                font-size: 0.9rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s;
                font-family: 'Poppins', Arial, sans-serif;
            " onmouseover="this.style.background='linear-gradient(135deg, rgba(255, 107, 107, 0.3), rgba(255, 107, 107, 0.4))'" onmouseout="this.style.background='linear-gradient(135deg, rgba(255, 107, 107, 0.2), rgba(255, 107, 107, 0.3))'">
                <span class="material-icons" style="font-size: 18px; vertical-align: middle; margin-right: 6px;">home</span>
                Return Home
            </button>
        </div>
    `;

    overlay.appendChild(card);
    document.body.appendChild(overlay);
}

if (window.QZPageTransition && typeof window.QZPageTransition.consumeIncomingToken === 'function') {
    window.QZPageTransition.consumeIncomingToken();
}

function hidePlayerLoadingOverlay() {
    const overlay = document.getElementById('loading-overlay') || document.getElementById('loadingcont');
    if (!overlay) {
        return;
    }

    overlay.classList.add('hidden');
    setTimeout(() => {
        overlay.style.display = 'none';
    }, 600);
}

function finishPlayerLoading() {
    const transition = window.QZPageTransition;
    const completion = transition && typeof transition.completeIncoming === 'function'
        ? transition.completeIncoming()
        : null;

    if (completion && typeof completion.then === 'function') {
        hidePlayerLoadingOverlay();
        completion.catch((error) => {
            console.error('Page transition completion failed:', error);
        });
        return;
    }

    hidePlayerLoadingOverlay();
}

(function() {
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingcont = document.getElementById('loadingcont');

    if (loadingOverlay && loadingcont) {
        Object.defineProperty(loadingcont.style, 'display', {
            set: function(value) {
                if (value === 'none') {
                    finishPlayerLoading();
                }
            },
            get: function() {
                return loadingOverlay.classList.contains('hidden') ? 'none' : 'flex';
            }
        });
    }
})();

if (typeof window.doneloading === 'undefined') {
    window.doneloading = finishPlayerLoading;
}

function ToggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else if (document.exitFullscreen) {
        document.exitFullscreen();
    }
}

function Backhome() {
    window.location.href = '../index.html';
}

function reportIssue() {
    window.open('https://forms.gle/yLyC7rFkY1xeNk3TA', '_blank', 'noopener');
}

function setPageTitle(title) {
    if (!title) {
        return;
    }

    if (window.QZTabCloak && typeof window.QZTabCloak.applyPageTitle === 'function') {
        window.QZTabCloak.applyPageTitle(title);
        return;
    }

    document.title = title;
}

function toggleHud() {
    const wrap = document.getElementById('hud-wrap');
    if (wrap) {
        wrap.classList.toggle('hud-hidden');
    }
}

function getPlayerModalOverlay(id) {
    return document.getElementById(id);
}

function syncPlayerModalState() {
    const anyModalOpen = ['menusforgame', 'helpModalOverlay'].some((id) => getPlayerModalOverlay(id)?.classList.contains('active'));
    document.body.style.overflow = anyModalOpen ? 'hidden' : '';
}

function setPlayerModalState(id, shouldOpen) {
    const target = getPlayerModalOverlay(id);
    if (!target) {
        return false;
    }

    ['menusforgame', 'helpModalOverlay'].forEach((overlayId) => {
        const overlay = getPlayerModalOverlay(overlayId);
        if (!overlay) {
            return;
        }

        if (overlayId === id) {
            overlay.classList.toggle('active', shouldOpen);
        } else if (shouldOpen) {
            overlay.classList.remove('active');
        }
    });

    syncPlayerModalState();
    return shouldOpen;
}

function toggleControllerSettings(forceState) {
    const overlay = getPlayerModalOverlay('menusforgame');
    if (!overlay) {
        return false;
    }

    const shouldOpen = typeof forceState === 'boolean' ? forceState : !overlay.classList.contains('active');
    return setPlayerModalState('menusforgame', shouldOpen);
}

function toggleHelpWindow(forceState) {
    const overlay = getPlayerModalOverlay('helpModalOverlay');
    if (!overlay) {
        return false;
    }

    const shouldOpen = typeof forceState === 'boolean' ? forceState : !overlay.classList.contains('active');
    return setPlayerModalState('helpModalOverlay', shouldOpen);
}

document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') {
        return;
    }

    if (getPlayerModalOverlay('helpModalOverlay')?.classList.contains('active')) {
        toggleHelpWindow(false);
        return;
    }

    if (getPlayerModalOverlay('menusforgame')?.classList.contains('active')) {
        toggleControllerSettings(false);
    }
});

let progress = 0;
let progressTarget = 0;
let progressAnimationFrame;

function stepLoadingProgress() {
    progress += (progressTarget - progress) * 0.08;

    if (Math.abs(progressTarget - progress) < 0.08) {
        progress = progressTarget;
    }

    const progressFill = document.getElementById('progbar');
    if (progressFill) {
        progressFill.style.width = progress.toFixed(2) + '%';
    }

    if (progress < 100) {
        progressAnimationFrame = requestAnimationFrame(stepLoadingProgress);
    } else {
        progressAnimationFrame = null;
    }
}

const progressInterval = setInterval(() => {
    const remaining = 100 - progressTarget;
    const step = Math.max(1.25, remaining * (0.08 + Math.random() * 0.12));
    progressTarget = Math.min(100, progressTarget + step);

    if (!progressAnimationFrame) {
        progressAnimationFrame = requestAnimationFrame(stepLoadingProgress);
    }

    if (progressTarget >= 100) {
        clearInterval(progressInterval);
    }
}, 280);

const gameSelectorState = {
    entries: [],
    suggestions: [],
    inputBound: false
};

let resolvedGameContext = null;
let resolvedGamePromise = null;

function safeDecodeGameValue(value) {
    if (typeof value !== 'string') {
        return value || '';
    }

    try {
        return decodeURIComponent(value);
    } catch (error) {
        return value;
    }
}

function getRequestedGameReference() {
    const params = new URLSearchParams(window.location.search);
    return {
        id: params.get('id'),
        name: params.get('name'),
        link: params.get('game'),
        type: params.get('type')
    };
}

function getRequestedGameLabel(reference = getRequestedGameReference()) {
    return safeDecodeGameValue(
        reference.id
        || reference.name
        || (reference.link ? reference.link.split('/').pop() : '')
        || 'Getting ready'
    )
        .replace(/[-_]+/g, ' ')
        .trim();
}

function setElementText(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value;
    }
}

function setElementSource(id, value) {
    const element = document.getElementById(id);
    if (element && value) {
        element.src = value;
    }
}

function replaceWithCanonicalGameId(gameId) {
    if (!gameId || !window.history || typeof window.history.replaceState !== 'function') {
        return;
    }

    const nextUrl = new URL(window.location.href);
    nextUrl.search = '';
    nextUrl.searchParams.set('id', gameId);
    window.history.replaceState({}, '', nextUrl);
}

function stopLoadingProgress() {
    clearInterval(progressInterval);

    if (progressAnimationFrame) {
        cancelAnimationFrame(progressAnimationFrame);
        progressAnimationFrame = null;
    }

    progress = 100;
    progressTarget = 100;

    const progressFill = document.getElementById('progbar');
    if (progressFill) {
        progressFill.style.width = '100%';
    }
}

function applyResolvedGamePresentation(context) {
    if (!context || !context.game) {
        return;
    }

    const displayName = context.game.name || context.id;
    const coverPath = window.GameCatalog && typeof window.GameCatalog.getGameCoverLink === 'function'
        ? window.GameCatalog.getGameCoverLink(context.game)
        : `../covers/${context.game.cover}`;

    setElementText('game-name', displayName);
    setElementSource('hud-cover', coverPath);

    setElementText('loading-title', displayName);
    setElementText('loading-game-name', 'Preparing your session');
    setElementText(
        'loading-subtitle',
        context.matchedBy === 'fuzzy'
            ? `Closest catalog match for "${context.query}"`
            : 'Setting up your gaming experience'
    );

    setElementSource('loading-cover', coverPath);
    setElementSource('loading-background', coverPath);
    setElementSource('gameCover', coverPath);

    setPageTitle(`Qz Games | ${displayName}`);
    replaceWithCanonicalGameId(context.id);
}

function getGameSelectorRefs() {
    return {
        overlay: document.getElementById('game-selector-overlay'),
        message: document.getElementById('game-selector-message'),
        input: document.getElementById('game-selector-input'),
        list: document.getElementById('game-selector-list')
    };
}

function scoreSelectorEntry(entry, query) {
    const catalog = window.GameCatalog;
    if (!catalog) {
        return 0;
    }

    const normalizedQuery = catalog.normalizeGameLookup(query);
    if (!normalizedQuery) {
        return 0;
    }

    const normalizedName = catalog.normalizeGameLookup(entry.game.name);
    const normalizedId = catalog.normalizeGameLookup(entry.id);
    const containsScore = normalizedName.includes(normalizedQuery) || normalizedId.includes(normalizedQuery)
        ? 0.92
        : 0;

    return Math.max(
        containsScore,
        catalog.calculateSimilarity(normalizedQuery, normalizedName),
        catalog.calculateSimilarity(normalizedQuery, normalizedId)
    );
}

function navigateToGameSelection(entry) {
    if (!entry || !window.GameCatalog) {
        return;
    }

    const link = window.GameCatalog.getGameLink(entry.game, {
        gameId: entry.id
    });

    if (
        window.QZPageTransition
        && typeof window.QZPageTransition.startOutgoingNavigation === 'function'
        && window.QZPageTransition.startOutgoingNavigation(link, {
            gameId: entry.id,
            gameName: entry.game.name,
            cover: window.GameCatalog.getGameCoverLink(entry.game)
        })
    ) {
        return;
    }

    window.location.href = link;
}

function renderGameSelectorEntries(query = '') {
    const refs = getGameSelectorRefs();
    if (!refs.list) {
        return;
    }

    const trimmedQuery = query.trim();
    let entriesToRender = gameSelectorState.entries.slice();

    if (trimmedQuery) {
        entriesToRender = entriesToRender
            .map((entry) => ({
                ...entry,
                searchScore: scoreSelectorEntry(entry, trimmedQuery)
            }))
            .filter((entry) => entry.searchScore >= 0.38)
            .sort((left, right) => right.searchScore - left.searchScore || left.game.name.localeCompare(right.game.name))
            .slice(0, 36);
    } else {
        entriesToRender = entriesToRender.slice(0, 28);
    }

    refs.list.innerHTML = '';

    if (!entriesToRender.length) {
        const emptyState = document.createElement('div');
        emptyState.className = 'game-selector-empty';
        emptyState.textContent = 'No matching games found. Try a different search.';
        refs.list.appendChild(emptyState);
        return;
    }

    entriesToRender.forEach((entry) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'game-selector-option';
        button.addEventListener('click', () => navigateToGameSelection(entry));

        const cover = document.createElement('img');
        cover.src = window.GameCatalog.getGameCoverLink(entry.game);
        cover.alt = `${entry.game.name} cover`;

        const copy = document.createElement('div');
        copy.className = 'game-selector-option-copy';

        const title = document.createElement('div');
        title.className = 'game-selector-option-title';
        title.textContent = entry.game.name;

        const meta = document.createElement('div');
        meta.className = 'game-selector-option-meta';
        meta.textContent = entry.game.catagory || entry.id;

        copy.appendChild(title);
        copy.appendChild(meta);

        const badge = document.createElement('div');
        badge.className = 'game-selector-option-badge';
        badge.textContent = entry.isSuggested ? 'Suggested' : (entry.game.type || 'game');

        button.appendChild(cover);
        button.appendChild(copy);
        button.appendChild(badge);

        refs.list.appendChild(button);
    });
}

function bindGameSelectorInput() {
    const refs = getGameSelectorRefs();
    if (!refs.input || gameSelectorState.inputBound) {
        return;
    }

    gameSelectorState.inputBound = true;
    refs.input.addEventListener('input', () => {
        renderGameSelectorEntries(refs.input.value);
    });
}

function showGameSelector(resolution, gamesData) {
    const refs = getGameSelectorRefs();
    if (!refs.overlay || !window.GameCatalog) {
        return;
    }

    const suggestedEntries = (resolution && resolution.suggestions ? resolution.suggestions : []).map((entry) => ({
        id: entry.id,
        game: entry.game,
        isSuggested: true
    }));

    const allEntries = window.GameCatalog.getCatalogEntries(gamesData)
        .sort((left, right) => left.game.name.localeCompare(right.game.name))
        .map((entry) => ({
            ...entry,
            isSuggested: false
        }));

    const mergedEntries = new Map();
    suggestedEntries.forEach((entry) => mergedEntries.set(entry.id, entry));
    allEntries.forEach((entry) => {
        if (!mergedEntries.has(entry.id)) {
            mergedEntries.set(entry.id, entry);
        }
    });

    gameSelectorState.entries = Array.from(mergedEntries.values());
    gameSelectorState.suggestions = suggestedEntries;

    setElementText('game-name', 'Select a game');
    setPageTitle('Qz Games | Select your game');
    stopLoadingProgress();

    if (typeof window.doneloading === 'function') {
        window.doneloading();
    }

    refs.message.textContent = resolution && resolution.query
        ? `We could not find an exact catalog match for "${resolution.query}". Search for your game or choose one of the closest results below.`
        : 'No game was specified. Search for your game below or pick one from the catalog.';

    refs.overlay.hidden = false;
    refs.overlay.classList.add('active');
    bindGameSelectorInput();
    refs.input.value = resolution && resolution.query ? resolution.query : '';
    renderGameSelectorEntries(refs.input.value);

    window.setTimeout(() => {
        refs.input.focus();
        refs.input.select();
    }, 80);
}

function setInitialRequestedGameLabel() {
    const initialLabel = getRequestedGameLabel();
    if (!initialLabel) {
        return;
    }

    setElementText('loading-title', initialLabel);
    setElementText('game-name', initialLabel);
    setPageTitle(`Qz Games | ${initialLabel}`);
}

async function resolveRequestedGame() {
    if (resolvedGamePromise) {
        return resolvedGamePromise;
    }

    resolvedGamePromise = (async () => {
        const reference = getRequestedGameReference();
        const catalog = window.GameCatalog;

        if (!catalog || typeof catalog.fetchGamesData !== 'function' || typeof catalog.resolveGameReference !== 'function') {
            return null;
        }

        const gamesData = await catalog.fetchGamesData('../games.json');
        const resolution = catalog.resolveGameReference(reference, gamesData);

        if (!resolution.entry) {
            showGameSelector(resolution, gamesData);
            return null;
        }

        resolvedGameContext = {
            id: resolution.entry.id,
            game: resolution.entry.game,
            matchedBy: resolution.matchedBy,
            query: resolution.query,
            gamesData
        };

        applyResolvedGamePresentation(resolvedGameContext);
        return resolvedGameContext;
    })().catch((error) => {
        console.error('Error resolving game from catalog:', error);
        showErrorNotification();
        return null;
    });

    return resolvedGamePromise;
}

window.QZGamePage = {
    resolveRequestedGame,
    getResolvedGameContext: () => resolvedGameContext,
    showGameSelector
};

setInitialRequestedGameLabel();
resolveRequestedGame();
