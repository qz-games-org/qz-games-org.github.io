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

(function() {
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingcont = document.getElementById('loadingcont');

    if (loadingOverlay && loadingcont) {
        Object.defineProperty(loadingcont.style, 'display', {
            set: function(value) {
                if (value === 'none') {
                    loadingOverlay.classList.add('hidden');
                    setTimeout(() => {
                        loadingOverlay.style.display = 'none';
                    }, 600);
                }
            },
            get: function() {
                return loadingOverlay.classList.contains('hidden') ? 'none' : 'flex';
            }
        });
    }
})();

if (typeof window.doneloading === 'undefined') {
    window.doneloading = function() {
        const overlay = document.getElementById('loading-overlay') || document.getElementById('loadingcont');
        if (overlay) {
            overlay.classList.add('hidden');
            setTimeout(() => {
                overlay.style.display = 'none';
            }, 600);
        }
    };
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

const urlParams = new URLSearchParams(window.location.search);
const gameName = urlParams.get('name');
const gameUrl = urlParams.get('game');
const gameType = urlParams.get('type');

if (gameName && gameName.trim() !== '') {
    const loadingTitleEl = document.getElementById('loading-title');
    if (loadingTitleEl) {
        loadingTitleEl.textContent = gameName;
    }
}

if (gameName && gameName.trim() !== '') {
    fetch('../games.json')
        .then(response => response.json())
        .then(gamesData => {
            const gameKey = Object.keys(gamesData).find(key =>
                key.toLowerCase() === gameName.toLowerCase()
            );

            if (gameKey && gamesData[gameKey]) {
                const gameData = gamesData[gameKey];
                const displayName = gameData.name;
                const coverPath = `../covers/${gameData.cover}`;

                const gameNameEl = document.getElementById('game-name');
                const hudCoverEl = document.getElementById('hud-cover');
                if (gameNameEl) gameNameEl.textContent = displayName;
                if (hudCoverEl) hudCoverEl.src = coverPath;

                const loadingTitleEl = document.getElementById('loading-title');
                const loadingGameNameEl = document.getElementById('loading-game-name');
                const loadingCoverEl = document.getElementById('loading-cover');
                const loadingBackgroundEl = document.getElementById('loading-background');
                const gameCoverEl = document.getElementById('gameCover');
                if (loadingTitleEl) loadingTitleEl.textContent = displayName;
                if (loadingGameNameEl) loadingGameNameEl.textContent = 'Preparing your session';
                if (loadingCoverEl) loadingCoverEl.src = coverPath;
                if (loadingBackgroundEl) loadingBackgroundEl.src = coverPath;
                if (gameCoverEl) gameCoverEl.src = coverPath;

                document.title = 'Qz Games | ' + displayName;
            } else {
                const gameNameEl = document.getElementById('game-name');
                const loadingTitleEl = document.getElementById('loading-title');
                const loadingGameNameEl = document.getElementById('loading-game-name');
                if (gameNameEl) gameNameEl.textContent = gameName;
                if (loadingTitleEl) loadingTitleEl.textContent = gameName;
                if (loadingGameNameEl) loadingGameNameEl.textContent = 'Preparing your session';
                document.title = 'Qz Games | ' + gameName;
            }
        })
        .catch(error => {
            console.error('Error loading game data:', error);
            const gameNameEl = document.getElementById('game-name');
            const loadingTitleEl = document.getElementById('loading-title');
            const loadingGameNameEl = document.getElementById('loading-game-name');
            if (gameNameEl) gameNameEl.textContent = gameName;
            if (loadingTitleEl) loadingTitleEl.textContent = gameName;
            if (loadingGameNameEl) loadingGameNameEl.textContent = 'Preparing your session';
            document.title = 'Qz Games | ' + gameName;
        });
}
