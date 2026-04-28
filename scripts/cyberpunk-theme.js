(function() {
    if (window.QZCyberpunkTheme && window.QZCyberpunkTheme.__ready) {
        if (window.QZThemeManager && typeof window.QZThemeManager.getThemeState === 'function') {
            window.QZCyberpunkTheme.applyThemeState(window.QZThemeManager.getThemeState());
        }
        return;
    }

    const currentScript = document.currentScript;
    const scriptBase = currentScript && currentScript.src
        ? new URL('./', currentScript.src).href
        : new URL('./scripts/', window.location.href).href;
    const videoSrc = new URL('./assets/cyberpunkbg2.mp4', scriptBase).href;
    const allowlistedPages = new Set(['', 'index.html', 'activity.html', 'upcoming.html']);
    const state = {
        active: false,
        failed: false,
        wrapper: null,
        video: null,
        tint: null,
        grid: null,
        cleanup: [],
        mediaQuery: window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null
    };

    function getThemeState() {
        if (window.QZThemeManager && typeof window.QZThemeManager.getThemeState === 'function') {
            return window.QZThemeManager.getThemeState();
        }

        return {
            theme: document.documentElement.getAttribute('data-qz-theme') || '',
            variant: document.documentElement.getAttribute('data-qz-theme-variant') || 'default'
        };
    }

    function getPageName() {
        const normalizedPath = window.location.pathname.replace(/\\/g, '/');
        const lastSlashIndex = normalizedPath.lastIndexOf('/');
        const pageName = lastSlashIndex >= 0 ? normalizedPath.slice(lastSlashIndex + 1).toLowerCase() : normalizedPath.toLowerCase();
        return pageName;
    }

    function isAllowlistedPage() {
        return allowlistedPages.has(getPageName());
    }

    function isReduceEffectsEnabled() {
        return document.body.classList.contains('reduce-effects')
            || window.localStorage.getItem('reduceVisualEffects') === 'true';
    }

    function areAnimationsDisabled() {
        const cookieValue = typeof getCookie === 'function' ? getCookie('disableAnimations') : '';
        const storedValue = window.localStorage.getItem('disableAnimations');
        return cookieValue === 'true' || storedValue === 'true';
    }

    function shouldUseVideo(themeState) {
        return Boolean(
            themeState
            && themeState.theme === 'cyberpunk'
            && themeState.variant === 'video'
            && isAllowlistedPage()
            && !areAnimationsDisabled()
            && !isReduceEffectsEnabled()
            && !(state.mediaQuery && state.mediaQuery.matches)
        );
    }

    function getMountPoint() {
        return document.getElementById('backgroundarea') || document.body;
    }

    function ensureWrapper() {
        const mountPoint = getMountPoint();
        if (!mountPoint) {
            return null;
        }

        if (!state.wrapper) {
            state.wrapper = document.createElement('div');
            state.wrapper.className = 'qz-cyberpunk-video-layer';

            state.video = document.createElement('video');
            state.video.className = 'qz-cyberpunk-video';
            state.video.src = videoSrc;
            state.video.autoplay = true;
            state.video.muted = true;
            state.video.loop = true;
            state.video.playsInline = true;
            state.video.preload = 'auto';
            state.video.setAttribute('loop', '');
            state.video.setAttribute('muted', '');
            state.video.setAttribute('playsinline', '');
            state.video.setAttribute('aria-hidden', 'true');

            state.tint = document.createElement('div');
            state.tint.className = 'qz-cyberpunk-video-tint';

            state.grid = document.createElement('div');
            state.grid.className = 'qz-cyberpunk-video-grid';

            state.video.addEventListener('error', handlePlaybackFailure);
            state.video.addEventListener('ended', handleVideoEnded);

            state.wrapper.appendChild(state.video);
            state.wrapper.appendChild(state.tint);
            state.wrapper.appendChild(state.grid);
        }

        if (state.wrapper.parentNode !== mountPoint) {
            mountPoint.appendChild(state.wrapper);
        }

        state.wrapper.classList.toggle('is-body-mounted', mountPoint === document.body);
        return state.wrapper;
    }

    function setVideoActive(isActive) {
        if (isActive) {
            document.documentElement.setAttribute('data-qz-cyberpunk-video', 'active');
            return;
        }

        document.documentElement.removeAttribute('data-qz-cyberpunk-video');
    }

    function hideVideo() {
        setVideoActive(false);

        if (!state.wrapper) {
            return;
        }

        state.wrapper.classList.remove('is-visible');

        if (state.video) {
            state.video.pause();
        }
    }

    function handlePlaybackFailure() {
        state.failed = true;
        hideVideo();
    }

    function handlePlayRejection() {
        if (!state.video) {
            return;
        }

        // Browsers can reject background/focus-related play attempts. Keep the
        // video layer eligible so focus/visibility events can resume it later.
        if (document.hidden) {
            return;
        }

        state.wrapper && state.wrapper.classList.remove('is-visible');
        setVideoActive(false);
    }

    function handleVideoEnded() {
        if (!state.active || !state.video) {
            return;
        }

        state.video.currentTime = 0;
        state.video.play().catch(() => {
            handlePlayRejection();
        });
    }

    function showVideo() {
        const wrapper = ensureWrapper();
        if (!wrapper || !state.video || state.failed) {
            if (state.failed) {
                hideVideo();
            }
            return;
        }

        const playPromise = state.video.play();
        if (playPromise && typeof playPromise.catch === 'function') {
            playPromise
                .then(() => {
                    if (!state.active) {
                        return;
                    }
                    wrapper.classList.add('is-visible');
                    setVideoActive(true);
                })
                .catch(() => {
                    handlePlayRejection();
                });
            return;
        }

        wrapper.classList.add('is-visible');
        setVideoActive(true);
    }

    function resumeVideo() {
        if (!state.active || state.failed || document.hidden) {
            return;
        }

        showVideo();
    }

    function applyThemeState(detail) {
        const themeState = detail && detail.theme ? detail : getThemeState();
        const shouldActivate = shouldUseVideo(themeState);

        if (!shouldActivate) {
            state.active = false;
            hideVideo();
            return;
        }

        state.active = true;
        state.failed = false;
        showVideo();
    }

    function bindEvents() {
        const handleThemeChange = (event) => {
            applyThemeState(event.detail || getThemeState());
        };

        const handleVisibilityChange = () => {
            if (document.hidden) {
                if (state.video) {
                    state.video.pause();
                }
                return;
            }

            resumeVideo();
        };

        const handlePageShow = () => {
            applyThemeState(getThemeState());
            resumeVideo();
        };

        const handleMotionChange = () => {
            applyThemeState(getThemeState());
        };

        window.addEventListener('qz:theme-change', handleThemeChange);
        window.addEventListener('focus', resumeVideo);
        window.addEventListener('pageshow', handlePageShow);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        state.cleanup.push(() => window.removeEventListener('qz:theme-change', handleThemeChange));
        state.cleanup.push(() => window.removeEventListener('focus', resumeVideo));
        state.cleanup.push(() => window.removeEventListener('pageshow', handlePageShow));
        state.cleanup.push(() => document.removeEventListener('visibilitychange', handleVisibilityChange));

        if (state.mediaQuery) {
            if (typeof state.mediaQuery.addEventListener === 'function') {
                state.mediaQuery.addEventListener('change', handleMotionChange);
                state.cleanup.push(() => state.mediaQuery.removeEventListener('change', handleMotionChange));
            } else if (typeof state.mediaQuery.addListener === 'function') {
                state.mediaQuery.addListener(handleMotionChange);
                state.cleanup.push(() => state.mediaQuery.removeListener(handleMotionChange));
            }
        }
    }

    function destroy() {
        hideVideo();

        while (state.cleanup.length > 0) {
            const cleanupFn = state.cleanup.pop();
            cleanupFn();
        }

        if (state.video) {
            state.video.removeEventListener('error', handlePlaybackFailure);
            state.video.removeEventListener('ended', handleVideoEnded);
            state.video.pause();
        }

        if (state.wrapper && state.wrapper.parentNode) {
            state.wrapper.parentNode.removeChild(state.wrapper);
        }

        state.wrapper = null;
        state.video = null;
        state.tint = null;
        state.grid = null;
    }

    bindEvents();

    window.QZCyberpunkTheme = {
        __ready: true,
        applyThemeState,
        destroy
    };

    applyThemeState(getThemeState());
})();
