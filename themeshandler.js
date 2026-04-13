(function() {
    function getRootBase() {
        const currentScript = document.currentScript;
        if (currentScript && currentScript.src) {
            return new URL('./', currentScript.src).href;
        }

        return window.location.pathname.includes('/Games/')
            ? '../'
            : './';
    }

    const ROOT_BASE = getRootBase();

    const THEME_CONFIG = {
        space: {
            css: 'styles/space.css',
            importMap: {
                id: 'theme-importmap-space',
                imports: {
                    three: 'https://unpkg.com/three@0.150.0/build/three.module.js'
                }
            },
            script: {
                id: 'theme-script-space',
                src: 'scripts/blackhole.js',
                type: 'module'
            }
        },
        spaceearth: {
            css: 'styles/spaceearth.css',
            importMap: {
                id: 'theme-importmap-earth',
                imports: {
                    three: 'https://unpkg.com/three@0.150.0/build/three.module.js'
                }
            },
            script: {
                id: 'theme-script-earth',
                src: 'scripts/earth.js',
                type: 'module'
            }
        },
        mc: {
            css: 'styles/minecraft.css',
            script: {
                id: 'theme-script-minecraft',
                src: 'scripts/minecraft.js'
            }
        },
        'midnight-purple': { css: 'styles/midnight-purple.css' },
        mlg: {
            css: 'styles/mlg.css',
            script: {
                id: 'theme-script-mlg',
                src: 'scripts/mlgscript.js'
            }
        },
        light: { css: 'styles/white.css' },
        aurora: {
            css: 'styles/aurora.css',
            script: {
                id: 'theme-script-aurora',
                src: 'scripts/aurora-theme.js'
            }
        },
        'obsidian-gold': { css: 'styles/obsidian-gold.css' },
        'rose-noir': { css: 'styles/rose-noir.css' },
        matcha: { css: 'styles/matcha.css' },
        sunset: { css: 'styles/sunset.css' },
        oceanic: { css: 'styles/oceanic.css' },
        frostbyte: { css: 'styles/frostbyte.css' },
        'crimson-core': { css: 'styles/crimson-core.css' },
        terminal: { css: 'styles/terminal.css' },
        moonstone: { css: 'styles/moonstone.css' },
        default: { css: 'styles/default.css' }
    };

    const THEME_VARIANTS = {
        aurora: ['simple', 'simulated']
    };

    const BACKGROUND_MAP = {
        mountain: 'background-custom/backgrounds/mountain.json',
        space: 'background-custom/backgrounds/space.json',
        forest: 'background-custom/backgrounds/forest.json',
        ocean: 'background-custom/backgrounds/ocean.json',
        desert: 'background-custom/backgrounds/desert.json',
        city: 'background-custom/backgrounds/city.json',
        abstract: 'background-custom/backgrounds/abstract.json'
    };

    let themeNoteClosed = false;
    let loadFallbackTimer = null;
    let activeThemeLoadId = 0;

    function getThemeVariantStorageKey(themeName) {
        return `themeVariant_${String(themeName).replace(/[^a-z0-9_-]/gi, '_')}`;
    }

    function normalizeThemeVariant(themeName, variant) {
        const availableVariants = THEME_VARIANTS[themeName];
        if (!availableVariants || availableVariants.length === 0) {
            return 'default';
        }

        const normalizedVariant = String(variant || '').trim().toLowerCase();
        return availableVariants.includes(normalizedVariant)
            ? normalizedVariant
            : availableVariants[0];
    }

    function getThemeName() {
        try {
            if (typeof getCookie === 'function') {
                return getCookie('theme') || window.localStorage.getItem('theme') || 'default';
            }

            return window.localStorage.getItem('theme') || 'default';
        } catch (error) {
            return typeof getCookie === 'function' ? getCookie('theme') || 'default' : 'default';
        }
    }

    function getThemeConfig(themeName) {
        return THEME_CONFIG[themeName] || THEME_CONFIG.default;
    }

    function getThemeVariant(themeName = getThemeName()) {
        const storageKey = getThemeVariantStorageKey(themeName);
        let storedVariant = '';

        try {
            if (typeof getCookie === 'function') {
                storedVariant = getCookie(storageKey) || '';
            }

            if (!storedVariant) {
                storedVariant = window.localStorage.getItem(storageKey) || '';
            }
        } catch (error) {
            storedVariant = typeof getCookie === 'function' ? getCookie(storageKey) || '' : '';
        }

        return normalizeThemeVariant(themeName, storedVariant);
    }

    function getThemeState(themeName = getThemeName()) {
        return {
            theme: themeName,
            variant: getThemeVariant(themeName)
        };
    }

    function getThemeHref(path) {
        return new URL(path, ROOT_BASE).href;
    }

    function getThemeLinkElement() {
        return document.getElementById('themecss')
            || document.getElementById('theme-stylesheet')
            || document.querySelector('link[data-qz-theme-link]');
    }

    function broadcastThemeState(themeState) {
        if (!themeState || !themeState.theme) {
            return;
        }

        document.documentElement.setAttribute('data-qz-theme', themeState.theme);
        document.documentElement.setAttribute('data-qz-theme-variant', themeState.variant);

        window.dispatchEvent(new CustomEvent('qz:theme-change', {
            detail: themeState
        }));
    }

    function shouldLoadThemeScripts() {
        return document.body?.dataset.qzThemeScripts === 'enabled';
    }

    function ensureScript(scriptConfig) {
        if (!scriptConfig) {
            return;
        }

        if (document.getElementById(scriptConfig.id)) {
            return;
        }

        const script = document.createElement('script');
        script.id = scriptConfig.id;
        script.src = getThemeHref(scriptConfig.src);
        if (scriptConfig.type) {
            script.type = scriptConfig.type;
        }

        script.onerror = () => {
            if (typeof issuenote === 'function') {
                issuenote('Failed', 'Theme scripts have failed to load.', true, 'note');
            }
        };

        document.head.appendChild(script);
    }

    function ensureImportMap(importMapConfig) {
        if (!importMapConfig || document.getElementById(importMapConfig.id)) {
            return;
        }

        const importMap = document.createElement('script');
        importMap.id = importMapConfig.id;
        importMap.type = 'importmap';
        importMap.textContent = JSON.stringify({ imports: importMapConfig.imports });
        document.head.appendChild(importMap);
    }

    function ensureThemeAssets(themeConfig) {
        if (!shouldLoadThemeScripts()) {
            return;
        }

        if (themeConfig.importMap) {
            ensureImportMap(themeConfig.importMap);
        }

        if (themeConfig.script) {
            ensureScript(themeConfig.script);
        }
    }

    function clearFallbackTimer() {
        if (loadFallbackTimer) {
            window.clearTimeout(loadFallbackTimer);
            loadFallbackTimer = null;
        }
    }

    function isThemeLoadingNoteVisible() {
        const noteContainer = document.getElementById('notafication');
        return Boolean(
            noteContainer
            && noteContainer.dataset.noteStyle === 'theme-loading'
            && noteContainer.style.display !== 'none'
        );
    }

    function finishThemeLoadingNote(loadId = activeThemeLoadId) {
        if (loadId !== activeThemeLoadId || themeNoteClosed) {
            return;
        }

        themeNoteClosed = true;
        clearFallbackTimer();

        window.setTimeout(() => {
            if (loadId !== activeThemeLoadId) {
                return;
            }

            if (typeof closeNote === 'function') {
                closeNote();
            }
        }, 1000);
    }

    function showThemeLoadingNote() {
        if (isThemeLoadingNoteVisible()) {
            return;
        }

        if (typeof issuenote === 'function') {
            issuenote('Loading Theme...', 'Applying your style', false, 'theme-loading');
        }
    }

    function showThemeLoadError(loadId = activeThemeLoadId) {
        if (loadId !== activeThemeLoadId) {
            return;
        }

        themeNoteClosed = true;
        clearFallbackTimer();

        if (typeof issuenote === 'function') {
            issuenote('Failed', 'Theme file failed to load.', true, 'note');
        }
    }

    function applyStylesheet(linkElement, href) {
        return new Promise((resolve, reject) => {
            const previousHref = linkElement.getAttribute('href');
            if (previousHref === href) {
                resolve(true);
                return;
            }

            function cleanup() {
                linkElement.removeEventListener('load', handleLoad);
                linkElement.removeEventListener('error', handleError);
            }

            function handleLoad() {
                cleanup();
                resolve(false);
            }

            function handleError() {
                cleanup();
                reject(new Error('Theme stylesheet failed to load.'));
            }

            linkElement.addEventListener('load', handleLoad, { once: true });
            linkElement.addEventListener('error', handleError, { once: true });
            linkElement.setAttribute('href', href);
        });
    }

    async function loadThemeCSS() {
        const linkElement = getThemeLinkElement();
        if (!linkElement) {
            return;
        }

        const loadId = ++activeThemeLoadId;
        const themeName = getThemeName();
        const themeState = getThemeState(themeName);
        const themeConfig = getThemeConfig(themeName);
        const themeHref = getThemeHref(themeConfig.css);

        themeNoteClosed = false;
        clearFallbackTimer();
        broadcastThemeState(themeState);
        showThemeLoadingNote();
        ensureThemeAssets(themeConfig);

        loadFallbackTimer = window.setTimeout(() => {
            finishThemeLoadingNote(loadId);
        }, 1600);

        try {
            const alreadyApplied = await applyStylesheet(linkElement, themeHref);
            if (loadId !== activeThemeLoadId) {
                return;
            }

            broadcastThemeState(themeState);

            if (alreadyApplied) {
                finishThemeLoadingNote(loadId);
                return;
            }

            finishThemeLoadingNote(loadId);
        } catch (error) {
            if (loadId !== activeThemeLoadId) {
                return;
            }

            console.error(error);
            showThemeLoadError(loadId);
        }
    }

    function loadSelectedBackground() {
        if (typeof backgroundHandler === 'undefined' || !backgroundHandler) {
            return;
        }

        const customBackgroundsEnabled = typeof getCookie !== 'function' || getCookie('customBackgrounds') !== 'false';
        if (!customBackgroundsEnabled) {
            backgroundHandler.setEnabled(false);
            backgroundHandler.clear();
            return;
        }

        backgroundHandler.setEnabled(true);

        const selectedBackground = (typeof getCookie === 'function' && getCookie('selectedBackground')) || 'none';
        if (selectedBackground === 'none') {
            backgroundHandler.clear();
            return;
        }

        const backgroundPath = BACKGROUND_MAP[selectedBackground];
        if (!backgroundPath) {
            backgroundHandler.clear();
            return;
        }

        loadBackgroundFromJSON(getThemeHref(backgroundPath)).catch((error) => {
            console.log(`Failed to load background: ${selectedBackground}`, error);
            backgroundHandler.clear();
        });
    }

    function applyThemeSelection(themeName) {
        const normalizedTheme = themeName in THEME_CONFIG ? themeName : 'default';

        if (typeof setCookie === 'function') {
            setCookie('theme', normalizedTheme);
        }

        try {
            window.localStorage.setItem('theme', normalizedTheme);
        } catch (error) {
            console.error('Failed to store theme preference.', error);
        }

        return loadThemeCSS();
    }

    function setThemeVariant(themeName, variant, options = {}) {
        if (!(themeName in THEME_VARIANTS)) {
            return Promise.resolve();
        }

        const normalizedVariant = normalizeThemeVariant(themeName, variant);
        const storageKey = getThemeVariantStorageKey(themeName);

        if (typeof setCookie === 'function') {
            setCookie(storageKey, normalizedVariant);
        }

        try {
            window.localStorage.setItem(storageKey, normalizedVariant);
        } catch (error) {
            console.error('Failed to store theme variant preference.', error);
        }

        if (options.reload === false || getThemeName() !== themeName) {
            broadcastThemeState(getThemeState());
            return Promise.resolve();
        }

        return loadThemeCSS();
    }

    window.loadThemeCSS = loadThemeCSS;
    window.loadSelectedBackground = loadSelectedBackground;
    window.QZThemeManager = {
        loadThemeCSS,
        loadSelectedBackground,
        applyThemeSelection,
        getThemeName,
        getThemeVariant,
        getThemeState,
        setThemeVariant
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadThemeCSS, { once: true });
    } else {
        loadThemeCSS();
    }
})();
