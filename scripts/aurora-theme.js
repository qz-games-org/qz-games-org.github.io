(function() {
    if (window.QZAuroraTheme && window.QZAuroraTheme.__ready) {
        if (window.QZThemeManager && typeof window.QZThemeManager.getThemeState === 'function') {
            window.QZAuroraTheme.applyThemeState(window.QZThemeManager.getThemeState());
        }
        return;
    }

    const state = {
        active: false,
        running: false,
        canvas: null,
        ctx: null,
        width: 0,
        height: 0,
        dpr: 1,
        stars: [],
        bands: [],
        rafId: 0,
        lastFrameTime: 0,
        resizeTimer: 0,
        viewportScale: 1,
        supportsCanvasFilter: true,
        cleanup: [],
        mediaQuery: window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null,
        reducedMotion: false
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

    function prefersReducedMotion() {
        return Boolean(
            (state.mediaQuery && state.mediaQuery.matches)
            || document.body && document.body.classList.contains('reduce-effects')
        );
    }

    function getMountPoint() {
        return document.getElementById('backgroundarea') || document.body;
    }

    function configureCanvas(canvas) {
        const mountPoint = getMountPoint();
        const insideBackgroundArea = mountPoint && mountPoint.id === 'backgroundarea';

        canvas.setAttribute('aria-hidden', 'true');
        canvas.style.position = insideBackgroundArea ? 'absolute' : 'fixed';
        canvas.style.inset = '0';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.pointerEvents = 'none';
        canvas.style.display = 'none';
        canvas.style.opacity = '0';
        canvas.style.transition = 'opacity 0.55s ease';
        canvas.style.zIndex = insideBackgroundArea ? '0' : '-1';
    }

    function ensureCanvas() {
        const mountPoint = getMountPoint();
        if (!mountPoint) {
            return null;
        }

        if (!state.canvas) {
            state.canvas = document.getElementById('aurora-theme-canvas') || document.createElement('canvas');
            state.canvas.id = 'aurora-theme-canvas';
            configureCanvas(state.canvas);
        }

        if (state.canvas.parentNode !== mountPoint) {
            mountPoint.appendChild(state.canvas);
        }

        if (!state.ctx) {
            state.ctx = state.canvas.getContext('2d', { alpha: true });
            state.supportsCanvasFilter = detectCanvasFilterSupport(state.ctx);
            document.documentElement.setAttribute(
                'data-qz-aurora-blur',
                state.supportsCanvasFilter ? 'native' : 'fallback'
            );
        }

        return state.canvas;
    }

    function detectCanvasFilterSupport(ctx) {
        if (!ctx || typeof ctx.filter !== 'string') {
            return false;
        }

        const previousFilter = ctx.filter;
        try {
            ctx.filter = 'blur(2px)';
            const supported = String(ctx.filter || '').toLowerCase().indexOf('blur') !== -1;
            ctx.filter = previousFilter;
            return supported;
        } catch (error) {
            ctx.filter = previousFilter;
            return false;
        }
    }

    function randomBetween(min, max) {
        return min + Math.random() * (max - min);
    }

    function rebuildScene() {
        state.reducedMotion = prefersReducedMotion();

        const widthFactor = Math.max(0.78, Math.min(1.34, state.width / 1440));
        const heightFactor = Math.max(0.82, Math.min(1.24, state.height / 900));
        const zoomFactor = Math.max(0.84, Math.min(1.2, 1 / state.viewportScale));
        const baseCount = state.reducedMotion ? 42 : 66;
        const starCount = Math.max(24, Math.round(baseCount * widthFactor * heightFactor * zoomFactor));
        state.stars = Array.from({ length: starCount }, () => ({
            x: Math.random() * state.width,
            y: Math.pow(Math.random(), 0.72) * state.height * 0.76,
            radius: randomBetween(0.5, state.reducedMotion ? 1.3 : 1.8),
            alpha: randomBetween(0.14, 0.5),
            twinkleOffset: randomBetween(0, Math.PI * 2),
            twinkleSpeed: randomBetween(0.35, state.reducedMotion ? 0.75 : 1.25)
        }));

        state.bands = [
            {
                anchorY: 0.18,
                amplitude: 0.05,
                thickness: 0.12,
                speed: 0.24,
                offset: randomBetween(0, Math.PI * 2),
                phaseScaleA: 6.2,
                phaseScaleB: 12.8,
                colors: [
                    'rgba(53, 255, 199, 0.00)',
                    'rgba(53, 255, 199, 0.18)',
                    'rgba(131, 255, 169, 0.42)',
                    'rgba(53, 255, 199, 0.08)'
                ]
            },
            {
                anchorY: 0.26,
                amplitude: 0.06,
                thickness: 0.14,
                speed: 0.18,
                offset: randomBetween(0, Math.PI * 2),
                phaseScaleA: 5.1,
                phaseScaleB: 10.6,
                colors: [
                    'rgba(77, 212, 255, 0.00)',
                    'rgba(77, 212, 255, 0.16)',
                    'rgba(127, 255, 213, 0.34)',
                    'rgba(77, 212, 255, 0.07)'
                ]
            },
            {
                anchorY: 0.34,
                amplitude: 0.045,
                thickness: 0.1,
                speed: 0.14,
                offset: randomBetween(0, Math.PI * 2),
                phaseScaleA: 4.3,
                phaseScaleB: 9.4,
                colors: [
                    'rgba(143, 255, 168, 0.00)',
                    'rgba(143, 255, 168, 0.12)',
                    'rgba(102, 255, 225, 0.24)',
                    'rgba(143, 255, 168, 0.05)'
                ]
            }
        ];
    }

    function resizeCanvas() {
        const canvas = ensureCanvas();
        if (!canvas || !state.ctx) {
            return;
        }

        state.reducedMotion = prefersReducedMotion();
        const mountPoint = getMountPoint();
        const visualViewport = window.visualViewport;
        state.viewportScale = visualViewport && Number.isFinite(visualViewport.scale)
            ? Math.max(0.5, Math.min(visualViewport.scale, 3))
            : 1;
        const rect = mountPoint && mountPoint !== document.body
            ? mountPoint.getBoundingClientRect()
            : {
                width: visualViewport && visualViewport.width ? visualViewport.width : window.innerWidth,
                height: visualViewport && visualViewport.height ? visualViewport.height : window.innerHeight
            };

        state.width = Math.max(1, Math.round(rect.width || window.innerWidth || 1));
        state.height = Math.max(1, Math.round(rect.height || window.innerHeight || 1));

        const rawDpr = window.devicePixelRatio || 1;
        const scaleCompensation = Math.max(0.74, Math.min(1.08, 1 / state.viewportScale));
        const dprCap = state.reducedMotion ? 1.05 : 1.35;
        state.dpr = Math.max(1, Math.min(rawDpr * scaleCompensation, dprCap));

        canvas.width = Math.round(state.width * state.dpr);
        canvas.height = Math.round(state.height * state.dpr);
        canvas.style.width = `${state.width}px`;
        canvas.style.height = `${state.height}px`;

        state.ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
        rebuildScene();
    }

    function scheduleResize() {
        window.clearTimeout(state.resizeTimer);
        state.resizeTimer = window.setTimeout(() => {
            resizeCanvas();
        }, 90);
    }

    function drawStars(time) {
        const ctx = state.ctx;
        if (!ctx) {
            return;
        }

        ctx.save();
        ctx.globalCompositeOperation = 'screen';

        for (const star of state.stars) {
            const twinkle = 0.72 + Math.sin(time * star.twinkleSpeed + star.twinkleOffset) * 0.28;
            const alpha = star.alpha * twinkle;

            ctx.fillStyle = `rgba(225, 244, 255, ${alpha.toFixed(3)})`;
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
            ctx.fill();

            if (!state.reducedMotion && star.radius > 1.1) {
                ctx.fillStyle = `rgba(180, 238, 255, ${(alpha * 0.18).toFixed(3)})`;
                ctx.beginPath();
                ctx.arc(star.x, star.y, star.radius * 2.2, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.restore();
    }

    function buildRibbonPath(points, thickness) {
        const ctx = state.ctx;
        if (!ctx || points.length === 0) {
            return;
        }

        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y - thickness);

        for (let index = 1; index < points.length; index += 1) {
            const previous = points[index - 1];
            const point = points[index];
            const controlX = (previous.x + point.x) / 2;
            const controlY = (previous.y + point.y) / 2 - thickness * 0.15;
            ctx.quadraticCurveTo(previous.x, previous.y - thickness, controlX, controlY);
        }

        const lastPoint = points[points.length - 1];
        ctx.lineTo(lastPoint.x, lastPoint.y + thickness * 0.85);

        for (let index = points.length - 2; index >= 0; index -= 1) {
            const nextPoint = points[index + 1];
            const point = points[index];
            const controlX = (nextPoint.x + point.x) / 2;
            const controlY = (nextPoint.y + point.y) / 2 + thickness * 0.9;
            ctx.quadraticCurveTo(nextPoint.x, nextPoint.y + thickness * 0.7, controlX, controlY);
        }

        ctx.closePath();
    }

    function drawRibbon(band, time, scale) {
        const ctx = state.ctx;
        if (!ctx) {
            return;
        }

        const segmentCount = state.reducedMotion ? 9 : 14;
        const points = [];
        const phase = time * band.speed + band.offset;
        const zoomCompensation = Math.max(0.84, Math.min(1.18, 1 / state.viewportScale));
        const amplitude = state.height * band.amplitude * scale * zoomCompensation;
        const thickness = state.height * band.thickness * scale * zoomCompensation;

        for (let step = 0; step <= segmentCount; step += 1) {
            const progress = step / segmentCount;
            const x = progress * state.width;
            const waveA = Math.sin(progress * band.phaseScaleA + phase);
            const waveB = Math.cos(progress * band.phaseScaleB - phase * 0.7);
            const waveC = Math.sin(progress * 17.0 + phase * 0.4);
            const y = state.height * band.anchorY
                + waveA * amplitude
                + waveB * amplitude * 0.42
                + waveC * amplitude * 0.18;

            points.push({ x, y });
        }

        const midY = points[Math.floor(points.length / 2)].y;
        const gradient = ctx.createLinearGradient(0, midY - thickness * 1.35, 0, midY + thickness * 1.6);
        gradient.addColorStop(0.00, band.colors[0]);
        gradient.addColorStop(0.28, band.colors[1]);
        gradient.addColorStop(0.56, band.colors[2]);
        gradient.addColorStop(1.00, band.colors[3]);

        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = scale > 1 ? 0.65 : 1;
        ctx.fillStyle = gradient;

        if (state.supportsCanvasFilter) {
            const blurAmount = Math.round((state.reducedMotion ? 16 : 24) * scale * zoomCompensation);
            ctx.filter = `blur(${blurAmount}px)`;
            buildRibbonPath(points, thickness);
            ctx.fill();
        } else {
            ctx.filter = 'none';

            buildRibbonPath(points, thickness);
            ctx.fill();

            ctx.globalAlpha *= 0.52;
            buildRibbonPath(points, thickness * 1.38);
            ctx.fill();

            ctx.globalAlpha *= 0.58;
            buildRibbonPath(points, thickness * 1.72);
            ctx.fill();
        }
        ctx.restore();
    }

    function render(time) {
        const ctx = state.ctx;
        if (!ctx) {
            return;
        }

        ctx.clearRect(0, 0, state.width, state.height);

        const haze = ctx.createLinearGradient(0, 0, 0, state.height);
        haze.addColorStop(0, 'rgba(3, 12, 18, 0.04)');
        haze.addColorStop(0.45, 'rgba(4, 18, 16, 0.08)');
        haze.addColorStop(1, 'rgba(1, 8, 10, 0.00)');
        ctx.fillStyle = haze;
        ctx.fillRect(0, 0, state.width, state.height);

        drawStars(time);

        for (const band of state.bands) {
            drawRibbon(band, time, 1.18);
            drawRibbon(band, time, 0.84);
        }
    }

    function animate(frameTime) {
        if (!state.running) {
            return;
        }

        const targetFrameTime = state.reducedMotion ? 1000 / 24 : 1000 / 40;
        if (!state.lastFrameTime || frameTime - state.lastFrameTime >= targetFrameTime) {
            render(frameTime * 0.001);
            state.lastFrameTime = frameTime;
        }

        state.rafId = window.requestAnimationFrame(animate);
    }

    function start() {
        ensureCanvas();
        if (!state.canvas) {
            return;
        }

        state.canvas.style.display = 'block';
        window.requestAnimationFrame(() => {
            if (state.canvas) {
                state.canvas.style.opacity = '1';
            }
        });

        if (state.running) {
            return;
        }

        state.running = true;
        state.lastFrameTime = 0;
        resizeCanvas();
        state.rafId = window.requestAnimationFrame(animate);
    }

    function stop() {
        state.running = false;
        state.lastFrameTime = 0;
        window.cancelAnimationFrame(state.rafId);
        state.rafId = 0;

        if (!state.canvas) {
            return;
        }

        state.canvas.style.opacity = '0';
        window.setTimeout(() => {
            if (!state.active && state.canvas) {
                state.canvas.style.display = 'none';
            }
        }, 260);
    }

    function applyThemeState(detail) {
        const themeState = detail && detail.theme ? detail : getThemeState();
        const shouldActivate = themeState.theme === 'aurora' && themeState.variant === 'simulated';

        state.active = shouldActivate;
        state.reducedMotion = prefersReducedMotion();

        if (!shouldActivate) {
            stop();
            return;
        }

        start();
    }

    function destroy() {
        stop();
        window.clearTimeout(state.resizeTimer);

        for (const cleanupFn of state.cleanup) {
            cleanupFn();
        }
        state.cleanup.length = 0;

        if (state.canvas && state.canvas.parentNode) {
            state.canvas.parentNode.removeChild(state.canvas);
        }

        state.canvas = null;
        state.ctx = null;
        state.stars = [];
        state.bands = [];
        document.documentElement.removeAttribute('data-qz-aurora-blur');
    }

    function bindEvents() {
        const handleThemeChange = (event) => {
            applyThemeState(event.detail || getThemeState());
        };

        const handleVisibilityChange = () => {
            if (document.hidden) {
                stop();
                return;
            }

            if (state.active) {
                start();
            }
        };

        window.addEventListener('resize', scheduleResize, { passive: true });
        window.addEventListener('qz:theme-change', handleThemeChange);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        state.cleanup.push(() => window.removeEventListener('resize', scheduleResize));
        state.cleanup.push(() => window.removeEventListener('qz:theme-change', handleThemeChange));
        state.cleanup.push(() => document.removeEventListener('visibilitychange', handleVisibilityChange));

        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', scheduleResize, { passive: true });
            window.visualViewport.addEventListener('scroll', scheduleResize, { passive: true });
            state.cleanup.push(() => window.visualViewport.removeEventListener('resize', scheduleResize));
            state.cleanup.push(() => window.visualViewport.removeEventListener('scroll', scheduleResize));
        }

        if (state.mediaQuery) {
            const handleMotionChange = () => {
                const wasReduced = state.reducedMotion;
                state.reducedMotion = prefersReducedMotion();
                if (state.active && wasReduced !== state.reducedMotion) {
                    resizeCanvas();
                }
            };

            if (typeof state.mediaQuery.addEventListener === 'function') {
                state.mediaQuery.addEventListener('change', handleMotionChange);
                state.cleanup.push(() => state.mediaQuery.removeEventListener('change', handleMotionChange));
            } else if (typeof state.mediaQuery.addListener === 'function') {
                state.mediaQuery.addListener(handleMotionChange);
                state.cleanup.push(() => state.mediaQuery.removeListener(handleMotionChange));
            }
        }
    }

    bindEvents();

    window.QZAuroraTheme = {
        __ready: true,
        applyThemeState,
        destroy
    };

    applyThemeState(getThemeState());
})();
