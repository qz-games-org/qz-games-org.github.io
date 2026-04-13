(function() {
    const BACKGROUND_SCRIPT_ID = 'background-handler-script';
    const BACKGROUND_SCRIPT_SRC = './background-custom/backgroundcustomhandle.js';
    const CHANGELOG_SOURCE = './chnglog.txt';
    const changelogState = {
        initialized: false,
        isOpen: false,
        content: null,
        loadingPromise: null,
        lastFocusedElement: null
    };

    function shouldLoadBackgroundSystem() {
        if (typeof getCookie !== 'function') {
            return false;
        }

        const customBackgroundsEnabled = getCookie('customBackgrounds') !== 'false';
        const selectedBackground = getCookie('selectedBackground') || 'none';
        return customBackgroundsEnabled && selectedBackground !== 'none';
    }

    function loadScript(src, id) {
        return new Promise((resolve, reject) => {
            const existingScript = document.getElementById(id);
            if (existingScript) {
                if (existingScript.dataset.loaded === 'true') {
                    resolve();
                    return;
                }

                existingScript.addEventListener('load', () => resolve(), { once: true });
                existingScript.addEventListener('error', reject, { once: true });
                return;
            }

            const script = document.createElement('script');
            script.id = id;
            script.src = src;
            script.defer = true;
            script.addEventListener('load', () => {
                script.dataset.loaded = 'true';
                resolve();
            }, { once: true });
            script.addEventListener('error', reject, { once: true });
            document.head.appendChild(script);
        });
    }

    async function initHomepageBackground() {
        if (!shouldLoadBackgroundSystem()) {
            return;
        }

        try {
            await loadScript(BACKGROUND_SCRIPT_SRC, BACKGROUND_SCRIPT_ID);

            if (typeof initBackgroundHandler === 'function') {
                initBackgroundHandler('#backgroundarea');
            }

            if (typeof loadSelectedBackground === 'function') {
                loadSelectedBackground();
            }
        } catch (error) {
            console.error('Failed to initialize homepage background system.', error);
        }
    }

    function shouldLoadWeatherSystem() {
        try {
            return window.localStorage.getItem('weather_enabled') !== 'false';
        } catch (error) {
            return true;
        }
    }

    async function initHomepageWeather() {
        if (!shouldLoadWeatherSystem()) {
            const greetingBanner = document.getElementById('greeting-banner');
            if (greetingBanner) {
                greetingBanner.style.display = 'none';
            }
            return;
        }

        try {
            await loadScript('./weather-widget.js', 'weather-widget-script');
            await loadScript('./greeting-banner.js', 'greeting-banner-script');
        } catch (error) {
            console.error('Failed to initialize homepage weather system.', error);
        }
    }

    function getChangelogElements() {
        return {
            button: document.getElementById('changelogButton'),
            modal: document.getElementById('changelogModal'),
            backdrop: document.getElementById('changelogBackdrop'),
            close: document.getElementById('changelogClose'),
            content: document.getElementById('changelogContent')
        };
    }

    function renderChangelogMessage(message) {
        const { content } = getChangelogElements();
        if (!content) {
            return;
        }

        content.textContent = message;
    }

    async function loadChangelogText() {
        if (typeof changelogState.content === 'string') {
            return changelogState.content;
        }

        if (changelogState.loadingPromise) {
            return changelogState.loadingPromise;
        }

        changelogState.loadingPromise = fetch(CHANGELOG_SOURCE, { cache: 'no-store' })
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`Failed to load changelog: ${response.status}`);
                }

                return response.text();
            })
            .then((text) => {
                changelogState.content = text.trim() || 'No changelog entries yet.';
                return changelogState.content;
            })
            .finally(() => {
                changelogState.loadingPromise = null;
            });

        return changelogState.loadingPromise;
    }

    function setChangelogOpen(isOpen) {
        const { modal, close, button } = getChangelogElements();
        if (!modal) {
            return;
        }

        changelogState.isOpen = isOpen;
        modal.hidden = false;
        modal.classList.toggle('is-open', isOpen);
        modal.setAttribute('aria-hidden', String(!isOpen));
        document.body.classList.toggle('changelog-open', isOpen);

        if (isOpen) {
            close?.focus();
            return;
        }

        window.setTimeout(() => {
            if (!changelogState.isOpen) {
                modal.hidden = true;
            }
        }, 220);

        if (changelogState.lastFocusedElement instanceof HTMLElement) {
            changelogState.lastFocusedElement.focus();
        } else {
            button?.focus();
        }
    }

    async function openChangelog() {
        const { modal } = getChangelogElements();
        if (!modal) {
            return;
        }

        changelogState.lastFocusedElement = document.activeElement;
        renderChangelogMessage('Loading changelog...');
        setChangelogOpen(true);

        try {
            renderChangelogMessage(await loadChangelogText());
        } catch (error) {
            console.error('Failed to load changelog.', error);
            renderChangelogMessage('Unable to load the changelog right now.');
        }
    }

    function closeChangelog() {
        if (!changelogState.isOpen) {
            return;
        }

        setChangelogOpen(false);
    }

    function initChangelog() {
        if (changelogState.initialized) {
            return;
        }

        const { button, modal, backdrop, close } = getChangelogElements();
        if (!button || !modal || !backdrop || !close) {
            return;
        }

        changelogState.initialized = true;
        button.addEventListener('click', openChangelog);
        backdrop.addEventListener('click', closeChangelog);
        close.addEventListener('click', closeChangelog);
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && changelogState.isOpen) {
                closeChangelog();
            }
        });
    }

    function init() {
        if (window.QZHomeUI && typeof window.QZHomeUI.init === 'function') {
            window.QZHomeUI.init();
        }

        if (window.QZNote && typeof window.QZNote.init === 'function') {
            window.QZNote.init();
        }

        initChangelog();
        initHomepageBackground();

        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(() => {
                initHomepageWeather();
            }, { timeout: 1200 });
        } else {
            window.setTimeout(() => {
                initHomepageWeather();
            }, 500);
        }
    }

    window.QZHomepageInit = {
        init,
        initHomepageBackground,
        initHomepageWeather,
        openChangelog,
        closeChangelog
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
