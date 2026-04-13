const DEBUG_MODE = false;
const COOKIE_NAME = 'usractivity';
const COOKIE_EXPIRY_DAYS = 3000;

// Store active game sessions for time tracking
const activeSessions = new Map();

/**
 * Set a cookie with name, value, and expiration
 */
function setCookieActivity(name, value, days = COOKIE_EXPIRY_DAYS) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = "expires=" + date.toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)};${expires};path=/`;
}

/**
 * Get a cookie value by name
 */
function getCookieActivity(name) {
    const nameEQ = name + "=";
    const cookies = document.cookie.split(';');

    for (let cookie of cookies) {
        cookie = cookie.trim();
        if (cookie.indexOf(nameEQ) === 0) {
            return decodeURIComponent(cookie.substring(nameEQ.length));
        }
    }
    return null;
}

/**
 * Get all activity data from cookie
 */
function getActivityData() {
    const activity = getCookieActivity(COOKIE_NAME);
    try {
        return activity ? JSON.parse(activity) : [];
    } catch (error) {
        console.error('Error parsing activity data:', error);
        return [];
    }
}

/**
 * Save activity data to cookie
 */
function saveActivityData(activityData) {
    try {
        setCookieActivity(COOKIE_NAME, JSON.stringify(activityData));
        return true;
    } catch (error) {
        console.error('Error saving activity to cookie:', error);
        return false;
    }
}

/**
 * Start tracking play time for a game
 */
function startPlaySession(gameKey) {
    if (!gameKey) return;

    // Store start time for this session
    activeSessions.set(gameKey, {
        startTime: Date.now(),
        lastUpdate: Date.now()
    });

    if (DEBUG_MODE) {
        console.log(`Started play session for ${gameKey}`);
    }
}

/**
 * Stop tracking play time and save duration
 */
function stopPlaySession(gameKey) {
    if (!gameKey || !activeSessions.has(gameKey)) return 0;

    const session = activeSessions.get(gameKey);
    const duration = Date.now() - session.startTime;
    activeSessions.delete(gameKey);

    // Update total play time
    updatePlayTime(gameKey, duration);

    if (DEBUG_MODE) {
        console.log(`Stopped play session for ${gameKey}, duration: ${formatDuration(duration)}`);
    }

    return duration;
}

/**
 * Update play time for a game
 */
function updatePlayTime(gameKey, durationMs, incrementPlayCount = false) {
    const activityData = getActivityData();

    // Normalize game key to lowercase for comparison to avoid duplicates
    const normalizedKey = gameKey.toLowerCase();
    let gameData = activityData.find(game => game.gameKey.toLowerCase() === normalizedKey);

    if (!gameData) {
        gameData = {
            gameKey: gameKey,
            totalPlayTimeMs: 0,
            playCount: 0,
            firstPlayed: new Date().toISOString(),
            lastPlayed: new Date().toISOString()
        };
        activityData.push(gameData);
    }

    // Update play time and metadata
    gameData.totalPlayTimeMs = (gameData.totalPlayTimeMs || 0) + durationMs;

    // Only increment play count if explicitly told (on new session start)
    if (incrementPlayCount) {
        gameData.playCount = (gameData.playCount || 0) + 1;
    }

    gameData.lastPlayed = new Date().toISOString();

    saveActivityData(activityData);
}

/**
 * Format duration in milliseconds to readable string
 */
function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    } else {
        return `${seconds}s`;
    }
}

/**
 * Format game data for display
 */
function formatGameData(gameData) {
    return {
        gameKey: gameData.gameKey,
        totalPlayTime: formatDuration(gameData.totalPlayTimeMs || 0),
        playCount: gameData.playCount || 0,
        lastPlayed: gameData.lastPlayed
    };
}

/**
 * Track activity when element is clicked
 */
function trackActivity(event) {
    const elementId = event.currentTarget.dataset.gameId || event.currentTarget.id;

    if (DEBUG_MODE) {
        alert(`Element ID: ${elementId}`);
    }

    if (elementId) {
        startPlaySession(elementId);
    }
}

/**
 * View current activity data (formatted)
 */
function viewActivityData() {
    const activityData = getActivityData();

    if (activityData.length === 0) {
        console.log('No activity data found');
        return [];
    }

    const formatted = activityData.map(formatGameData);
    console.table(formatted);
    return activityData;
}

/**
 * Get play time for a specific game
 */
function getGamePlayTime(gameKey) {
    const activityData = getActivityData();
    const gameData = activityData.find(game => game.gameKey === gameKey);

    if (gameData) {
        return formatGameData(gameData);
    }
    return null;
}

/**
 * Clear all activity data (for testing)
 */
function clearActivityData() {
    document.cookie = `${COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    activeSessions.clear();
}

/**
 * Merge duplicate game entries (case-insensitive)
 */
function mergeDuplicates() {
    const activityData = getActivityData();
    const merged = {};

    activityData.forEach(game => {
        const key = game.gameKey.toLowerCase();

        if (!merged[key]) {
            merged[key] = game;
        } else {
            // Merge with existing entry
            merged[key].totalPlayTimeMs = (merged[key].totalPlayTimeMs || 0) + (game.totalPlayTimeMs || 0);
            merged[key].playCount = (merged[key].playCount || 0) + (game.playCount || 0);

            // Keep earliest first played
            if (game.firstPlayed && (!merged[key].firstPlayed || game.firstPlayed < merged[key].firstPlayed)) {
                merged[key].firstPlayed = game.firstPlayed;
            }

            // Keep latest last played
            if (game.lastPlayed && (!merged[key].lastPlayed || game.lastPlayed > merged[key].lastPlayed)) {
                merged[key].lastPlayed = game.lastPlayed;
            }
        }
    });

    const cleanedData = Object.values(merged);
    saveActivityData(cleanedData);
    return cleanedData;
}

// Auto-save active sessions before page unload
window.addEventListener('beforeunload', () => {
    for (const [gameKey, session] of activeSessions.entries()) {
        const duration = Date.now() - session.startTime;
        updatePlayTime(gameKey, duration, false); // Don't increment play count on close
    }
    activeSessions.clear();
});

// Auto-start tracking on game page
(async function initGameActivityTracking() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initGameActivityTracking, { once: true });
        return;
    }

    // Clean up any duplicate entries on load
    mergeDuplicates();

    // Check if on game page (prefer catalog id, then fall back to older params)
    const params = new URLSearchParams(window.location.search);
    let gameKey = params.get('id');

    if (!gameKey && window.QZGamePage && typeof window.QZGamePage.resolveRequestedGame === 'function') {
        try {
            const resolvedGame = await window.QZGamePage.resolveRequestedGame();
            if (resolvedGame && resolvedGame.id) {
                gameKey = resolvedGame.id;
            }
        } catch (error) {
            console.error('Error resolving game id for activity tracking:', error);
        }
    }

    if (!gameKey) {
        gameKey = params.get('name');
    }

    // If name not found, fallback to extracting from ?game= path
    if (!gameKey) {
        const gamePath = params.get('game');
        if (gamePath) {
            // Extract just the game name from path like "../Games01/crazyc"
            gameKey = gamePath.split('/').pop();
        }
    }

    if (gameKey) {
        startPlaySession(gameKey);

        // Mark that this is a new session (we'll increment play count on first save)
        let isNewSession = true;

        // Auto-save every 2 seconds
        setInterval(() => {
            const session = activeSessions.get(gameKey);
            if (session) {
                const duration = Date.now() - session.startTime;
                // Only increment play count on the very first save of a new session
                updatePlayTime(gameKey, duration, isNewSession);
                if (isNewSession) {
                    isNewSession = false; // Only count once per session
                }
                session.startTime = Date.now();
            }
        }, 2000);

        // Pause when tab hidden
        document.addEventListener('visibilitychange', () => {
            const session = activeSessions.get(gameKey);
            if (!session) return;

            if (document.hidden) {
                const duration = Date.now() - session.startTime;
                updatePlayTime(gameKey, duration, false); // Don't increment play count
                session.pausedAt = Date.now();
            } else if (session.pausedAt) {
                session.startTime = Date.now();
                delete session.pausedAt;
            }
        });
    }
})();
