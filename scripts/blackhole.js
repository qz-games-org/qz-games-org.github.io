import * as THREE from 'three';

(function() {
    if (window.QZBlackHoleTheme && window.QZBlackHoleTheme.__ready) {
        if (window.QZThemeManager && typeof window.QZThemeManager.getThemeState === 'function') {
            window.QZBlackHoleTheme.applyThemeState(window.QZThemeManager.getThemeState());
        }
        return;
    }

    const state = {
        scene: null,
        camera: null,
        renderer: null,
        canvas: null,
        stars: null,
        diskMaterial: null,
        lensMaterial: null,
        clock: null,
        rafId: 0,
        active: false,
        mounted: false,
        shootingStars: [],
        shootingStarTimer: 0,
        cleanup: [],
        mediaQuery: window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null
    };

    function isReducedMotion() {
        return Boolean(
            (state.mediaQuery && state.mediaQuery.matches)
            || document.body && document.body.classList.contains('reduce-effects')
        );
    }

    function getThemeState() {
        if (window.QZThemeManager && typeof window.QZThemeManager.getThemeState === 'function') {
            return window.QZThemeManager.getThemeState();
        }

        return {
            theme: document.documentElement.getAttribute('data-qz-theme') || ''
        };
    }

    function ensureRenderer() {
        if (state.renderer) {
            return;
        }

        state.scene = new THREE.Scene();
        state.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
        state.camera.position.set(0, -22, 4);
        state.camera.lookAt(0, 0, 0);

        state.renderer = new THREE.WebGLRenderer({
            antialias: !isReducedMotion(),
            alpha: false,
            powerPreference: 'high-performance'
        });
        state.renderer.setClearColor(0x000000, 1);
        state.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isReducedMotion() ? 1.1 : 1.5));
        state.renderer.setSize(window.innerWidth, window.innerHeight);

        state.canvas = state.renderer.domElement;
        state.canvas.classList.add('bgblackholetheme');
        state.canvas.id = 'bgblackhole';
        state.canvas.style.display = 'none';
        state.canvas.style.opacity = '0';
        state.canvas.style.transition = 'opacity 0.45s ease';

        document.body.appendChild(state.canvas);
        buildScene();
        bindEvents();
    }

    function createStars() {
        const reduced = isReducedMotion();
        const starsGeometry = new THREE.BufferGeometry();
        const starCount = reduced ? 1600 : 2800;
        const positions = new Float32Array(starCount * 3);

        for (let index = 0; index < starCount; index += 1) {
            const offset = index * 3;
            const radius = 700 + Math.random() * 450;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);

            positions[offset] = radius * Math.sin(phi) * Math.cos(theta);
            positions[offset + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[offset + 2] = radius * Math.cos(phi);
        }

        starsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        return new THREE.Points(
            starsGeometry,
            new THREE.PointsMaterial({
                color: 0xe9f4ff,
                size: reduced ? 1.1 : 1.45,
                sizeAttenuation: true,
                transparent: true,
                opacity: 0.9,
                depthWrite: false
            })
        );
    }

    class ShootingStar {
        constructor(scene) {
            this.geometry = new THREE.BufferGeometry();
            this.length = 16;
            const positions = new Float32Array(this.length * 3);
            const sizes = new Float32Array(this.length);
            const opacities = new Float32Array(this.length);

            for (let index = 0; index < this.length; index += 1) {
                const progress = index / this.length;
                sizes[index] = 3 * (1 - progress);
                opacities[index] = 1 - progress;
            }

            this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            this.geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
            this.geometry.setAttribute('opacity', new THREE.BufferAttribute(opacities, 1));

            this.material = new THREE.ShaderMaterial({
                vertexShader: `
                    attribute float size;
                    attribute float opacity;
                    varying float vOpacity;

                    void main() {
                        vOpacity = opacity;
                        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                        gl_PointSize = size * (280.0 / -mvPosition.z);
                        gl_Position = projectionMatrix * mvPosition;
                    }
                `,
                fragmentShader: `
                    varying float vOpacity;

                    void main() {
                        float radius = distance(gl_PointCoord, vec2(0.5));
                        if (radius > 0.5) discard;

                        vec3 color = mix(vec3(0.55, 0.8, 1.0), vec3(1.0), vOpacity);
                        gl_FragColor = vec4(color, (1.0 - radius * 2.0) * vOpacity);
                    }
                `,
                transparent: true,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });

            this.points = new THREE.Points(this.geometry, this.material);
            this.points.visible = false;
            scene.add(this.points);

            this.active = false;
            this.position = new THREE.Vector3();
            this.direction = new THREE.Vector3();
            this.trailPositions = Array.from({ length: this.length }, () => new THREE.Vector3());
            this.speed = 0;
            this.lifeTime = 0;
            this.currentTime = 0;
        }

        activate() {
            const startRadius = 520;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;

            this.position.set(
                startRadius * Math.sin(phi) * Math.cos(theta),
                startRadius * Math.sin(phi) * Math.sin(theta),
                startRadius * Math.cos(phi)
            );

            this.direction.set(
                -this.position.x + (Math.random() - 0.5) * 170,
                -this.position.y + (Math.random() - 0.5) * 170,
                -this.position.z + (Math.random() - 0.5) * 170
            ).normalize();

            this.speed = 55 + Math.random() * 120;
            this.lifeTime = 1.5 + Math.random() * 1.6;
            this.currentTime = 0;

            for (let index = 0; index < this.trailPositions.length; index += 1) {
                this.trailPositions[index].copy(this.position);
            }

            this.points.visible = true;
            this.active = true;
        }

        update(deltaTime) {
            if (!this.active) {
                return;
            }

            this.position.addScaledVector(this.direction, this.speed * deltaTime);
            this.currentTime += deltaTime;

            if (this.currentTime >= this.lifeTime || this.position.length() < 110) {
                this.active = false;
                this.points.visible = false;
                return;
            }

            const positions = this.geometry.attributes.position.array;
            const spacing = 0.55;
            this.trailPositions[0].copy(this.position);

            for (let index = 0; index < this.trailPositions.length; index += 1) {
                if (index > 0) {
                    this.trailPositions[index]
                        .copy(this.trailPositions[index - 1])
                        .sub(this.direction.clone().multiplyScalar(spacing));
                }

                positions[index * 3] = this.trailPositions[index].x;
                positions[index * 3 + 1] = this.trailPositions[index].y;
                positions[index * 3 + 2] = this.trailPositions[index].z;
            }

            this.geometry.attributes.position.needsUpdate = true;
        }
    }

    function buildScene() {
        if (!state.scene) {
            return;
        }

        const reduced = isReducedMotion();

        state.stars = createStars();
        state.scene.add(state.stars);

        const blackHoleRadius = 1.5;
        const blackHole = new THREE.Mesh(
            new THREE.SphereGeometry(blackHoleRadius, 64, 64),
            new THREE.MeshBasicMaterial({ color: 0x000000 })
        );
        state.scene.add(blackHole);

        const diskInnerRadius = blackHoleRadius * 1.2;
        const diskOuterRadius = blackHoleRadius * 8;

        state.diskMaterial = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 }
            },
            vertexShader: `
                varying vec2 vUv;
                varying float vDistance;

                void main() {
                    vUv = uv;
                    vec3 pos = position;
                    vDistance = length(pos.xy);

                    float thickness = 0.14 * smoothstep(${diskInnerRadius.toFixed(2)}, ${diskOuterRadius.toFixed(2)}, vDistance);
                    float wave = sin(vDistance * 20.0 - uv.x * 10.0) * 0.85;
                    pos.z += wave * thickness;

                    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
                }
            `,
            fragmentShader: `
                uniform float time;
                varying vec2 vUv;
                varying float vDistance;

                void main() {
                    float angle = atan(vUv.y - 0.5, vUv.x - 0.5);
                    float innerRadius = ${diskInnerRadius.toFixed(2)};
                    float outerRadius = ${diskOuterRadius.toFixed(2)};
                    float normalizedDist = clamp((vDistance - innerRadius) / (outerRadius - innerRadius), 0.0, 1.0);
                    float swirl = sin((angle + time * 0.5) * -1.0 + normalizedDist * 100.0);

                    vec3 innerColor = vec3(1.0, 0.92, 0.68);
                    vec3 midColor = vec3(1.0, 0.52, 0.12);
                    vec3 outerColor = vec3(0.72, 0.18, 0.02);

                    vec3 color = normalizedDist < 0.4
                        ? mix(innerColor, midColor, normalizedDist / 0.4)
                        : mix(midColor, outerColor, (normalizedDist - 0.4) / 0.6);

                    color *= 0.82 + 0.18 * swirl;

                    float brightness = smoothstep(1.0, 0.0, normalizedDist);
                    float alpha = brightness * (1.0 - smoothstep(0.95, 1.0, normalizedDist));

                    gl_FragColor = vec4(color, alpha);
                }
            `,
            transparent: true,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        const accretionDisk = new THREE.Mesh(
            new THREE.RingGeometry(diskInnerRadius, diskOuterRadius, 120, 240),
            state.diskMaterial
        );
        state.scene.add(accretionDisk);
        state.accretionDisk = accretionDisk;

        state.lensMaterial = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 }
            },
            vertexShader: `
                varying vec3 vPosition;

                void main() {
                    vPosition = position;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float time;
                varying vec3 vPosition;

                void main() {
                    float pulse = 0.9 + 0.1 * sin(time * 2.0);
                    vec3 blueColor = vec3(0.3, 0.6, 1.0) * pulse;
                    gl_FragColor = vec4(blueColor, 0.78);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        const lensEffect = new THREE.Mesh(
            new THREE.TorusGeometry(blackHoleRadius, 0.15, 30, 100),
            state.lensMaterial
        );
        state.scene.add(lensEffect);
        state.lensEffect = lensEffect;

        state.clock = new THREE.Clock();
        state.shootingStarTimer = 0;
        state.shootingStars = Array.from(
            { length: reduced ? 6 : 12 },
            () => new ShootingStar(state.scene)
        );
    }

    function spawnShootingStar() {
        for (const star of state.shootingStars) {
            if (!star.active) {
                star.activate();
                return;
            }
        }
    }

    function onResize() {
        if (!state.renderer || !state.camera) {
            return;
        }

        state.camera.aspect = window.innerWidth / window.innerHeight;
        state.camera.updateProjectionMatrix();
        state.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isReducedMotion() ? 1.1 : 1.5));
        state.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    function animate() {
        if (!state.active || !state.renderer || !state.scene || !state.camera) {
            return;
        }

        state.rafId = window.requestAnimationFrame(animate);

        const elapsedTime = state.clock.getElapsedTime();
        const deltaTime = state.clock.getDelta();
        const reduced = isReducedMotion();

        if (state.diskMaterial) {
            state.diskMaterial.uniforms.time.value = elapsedTime;
        }

        if (state.lensMaterial) {
            state.lensMaterial.uniforms.time.value = elapsedTime;
        }

        state.shootingStarTimer += deltaTime;
        const spawnInterval = reduced ? 2.1 : 1.0;
        if (state.shootingStarTimer > spawnInterval + Math.random() * (reduced ? 0.7 : 0.45)) {
            spawnShootingStar();
            state.shootingStarTimer = 0;
        }

        for (const star of state.shootingStars) {
            if (star.active) {
                star.update(deltaTime);
            }
        }

        if (state.accretionDisk) {
            const baseSpeed = reduced ? 0.9 : 1.5;
            const speedVariation = Math.sin(elapsedTime * 0.5) * 0.2;
            state.accretionDisk.rotation.z += (baseSpeed + speedVariation) * deltaTime;
        }

        if (state.lensEffect) {
            state.lensEffect.rotation.z = -elapsedTime * 0.02;
        }

        if (state.stars) {
            state.stars.rotation.y = elapsedTime * 0.001;
        }

        state.renderer.render(state.scene, state.camera);
    }

    function start() {
        ensureRenderer();
        if (!state.canvas || state.active) {
            return;
        }

        state.active = true;
        state.canvas.style.display = 'block';
        window.requestAnimationFrame(() => {
            if (state.canvas) {
                state.canvas.style.opacity = '1';
            }
        });

        state.clock.start();
        animate();
    }

    function stop() {
        state.active = false;
        window.cancelAnimationFrame(state.rafId);
        state.rafId = 0;

        if (state.clock) {
            state.clock.stop();
        }

        if (state.canvas) {
            state.canvas.style.opacity = '0';
            window.setTimeout(() => {
                if (!state.active && state.canvas) {
                    state.canvas.style.display = 'none';
                }
            }, 260);
        }
    }

    function applyThemeState(detail) {
        const themeState = detail && detail.theme ? detail : getThemeState();
        if (themeState.theme === 'space') {
            start();
            return;
        }

        stop();
    }

    function bindEvents() {
        if (state.mounted) {
            return;
        }

        state.mounted = true;

        const handleThemeChange = (event) => {
            applyThemeState(event.detail || getThemeState());
        };

        const handleVisibilityChange = () => {
            if (document.hidden) {
                if (state.clock) {
                    state.clock.stop();
                }
                window.cancelAnimationFrame(state.rafId);
                state.rafId = 0;
                return;
            }

            if (state.active && state.rafId === 0) {
                state.clock.start();
                animate();
            }
        };

        const handleMotionChange = () => {
            onResize();
        };

        window.addEventListener('resize', onResize);
        window.addEventListener('qz:theme-change', handleThemeChange);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        state.cleanup.push(() => window.removeEventListener('resize', onResize));
        state.cleanup.push(() => window.removeEventListener('qz:theme-change', handleThemeChange));
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
        stop();

        for (const cleanup of state.cleanup) {
            cleanup();
        }
        state.cleanup.length = 0;

        if (state.scene) {
            state.scene.traverse((object) => {
                if (object.geometry) {
                    object.geometry.dispose();
                }

                if (object.material) {
                    if (Array.isArray(object.material)) {
                        object.material.forEach((material) => material.dispose());
                    } else {
                        object.material.dispose();
                    }
                }
            });
        }

        if (state.renderer) {
            state.renderer.dispose();
        }

        if (state.canvas && state.canvas.parentNode) {
            state.canvas.parentNode.removeChild(state.canvas);
        }
    }

    window.QZBlackHoleTheme = {
        __ready: true,
        applyThemeState,
        destroy
    };

    applyThemeState(getThemeState());
})();
