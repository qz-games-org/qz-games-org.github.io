(function() {
    const THEME_CONFIG = {
        space: { css: './styles/space.css' },
        spaceearth: {
            css: './styles/spaceearth.css',
            importMap: {
                id: 'theme-importmap-earth',
                imports: {
                    three: 'https://unpkg.com/three@0.150.0/build/three.module.js'
                }
            },
            script: {
                id: 'theme-script-earth',
                src: './scripts/earth.js',
                type: 'module'
            }
        },
        mc: {
            css: './styles/minecraft.css',
            script: {
                id: 'theme-script-minecraft',
                src: './scripts/minecraft.js'
            }
        },
        'midnight-purple': { css: './styles/midnight-purple.css' },
        mlg: {
            css: './styles/mlg.css',
            script: {
                id: 'theme-script-mlg',
                src: './scripts/mlgscript.js'
            }
        },
        light: { css: './styles/white.css' },
        default: { css: './styles/default.css' }
    };

    const BACKGROUND_MAP = {
        mountain: './background-custom/backgrounds/mountain.json',
        space: './background-custom/backgrounds/space.json',
        forest: './background-custom/backgrounds/forest.json',
        ocean: './background-custom/backgrounds/ocean.json',
        desert: './background-custom/backgrounds/desert.json',
        city: './background-custom/backgrounds/city.json',
        abstract: './background-custom/backgrounds/abstract.json'
    };

    let themeNoteClosed = false;
    let loadFallbackTimer = null;

    function getThemeName() {
        if (typeof getCookie !== 'function') {
            return 'default';
        }

        return getCookie('theme') || 'default';
    }

    function getThemeConfig(themeName) {
        return THEME_CONFIG[themeName] || THEME_CONFIG.default;
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
        script.src = scriptConfig.src;
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

    function finishThemeLoadingNote() {
        if (themeNoteClosed) {
            return;
        }

        themeNoteClosed = true;
        clearFallbackTimer();

        window.setTimeout(() => {
            if (typeof closeNote === 'function') {
                closeNote();
            }
        }, 1000);
    }

    function showThemeLoadingNote() {
        if (typeof issuenote === 'function') {
            issuenote('Loading Theme...', 'Applying your style', false, 'theme-loading');
        }
    }

    function showThemeLoadError() {
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
        const linkElement = document.getElementById('themecss');
        if (!linkElement) {
            return;
        }

        const themeName = getThemeName();
        const themeConfig = getThemeConfig(themeName);

        themeNoteClosed = false;
        showThemeLoadingNote();
        ensureThemeAssets(themeConfig);

        loadFallbackTimer = window.setTimeout(() => {
            finishThemeLoadingNote();
        }, 1600);

        try {
            const alreadyApplied = await applyStylesheet(linkElement, themeConfig.css);
            if (alreadyApplied) {
                finishThemeLoadingNote();
                return;
            }

            finishThemeLoadingNote();
        } catch (error) {
            console.error(error);
            showThemeLoadError();
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

        loadBackgroundFromJSON(backgroundPath).catch((error) => {
            console.log(`Failed to load background: ${selectedBackground}`, error);
            backgroundHandler.clear();
        });
    }

    window.loadThemeCSS = loadThemeCSS;
    window.loadSelectedBackground = loadSelectedBackground;
    window.QZThemeManager = {
        loadThemeCSS,
        loadSelectedBackground
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadThemeCSS, { once: true });
    } else {
        loadThemeCSS();
    }
})();
