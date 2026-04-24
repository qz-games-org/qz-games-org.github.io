(function() {
    const BACKGROUND_SCRIPT_ID = 'background-handler-script';
    const BACKGROUND_SCRIPT_SRC = './background-custom/backgroundcustomhandle.js';
    const CHANGELOG_SOURCE = './chnglog.txt';
    const VERSION_SOURCE = './version.txt';
    const BROWSER_NOTICE_STORAGE_KEY = 'qzBrowserNoticeDismissed';
    const changelogState = {
        initialized: false,
        isOpen: false,
        content: null,
        loadingPromise: null,
        lastFocusedElement: null
    };
    const versionState = {
        content: null,
        loadingPromise: null
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

    async function loadVersionText() {
        if (typeof versionState.content === 'string') {
            return versionState.content;
        }

        if (versionState.loadingPromise) {
            return versionState.loadingPromise;
        }

        versionState.loadingPromise = fetch(VERSION_SOURCE, { cache: 'no-store' })
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`Failed to load version text: ${response.status}`);
                }

                return response.text();
            })
            .then((text) => {
                const firstLine = String(text || '')
                    .split(/\r?\n/)
                    .map((line) => line.trim())
                    .find((line) => line.length > 0);

                versionState.content = firstLine || '';
                return versionState.content;
            })
            .finally(() => {
                versionState.loadingPromise = null;
            });

        return versionState.loadingPromise;
    }

    function applyVersionText(versionText) {
        if (!versionText) {
            return;
        }

        document.querySelectorAll('[data-qz-version="label"]').forEach((label) => {
            label.textContent = versionText;
        });

        const footerLead = document.querySelector('.foot > div:first-child');
        if (footerLead && !footerLead.querySelector('[data-qz-version="label"]')) {
            footerLead.innerHTML = `© 2026 Qz Games · <span data-qz-version="label">${versionText}</span>`;
        }
    }

    async function syncVersionLabels() {
        try {
            applyVersionText(await loadVersionText());
        } catch (error) {
            console.error('Failed to sync version labels.', error);
        }
    }

    function isChromiumBrowser() {
        const nav = window.navigator || {};
        const userAgent = String(nav.userAgent || '').toLowerCase();
        const brands = Array.isArray(nav.userAgentData?.brands) ? nav.userAgentData.brands : [];
        const hasChromiumBrand = brands.some((brand) => /chrom(e|ium)|edge|opera/i.test(String(brand.brand || '')));

        if (hasChromiumBrand) {
            return true;
        }

        const isChromiumLike = /chrome|chromium|crios|edg\/|opr\//i.test(userAgent);
        const isFirefox = /firefox|fxios/i.test(userAgent);
        return isChromiumLike && !isFirefox;
    }

    function dismissBrowserNotice(element) {
        if (element && element.parentNode) {
            element.parentNode.removeChild(element);
        }

        try {
            window.localStorage.setItem(BROWSER_NOTICE_STORAGE_KEY, 'dismissed');
        } catch (error) {
            // Ignore storage errors and continue.
        }
    }

    function initBrowserRecommendation() {
        if (isChromiumBrowser()) {
            return;
        }

        try {
            if (window.localStorage.getItem(BROWSER_NOTICE_STORAGE_KEY) === 'dismissed') {
                return;
            }
        } catch (error) {
            // Ignore storage failures and continue with rendering.
        }

        const nav = document.querySelector('.nav');
        if (!nav || document.querySelector('.browser-recommendation')) {
            return;
        }

        const recommendation = document.createElement('aside');
        recommendation.className = 'browser-recommendation';
        recommendation.setAttribute('role', 'status');
        recommendation.innerHTML =
            '<p><strong>Compatibility tip:</strong> For the smoothest experience, we recommend Chrome. Some visual effects may be limited in other browsers.</p>' +
            '<button class="dismiss-btn" type="button" aria-label="Dismiss browser recommendation">' +
                '<span class="material-icons notranslate" style="font-size:16px;" aria-hidden="true">close</span>' +
            '</button>';

        const dismissButton = recommendation.querySelector('.dismiss-btn');
        if (dismissButton) {
            dismissButton.addEventListener('click', () => dismissBrowserNotice(recommendation));
        }

        nav.insertAdjacentElement('afterend', recommendation);
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

        syncVersionLabels();
        initBrowserRecommendation();
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
