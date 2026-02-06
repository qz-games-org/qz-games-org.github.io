// Enhanced Dynamic EQ System with Advanced Mode Processing
class DynamicEQ {
    constructor() {
        this.audioContext = null;
        this.sourceNode = null;
        this.analyserNode = null;
        this.filters = [];
        this.gainNode = null;
        this.isActive = false;
        this.adaptiveMode = false;
        this.currentPreset = null;
        this.audioElement = null;

        // Manual EQ state
        this.manualGains = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; // Store manual EQ settings
        this.manualEQEnabled = true; // Track if manual EQ is active

        // Distortion Limiter Settings
        this.distortionLimiterEnabled = false; // Default to false
        this.compressorNode = null;
        this.limiterNode = null;
        this.preGainNode = null;
        
        // Analysis data
        this.frequencyData = null;
        this.timeData = null;
        this.bassLevel = 0;
        this.midLevel = 0;
        this.trebleLevel = 0;
        this.vocalLevel = 0;
        this.analysisInterval = null;

        // Genre Detection
        this.genreDetector = {
            beatHistory: [],
            beatThreshold: 0,
            lastBeatTime: 0,
            bpm: 0,
            genreScores: {
                hiphop: 0,
                electronic: 0,
                rock: 0,
                classical: 0,
                jazz: 0,
                lofi: 0
            },
            dominantGenre: null
        };

        // Enhanced Adaptive Settings
        this.adaptiveIntensity = 'normal'; // chill, normal, aggressive
        this.adaptiveHistory = [];
        this.historySize = 200; // Increased for better analysis

        // Logging control
        this.loggingEnabled = false;
        
        // Mode-specific processors
        this.modeProcessors = {
            chill: new ChillModeProcessor(),
            bass: new BassModeProcessor(),
            vocals: new VocalModeProcessor(),
            adaptive: new AdaptiveModeProcessor()
        };
        
        // Distortion detection
        this.distortionHistory = [];
        this.distortionLevel = 0;
        this.gradualReductions = { bass: 0, mids: 0, treble: 0, vocals: 0 };
        
        // EQ frequency bands (Hz) - Enhanced for better vocal detection
        this.frequencies = [
            32,    // Sub-bass
            64,    // Bass
            125,   // Low bass
            250,   // Mid bass
            500,   // Low mids
            1000,  // Mids
            2000,  // Upper mids (vocal presence)
            3000,  // Vocal clarity
            4000,  // Presence
            6000,  // Brilliance
            8000,  // Air
            12000, // High treble
            16000  // Ultra high
        ];
        
        // Vocal frequency ranges for detection
        this.vocalRanges = {
            fundamental: { min: 85, max: 255 },     // Male & female fundamentals
            presence: { min: 2000, max: 4000 },     // Vocal presence
            harmonics: { min: 4000, max: 8000 }     // Vocal harmonics
        };
        
        // Connection state
        this._wired = false;
        this._tapConnected = false;
        
        this.init();
    }
    
    init() {
        this.frequencyData = null;
        this.timeData = null;
    }

    // Helper method for conditional logging
    log(...args) {
        if (this.loggingEnabled) {
            console.log(...args);
        }
    }

    buildNodes(ctx) {
        // Create analyser for frequency analysis
        this.analyserNode = ctx.createAnalyser();
        this.analyserNode.fftSize = 4096; // Higher resolution for better analysis
        this.analyserNode.smoothingTimeConstant = 0.7;
        
        // Create filters for each frequency band
        this.filters = [];
        this.frequencies.forEach((freq, index) => {
            const f = ctx.createBiquadFilter();
            if (index === 0) {
                f.type = 'lowshelf';
            } else if (index === this.frequencies.length - 1) {
                f.type = 'highshelf';
            } else { 
                f.type = 'peaking';
                // Adaptive Q values based on frequency
                const qValue = freq < 250 ? 0.5 : freq < 2000 ? 0.7 : 1.0;
                f.Q.setValueAtTime(qValue, ctx.currentTime);
            }
            f.frequency.setValueAtTime(freq, ctx.currentTime);
            f.gain.setValueAtTime(0, ctx.currentTime);
            this.filters.push(f);
        });
        
        // Create distortion limiter nodes
        this.preGainNode = ctx.createGain();
        this.preGainNode.gain.setValueAtTime(0.8, ctx.currentTime);
        
        this.compressorNode = ctx.createDynamicsCompressor();
        this.compressorNode.threshold.setValueAtTime(-12, ctx.currentTime);
        this.compressorNode.knee.setValueAtTime(2, ctx.currentTime);
        this.compressorNode.ratio.setValueAtTime(8, ctx.currentTime);
        this.compressorNode.attack.setValueAtTime(0.003, ctx.currentTime);
        this.compressorNode.release.setValueAtTime(0.1, ctx.currentTime);
        
        this.limiterNode = ctx.createDynamicsCompressor();
        this.limiterNode.threshold.setValueAtTime(-3, ctx.currentTime);
        this.limiterNode.knee.setValueAtTime(0, ctx.currentTime);
        this.limiterNode.ratio.setValueAtTime(20, ctx.currentTime);
        this.limiterNode.attack.setValueAtTime(0.001, ctx.currentTime);
        this.limiterNode.release.setValueAtTime(0.05, ctx.currentTime);
        
        this.gainNode = ctx.createGain();
        this.gainNode.gain.setValueAtTime(1, ctx.currentTime);
        
        this.frequencyData = new Uint8Array(this.analyserNode.frequencyBinCount);
        this.timeData = new Uint8Array(this.analyserNode.fftSize);
    }
    
    attachToAudio(audioElement) {
        if (!audioElement || !(audioElement instanceof HTMLAudioElement)) {
            console.error('Invalid audio element provided');
            return false;
        }
        
        try {
            if (!window.SharedAudio) {
                console.error('SharedAudio not available');
                return false;
            }
            
            const { ctx, source, masterGain } = window.SharedAudio.get(audioElement);
            
            if (!ctx || !source || !masterGain) {
                console.error('SharedAudio returned invalid objects');
                return false;
            }
      
            if (this.audioContext !== ctx) {
                this.audioContext = ctx;
                this.buildNodes(ctx);
                this._wired = false;
                this._tapConnected = false;
            }
      
            this.audioElement = audioElement;
            this.sourceNode = source;
      
            // Connect analysis tap for frequency analysis
            if (!this._tapConnected) {
                this.sourceNode.connect(this.analyserNode);
                this._tapConnected = true;
            }
            
            this.log('Enhanced Dynamic EQ attached successfully');
            return true;
        } catch (error) {
            console.error('Failed to attach to audio element:', error);
            return false;
        }
    }

    enable() {
        this.log('[EQ] Enable called');
        if (!this.audioElement || !this.sourceNode) {
            console.error('[EQ] ERROR: No audio element attached');
            return false;
        }

        if (this.audioContext?.state === 'suspended') {
            this.audioContext.resume().catch(()=>{});
        }

        if (!this._wired) {
            try {
                const { masterGain } = window.SharedAudio.get(this.audioElement);

                // Disconnect direct routing
                try { this.sourceNode.disconnect(masterGain); } catch(_) {}

                // Build audio chain based on distortion limiter setting
                let head = this.sourceNode;

                // Route through filters
                this.filters.forEach(f => {
                    head = head.connect(f);
                });

                // Add distortion limiter chain if enabled
                if (this.distortionLimiterEnabled) {
                    head.connect(this.preGainNode)
                        .connect(this.compressorNode)
                        .connect(this.limiterNode)
                        .connect(this.gainNode)
                        .connect(masterGain);
                } else {
                    head.connect(this.gainNode).connect(masterGain);
                }

                // Ensure analyser stays connected
                if (this.analyserNode) {
                    try { this.sourceNode.connect(this.analyserNode); } catch(_) {}
                }

                this._wired = true;
                this.log(`[EQ] Audio routed through EQ (Distortion Limiter: ${this.distortionLimiterEnabled ? 'ON' : 'OFF'})`);
            } catch (error) {
                console.error('[EQ] ERROR: Failed to route audio through EQ:', error);
                return false;
            }
        }

        this.isActive = true;
        this.log(`[EQ] EQ is now active. Adaptive mode: ${this.adaptiveMode}, Preset: ${this.currentPreset}`);

        if (this.adaptiveMode) {
            this.log('[EQ] Starting analysis because adaptive mode is enabled');
            this.startAnalysis();
        } else {
            this.log('[EQ] NOT starting analysis - adaptive mode is OFF');
        }

        return true;
    }

    disable() {
        if (!this.isActive) return;
        
        this.isActive = false;
        this.stopAnalysis();
        
        if (this._wired && this.sourceNode && this.audioElement) {
            try {
                const { masterGain } = window.SharedAudio.get(this.audioElement);
                
                // Disconnect EQ chain
                this.sourceNode.disconnect();
                this.filters.forEach(f => f.disconnect());
                this.preGainNode?.disconnect();
                this.compressorNode?.disconnect();
                this.limiterNode?.disconnect();
                this.gainNode?.disconnect();
                
                // Reconnect direct routing
                this.sourceNode.connect(masterGain);
                
                // Keep analyser connected for visualization
                this.sourceNode.connect(this.analyserNode);
                
                this._wired = false;
            } catch (error) {
                console.error('Error disabling EQ:', error);
            }
        }
    }

    setDistortionLimiter(enabled) {
        this.distortionLimiterEnabled = enabled;

        this.log(`[EQ] Distortion Limiter ${enabled ? 'ENABLED' : 'DISABLED'}`);

        // Re-wire if already active to apply changes
        if (this.isActive && this._wired) {
            this.log(`[EQ] Re-wiring audio chain to apply distortion limiter changes...`);
            this.disable();
            this.enable();
        }
    }

    setAdaptiveMode(enabled, preset = null) {
        this.adaptiveMode = enabled;
        this.currentPreset = preset;
        this.manualEQEnabled = !enabled; // Manual EQ is disabled when adaptive is on

        this.log(`[EQ] Adaptive Mode ${enabled ? 'ENABLED' : 'DISABLED'} | Preset: ${preset || 'none'}`);

        if (enabled) {
            // Switching TO adaptive mode - start analysis
            if (this.isActive) {
                this.startAnalysis();
                this.log(`[EQ] Started real-time analysis (50ms intervals)`);
            }
        } else {
            // Switching FROM adaptive mode to manual - restore manual EQ settings
            this.stopAnalysis();
            this.log(`[EQ] Stopped real-time analysis`);

            // Restore saved manual EQ gains
            if (this.filters.length && this.manualGains.length) {
                const currentTime = this.audioContext.currentTime;
                this.filters.forEach((filter, index) => {
                    if (filter && index < this.manualGains.length) {
                        filter.gain.setTargetAtTime(this.manualGains[index], currentTime, 0.05);
                    }
                });
                this.log('Manual EQ gains restored:', this.manualGains);
            }
        }
    }

    setAdaptiveIntensity(intensity) {
        if (['chill', 'normal', 'aggressive'].includes(intensity)) {
            const previous = this.adaptiveIntensity;
            this.adaptiveIntensity = intensity;
            this.log(`[EQ] Intensity changed: ${previous} → ${intensity}`);
        }
    }

    startAnalysis() {
        if (this.analysisInterval) {
            this.log('[EQ] Analysis already running');
            return;
        }

        this.log('[EQ] ✅ Starting real-time analysis (every 50ms)');

        this.analysisInterval = setInterval(() => {
            this.analyze();
            this.detectGenre();
            this.applyAdaptiveEQ();
        }, 50); // 20Hz update rate for smooth response

        this.log('[EQ] Analysis interval started. Interval ID:', this.analysisInterval);
    }

    stopAnalysis() {
        if (this.analysisInterval) {
            clearInterval(this.analysisInterval);
            this.analysisInterval = null;
        }
    }

    analyze() {
        if (!this.analyserNode || !this.frequencyData) {
            console.warn('[EQ] Cannot analyze - analyser or frequency data not ready');
            return;
        }

        this.analyserNode.getByteFrequencyData(this.frequencyData);
        this.analyserNode.getByteTimeDomainData(this.timeData);

        // Calculate frequency band levels
        const nyquist = this.audioContext.sampleRate / 2;
        const binWidth = nyquist / this.frequencyData.length;

        // Bass (20-250 Hz)
        this.bassLevel = this.getAverageVolume(20, 250, binWidth);

        // Mids (250-2000 Hz)
        this.midLevel = this.getAverageVolume(250, 2000, binWidth);

        // Treble (2000-20000 Hz)
        this.trebleLevel = this.getAverageVolume(2000, 20000, binWidth);

        // Vocal range analysis (85-8000 Hz with focus on presence)
        this.vocalLevel = this.detectVocalPresence();

        // Log levels every second (every 20th call since we run at 50ms)
        if (!this._analyzeCounter) this._analyzeCounter = 0;
        this._analyzeCounter++;
        if (this._analyzeCounter % 20 === 0) {
            this.log(`[EQ] Current levels: Bass=${this.bassLevel.toFixed(1)} Mid=${this.midLevel.toFixed(1)} Treble=${this.trebleLevel.toFixed(1)} Vocal=${this.vocalLevel.toFixed(1)}`);
        }

        // Store in adaptive history
        this.adaptiveHistory.push({
            bass: this.bassLevel,
            mid: this.midLevel,
            treble: this.trebleLevel,
            vocal: this.vocalLevel,
            timestamp: Date.now()
        });

        // Keep history size limited
        if (this.adaptiveHistory.length > this.historySize) {
            this.adaptiveHistory.shift();
        }
    }

    detectVocalPresence() {
        if (!this.frequencyData) return 0;
        
        const nyquist = this.audioContext.sampleRate / 2;
        const binWidth = nyquist / this.frequencyData.length;
        
        // Analyze fundamental frequencies
        const fundamental = this.getAverageVolume(
            this.vocalRanges.fundamental.min,
            this.vocalRanges.fundamental.max,
            binWidth
        );
        
        // Analyze presence frequencies (most important for vocals)
        const presence = this.getAverageVolume(
            this.vocalRanges.presence.min,
            this.vocalRanges.presence.max,
            binWidth
        );
        
        // Analyze harmonic frequencies
        const harmonics = this.getAverageVolume(
            this.vocalRanges.harmonics.min,
            this.vocalRanges.harmonics.max,
            binWidth
        );
        
        // Weighted average (presence is most important)
        return fundamental * 0.2 + presence * 0.5 + harmonics * 0.3;
    }

    detectGenre() {
        if (!this.timeData || !this.frequencyData) return;

        // Beat detection for rhythm-based genres
        const beatStrength = this.detectBeat();

        // Update genre scores based on frequency distribution and beat
        const bassToMidRatio = this.bassLevel / (this.midLevel + 1);
        const trebleToMidRatio = this.trebleLevel / (this.midLevel + 1);

        const previousGenre = this.genreDetector.dominantGenre;

        // Hip-hop/Rap detection (strong bass, regular beats, moderate treble)
        if (bassToMidRatio > 1.2 && beatStrength > 0.7 && this.genreDetector.bpm >= 70 && this.genreDetector.bpm <= 110) {
            this.genreDetector.genreScores.hiphop = Math.min(100, this.genreDetector.genreScores.hiphop + 2);
        } else {
            this.genreDetector.genreScores.hiphop *= 0.95;
        }

        // Electronic/EDM detection (consistent beats, balanced frequency)
        if (beatStrength > 0.8 && this.genreDetector.bpm >= 120 && this.genreDetector.bpm <= 140) {
            this.genreDetector.genreScores.electronic = Math.min(100, this.genreDetector.genreScores.electronic + 2);
        } else {
            this.genreDetector.genreScores.electronic *= 0.95;
        }

        // Rock detection (strong mids, moderate bass)
        if (bassToMidRatio > 0.7 && bassToMidRatio < 1.2 && this.midLevel > 60) {
            this.genreDetector.genreScores.rock = Math.min(100, this.genreDetector.genreScores.rock + 1.5);
        } else {
            this.genreDetector.genreScores.rock *= 0.95;
        }

        // Classical detection (balanced spectrum, low bass)
        if (bassToMidRatio < 0.8 && trebleToMidRatio > 0.8 && beatStrength < 0.4) {
            this.genreDetector.genreScores.classical = Math.min(100, this.genreDetector.genreScores.classical + 1.5);
        } else {
            this.genreDetector.genreScores.classical *= 0.95;
        }

        // Jazz detection (complex harmonics, irregular beats)
        if (this.vocalLevel > 50 && beatStrength < 0.6 && trebleToMidRatio > 0.9) {
            this.genreDetector.genreScores.jazz = Math.min(100, this.genreDetector.genreScores.jazz + 1.5);
        } else {
            this.genreDetector.genreScores.jazz *= 0.95;
        }

        // Lo-fi detection (reduced highs, warm mids)
        if (trebleToMidRatio < 0.7 && this.midLevel > 40 && this.midLevel < 70) {
            this.genreDetector.genreScores.lofi = Math.min(100, this.genreDetector.genreScores.lofi + 2);
        } else {
            this.genreDetector.genreScores.lofi *= 0.95;
        }

        // Determine dominant genre
        let maxScore = 0;
        let dominant = null;
        for (const [genre, score] of Object.entries(this.genreDetector.genreScores)) {
            if (score > maxScore) {
                maxScore = score;
                dominant = genre;
            }
        }

        if (maxScore > 30) { // Confidence threshold
            this.genreDetector.dominantGenre = dominant;

            // Log genre change
            if (previousGenre !== dominant) {
                this.log(`[Genre Detection] Changed: ${previousGenre || 'none'} → ${dominant} (score: ${maxScore.toFixed(1)}, BPM: ${Math.round(this.genreDetector.bpm)})`);
                this.log(`[Genre Detection] All scores:`, Object.entries(this.genreDetector.genreScores)
                    .map(([g, s]) => `${g}=${s.toFixed(1)}`)
                    .join(', '));
            }
        }
    }

    detectBeat() {
        if (!this.timeData) return 0;
        
        // Simple beat detection using time domain data
        let sum = 0;
        for (let i = 0; i < this.timeData.length; i++) {
            sum += Math.abs(this.timeData[i] - 128);
        }
        const average = sum / this.timeData.length;
        
        // Dynamic threshold
        this.genreDetector.beatThreshold = this.genreDetector.beatThreshold * 0.95 + average * 0.05;
        
        // Detect beat
        const isBeat = average > this.genreDetector.beatThreshold * 1.3;
        
        if (isBeat) {
            const now = Date.now();
            if (this.genreDetector.lastBeatTime > 0) {
                const beatInterval = now - this.genreDetector.lastBeatTime;
                const bpm = 60000 / beatInterval;
                
                // Smooth BPM calculation
                this.genreDetector.bpm = this.genreDetector.bpm * 0.9 + bpm * 0.1;
            }
            this.genreDetector.lastBeatTime = now;
            
            this.genreDetector.beatHistory.push(now);
            if (this.genreDetector.beatHistory.length > 32) {
                this.genreDetector.beatHistory.shift();
            }
            
            return 1.0;
        }
        
        return average / (this.genreDetector.beatThreshold + 1);
    }

    getAverageVolume(minFreq, maxFreq, binWidth) {
        const minBin = Math.floor(minFreq / binWidth);
        const maxBin = Math.ceil(maxFreq / binWidth);
        
        let sum = 0;
        let count = 0;
        
        for (let i = minBin; i <= maxBin && i < this.frequencyData.length; i++) {
            sum += this.frequencyData[i];
            count++;
        }
        
        return count > 0 ? sum / count : 0;
    }

    applyAdaptiveEQ() {
        if (!this.adaptiveMode || !this.currentPreset || !this.filters.length) {
            if (!this._applyWarned) {
                console.warn(`[EQ] applyAdaptiveEQ skipped - adaptiveMode=${this.adaptiveMode}, preset=${this.currentPreset}, filters=${this.filters.length}`);
                this._applyWarned = true;
            }
            return;
        }

        const currentTime = this.audioContext.currentTime;
        const transitionTime = this.getTransitionTime();

        // Get adjustments based on current mode
        let adjustments = [];

        switch (this.currentPreset) {
            case 'chill':
                adjustments = this.modeProcessors.chill.process(this);
                break;
            case 'bass':
                adjustments = this.modeProcessors.bass.process(this);
                break;
            case 'vocals':
                adjustments = this.modeProcessors.vocals.process(this);
                break;
            case 'adaptive':
                adjustments = this.modeProcessors.adaptive.process(this);
                break;
            default:
                console.warn(`[EQ] Unknown preset: ${this.currentPreset}`);
                return;
        }

        // Store adjustments for distortion monitoring
        this._lastAdjustments = adjustments;

        // Apply distortion limiting if enabled
        if (this.distortionLimiterEnabled) {
            adjustments = this.applyDistortionLimiting(adjustments);
        }

        // Apply adjustments to filters
        this.filters.forEach((filter, index) => {
            if (filter && index < adjustments.length) {
                const targetGain = adjustments[index];
                filter.gain.setTargetAtTime(targetGain, currentTime, transitionTime);
            }
        });
    }

    applyDistortionLimiting(adjustments) {
        // Calculate total boost
        const totalBoost = adjustments.reduce((sum, gain) => sum + Math.max(0, gain), 0);
        
        // Dynamic threshold based on mode and intensity
        let threshold = 20; // Default threshold
        if (this.currentPreset === 'bass') threshold = 15;
        if (this.currentPreset === 'vocals') threshold = 18;
        if (this.adaptiveIntensity === 'aggressive') threshold *= 0.8;
        if (this.adaptiveIntensity === 'chill') threshold *= 1.2;
        
        // Apply limiting if exceeding threshold
        if (totalBoost > threshold) {
            const reductionFactor = threshold / totalBoost;
            return adjustments.map(gain => gain * reductionFactor);
        }
        
        return adjustments;
    }

    getTransitionTime() {
        switch (this.adaptiveIntensity) {
            case 'chill': return 0.5;      // Slower, smoother transitions
            case 'aggressive': return 0.1;  // Fast, responsive transitions
            default: return 0.2;            // Normal transitions
        }
    }

    setManualGains(gains) {
        // Store manual EQ settings even when adaptive is on
        this.manualGains = [...gains];

        // Only apply if manual EQ is active (not in adaptive mode)
        if (this.adaptiveMode || !this.filters.length) return;

        const currentTime = this.audioContext.currentTime;
        this.filters.forEach((filter, index) => {
            if (filter && index < gains.length) {
                filter.gain.setTargetAtTime(gains[index], currentTime, 0.05);
            }
        });

        this.log('Manual EQ gains applied:', gains);
    }

    applyPreset(presetName) {
        const presets = {
            flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            bass: [8, 6, 4, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            vocals: [0, 0, 0, 2, 4, 6, 6, 4, 2, 0, 0, 0, 0],
            treble: [0, 0, 0, 0, 0, 2, 4, 6, 8, 8, 6, 4, 2]
        };
        
        if (presets[presetName]) {
            this.setManualGains(presets[presetName]);
        }
    }

    getStatus() {
        return {
            active: this.isActive,
            adaptive: this.adaptiveMode,
            preset: this.currentPreset,
            intensity: this.adaptiveIntensity,
            distortionLimiter: this.distortionLimiterEnabled,
            genre: this.genreDetector.dominantGenre,
            bpm: Math.round(this.genreDetector.bpm),
            levels: {
                bass: Math.round(this.bassLevel),
                mid: Math.round(this.midLevel),
                treble: Math.round(this.trebleLevel),
                vocal: Math.round(this.vocalLevel)
            }
        };
    }
}

// Mode Processors
class ChillModeProcessor {
    process(eq) {
        const adjustments = new Array(eq.filters.length).fill(0);
        const intensity = eq.adaptiveIntensity;

        // Get smoothed levels from history
        const smoothedLevels = this.getSmoothedLevels(eq.adaptiveHistory);

        // Chill mode: Smooth out ALL frequencies for a relaxed, even sound
        const multiplier = intensity === 'aggressive' ? 0.45 : intensity === 'chill' ? 0.6 : 0.5;

        // Get current levels
        const bassLevel = eq.bassLevel;
        const midLevel = eq.midLevel;
        const trebleLevel = eq.trebleLevel;

        // Calculate average level to smooth towards
        const avgLevel = (bassLevel + midLevel + trebleLevel) / 3;

        // SMOOTH OUT ALL FREQUENCIES - bring peaks down, raise valleys up
        const smoothingFactor = 0.15; // How much to smooth

        // Sub-bass and bass smoothing
        const bassDiff = bassLevel - avgLevel;
        if (bassDiff > 10) {
            // Bass is too loud, gently reduce it
            adjustments[0] = -Math.min(2, bassDiff * smoothingFactor) * multiplier;
            adjustments[1] = -Math.min(2, bassDiff * smoothingFactor) * multiplier;
            eq.log(`[Chill] Bass too loud (${bassLevel.toFixed(1)}), reducing by ${adjustments[1].toFixed(2)}dB`);
        } else if (bassDiff < -10) {
            // Bass is too quiet, gently boost it
            adjustments[0] = Math.min(2, Math.abs(bassDiff) * smoothingFactor) * multiplier;
            adjustments[1] = Math.min(2, Math.abs(bassDiff) * smoothingFactor) * multiplier;
            eq.log(`[Chill] Bass too quiet (${bassLevel.toFixed(1)}), boosting by ${adjustments[1].toFixed(2)}dB`);
        } else {
            // Bass is balanced, add warmth
            adjustments[0] = 0.5 * multiplier;
            adjustments[1] = 0.8 * multiplier;
        }

        // Mid smoothing - gentle warmth
        const midDiff = midLevel - avgLevel;
        if (midDiff > 10) {
            adjustments[4] = -Math.min(1.5, midDiff * smoothingFactor) * multiplier;
            adjustments[5] = -Math.min(1.5, midDiff * smoothingFactor) * multiplier;
            eq.log(`[Chill] Mids too loud (${midLevel.toFixed(1)}), reducing by ${adjustments[4].toFixed(2)}dB`);
        } else if (midDiff < -10) {
            adjustments[4] = Math.min(1.5, Math.abs(midDiff) * smoothingFactor) * multiplier;
            adjustments[5] = Math.min(1.5, Math.abs(midDiff) * smoothingFactor) * multiplier;
            eq.log(`[Chill] Mids too quiet (${midLevel.toFixed(1)}), boosting by ${adjustments[4].toFixed(2)}dB`);
        } else {
            // Add gentle warmth
            adjustments[4] = 1 * multiplier;
            adjustments[5] = 0.5 * multiplier;
        }

        // Treble smoothing - always soften for chill vibes
        const trebleDiff = trebleLevel - avgLevel;
        if (trebleDiff > 5) {
            // Treble is harsh, reduce it more
            adjustments[7] = -Math.min(2, trebleDiff * smoothingFactor * 1.2) * multiplier;
            adjustments[8] = -Math.min(2.5, trebleDiff * smoothingFactor * 1.3) * multiplier;
            adjustments[9] = -Math.min(3, trebleDiff * smoothingFactor * 1.4) * multiplier;
            eq.log(`[Chill] Treble harsh (${trebleLevel.toFixed(1)}), smoothing by ${adjustments[8].toFixed(2)}dB`);
        } else {
            // Gentle treble softening for relaxed sound
            adjustments[7] = -0.8 * multiplier;
            adjustments[8] = -1.2 * multiplier;
            adjustments[9] = -1.5 * multiplier;
        }

        // Always roll off extreme highs for smooth, chill sound
        adjustments[11] = -2 * multiplier;
        adjustments[12] = -2.5 * multiplier;

        // Compress dynamic range for consistent, relaxed listening
        const dynamicRange = smoothedLevels.max - smoothedLevels.min;
        if (dynamicRange > 50) {
            const compressionFactor = Math.min(0.35, (dynamicRange - 50) / 100);
            adjustments.forEach((_, i) => {
                adjustments[i] *= (1 - compressionFactor * 0.25);
            });
            eq.log(`[Chill] High dynamic range (${dynamicRange.toFixed(1)}), compressing by ${(compressionFactor * 100).toFixed(1)}%`);
        }

        eq.log(`[Chill] Levels: Bass=${bassLevel.toFixed(1)} Mid=${midLevel.toFixed(1)} Treble=${trebleLevel.toFixed(1)} Avg=${avgLevel.toFixed(1)}`);

        // Store dev stats
        eq._devStats = eq._devStats || {};

        // Determine bass status (reusing bassDiff from above)
        let bassStatus = 'balanced';
        if (bassDiff > 10) {
            bassStatus = 'loud';
        } else if (bassDiff < -10) {
            bassStatus = 'quiet';
        }

        // Determine mid status (reusing midDiff from above)
        let midStatus = 'balanced';
        if (midDiff > 10) {
            midStatus = 'loud';
        } else if (midDiff < -10) {
            midStatus = 'quiet';
        }

        // Determine treble status (reusing trebleDiff from above)
        let trebleStatus = 'balanced';
        if (trebleDiff > 5) {
            trebleStatus = 'harsh';
        } else {
            trebleStatus = 'smooth';
        }

        // Vocal status (inferred from overall balance)
        let vocalStatus = 'balanced';

        eq._devStats.bassStatus = bassStatus;
        eq._devStats.midStatus = midStatus;
        eq._devStats.trebleStatus = trebleStatus;
        eq._devStats.vocalStatus = vocalStatus;
        eq._devStats.appliedBass = adjustments[1];
        eq._devStats.appliedLowerMid = adjustments[4];
        eq._devStats.appliedHigherMid = adjustments[5];
        eq._devStats.appliedTreble = adjustments[10];
        eq._devStats.appliedVocal = adjustments[7];

        return adjustments;
    }

    getSmoothedLevels(history) {
        if (history.length === 0) return { bass: 50, mid: 50, treble: 50, max: 50, min: 50 };

        const recent = history.slice(-20);
        const bass = recent.reduce((sum, h) => sum + h.bass, 0) / recent.length;
        const mid = recent.reduce((sum, h) => sum + h.mid, 0) / recent.length;
        const treble = recent.reduce((sum, h) => sum + h.treble, 0) / recent.length;

        return {
            bass,
            mid,
            treble,
            max: Math.max(bass, mid, treble),
            min: Math.min(bass, mid, treble)
        };
    }
}

class BassModeProcessor {
    process(eq) {
        const adjustments = new Array(eq.filters.length).fill(0);
        const intensity = eq.adaptiveIntensity;

        // ORIGINAL CONFIG (kept for reference):
        // const multiplier = intensity === 'aggressive' ? 0.8 : intensity === 'chill' ? 0.4 : 0.5;
        // bassBoostNeeded = (0.9 - bassToMidRatio) * 8;
        // adjustments[0] = Math.min(6, finalBassBoost * 0.6);
        // adjustments[1] = Math.min(7, finalBassBoost * 0.8);
        // adjustments[2] = Math.min(5, finalBassBoost * 0.6);

        // NEW CONFIG: Increased multiplier and boost factor for Aggressive only
        const multiplier = intensity === 'aggressive' ? 1.2 : intensity === 'chill' ? 0.4 : 0.5;

        // Analyze current bass level to determine if boost is needed
        const bassLevel = eq.bassLevel;
        const midLevel = eq.midLevel;
        const bassToMidRatio = bassLevel / (midLevel + 1);

        // Only boost bass if it's actually lacking (adaptive approach)
        let bassBoostNeeded = 0;
        let bassStatus = 'balanced';

        if (bassToMidRatio < 0.9) {
            // Bass is weak compared to mids, boost it
            const boostFactor = intensity === 'aggressive' ? 12 : 8;
            bassBoostNeeded = (0.9 - bassToMidRatio) * boostFactor;
            bassStatus = 'weak';
            eq.log(`[Bass] Bass weak (ratio=${bassToMidRatio.toFixed(2)}), boosting ${bassBoostNeeded.toFixed(2)}dB base`);
        } else if (bassToMidRatio > 1.5) {
            // Bass is very strong - in Aggressive mode, still maintain it; otherwise reduce
            if (intensity === 'aggressive') {
                bassBoostNeeded = 1.5; // Maintain strong bass with gentle boost
                bassStatus = 'strong-maintained';
                eq.log(`[Bass] Bass very strong (ratio=${bassToMidRatio.toFixed(2)}), maintaining in Aggressive mode`);
            } else if (intensity === 'normal') {
                bassBoostNeeded = 0.5; // Keep it neutral in Normal mode
                bassStatus = 'strong';
                eq.log(`[Bass] Bass strong (ratio=${bassToMidRatio.toFixed(2)}), keeping neutral in Normal mode`);
            } else {
                // Chill mode - reduce if too strong
                bassBoostNeeded = -(bassToMidRatio - 1.5) * 2;
                bassStatus = 'strong';
                eq.log(`[Bass] Bass strong (ratio=${bassToMidRatio.toFixed(2)}), reducing in Chill mode`);
            }
        } else {
            // Bass is in good balance, enhance based on intensity
            bassBoostNeeded = intensity === 'aggressive' ? 3 : intensity === 'normal' ? 2 : 1.5;
            eq.log(`[Bass] Bass balanced (ratio=${bassToMidRatio.toFixed(2)}), enhancing for focus`);
        }

        // NO GENRE INFLUENCE - genre is informational only
        const finalBassBoost = bassBoostNeeded * multiplier;

        // Sub-bass and bass enhancement - higher caps for Aggressive and Normal modes
        // ORIGINAL CAPS: 6dB, 7dB, 5dB, 3dB (Chill/Normal)
        // INCREASED CAPS: Normal gets more headroom, Aggressive gets even more
        const subBassCap = intensity === 'aggressive' ? 10 : intensity === 'normal' ? 7 : 6;
        const bassCap = intensity === 'aggressive' ? 12 : intensity === 'normal' ? 9 : 7;
        const upperBassCap = intensity === 'aggressive' ? 9 : intensity === 'normal' ? 6 : 5;
        const lowMidCap = intensity === 'aggressive' ? 5 : intensity === 'normal' ? 4 : 3;

        adjustments[0] = Math.min(subBassCap, finalBassBoost * 0.6); // 32Hz - sub-bass
        adjustments[1] = Math.min(bassCap, finalBassBoost * 0.8);    // 64Hz - main bass
        adjustments[2] = Math.min(upperBassCap, finalBassBoost * 0.6); // 125Hz - upper bass
        adjustments[3] = Math.min(lowMidCap, finalBassBoost * 0.4); // 250Hz - low mids

        // BASS MODE = BASS FOCUS: Intelligently adjust other frequencies to support bass

        // 1. ADAPTIVE MID HANDLING - Detect what kind of mids the song has
        const vocalLevel = eq.vocalLevel;
        const trebleLevel = eq.trebleLevel;
        const avgNonMid = (bassLevel + trebleLevel) / 2 + 1;
        const midToAvgRatio = midLevel / avgNonMid;
        let midStatus = 'balanced';

        // IMPORTANT: Check if bass is already strong before scooping mids
        const bassIsStrong = bassStatus === 'strong' || bassBoostNeeded < 0;
        const bassIsBeingBoosted = finalBassBoost > 0;

        if (midToAvgRatio < 0.7) {
            // Song has weak/sparse mids, boost LOWER mids to support bass warmth
            // Boost 250Hz-500Hz range for body, leave 1kHz more neutral
            adjustments[3] += 0.8 * multiplier;   // 250Hz - add low-mid body (on top of bass boost)
            adjustments[4] = 1.5 * multiplier;    // 500Hz - solid body boost
            adjustments[5] = 0.2 * multiplier;    // 1kHz - minimal warmth (don't boost high mids much)
            midStatus = 'weak';
            eq.log(`[Bass] Weak mids detected (ratio=${midToAvgRatio.toFixed(2)}), boosting lower mids for warmth`);
        } else if (midToAvgRatio > 1.6 && !bassIsStrong) {
            // Song has heavy/congested mids AND bass needs help
            // Lower mids: Keep minimal scoop to preserve body
            // Higher mids: Moderate scoop for clarity
            adjustments[4] = -0.3 * multiplier;   // 500Hz - minimal scoop to keep body
            adjustments[5] = -1.0 * multiplier;   // 1kHz - moderate scoop (high mids)
            midStatus = 'heavy';
            eq.log(`[Bass] Heavy mids detected (ratio=${midToAvgRatio.toFixed(2)}), gentle scoop of high mids for bass clarity`);
        } else if (bassIsStrong) {
            // Bass is already strong, boost lower mids to maintain fullness and prevent thinness
            // Strong bass still needs lower mid support for audible punch
            // Scale with intensity: aggressive maintains strong fullness, chill is more conservative
            const strongBassFactor = intensity === 'aggressive' ? 2.5 :
                                    intensity === 'normal' ? 1.5 : 0.8;

            adjustments[3] += Math.min(4, strongBassFactor * 0.6);  // 250Hz - low-mid warmth
            adjustments[4] = Math.min(5, strongBassFactor);         // 500Hz - body/punch
            adjustments[5] = 0;                                     // 1kHz - leave neutral
            midStatus = 'supporting';
            eq.log(`[Bass] Bass strong, maintaining lower mid fullness: 250Hz +${adjustments[3].toFixed(2)}dB, 500Hz +${adjustments[4].toFixed(2)}dB`);
        } else {
            // BALANCED MIDS (ratio 0.7-1.6) - Intelligent handling with STRONG lower mid support
            // Lower mids: Scale with bass boost for audible punch and body
            if (bassIsBeingBoosted) {
                // Scale lower mid boost proportionally with bass boost amount
                // Aggressive: 40% of bass boost (e.g., +10dB bass = +4dB lower mids)
                // Normal: 25% of bass boost (e.g., +8dB bass = +2dB lower mids)
                // Chill: 15% of bass boost (e.g., +6dB bass = +0.9dB lower mids)
                const lowerMidFactor = intensity === 'aggressive' ? 0.4 :
                                      intensity === 'normal' ? 0.25 : 0.15;

                // 250Hz - low mid warmth (60% of 500Hz boost)
                adjustments[3] += Math.min(5, finalBassBoost * lowerMidFactor * 0.6);

                // 500Hz - main lower mid body/punch
                adjustments[4] = Math.min(6, finalBassBoost * lowerMidFactor);

                eq.log(`[Bass] Balanced mids, scaling lower mid boost with bass: 250Hz +${adjustments[3].toFixed(2)}dB, 500Hz +${adjustments[4].toFixed(2)}dB`);
            } else {
                adjustments[4] = 0;  // 500Hz - leave neutral if not boosting bass
            }

            // Higher mids: Only scoop if they're interfering with bass presence
            // Check if higher mids (1kHz area) are proportionally high compared to bass/lower mids
            const higherMidToBassRatio = midLevel / (bassLevel + 1);
            if (higherMidToBassRatio > 1.2) {
                // Higher mids slightly elevated, gentle scoop for clarity
                adjustments[5] = -0.4 * multiplier;  // 1kHz - gentle scoop
                eq.log(`[Bass] Mids balanced but slightly elevated (ratio=${midToAvgRatio.toFixed(2)}), gentle high-mid scoop`);
            } else if (higherMidToBassRatio < 0.8) {
                // Higher mids proportionally low, tiny boost for presence
                adjustments[5] = 0.2 * multiplier;  // 1kHz - tiny boost
                eq.log(`[Bass] Mids balanced and proportional (ratio=${midToAvgRatio.toFixed(2)}), supporting higher mids`);
            } else {
                // Higher mids perfectly proportional, leave neutral
                adjustments[5] = 0;  // 1kHz - neutral
                eq.log(`[Bass] Mids balanced and proportional (ratio=${midToAvgRatio.toFixed(2)}), keeping neutral`);
            }
            midStatus = 'balanced';
        }

        // 2. ADAPTIVE VOCAL PROTECTION - Tiny helper at most (max ~1.25dB boost)
        const vocalToBassRatio = vocalLevel / (bassLevel + 1);

        // IMPORTANT: Also check absolute vocal level - if vocals are already strong, don't boost
        const vocalThreshold = 40; // If vocals are above this level, they're already strong enough
        let vocalStatus = 'balanced';

        if (vocalLevel > vocalThreshold) {
            // Vocals are already strong in absolute terms, no boost needed
            adjustments[6] = 0;
            adjustments[7] = 0;
            vocalStatus = 'strong';
            eq.log(`[Bass] Vocals strong (level=${vocalLevel.toFixed(1)}), no boost`);
        } else if (vocalToBassRatio < 0.25) {
            // Vocals extremely buried, tiny helper to keep them barely audible
            const vocalBoost = (0.25 - vocalToBassRatio) * 2.5; // Gentle multiplier
            adjustments[6] = Math.min(0.7, vocalBoost * multiplier); // 2kHz - cap at 0.7dB
            adjustments[7] = Math.min(0.6, vocalBoost * multiplier); // 3kHz - cap at 0.6dB
            vocalStatus = 'buried';
            eq.log(`[Bass] Vocals buried (ratio=${vocalToBassRatio.toFixed(2)}, level=${vocalLevel.toFixed(1)}), tiny boost ${vocalBoost.toFixed(2)}dB`);
        } else if (vocalToBassRatio > 1.2) {
            // Vocals already prominent, no boost needed
            adjustments[6] = 0;
            adjustments[7] = 0;
            vocalStatus = 'prominent';
            eq.log(`[Bass] Vocals prominent (ratio=${vocalToBassRatio.toFixed(2)}), no boost`);
        } else {
            // Balanced vocals, tiny boost to keep them barely present
            adjustments[6] = 0.15 * multiplier; // Very subtle - around 0.15-0.18dB
            adjustments[7] = 0.1 * multiplier;  // Even more subtle
            eq.log(`[Bass] Vocals balanced (level=${vocalLevel.toFixed(1)}), tiny helper boost`);
        }

        // 3. ADAPTIVE TREBLE BALANCING - Keep brightness balanced with bass (subtle)
        const trebleToBassRatio = trebleLevel / (bassLevel + 1);
        let trebleStatus = 'balanced';

        if (trebleToBassRatio < 0.6) {
            // Treble weak, gentle boost for air (not boosting vocal range) - max 0.70dB
            adjustments[9] = 0.4 * multiplier;    // 6kHz - gentle air (max 0.48dB on aggressive)
            adjustments[10] = 0.5 * multiplier;   // 8kHz - subtle brightness (max 0.60dB on aggressive)
            adjustments[11] = 0.6 * multiplier;   // 12kHz - sparkle (max 0.72dB on aggressive)
            trebleStatus = 'weak';
            eq.log(`[Bass] Weak treble (ratio=${trebleToBassRatio.toFixed(2)}), gentle boost for air`);
        } else if (trebleToBassRatio > 1.3) {
            // Treble strong, minimal boost to avoid harshness
            adjustments[9] = 0.2 * multiplier;    // Max 0.24dB
            adjustments[10] = 0.25 * multiplier;  // Max 0.30dB
            adjustments[11] = 0.2 * multiplier;   // Max 0.24dB
            trebleStatus = 'strong';
            eq.log(`[Bass] Strong treble, minimal boost`);
        } else {
            // Balanced treble, very subtle sparkle - max 0.70dB
            adjustments[9] = 0.35 * multiplier;   // Max 0.42dB
            adjustments[10] = 0.45 * multiplier;  // Max 0.54dB on aggressive
            adjustments[11] = 0.5 * multiplier;   // Max 0.60dB on aggressive
            eq.log(`[Bass] Treble balanced, subtle sparkle`);
        }

        eq.log(`[Bass] Applied: 64Hz=${adjustments[1].toFixed(2)}dB | Bass=${bassLevel.toFixed(1)} Mid=${midLevel.toFixed(1)} | Intensity=${intensity}`);

        // Store status for dev menu - ALL statuses with separate low/high mids
        eq._devStats = eq._devStats || {};
        eq._devStats.bassStatus = bassStatus;
        eq._devStats.midStatus = midStatus;
        eq._devStats.vocalStatus = vocalStatus;
        eq._devStats.trebleStatus = trebleStatus;
        eq._devStats.bassRatio = bassToMidRatio;
        eq._devStats.midRatio = midToAvgRatio;
        eq._devStats.vocalRatio = vocalToBassRatio;
        eq._devStats.trebleRatio = trebleToBassRatio;
        eq._devStats.appliedBass = adjustments[1];
        eq._devStats.appliedLowerMid = adjustments[4];  // 500Hz - lower mids
        eq._devStats.appliedHigherMid = adjustments[5]; // 1kHz - higher mids
        eq._devStats.appliedVocal = adjustments[6];
        eq._devStats.appliedTreble = adjustments[10];

        return adjustments;
    }
}

class VocalModeProcessor {
    process(eq) {
        const adjustments = new Array(eq.filters.length).fill(0);
        const intensity = eq.adaptiveIntensity;

        // Subtle intensity multipliers
        const multiplier = intensity === 'aggressive' ? 0.7 : intensity === 'chill' ? 0.35 : 0.5;

        // Analyze vocal level relative to other frequencies
        const vocalLevel = eq.vocalLevel;
        const bassLevel = eq.bassLevel;
        const trebleLevel = eq.trebleLevel;

        // Calculate if vocals need boost or are already prominent
        let vocalBoostNeeded = 0;
        const avgNonVocal = (bassLevel + trebleLevel) / 2;

        if (vocalLevel < avgNonVocal * 0.8) {
            // Vocals are weak, boost them
            vocalBoostNeeded = (avgNonVocal * 0.8 - vocalLevel) * 0.08;
            eq.log(`[Vocals] Vocals weak (${vocalLevel.toFixed(1)} vs avg ${avgNonVocal.toFixed(1)}), boosting ${vocalBoostNeeded.toFixed(2)}dB base`);
        } else if (vocalLevel > avgNonVocal * 1.2) {
            // Vocals already prominent, minimal boost
            vocalBoostNeeded = 1;
            eq.log(`[Vocals] Vocals already prominent (${vocalLevel.toFixed(1)}), minimal boost`);
        } else {
            // Vocals balanced, gentle enhancement
            vocalBoostNeeded = 2;
        }

        // VOCAL MODE = VOCAL FOCUS: Intelligently adjust other frequencies to support vocals

        // 1. ADAPTIVE BASS REDUCTION - Only cut bass if it's overpowering vocals
        const bassToVocalRatio = bassLevel / (vocalLevel + 1);

        if (bassToVocalRatio > 1.5) {
            // Bass is overpowering vocals, cut it more aggressively
            adjustments[0] = -3 * multiplier;   // Sub-bass - strong reduction
            adjustments[1] = -2.5 * multiplier; // Bass - clear space
            adjustments[2] = -1.5 * multiplier; // Upper bass
            eq.log(`[Vocals] Bass overpowering (ratio=${bassToVocalRatio.toFixed(2)}), cutting aggressively`);
        } else if (bassToVocalRatio < 0.8) {
            // Bass is weak, minimal reduction to keep fullness
            adjustments[0] = -0.5 * multiplier;
            adjustments[1] = -0.3 * multiplier;
            adjustments[2] = 0;
            eq.log(`[Vocals] Bass weak, minimal reduction for fullness`);
        } else {
            // Balanced bass, standard reduction for vocal clarity
            adjustments[0] = -1.5 * multiplier;
            adjustments[1] = -1 * multiplier;
            adjustments[2] = -0.5 * multiplier;
        }

        // 2. ADAPTIVE VOCAL BOOST - Based on vocal prominence and need
        adjustments[3] = Math.min(4, vocalBoostNeeded * 0.5 * multiplier); // 250Hz - low fundamentals
        adjustments[4] = Math.min(5, vocalBoostNeeded * 0.7 * multiplier); // 500Hz - warmth
        adjustments[5] = Math.min(6, vocalBoostNeeded * 1.0 * multiplier); // 1kHz - body

        // Main vocal presence - this is the star
        adjustments[6] = Math.min(6, vocalBoostNeeded * 1.2 * multiplier); // 2kHz - presence
        adjustments[7] = Math.min(7, vocalBoostNeeded * 1.3 * multiplier); // 3kHz - clarity
        adjustments[8] = Math.min(5, vocalBoostNeeded * 1.0 * multiplier); // 4kHz - definition

        // 3. ADAPTIVE TREBLE - Keep sparkle balanced with vocals
        const trebleToVocalRatio = trebleLevel / (vocalLevel + 1);

        if (trebleToVocalRatio < 0.7) {
            // Treble weak, boost for vocal air and sparkle
            adjustments[9] = Math.min(5, 3 * multiplier);    // 6kHz - air
            adjustments[10] = Math.min(5, 3.5 * multiplier); // 8kHz - brightness
            adjustments[11] = Math.min(4, 2 * multiplier);   // 12kHz - sparkle
            eq.log(`[Vocals] Weak treble (ratio=${trebleToVocalRatio.toFixed(2)}), boosting for vocal air`);
        } else if (trebleToVocalRatio > 1.4) {
            // Treble strong, reduce to avoid sibilance
            adjustments[9] = Math.min(2, 1 * multiplier);
            adjustments[10] = Math.min(2, 1.5 * multiplier);
            adjustments[11] = Math.min(1, 0.5 * multiplier);
            eq.log(`[Vocals] Strong treble, reducing to avoid sibilance`);
        } else {
            // Balanced treble, standard vocal sparkle
            adjustments[9] = Math.min(4, 2 * multiplier);
            adjustments[10] = Math.min(4, 2.5 * multiplier);
            adjustments[11] = Math.min(3, 1.5 * multiplier);
        }

        // 4. INTELLIGIBILITY BOOST - Extra consonant clarity when needed
        if (trebleLevel < 50 && vocalLevel > 40) {
            adjustments[8] += 1.5 * multiplier; // 4kHz - consonants
            adjustments[9] += 1 * multiplier;   // 6kHz - sibilance
            eq.log(`[Vocals] Low treble + strong vocals, boosting consonants for intelligibility`);
        }

        eq.log(`[Vocals] Applied: 3kHz=${adjustments[7].toFixed(2)}dB | Vocal=${vocalLevel.toFixed(1)} Bass=${bassLevel.toFixed(1)} | Intensity=${intensity}`);

        // Store dev stats
        eq._devStats = eq._devStats || {};

        // Determine bass status based on bassToVocalRatio
        let bassStatus = 'balanced';
        if (bassToVocalRatio > 1.5) {
            bassStatus = 'overpowering';
        } else if (bassToVocalRatio < 0.8) {
            bassStatus = 'weak';
        }

        // Determine vocal status based on vocalLevel and avgNonVocal
        let vocalStatus = 'balanced';
        if (vocalLevel < avgNonVocal * 0.8) {
            vocalStatus = 'weak';
        } else if (vocalLevel > avgNonVocal * 1.2) {
            vocalStatus = 'prominent';
        }

        // Determine treble status based on trebleToVocalRatio
        let trebleStatus = 'balanced';
        if (trebleToVocalRatio < 0.7) {
            trebleStatus = 'weak';
        } else if (trebleToVocalRatio > 1.4) {
            trebleStatus = 'strong';
        }

        // Determine mid status (inferred from adjustments)
        let midStatus = 'balanced';

        eq._devStats.bassStatus = bassStatus;
        eq._devStats.midStatus = midStatus;
        eq._devStats.trebleStatus = trebleStatus;
        eq._devStats.vocalStatus = vocalStatus;
        eq._devStats.appliedBass = adjustments[1];
        eq._devStats.appliedLowerMid = adjustments[4];
        eq._devStats.appliedHigherMid = adjustments[5];
        eq._devStats.appliedTreble = adjustments[10];
        eq._devStats.appliedVocal = adjustments[7];

        return adjustments;
    }
}

class AdaptiveModeProcessor {
    constructor() {
        this.lastLevels = { bass: 0, mid: 0, treble: 0, vocal: 0 };
        this.changeHistory = [];
    }

    process(eq) {
        const adjustments = new Array(eq.filters.length).fill(0);
        const intensity = eq.adaptiveIntensity;
        const genre = eq.genreDetector.dominantGenre;

        // Intensity multipliers - Aggressive is now truly aggressive!
        const multiplier = intensity === 'aggressive' ? 1.3 : intensity === 'chill' ? 0.3 : 0.9;

        // Get current frequency levels - REAL-TIME, NO TARGETS
        const bassLevel = eq.bassLevel;
        const midLevel = eq.midLevel;
        const trebleLevel = eq.trebleLevel;
        const vocalLevel = eq.vocalLevel;

        // Log if levels changed significantly
        if (Math.abs(bassLevel - this.lastLevels.bass) > 5) {
            eq.log(`[Adaptive] Bass changed: ${this.lastLevels.bass.toFixed(1)} → ${bassLevel.toFixed(1)}`);
        }
        if (Math.abs(midLevel - this.lastLevels.mid) > 5) {
            eq.log(`[Adaptive] Mids changed: ${this.lastLevels.mid.toFixed(1)} → ${midLevel.toFixed(1)}`);
        }
        if (Math.abs(trebleLevel - this.lastLevels.treble) > 5) {
            eq.log(`[Adaptive] Treble changed: ${this.lastLevels.treble.toFixed(1)} → ${trebleLevel.toFixed(1)}`);
        }
        if (Math.abs(vocalLevel - this.lastLevels.vocal) > 5) {
            eq.log(`[Adaptive] Vocals changed: ${this.lastLevels.vocal.toFixed(1)} → ${vocalLevel.toFixed(1)}`);
        }

        this.lastLevels = { bass: bassLevel, mid: midLevel, treble: trebleLevel, vocal: vocalLevel };

        // ADAPTIVE MODE: Enhance what's prominent, maintain stability
        // Key philosophy: Boost the dominant, support the weak, prevent drowning
        // Example: Strong bass + strong vocals = boost both but maintain separation
        // Example: Strong bass only = boost bass but raise vocals/treble slightly for stability

        // Determine what's dominant right now
        const totalEnergy = bassLevel + midLevel + vocalLevel + trebleLevel;
        const bassWeight = bassLevel / totalEnergy;
        const vocalWeight = vocalLevel / totalEnergy;
        const trebleWeight = trebleLevel / totalEnergy;
        const midWeight = midLevel / totalEnergy;

        // Track what's dominant for stability adjustments
        const bassDominant = bassWeight > 0.35;
        const vocalsDominant = vocalWeight > 0.25;
        const bothBassAndVocalsDominant = bassDominant && vocalsDominant;

        // BASS: Enhance if prominent, support if weak
        if (bassWeight > 0.35) {
            // Bass is dominant - boost it to emphasize the bass-heavy character
            // Scale enhancement factor with intensity for truly aggressive response
            const enhancementFactor = intensity === 'aggressive' ? 30 : intensity === 'normal' ? 18 : 15;
            const bassEnhance = (bassWeight - 0.35) * enhancementFactor;

            // Higher caps for aggressive mode
            const bassCap = intensity === 'aggressive' ? 10 : intensity === 'normal' ? 6 : 5;

            adjustments[0] = Math.min(bassCap * 0.7, bassEnhance * 0.7) * multiplier;  // Sub-bass
            adjustments[1] = Math.min(bassCap, bassEnhance * 1.0) * multiplier;         // Main bass
            adjustments[2] = Math.min(bassCap * 0.8, bassEnhance * 0.6) * multiplier;  // Upper bass

            // Add lower mid support for audible bass punch (like Bass mode)
            // Match Bass mode's aggressiveness: 45% for aggressive (vs Bass mode's 40%)
            const lowerMidFactor = intensity === 'aggressive' ? 0.45 : intensity === 'normal' ? 0.25 : 0.15;
            adjustments[3] += Math.min(6, bassEnhance * lowerMidFactor * 0.6) * multiplier;  // 250Hz
            adjustments[4] += Math.min(7, bassEnhance * lowerMidFactor) * multiplier;        // 500Hz

            eq.log(`[Adaptive] Bass dominant (${(bassWeight*100).toFixed(1)}%), enhancing ${adjustments[1].toFixed(2)}dB, lower mids ${adjustments[4].toFixed(2)}dB`);
        } else if (bassWeight < 0.20) {
            // Bass is weak - boost it to maintain fullness
            const boostFactor = intensity === 'aggressive' ? 15 : 10;
            const bassBoost = (0.20 - bassWeight) * boostFactor;

            const bassCap = intensity === 'aggressive' ? 8 : 5;

            adjustments[0] = Math.min(bassCap * 0.7, bassBoost * 0.7) * multiplier;
            adjustments[1] = Math.min(bassCap, bassBoost * 1.0) * multiplier;
            adjustments[2] = Math.min(bassCap * 0.6, bassBoost * 0.6) * multiplier;

            // Add lower mid support when boosting weak bass
            // Match dominant scenario's aggressiveness
            const lowerMidFactor = intensity === 'aggressive' ? 0.45 : intensity === 'normal' ? 0.25 : 0.15;
            adjustments[3] += Math.min(5, bassBoost * lowerMidFactor * 0.6) * multiplier;
            adjustments[4] += Math.min(6, bassBoost * lowerMidFactor) * multiplier;

            eq.log(`[Adaptive] Bass weak (${(bassWeight*100).toFixed(1)}%), supporting ${adjustments[1].toFixed(2)}dB, lower mids ${adjustments[4].toFixed(2)}dB`);
        }

        // VOCALS: Enhance if prominent, support if weak
        if (vocalWeight > 0.25) {
            // Vocals are prominent - boost them
            // Scale enhancement factor with intensity for truly aggressive response
            const vocalEnhanceFactor = intensity === 'aggressive' ? 20 : intensity === 'normal' ? 14 : 12;
            const vocalEnhance = (vocalWeight - 0.25) * vocalEnhanceFactor;

            // Higher caps for aggressive mode
            const vocalCap = intensity === 'aggressive' ? 7 : intensity === 'normal' ? 5 : 4;

            adjustments[6] = Math.min(vocalCap, vocalEnhance * 1.0) * multiplier;
            adjustments[7] = Math.min(vocalCap, vocalEnhance * 1.1) * multiplier;

            // STABILITY: Only reduce bass if vocals dominant WITHOUT bass being dominant
            if (!bothBassAndVocalsDominant) {
                adjustments[1] = Math.max(adjustments[1] - (1 * multiplier), adjustments[1] - 2);
                eq.log(`[Adaptive] Vocals prominent (${(vocalWeight*100).toFixed(1)}%), enhancing ${adjustments[6].toFixed(2)}dB, reducing bass for clarity`);
            } else {
                eq.log(`[Adaptive] Vocals prominent (${(vocalWeight*100).toFixed(1)}%), enhancing ${adjustments[6].toFixed(2)}dB, keeping bass strong`);
            }
        } else if (vocalWeight < 0.15) {
            // Vocals are buried - bring them up
            const vocalBoostFactor = intensity === 'aggressive' ? 12 : intensity === 'normal' ? 10 : 8;
            const vocalBoost = (0.15 - vocalWeight) * vocalBoostFactor;

            const buriedVocalCap = intensity === 'aggressive' ? 5 : intensity === 'normal' ? 4 : 3;

            adjustments[6] = Math.min(buriedVocalCap, vocalBoost * 1.0) * multiplier;
            adjustments[7] = Math.min(buriedVocalCap, vocalBoost * 0.9) * multiplier;
            eq.log(`[Adaptive] Vocals buried (${(vocalWeight*100).toFixed(1)}%), supporting ${adjustments[6].toFixed(2)}dB`);
        }

        // TREBLE: Enhance if prominent, support if weak
        if (trebleWeight > 0.18) {
            // Treble is prominent - boost for sparkle
            // Scale with intensity for more aggressive response
            const trebleEnhanceFactor = intensity === 'aggressive' ? 16 : intensity === 'normal' ? 12 : 10;
            const trebleEnhance = (trebleWeight - 0.18) * trebleEnhanceFactor;

            const trebleCap = intensity === 'aggressive' ? 6 : intensity === 'normal' ? 5 : 4;

            adjustments[9] = Math.min(trebleCap * 0.75, trebleEnhance * 0.9) * multiplier;
            adjustments[10] = Math.min(trebleCap, trebleEnhance * 1.0) * multiplier;
            adjustments[11] = Math.min(trebleCap * 0.75, trebleEnhance * 0.8) * multiplier;
            eq.log(`[Adaptive] Treble prominent (${(trebleWeight*100).toFixed(1)}%), enhancing ${adjustments[10].toFixed(2)}dB`);
        } else if (trebleWeight < 0.10) {
            // Treble is weak - add air
            const trebleBoostFactor = intensity === 'aggressive' ? 12 : intensity === 'normal' ? 10 : 8;
            const trebleBoost = (0.10 - trebleWeight) * trebleBoostFactor;

            const weakTrebleCap = intensity === 'aggressive' ? 5 : intensity === 'normal' ? 4 : 3;

            adjustments[9] = Math.min(weakTrebleCap * 0.85, trebleBoost * 0.9) * multiplier;
            adjustments[10] = Math.min(weakTrebleCap, trebleBoost * 1.0) * multiplier;
            eq.log(`[Adaptive] Treble weak (${(trebleWeight*100).toFixed(1)}%), adding air ${adjustments[10].toFixed(2)}dB`);
        }

        // MIDS: Intelligent handling - don't scoop lower mids when bass is dominant
        if (midWeight < 0.20) {
            // Mids are weak - add body
            // Scale with intensity
            const midBoostFactor = intensity === 'aggressive' ? 10 : intensity === 'normal' ? 8 : 6;
            const midBoost = (0.20 - midWeight) * midBoostFactor;

            const midBoostCap = intensity === 'aggressive' ? 4 : intensity === 'normal' ? 3 : 2;

            // Use += to not overwrite bass adjustments to 500Hz
            adjustments[4] += Math.min(midBoostCap * 0.8, midBoost * 0.8) * multiplier;  // 500Hz
            adjustments[5] += Math.min(midBoostCap, midBoost * 1.0) * multiplier;        // 1kHz
            eq.log(`[Adaptive] Mids thin (${(midWeight*100).toFixed(1)}%), adding body ${adjustments[5].toFixed(2)}dB`);
        } else if (midWeight > 0.35 && bassWeight < 0.35) {
            // Mids are too strong AND bass is NOT dominant - scoop higher mids only
            // Don't scoop when bass is dominant because lower mids support bass
            const midCutFactor = intensity === 'aggressive' ? 8 : intensity === 'normal' ? 6 : 5;
            const midCut = (midWeight - 0.35) * midCutFactor;

            const midCutCap = intensity === 'aggressive' ? 3 : intensity === 'normal' ? 2 : 1.5;

            // Focus scoop on higher mids (1kHz), be gentler on 500Hz since it can support bass
            adjustments[4] += -Math.min(midCutCap * 0.5, midCut * 0.5) * multiplier;  // 500Hz - gentle
            adjustments[5] += -Math.min(midCutCap, midCut) * multiplier;              // 1kHz - main scoop
            eq.log(`[Adaptive] Mids heavy (${(midWeight*100).toFixed(1)}%), bass not dominant, scooping ${adjustments[5].toFixed(2)}dB`);
        } else if (midWeight > 0.35 && bassWeight >= 0.35) {
            // Both bass and mids are strong - only scoop 1kHz to make room, leave 500Hz for bass support
            const midCutFactor = intensity === 'aggressive' ? 6 : intensity === 'normal' ? 5 : 4;
            const midCut = (midWeight - 0.35) * midCutFactor;

            const midCutCap = intensity === 'aggressive' ? 2.5 : intensity === 'normal' ? 1.5 : 1;

            adjustments[5] += -Math.min(midCutCap, midCut) * multiplier;  // Only 1kHz
            eq.log(`[Adaptive] Mids heavy (${(midWeight*100).toFixed(1)}%), bass dominant, scooping 1kHz only ${adjustments[5].toFixed(2)}dB`);
        }

        // STABILITY ADJUSTMENTS: Prevent drowning when one frequency dominates
        // If bass is very dominant (>40%), raise vocals/treble slightly to maintain presence
        if (bassWeight > 0.40 && !vocalsDominant) {
            const stabilityBoost = (bassWeight - 0.40) * 3;
            adjustments[6] += Math.min(1.5, stabilityBoost) * multiplier; // Raise vocals
            adjustments[7] += Math.min(1.5, stabilityBoost) * multiplier;
            adjustments[10] += Math.min(1, stabilityBoost * 0.7) * multiplier; // Raise treble
            eq.log(`[Adaptive] Bass very dominant (${(bassWeight*100).toFixed(1)}%), raising vocals/treble for stability`);
        }

        // If vocals are very dominant (>30%), raise bass/treble slightly for fullness
        if (vocalWeight > 0.30 && !bassDominant) {
            const stabilityBoost = (vocalWeight - 0.30) * 3;
            adjustments[1] += Math.min(1.5, stabilityBoost) * multiplier; // Raise bass
            adjustments[10] += Math.min(1, stabilityBoost * 0.8) * multiplier; // Raise treble
            eq.log(`[Adaptive] Vocals very dominant (${(vocalWeight*100).toFixed(1)}%), raising bass/treble for fullness`);
        }

        // If both bass and vocals are strong, ensure treble/mids don't disappear
        if (bothBassAndVocalsDominant) {
            if (trebleWeight < 0.12) {
                adjustments[10] += 1.2 * multiplier; // Ensure treble presence
            }
            if (midWeight < 0.20) {
                adjustments[5] += 0.8 * multiplier; // Ensure mid presence
            }
            eq.log(`[Adaptive] Both bass and vocals strong, maintaining treble/mid stability`);
        }

        // Genre is INFORMATIONAL ONLY - no EQ adjustments based on genre
        if (genre) {
            eq.log(`[Adaptive] Genre detected: ${genre} (informational only, not affecting EQ)`);
        }

        // Quiet passage enhancement - use average of bass and mids
        const avgLowFreq = (bassLevel + midLevel) / 2;
        if (avgLowFreq < 30) {
            adjustments.forEach((_, i) => {
                adjustments[i] += 0.5 * multiplier;
            });
            eq.log(`[Adaptive] Quiet passage detected (${avgLowFreq.toFixed(1)}), gentle boost`);
        }

        // Log overall adjustment summary
        const totalAdjustment = adjustments.reduce((sum, val) => sum + Math.abs(val), 0);
        if (totalAdjustment > 1) {
            eq.log(`[Adaptive] Total adjustment: ${totalAdjustment.toFixed(2)}dB | Bass=${bassLevel.toFixed(1)} Mid=${midLevel.toFixed(1)} Treble=${trebleLevel.toFixed(1)} Vocal=${vocalLevel.toFixed(1)}`);
        }

        // Store stats for dev menu
        eq._devStats = eq._devStats || {};
        eq._devStats.bassStatus = bassWeight > 0.35 ? 'dominant' : bassWeight < 0.20 ? 'weak' : 'balanced';
        eq._devStats.vocalStatus = vocalWeight > 0.25 ? 'prominent' : vocalWeight < 0.15 ? 'buried' : 'balanced';
        eq._devStats.trebleStatus = trebleWeight > 0.18 ? 'prominent' : trebleWeight < 0.10 ? 'weak' : 'balanced';
        eq._devStats.midStatus = midWeight > 0.35 ? 'heavy' : midWeight < 0.20 ? 'thin' : 'balanced';
        eq._devStats.bassWeight = bassWeight;
        eq._devStats.vocalWeight = vocalWeight;
        eq._devStats.trebleWeight = trebleWeight;
        eq._devStats.midWeight = midWeight;
        eq._devStats.appliedBass = adjustments[1];
        eq._devStats.appliedLowerMid = adjustments[4];  // 500Hz
        eq._devStats.appliedHigherMid = adjustments[5]; // 1kHz
        eq._devStats.appliedTreble = adjustments[10];
        eq._devStats.appliedVocal = adjustments[7];

        return adjustments;
    }
}

// Initialize the global EQ system
window.dynamicEQ = new DynamicEQ();

// Menu Integration
document.addEventListener('DOMContentLoaded', () => {
    // State management
    let eqEnabled = false;
    let adaptiveEnabled = false;
    let distortLimiterEnabled = false;
    let currentPreset = null;

    // DOM elements
    const mainToggle = document.getElementById('mainToggle');
    const adaptiveToggle = document.getElementById('adaptiveToggle');
    const distortToggle = document.getElementById('distortLimiter');
    const eqContent = document.getElementById('eqContent');
    const eqSliders = document.getElementById('eqSliders');
    const presetOptions = document.querySelectorAll('.preset-option');
    const verticalSliders = document.querySelectorAll('.vertical-slider');
    const intensityOptions = document.getElementById('intensityOptions');

    // Auto-attach to audio elements
    const audioElements = document.querySelectorAll('audio[data-dynamic-eq], audio');
    if (audioElements.length > 0) {
        window.dynamicEQ.attachToAudio(audioElements[0]);
    }

    // Main EQ toggle
    mainToggle?.addEventListener('click', () => {
        eqEnabled = !eqEnabled;
        mainToggle.classList.toggle('active', eqEnabled);
        eqContent?.classList.toggle('enabled', eqEnabled);
        
        if (eqEnabled) {
            window.dynamicEQ.enable();
        } else {
            window.dynamicEQ.disable();
        }
    });

    // Adaptive EQ toggle
    adaptiveToggle?.addEventListener('click', () => {
        adaptiveEnabled = !adaptiveEnabled;
        adaptiveToggle.classList.toggle('active', adaptiveEnabled);
        eqSliders?.classList.toggle('locked', adaptiveEnabled);

        // Grey out manual EQ canvas when adaptive is enabled
        const eqCanvas = document.getElementById('eqCanvas');
        const manualEQSection = eqCanvas?.closest('.eq-section');

        if (manualEQSection) {
            if (adaptiveEnabled) {
                // Grey out manual EQ
                manualEQSection.style.opacity = '0.4';
                manualEQSection.style.pointerEvents = 'none';
                manualEQSection.style.filter = 'grayscale(0.5)';
            } else {
                // Un-grey manual EQ
                manualEQSection.style.opacity = '1';
                manualEQSection.style.pointerEvents = 'auto';
                manualEQSection.style.filter = 'none';
            }
        }

        // Show/hide intensity options
        if (intensityOptions) {
            intensityOptions.style.display = adaptiveEnabled ? 'flex' : 'none';
        }

        window.dynamicEQ.setAdaptiveMode(adaptiveEnabled, currentPreset);

        if (!adaptiveEnabled) {
            // Clear preset selection
            presetOptions.forEach(option => option.classList.remove('active'));
            currentPreset = null;
            window.dynamicEQ.currentPreset = null;
            // Manual EQ settings are automatically restored in setAdaptiveMode()
        }
    });
    
    // Distortion Limiter toggle
    distortToggle?.addEventListener('click', () => {
        distortLimiterEnabled = !distortLimiterEnabled;
        distortToggle.classList.toggle('active', distortLimiterEnabled);
        
        window.dynamicEQ.setDistortionLimiter(distortLimiterEnabled);
        
        // Update button text to show status
        if (distortToggle) {
            distortToggle.textContent = `Distortion Limiter: ${distortLimiterEnabled ? 'ON' : 'OFF'}`;
        }
    });

    // Adaptive intensity options - now works for all modes
    const intensityButtons = document.querySelectorAll('[data-intensity]');

    intensityButtons.forEach(button => {
        button.addEventListener('click', () => {
            if (!adaptiveEnabled || !currentPreset) {
                console.warn('[Intensity] Cannot change intensity - adaptive mode must be enabled and a preset selected');
                return;
            }

            // Remove active from all intensity options
            intensityButtons.forEach(btn => btn.classList.remove('active'));

            // Add active to clicked option
            button.classList.add('active');

            // Set adaptive intensity
            const intensity = button.dataset.intensity;
            window.dynamicEQ.setAdaptiveIntensity(intensity);

            window.dynamicEQ.log(`[Intensity] Set to: ${intensity.toUpperCase()}`);
        });
    });

    // Initialize intensity display visibility
    if (intensityOptions) {
        intensityOptions.style.display = 'none'; // Hidden until a preset is selected
    }

    // Preset selection (bass, vocals, chill, adaptive)
    presetOptions.forEach(option => {
        option.addEventListener('click', () => {
            if (!adaptiveEnabled) return;
            
            // Remove active from all options
            presetOptions.forEach(opt => opt.classList.remove('active'));
            
            // Add active to clicked option
            option.classList.add('active');
            
            // Store preset and enable intensity options
            const preset = option.dataset.preset;
            currentPreset = preset;
            window.dynamicEQ.currentPreset = preset;

            // Show intensity options for ALL adaptive modes
            if (intensityOptions) {
                intensityOptions.style.display = 'flex';

                // Set default intensity to normal if none selected
                if (!document.querySelector('[data-intensity].active')) {
                    const normalBtn = document.querySelector('[data-intensity="normal"]');
                    if (normalBtn) {
                        normalBtn.classList.add('active');
                        window.dynamicEQ.setAdaptiveIntensity('normal');
                    }
                }
            }

            window.dynamicEQ.log(`${preset} mode selected - Dynamic EQ will adapt for ${preset}`);
        });
    });

    // Update gain value display
    function updateGainValue(slider) {
        const gainValue = slider.parentElement.nextElementSibling;
        if (gainValue) {
            const value = parseFloat(slider.value);
            const sign = value >= 0 ? '+' : '';
            gainValue.textContent = `${sign}${value} dB`;
        }
    }

    // Slider change events
    verticalSliders.forEach((slider) => {
        slider.addEventListener('input', () => {
            if (!adaptiveEnabled) {
                updateGainValue(slider);

                // Get all slider values and apply to EQ
                const gains = Array.from(verticalSliders).map(s => parseFloat(s.value));
                window.dynamicEQ.setManualGains(gains);
            }
        });

        // Initialize gain values
        updateGainValue(slider);
    });

    // Prevent slider changes when adaptive mode is enabled
    verticalSliders.forEach(slider => {
        slider.addEventListener('mousedown', (e) => {
            if (adaptiveEnabled) {
                e.preventDefault();
            }
        });
    });

    // Status display update (optional)
    setInterval(() => {
        const status = window.dynamicEQ.getStatus();
        
        // Update status display if exists
        const statusDisplay = document.getElementById('eqStatus');
        if (statusDisplay && status.active) {
            statusDisplay.innerHTML = `
                Genre: ${status.genre || 'Detecting...'} | 
                BPM: ${status.bpm || '--'} | 
                Bass: ${status.levels.bass} | 
                Mid: ${status.levels.mid} | 
                Treble: ${status.levels.treble} | 
                Vocal: ${status.levels.vocal}
            `;
        }
    }, 500);
});

// Global helper functions
window.attachEQToAudio = function(audioElement) {
    return window.dynamicEQ.attachToAudio(audioElement);
};
// Global function for toggling distortion limiter
window.toggleDistortionLimiter = function (enabled) {
    if (!window.dynamicEQ) {
        console.error("DynamicEQ not initialized.");
        return false;
    }

    window.dynamicEQ.setDistortionLimiter(enabled);
    window.dynamicEQ.log(`Global distortion limiter ${enabled ? 'enabled' : 'disabled'}.`);
    return true;
};
   // Settings menu toggle
   var isopenmenu = false;
   window.togglesetting = function() {
       if(isopenmenu === true) {
           document.body.style.overflow = 'auto';
           document.getElementById('settings-cont').style.opacity = 0;

           setTimeout(() => {
               document.getElementById('settings-cont').style.visibility = 'hidden';
           }, 450);
           isopenmenu = false;
       } else {
           document.body.style.overflow = 'hidden';
           document.getElementById('settings-cont').style.visibility = 'visible';
           document.getElementById('settings-cont').style.opacity = 1;
           isopenmenu = true;
       }
   };
   
window.getEQStatus = function() {
    return window.dynamicEQ.getStatus();
};

// ========================================
// EQ Curve Editor
// ========================================
(function() {
    const canvas = document.getElementById('eqCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const sliders = document.querySelectorAll('#eqSliders .vertical-slider');

    // EQ points data: 10 frequency bands
    const frequencies = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];
    const eqPoints = frequencies.map((freq, i) => ({
        freq,
        gain: 0, // -12 to +12 dB
        index: i
    }));

    let draggingPoint = null;
    let isDragging = false;

    // Draw the EQ curve
    function drawEQ() {
        const width = canvas.width;
        const height = canvas.height;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Draw background grid
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;

        // Horizontal grid lines (dB levels)
        for (let i = 0; i <= 6; i++) {
            const y = (i / 6) * height;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        // Vertical grid lines (frequency bands)
        for (let i = 0; i <= 10; i++) {
            const x = (i / 9) * width;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }

        // Draw center line (0 dB)
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw dB labels
        ctx.fillStyle = '#666';
        ctx.font = '10px monospace';
        ctx.textAlign = 'right';
        ctx.fillText('+12dB', width - 5, 15);
        ctx.fillText('0dB', width - 5, height / 2 + 4);
        ctx.fillText('-12dB', width - 5, height - 5);

        // Calculate curve points
        const curvePoints = eqPoints.map((point, i) => {
            const x = (i / (eqPoints.length - 1)) * width;
            // Convert gain (-12 to +12) to y position (height to 0)
            const normalizedGain = (point.gain + 12) / 24; // 0 to 1
            const y = height - (normalizedGain * height);
            return { x, y };
        });

        // Draw smooth curve using bezier curves
        if (curvePoints.length > 1) {
            ctx.strokeStyle = '#00ffaa';
            ctx.lineWidth = 3;
            ctx.shadowColor = '#00ffaa';
            ctx.shadowBlur = 10;

            ctx.beginPath();
            ctx.moveTo(curvePoints[0].x, curvePoints[0].y);

            for (let i = 0; i < curvePoints.length - 1; i++) {
                const current = curvePoints[i];
                const next = curvePoints[i + 1];
                const midX = (current.x + next.x) / 2;
                const midY = (current.y + next.y) / 2;

                if (i === 0) {
                    ctx.quadraticCurveTo(current.x, current.y, midX, midY);
                } else {
                    ctx.quadraticCurveTo(current.x, current.y, midX, midY);
                }
            }

            const lastPoint = curvePoints[curvePoints.length - 1];
            ctx.lineTo(lastPoint.x, lastPoint.y);
            ctx.stroke();

            ctx.shadowBlur = 0;
        }

        // Draw gradient fill under curve
        if (curvePoints.length > 1) {
            const gradient = ctx.createLinearGradient(0, 0, 0, height);
            gradient.addColorStop(0, 'rgba(0,255,170,0.2)');
            gradient.addColorStop(1, 'rgba(0,255,170,0.02)');

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.moveTo(curvePoints[0].x, height);
            curvePoints.forEach(p => ctx.lineTo(p.x, p.y));
            ctx.lineTo(curvePoints[curvePoints.length - 1].x, height);
            ctx.closePath();
            ctx.fill();
        }

        // Draw control points
        curvePoints.forEach((point, i) => {
            const isActive = isDragging === i;

            // Outer glow
            ctx.shadowColor = '#00ffaa';
            ctx.shadowBlur = isActive ? 20 : 10;

            // Point circle
            ctx.fillStyle = isActive ? '#00ffaa' : '#00dd88';
            ctx.beginPath();
            ctx.arc(point.x, point.y, isActive ? 8 : 6, 0, Math.PI * 2);
            ctx.fill();

            // Inner circle
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.beginPath();
            ctx.arc(point.x, point.y, isActive ? 3 : 2, 0, Math.PI * 2);
            ctx.fill();

            ctx.shadowBlur = 0;

            // Show gain value only when actively dragging
            if (isDragging === i) {
                ctx.fillStyle = '#00ffaa';
                ctx.font = 'bold 11px monospace';
                ctx.textAlign = 'center';
                const gainText = (eqPoints[i].gain >= 0 ? '+' : '') + eqPoints[i].gain.toFixed(1) + 'dB';
                ctx.fillText(gainText, point.x, point.y - 15);
            }
        });
    }

    // Get mouse position relative to canvas
    function getMousePos(e) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }

    // Find closest point to mouse
    function findClosestPoint(mouseX, mouseY) {
        const width = canvas.width;
        const height = canvas.height;

        for (let i = 0; i < eqPoints.length; i++) {
            const x = (i / (eqPoints.length - 1)) * width;
            const normalizedGain = (eqPoints[i].gain + 12) / 24;
            const y = height - (normalizedGain * height);

            const distance = Math.sqrt(Math.pow(mouseX - x, 2) + Math.pow(mouseY - y, 2));
            if (distance < 15) {
                return i;
            }
        }
        return null;
    }

    // Update slider value
    function updateSlider(index, gain) {
        if (sliders[index]) {
            sliders[index].value = gain;
            // Trigger change event to update actual EQ
            sliders[index].dispatchEvent(new Event('input', { bubbles: true }));
        }
    }

    // Mouse events
    canvas.addEventListener('mousedown', (e) => {
        // Prevent interaction when adaptive mode is enabled
        if (window.dynamicEQ && window.dynamicEQ.adaptiveMode) return;

        const pos = getMousePos(e);
        const pointIndex = findClosestPoint(pos.x, pos.y);
        if (pointIndex !== null) {
            draggingPoint = pointIndex;
            isDragging = pointIndex;
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        const pos = getMousePos(e);

        if (isDragging !== false && draggingPoint !== null) {
            // Only update gain if actively dragging (mouse is down)
            const height = canvas.height;
            const normalizedY = 1 - (pos.y / height); // 0 to 1
            let gain = (normalizedY * 24) - 12; // -12 to +12

            // Clamp gain
            gain = Math.max(-12, Math.min(12, gain));

            // Round to 0.5
            gain = Math.round(gain * 2) / 2;

            eqPoints[draggingPoint].gain = gain;
            updateSlider(draggingPoint, gain);
            drawEQ();
        } else {
            // Just check for hover to change cursor
            const hoverPoint = findClosestPoint(pos.x, pos.y);
            if (hoverPoint !== null) {
                canvas.style.cursor = 'pointer';
            } else {
                canvas.style.cursor = 'default';
            }
        }
    });

    canvas.addEventListener('mouseup', () => {
        draggingPoint = null;
        isDragging = false;
    });

    canvas.addEventListener('mouseleave', () => {
        draggingPoint = null;
        isDragging = false;
        drawEQ();
    });

    // Listen to slider changes to update curve
    sliders.forEach((slider, i) => {
        slider.addEventListener('input', () => {
            eqPoints[i].gain = parseFloat(slider.value);
            drawEQ();
        });
    });

    // Initial draw
    drawEQ();

    // Redraw on window resize
    window.addEventListener('resize', drawEQ);
})();

// Reset EQ function
window.resetEQ = function() {
    const sliders = document.querySelectorAll('#eqSliders .vertical-slider');
    sliders.forEach(slider => {
        slider.value = 0;
        slider.dispatchEvent(new Event('input', { bubbles: true }));
    });
};

// ========================================
// Distortion Limiter Toggle and Status
// ========================================
(function() {
    let distortionEnabled = false;
    const distToggle = document.getElementById('distoggle');
    const distSlider = distToggle?.querySelector('.toggle-slider');
    const distCircle = document.getElementById('distcircle');
    const distStatus = document.getElementById('distortionStatus');
    const distStatusText = document.getElementById('distStatus');
    const distTotalBoost = document.getElementById('distTotalBoost');
    const distThreshold = document.getElementById('distThreshold');
    const distProgressBar = document.getElementById('distProgressBar');

    // Toggle click handler
    distToggle?.addEventListener('click', () => {
        distortionEnabled = !distortionEnabled;

        // Update toggle appearance
        if (distortionEnabled) {
            distSlider.style.transform = 'translateX(24px)';
            distToggle.style.background = 'rgba(0,255,170,0.3)';
            distToggle.style.borderColor = 'rgba(0,255,170,0.5)';
        } else {
            distSlider.style.transform = 'translateX(0)';
            distToggle.style.background = 'rgba(255,255,255,0.1)';
            distToggle.style.borderColor = 'rgba(255,255,255,0.2)';
        }

        // Update status circle
        if (distortionEnabled) {
            distCircle.style.background = '#00ffaa';
            distCircle.style.boxShadow = '0 0 12px rgba(0,255,170,0.8)';
        } else {
            distCircle.style.background = '#666';
            distCircle.style.boxShadow = '0 0 8px rgba(255,102,102,0.5)';
        }

        // Show/hide status display
        if (distortionEnabled) {
            distStatus.style.display = 'block';
        } else {
            distStatus.style.display = 'none';
        }

        // Call the global toggle function
        if (typeof window.toggleDistortionLimiter === 'function') {
            window.toggleDistortionLimiter(distortionEnabled);
        }
    });

    // Update distortion status display
    function updateDistortionStatus() {
        if (!distortionEnabled || !window.dynamicEQ) return;

        const eq = window.dynamicEQ;

        // Get current adjustments to calculate total boost
        if (eq._lastAdjustments && eq._lastAdjustments.length > 0) {
            const totalBoost = eq._lastAdjustments.reduce((sum, gain) => sum + Math.max(0, gain), 0);

            // Calculate threshold based on mode and intensity
            let threshold = 20;
            if (eq.currentPreset === 'bass') threshold = 15;
            if (eq.currentPreset === 'vocals') threshold = 18;
            if (eq.adaptiveIntensity === 'aggressive') threshold *= 0.8;
            if (eq.adaptiveIntensity === 'chill') threshold *= 1.2;

            // Update status
            const isLimiting = totalBoost > threshold;
            if (distStatusText) {
                distStatusText.textContent = isLimiting ? 'Limiting' : 'Active';
                distStatusText.style.color = isLimiting ? '#ff6666' : '#00ffaa';
            }

            // Update total boost
            if (distTotalBoost) {
                distTotalBoost.textContent = '+' + totalBoost.toFixed(1) + 'dB';
                distTotalBoost.style.color = isLimiting ? '#ff6666' : '#00ffaa';
            }

            // Update threshold
            if (distThreshold) {
                distThreshold.textContent = threshold.toFixed(0) + 'dB';
            }

            // Update progress bar
            if (distProgressBar) {
                const percentage = Math.min(100, (totalBoost / threshold) * 100);
                distProgressBar.style.width = percentage + '%';
            }
        }
    }

    // Monitor distortion status every 100ms when enabled
    setInterval(() => {
        if (distortionEnabled) {
            updateDistortionStatus();
        }
    }, 100);
})();

// Auto-start function

var alreadyon = false
window.starteq = function() {
        if(alreadyon===false) {
            mainToggle.classList.add('active');
            eqContent?.classList.add('enabled');
            window.dynamicEQ.enable();
            alreadyon=true
        }
}

// Debug helper function
window.debugEQ = function() {
    console.log('========== EQ DEBUG INFO ==========');
    console.log('EQ exists:', !!window.dynamicEQ);
    if (window.dynamicEQ) {
        console.log('Is Active:', window.dynamicEQ.isActive);
        console.log('Adaptive Mode:', window.dynamicEQ.adaptiveMode);
        console.log('Current Preset:', window.dynamicEQ.currentPreset);
        console.log('Logging Enabled:', window.dynamicEQ.loggingEnabled);
        console.log('Audio Element:', window.dynamicEQ.audioElement);
        console.log('Source Node:', window.dynamicEQ.sourceNode);
        console.log('Analyser Node:', window.dynamicEQ.analyserNode);
        console.log('Filters:', window.dynamicEQ.filters.length);
        console.log('Analysis Interval:', window.dynamicEQ.analysisInterval);
        console.log('Wired:', window.dynamicEQ._wired);
        console.log('Current Levels:', {
            bass: window.dynamicEQ.bassLevel,
            mid: window.dynamicEQ.midLevel,
            treble: window.dynamicEQ.trebleLevel,
            vocal: window.dynamicEQ.vocalLevel
        });
    }
    console.log('===================================');
};

// Start EQ logging
window.startLoggingEQ = function() {
    if (window.dynamicEQ) {
        window.dynamicEQ.loggingEnabled = true;
        console.log('[EQ] Logging enabled - EQ will now log detailed information');
    } else {
        console.log('[EQ] Error: dynamicEQ not initialized');
    }
};

// Stop EQ logging
window.stopLoggingEQ = function() {
    if (window.dynamicEQ) {
        window.dynamicEQ.loggingEnabled = false;
        console.log('[EQ] Logging disabled');
    }
};

// Dev Menu Controls
let devMenuVisible = false;
const devMenu = document.getElementById('devMenu');

// Toggle dev menu with backslash key
document.addEventListener('keydown', (e) => {
    if (e.key === '\\') {
        e.preventDefault();
        devMenuVisible = !devMenuVisible;
        if (devMenu) {
            devMenu.style.display = devMenuVisible ? 'block' : 'none';
            if (devMenuVisible) {
                window.dynamicEQ.log('[Dev Menu] Opened');
                startDevMenuUpdates();
            } else {
                window.dynamicEQ.log('[Dev Menu] Closed');
            }
        }
    }
});

// Update dev menu with real-time stats
function updateDevMenu() {
    if (!devMenuVisible || !window.dynamicEQ) return;

    const eq = window.dynamicEQ;
    const stats = eq._devStats || {};

    // Mode and Genre
    document.getElementById('devMode').textContent = eq.currentPreset || 'None';
    document.getElementById('devMode').style.color = eq.adaptiveMode ? '#00ff00' : '#ff0000';

    // Intensity
    const intensityText = eq.adaptiveIntensity || 'normal';
    document.getElementById('devIntensity').textContent = intensityText.toUpperCase();
    document.getElementById('devIntensity').style.color =
        intensityText === 'aggressive' ? '#ff0000' :
        intensityText === 'chill' ? '#00ffff' : '#00ff00';

    const genreText = eq.genreDetector?.dominantGenre || 'None';
    document.getElementById('devGenre').textContent = genreText;
    document.getElementById('devGenre').style.color = genreText !== 'None' ? '#ffff00' : '#888';

    // Current Levels
    document.getElementById('devBassLevel').textContent = eq.bassLevel.toFixed(1);
    document.getElementById('devMidLevel').textContent = eq.midLevel.toFixed(1);
    document.getElementById('devTrebleLevel').textContent = eq.trebleLevel.toFixed(1);
    document.getElementById('devVocalLevel').textContent = eq.vocalLevel.toFixed(1);

    // Detection Status with color coding
    const bassStatus = stats.bassStatus || '-';
    const bassEl = document.getElementById('devBassStatus');
    bassEl.textContent = bassStatus;
    bassEl.style.color = bassStatus === 'weak' || bassStatus === 'slightly weak' ? '#ff6600' :
                          bassStatus === 'strong' ? '#ff0000' : '#00ff00';

    const midStatus = stats.midStatus || '-';
    const midEl = document.getElementById('devMidStatus');
    midEl.textContent = midStatus;
    midEl.style.color = midStatus === 'weak' ? '#ff6600' : midStatus === 'strong' ? '#ff0000' : '#00ff00';

    const trebleStatus = stats.trebleStatus || '-';
    const trebleEl = document.getElementById('devTrebleStatus');
    trebleEl.textContent = trebleStatus;
    trebleEl.style.color = trebleStatus === 'weak' ? '#ff6600' :
                            trebleStatus === 'harsh' ? '#ff0000' : '#00ff00';

    const vocalStatus = stats.vocalStatus || '-';
    const vocalEl = document.getElementById('devVocalStatus');
    vocalEl.textContent = vocalStatus;
    vocalEl.style.color = vocalStatus === 'buried' ? '#ff6600' :
                           vocalStatus === 'loud' ? '#ff0000' : '#00ff00';

    // Applied Adjustments with color coding
    const formatAdjustment = (val) => {
        if (!val && val !== 0) return '-';
        const sign = val >= 0 ? '+' : '';
        return `${sign}${val.toFixed(2)}dB`;
    };

    const appliedBass = stats.appliedBass;
    const bassAdjEl = document.getElementById('devAppliedBass');
    bassAdjEl.textContent = formatAdjustment(appliedBass);
    bassAdjEl.style.color = appliedBass > 0 ? '#00ff00' : appliedBass < 0 ? '#ff6600' : '#888';

    const appliedLowerMid = stats.appliedLowerMid || stats.appliedMid; // Fallback to old appliedMid
    const lowerMidAdjEl = document.getElementById('devAppliedLowerMid');
    lowerMidAdjEl.textContent = formatAdjustment(appliedLowerMid);
    lowerMidAdjEl.style.color = appliedLowerMid > 0 ? '#00ff00' : appliedLowerMid < 0 ? '#ff6600' : '#888';

    const appliedHigherMid = stats.appliedHigherMid || stats.appliedMid; // Fallback to old appliedMid
    const higherMidAdjEl = document.getElementById('devAppliedHigherMid');
    higherMidAdjEl.textContent = formatAdjustment(appliedHigherMid);
    higherMidAdjEl.style.color = appliedHigherMid > 0 ? '#00ff00' : appliedHigherMid < 0 ? '#ff6600' : '#888';

    const appliedTreble = stats.appliedTreble;
    const trebleAdjEl = document.getElementById('devAppliedTreble');
    trebleAdjEl.textContent = formatAdjustment(appliedTreble);
    trebleAdjEl.style.color = appliedTreble > 0 ? '#00ff00' : appliedTreble < 0 ? '#ff6600' : '#888';

    const appliedVocal = stats.appliedVocal;
    const vocalAdjEl = document.getElementById('devAppliedVocal');
    vocalAdjEl.textContent = formatAdjustment(appliedVocal);
    vocalAdjEl.style.color = appliedVocal > 0 ? '#00ff00' : appliedVocal < 0 ? '#ff6600' : '#888';
}

let devMenuInterval;
function startDevMenuUpdates() {
    if (devMenuInterval) return;
    devMenuInterval = setInterval(updateDevMenu, 50); // Update every 50ms
}

// Start updates when page loads if menu is visible
if (devMenuVisible) {
    startDevMenuUpdates();
}

// Export for module environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DynamicEQ, dynamicEQ: window.dynamicEQ };
}