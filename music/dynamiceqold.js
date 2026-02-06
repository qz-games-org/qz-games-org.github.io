
/*
// Integrated Dynamic EQ System with Menu Controls
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
        
        // Analysis data
        this.frequencyData = null;
        this.bassLevel = 0;
        this.midLevel = 0;
        this.trebleLevel = 0;
        this.analysisInterval = null;
        
        // Adaptive history
        this.adaptiveHistory = [];
        this.historySize = 100;
        
        // EQ frequency bands (Hz)
        this.frequencies = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];
        
        // Connection state
        this._wired = false;
        this._tapConnected = false;
        
        this.init();
    }
    
    init() {
        // don't create an AudioContext here
        this.frequencyData = null;
        // leave analyser/filters/gain uninitialized until we know the shared ctx
    }
      
    buildNodes(ctx) {
        // (re)create everything in the shared AudioContext
        this.analyserNode = ctx.createAnalyser();
        this.analyserNode.fftSize = 2048;
        this.analyserNode.smoothingTimeConstant = 0.8;
      
        this.filters = [];
        this.frequencies.forEach((freq, index) => {
            const f = ctx.createBiquadFilter();
            if (index === 0) f.type = 'lowshelf';
            else if (index === this.frequencies.length - 1) f.type = 'highshelf';
            else { 
                f.type = 'peaking'; 
                f.Q.setValueAtTime(0.7, ctx.currentTime); // Lower Q to reduce distortion
            }
            f.frequency.setValueAtTime(freq, ctx.currentTime);
            f.gain.setValueAtTime(0, ctx.currentTime);
            this.filters.push(f);
        });
      
        this.gainNode = ctx.createGain();
        this.gainNode.gain.setValueAtTime(1, ctx.currentTime);
      
        this.frequencyData = new Uint8Array(this.analyserNode.frequencyBinCount);
    }
    
    attachToAudio(audioElement) {
        if (!audioElement || !(audioElement instanceof HTMLAudioElement)) {
            console.error('Invalid audio element provided');
            return false;
        }
        
        try {
            // Ensure SharedAudio exists and works
            if (!window.SharedAudio) {
                console.error('SharedAudio not available');
                return false;
            }
            
            const { ctx, source, masterGain } = window.SharedAudio.get(audioElement);
            
            if (!ctx || !source || !masterGain) {
                console.error('SharedAudio returned invalid objects');
                return false;
            }
      
            // if first time or context changed, rebuild nodes for the shared ctx
            if (this.audioContext !== ctx) {
                this.audioContext = ctx;
                this.buildNodes(ctx);
                this._wired = false;
                this._tapConnected = false;
            }
      
            this.audioElement = audioElement;
            this.sourceNode = source;
      
            // Connect analysis tap (parallel connection for frequency analysis)
            if (!this._tapConnected) {
                this.sourceNode.connect(this.analyserNode);
                this._tapConnected = true;
            }
            
            // DON'T connect EQ chain here - let audio flow directly until EQ is enabled
            console.log('Dynamic EQ attached successfully');
            console.log('Audio should play normally - EQ is ready but not active');
            return true;
        } catch (error) {
            console.error('Failed to attach to audio element:', error);
            console.error('Make sure SharedAudio is loaded first');
            return false;
        }
    }
    
    enable() {
        if (!this.audioElement || !this.sourceNode) {
            console.error('No audio element attached');
            return false;
        }
        
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        
        // NOW route audio through EQ when enabled
        if (!this._wired) {
            try {
                const { masterGain } = window.SharedAudio.get(this.audioElement);
                
                // Disconnect direct routing first
                this.sourceNode.disconnect(masterGain);
                
                // Route through EQ chain: source -> filters -> gain -> master
                let head = this.sourceNode;
                this.filters.forEach(f => { 
                    head = head.connect(f); 
                });
                head.connect(this.gainNode).connect(masterGain);
                this._wired = true;
                
                console.log('Audio routed through EQ');
            } catch (error) {
                console.error('Failed to route audio through EQ:', error);
                return false;
            }
        }
        
        this.isActive = true;
        
        if (this.adaptiveMode) {
            this.startAnalysis();
        }
        
        return true;
    }
    
    disable() {
        this.isActive = false;
        this.stopAnalysis();
        this.resetFilters();
        
        // Route audio directly again when disabled
        if (this._wired) {
            try {
                const { masterGain } = window.SharedAudio.get(this.audioElement);
                
                // Disconnect EQ chain
                this.gainNode.disconnect(masterGain);
                this.filters.forEach(f => f.disconnect());
                
                // Reconnect direct routing
                this.sourceNode.connect(masterGain);
                this._wired = false;
                
                console.log('Audio routed directly (EQ bypassed)');
            } catch (error) {
                console.error('Failed to bypass EQ:', error);
            }
        }
    }
    
    setAdaptiveMode(enabled) {
        this.adaptiveMode = enabled;
        
        if (enabled && this.isActive) {
            this.startAnalysis();
        } else {
            this.stopAnalysis();
        }
    }
    
    startAnalysis() {
        if (this.analysisInterval) {
            clearInterval(this.analysisInterval);
        }
        
        this.analysisInterval = setInterval(() => {
            this.analyzeFrequencies();
            this.updateAdaptiveEQ();
            console.log('check')
        }, 1200); // Update every 2 seconds for song section changes
    }
    
    stopAnalysis() {
        if (this.analysisInterval) {
            clearInterval(this.analysisInterval);
            this.analysisInterval = null;
        }
    }
    
    analyzeFrequencies() {
        this.analyserNode.getByteFrequencyData(this.frequencyData);
        
        const sampleRate = this.audioContext.sampleRate;
        const binCount = this.frequencyData.length;
        const binWidth = sampleRate / (2 * binCount);
        
        // Calculate levels for bass, mid, treble
        const bassStart = Math.floor(60 / binWidth);
        const bassEnd = Math.floor(250 / binWidth);
        const midStart = Math.floor(250 / binWidth);
        const midEnd = Math.floor(4000 / binWidth);
        const trebleStart = Math.floor(4000 / binWidth);
        const trebleEnd = Math.min(Math.floor(16000 / binWidth), binCount - 1);
        
        this.bassLevel = this.getAverageLevel(bassStart, bassEnd);
        this.midLevel = this.getAverageLevel(midStart, midEnd);
        this.trebleLevel = this.getAverageLevel(trebleStart, trebleEnd);
        
        // Store in history
        this.adaptiveHistory.push({
            bass: this.bassLevel,
            mid: this.midLevel,
            treble: this.trebleLevel,
            timestamp: Date.now()
        });
        
        if (this.adaptiveHistory.length > this.historySize) {
            this.adaptiveHistory.shift();
        }
    }
    
    getAverageLevel(startBin, endBin) {
        let sum = 0;
        for (let i = startBin; i <= endBin; i++) {
            sum += this.frequencyData[i];
        }
        return sum / (endBin - startBin + 1);
    }
    
    updateAdaptiveEQ() {
        if (this.adaptiveHistory.length < 10) return;
        
        const recentHistory = this.adaptiveHistory.slice(-20);
        const avgBass = recentHistory.reduce((sum, item) => sum + item.bass, 0) / recentHistory.length;
        const avgMid = recentHistory.reduce((sum, item) => sum + item.mid, 0) / recentHistory.length;
        const avgTreble = recentHistory.reduce((sum, item) => sum + item.treble, 0) / recentHistory.length;
        
        // Calculate total energy
        const totalEnergy = avgBass + avgMid + avgTreble;
        
        // Don't make changes during very quiet periods
        if (totalEnergy < 10) return;
        
        // Get the current user-selected preset/mode
        const userMode = this.getUserSelectedMode();
        
        // Apply dynamic adjustments based on user's chosen mode
        this.applyDynamicAdjustments(avgBass, avgMid, avgTreble, userMode);
    }
    
    getUserSelectedMode() {
        // Check which preset the user has selected
        const activePreset = document.querySelector('.preset-option.active');
        if (activePreset) {
            return activePreset.dataset.preset;
        }
        return 'adaptive'; // Default fallback
    }
    
    applyDynamicAdjustments(bassLevel, midLevel, trebleLevel, userMode) {
        const currentTime = this.audioContext.currentTime;
        const transitionTime = 0.5; // Slower transitions to reduce distortion
        
        // Determine what's prominent in the current audio
        const bassRatio = bassLevel / (midLevel + trebleLevel + 1);
        const vocalRatio = midLevel / (bassLevel + trebleLevel + 1);
        
        let adjustments = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; // Default flat
        let adjustmentReason = '';
        
        switch (userMode) {
            case 'adaptive':
                // Automatically focus on whatever is prominent
                if (bassRatio > 0.4 && bassLevel > 25) {
                    // Bass is prominent - gentle bass boost
                    adjustments = [3, 2, 1, 0, -1, 0, 1, 1, 0, 0];
                    adjustmentReason = `bass-heavy content detected (bass: ${bassLevel.toFixed(1)}, ratio: ${bassRatio.toFixed(2)})`;
                } else if (vocalRatio > 0.4 && midLevel > 30) {
                    // Vocals are prominent - gentle vocal boost
                    adjustments = [-2, -1, 1, 2, 3, 2, 1, 0, 0, -1];
                    adjustmentReason = `vocal-heavy content detected (mid: ${midLevel.toFixed(1)}, ratio: ${vocalRatio.toFixed(2)})`;
                } else {
                    // Balanced content - gentle enhancement
                    adjustments = [1, 0, 0, 1, 1, 0, 0, 1, 0, 0];
                    adjustmentReason = `balanced content detected (bass: ${bassLevel.toFixed(1)}, mid: ${midLevel.toFixed(1)})`;
                }
                break;
                
            case 'bass':
                // User wants bass focus - dynamically boost bass when detected
                if (bassLevel > 20) {
                    // Strong bass detected - boost it more (but gently)
                    const bassMultiplier = Math.min(1.5, 1 + (bassLevel - 20) * 0.02);
                    adjustments = [3 * bassMultiplier, 2 * bassMultiplier, 1, 0, -1, 0, 1, 1, 0, 0];
                    adjustmentReason = `strong bass detected, boosting (level: ${bassLevel.toFixed(1)}, multiplier: ${bassMultiplier.toFixed(2)})`;
                } else {
                    // Weak bass - moderate boost to compensate
                    adjustments = [4, 2, 1, 0, 0, 0, 1, 1, 0, 0];
                    adjustmentReason = `weak bass detected, compensating (level: ${bassLevel.toFixed(1)})`;
                }
                break;
                
            case 'vocals':
                    // User wants vocal focus - dynamically boost vocals when detected
                    if (midLevel > 25) {
                        // Strong vocals detected - boost them more (but gently)
                        const vocalMultiplier = Math.min(1.3, 1 + (midLevel - 25) * 0.015);
                        adjustments = [-2, -1, 1, 2 * vocalMultiplier, 3 * vocalMultiplier, 2 * vocalMultiplier, 2, 1, 0, 0];
                        adjustmentReason = `strong vocals detected, boosting (level: ${midLevel.toFixed(1)}, multiplier: ${vocalMultiplier.toFixed(2)})`;
                    } else {
                        // Weak vocals - moderate boost to bring them forward
                        adjustments = [-2, 0, 1, 3, 4, 3, 2, 1, 0, -1];
                        adjustmentReason = `weak vocals detected, bringing forward (level: ${midLevel.toFixed(1)})`;
                    }
                    break;
                
            case 'chill':
                // User wants chill mode - gentle, consistent adjustments regardless of content
                if (trebleLevel > 30) {
                    // Reduce harsh treble when detected
                    adjustments = [2, 1, 0, 0, 1, 0, -1, -2, -1, -1];
                    adjustmentReason = `harsh treble detected, smoothing (level: ${trebleLevel.toFixed(1)})`;
                } else {
                    // Standard chill curve
                    adjustments = [2, 1, 0, 0, 1, 0, -1, -1, 0, 0];
                    adjustmentReason = `maintaining chill profile (treble: ${trebleLevel.toFixed(1)})`;
                }
                break;
                
            case 'rock':
                // Dynamic rock adjustments
                if (bassLevel > 25 && midLevel > 25) {
                    adjustments = [3, 2, 0, -1, 1, 2, 3, 3, 2, 1];
                    adjustmentReason = `high-energy rock detected (bass: ${bassLevel.toFixed(1)}, mid: ${midLevel.toFixed(1)})`;
                } else {
                    adjustments = [3, 2, -1, -2, 0, 2, 4, 3, 2, 1];
                    adjustmentReason = `standard rock profile applied (bass: ${bassLevel.toFixed(1)}, mid: ${midLevel.toFixed(1)})`;
                }
                break;
                
            case 'electronic':
                // Dynamic electronic adjustments
                if (bassLevel > 30 || trebleLevel > 25) {
                    adjustments = [4, 2, 1, 0, 1, 2, 2, 3, 3, 2];
                    adjustmentReason = `electronic peak detected (bass: ${bassLevel.toFixed(1)}, treble: ${trebleLevel.toFixed(1)})`;
                } else {
                    adjustments = [4, 2, 0, -1, 2, 3, 2, 3, 4, 2];
                    adjustmentReason = `standard electronic profile applied (bass: ${bassLevel.toFixed(1)}, treble: ${trebleLevel.toFixed(1)})`;
                }
                break;
                
            default:
                adjustments = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
                adjustmentReason = 'flat response (no mode selected)';
        }
        
        // Check if adjustments actually changed
        const currentAdjustments = this.filters.map(filter => filter.gain.value);
        const hasChanged = adjustments.some((gain, index) => {
            const limitedGain = Math.max(-6, Math.min(6, gain));
            return Math.abs(limitedGain - currentAdjustments[index]) > 0.1; // 0.1dB threshold
        });
        
        if (hasChanged) {
            console.log(`🎵 EQ Adjustment [${userMode.toUpperCase()}]: ${adjustmentReason}`);
            console.log(`   Levels - Bass: ${bassLevel.toFixed(1)}, Mid: ${midLevel.toFixed(1)}, Treble: ${trebleLevel.toFixed(1)}`);
            console.log(`   Applied: [${adjustments.map(g => g.toFixed(1)).join(', ')}] dB`);
        }
        
        // Apply the dynamic adjustments with limiting to prevent distortion
        adjustments.forEach((gain, index) => {
            if (this.filters[index]) {
                // Limit gains to prevent distortion
                const limitedGain = Math.max(-6, Math.min(6, gain));
                this.filters[index].gain.setTargetAtTime(limitedGain, currentTime, transitionTime);
            }
        });
        
        // Update slider display
        if (this.adaptiveMode) {
            this.updateSliderUI(adjustments);
        }
    }
    
    applyPreset(presetName) {
        const presets = {
            flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            vocal: [-3, -1, 1, 3, 4, 3, 2, 1, 0, -1],
            bass: [6, 4, 2, 0, -1, 0, 1, 2, 1, 0],
            chill: [2, 1, 0, 0, 1, 0, -1, -1, 0, 0],
            rock: [3, 2, -1, -2, 0, 2, 4, 3, 2, 1],
            jazz: [-1, 0, 1, 2, 1, 0, 1, 2, 1, 0],
            electronic: [4, 2, 0, -1, 2, 3, 2, 3, 4, 2],
            classical: [0, 0, 0, 0, -1, -1, 0, 1, 2, 2]
        };
        
        const values = presets[presetName] || presets.flat;
        const currentTime = this.audioContext.currentTime;
        
        values.forEach((gain, index) => {
            if (this.filters[index]) {
                // Limit gains to prevent distortion
                const limitedGain = Math.max(-6, Math.min(6, gain));
                this.filters[index].gain.setTargetAtTime(limitedGain, currentTime, 0.3);
            }
        });
        
        this.currentPreset = presetName;
        
        // Update manual sliders if not in adaptive mode
        if (!this.adaptiveMode) {
            this.updateSliderUI(values);
        }
    }
    
    setManualGains(gains) {
        if (this.adaptiveMode) return; // Don't allow manual changes in adaptive mode
        
        const currentTime = this.audioContext.currentTime;
        
        gains.forEach((gain, index) => {
            if (this.filters[index]) {
                // Limit gains to prevent distortion
                const limitedGain = Math.max(-6, Math.min(6, gain));
                this.filters[index].gain.setTargetAtTime(limitedGain, currentTime, 0.1);
            }
        });
    }
    
    updateSliderUI(values) {
        const verticalSliders = document.querySelectorAll('.vertical-slider');
        verticalSliders.forEach((slider, index) => {
            if (values[index] !== undefined) {
                slider.value = Math.max(-6, Math.min(6, values[index]));
                this.updateGainValueDisplay(slider);
            }
        });
    }
    
    updatePresetUI(presetName) {
        // Only update UI in adaptive mode, otherwise respect user selection
        if (this.getUserSelectedMode() === 'adaptive') {
            const presetOptions = document.querySelectorAll('.preset-option');
            presetOptions.forEach(option => {
                option.classList.remove('active');
                if (option.dataset.preset === presetName) {
                    option.classList.add('active');
                }
            });
        }
    }
    
    updateGainValueDisplay(slider) {
        const gainValue = slider.parentElement.nextElementSibling;
        const value = parseFloat(slider.value);
        const sign = value >= 0 ? '+' : '';
        gainValue.textContent = `${sign}${value} dB`;
    }
    
    resetFilters() {
        if (!this.filters.length) return;
        
        const currentTime = this.audioContext.currentTime;
        this.filters.forEach(filter => {
            filter.gain.setTargetAtTime(0, currentTime, 0.5);
        });
    }
    
    getStatus() {
        return {
            isActive: this.isActive,
            adaptiveMode: this.adaptiveMode,
            currentPreset: this.currentPreset,
            userSelectedMode: this.getUserSelectedMode(),
            bassLevel: Math.round(this.bassLevel),
            midLevel: Math.round(this.midLevel),
            trebleLevel: Math.round(this.trebleLevel)
        };
    }
}

// Initialize the global EQ system
window.dynamicEQ = new DynamicEQ();

// Menu Integration
document.addEventListener('DOMContentLoaded', () => {
    // State management
    let eqEnabled = false;
    let adaptiveEnabled = false;
    let currentPreset = null;

    // DOM elements
    const mainToggle = document.getElementById('mainToggle');
    const adaptiveToggle = document.getElementById('adaptiveToggle');
    const eqContent = document.getElementById('eqContent');
    const eqSliders = document.getElementById('eqSliders');
    const presetOptions = document.querySelectorAll('.preset-option');
    const verticalSliders = document.querySelectorAll('.vertical-slider');

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
        
        window.dynamicEQ.setAdaptiveMode(adaptiveEnabled);
        
        if (!adaptiveEnabled) {
            // Clear preset selection and reset to flat
            presetOptions.forEach(option => option.classList.remove('active'));
            currentPreset = null;
            window.dynamicEQ.currentPreset = null;
            // Reset to flat EQ when disabling adaptive mode
            window.dynamicEQ.applyPreset('flat');
        }
    });

    // Preset selection
    presetOptions.forEach(option => {
        option.addEventListener('click', () => {
            if (!adaptiveEnabled) return;
            
            // Remove active from all options
            presetOptions.forEach(opt => opt.classList.remove('active'));
            
            // Add active to clicked option
            option.classList.add('active');
            
            // Store the user's choice - the EQ will now work in this mode
            const preset = option.dataset.preset;
            currentPreset = preset;
            
            console.log(`User selected ${preset} mode - EQ will dynamically adjust for ${preset} focus`);
        });
    });

    // Update gain value display
    function updateGainValue(slider) {
        const gainValue = slider.parentElement.nextElementSibling;
        const value = parseFloat(slider.value);
        const sign = value >= 0 ? '+' : '';
        gainValue.textContent = `${sign}${value} dB`;
    }

    // Slider change events
    verticalSliders.forEach((slider, index) => {
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

    // Settings menu toggle
    var isopenmenu = false;
    window.togglesetting = function() {
        if(isopenmenu === true) {
            document.body.style.overflow = 'auto';
            document.getElementById('settings-cont').style.opacity = 0;

            setTimeout(() => {
                document.getElementById('settings-cont').style.visibility = 'hidden';
            }, 350);
            isopenmenu = false;
        } else {
            document.body.style.overflow = 'hidden';
            document.getElementById('settings-cont').style.visibility = 'visible';
            document.getElementById('settings-cont').style.opacity = 1;
            isopenmenu = true;
        }
    };
});

// Global helper functions
window.attachEQToAudio = function(audioElement) {
    return window.dynamicEQ.attachToAudio(audioElement);
};

window.getEQStatus = function() {
    return window.dynamicEQ.getStatus();
};


var alreadyon = false
window.starteq = function() {
        if(alreadyon===false) {
            mainToggle.classList.add('active');
            eqContent?.classList.add('enabled');
            window.dynamicEQ.enable();
            alreadyon=true
        }
}
// Export for module environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DynamicEQ, dynamicEQ: window.dynamicEQ };
}

*/

//working before adaptive presets
/*
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
        
        // Analysis data
        this.frequencyData = null;
        this.bassLevel = 0;
        this.midLevel = 0;
        this.trebleLevel = 0;
        this.analysisInterval = null;
        
        // Adaptive history
        this.adaptiveHistory = [];
        this.historySize = 100;
        
        // EQ frequency bands (Hz)
        this.frequencies = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];
        
        // Connection state
        this._wired = false;
        this._tapConnected = false;
        
        this.init();
    }
    
    init() {
        // don't create an AudioContext here
        this.frequencyData = null;
        // leave analyser/filters/gain uninitialized until we know the shared ctx
    }
      
    buildNodes(ctx) {
        // (re)create everything in the shared AudioContext
        this.analyserNode = ctx.createAnalyser();
        this.analyserNode.fftSize = 2048;
        this.analyserNode.smoothingTimeConstant = 0.8;
      
        this.filters = [];
        this.frequencies.forEach((freq, index) => {
            const f = ctx.createBiquadFilter();
            if (index === 0) f.type = 'lowshelf';
            else if (index === this.frequencies.length - 1) f.type = 'highshelf';
            else { 
                f.type = 'peaking'; 
                f.Q.setValueAtTime(0.7, ctx.currentTime); // Lower Q to reduce distortion
            }
            f.frequency.setValueAtTime(freq, ctx.currentTime);
            f.gain.setValueAtTime(0, ctx.currentTime);
            this.filters.push(f);
        });
      
        this.gainNode = ctx.createGain();
        this.gainNode.gain.setValueAtTime(1, ctx.currentTime);
      
        this.frequencyData = new Uint8Array(this.analyserNode.frequencyBinCount);
    }
    
    attachToAudio(audioElement) {
        if (!audioElement || !(audioElement instanceof HTMLAudioElement)) {
            console.error('Invalid audio element provided');
            return false;
        }
        
        try {
            // Ensure SharedAudio exists and works
            if (!window.SharedAudio) {
                console.error('SharedAudio not available');
                return false;
            }
            
            const { ctx, source, masterGain } = window.SharedAudio.get(audioElement);
            
            if (!ctx || !source || !masterGain) {
                console.error('SharedAudio returned invalid objects');
                return false;
            }
      
            // if first time or context changed, rebuild nodes for the shared ctx
            if (this.audioContext !== ctx) {
                this.audioContext = ctx;
                this.buildNodes(ctx);
                this._wired = false;
                this._tapConnected = false;
            }
      
            this.audioElement = audioElement;
            this.sourceNode = source;
      
            // Connect analysis tap (parallel connection for frequency analysis)
            if (!this._tapConnected) {
                this.sourceNode.connect(this.analyserNode);
                this._tapConnected = true;
            }
            
            // DON'T connect EQ chain here - let audio flow directly until EQ is enabled
            console.log('Dynamic EQ attached successfully');
            console.log('Audio should play normally - EQ is ready but not active');
            return true;
        } catch (error) {
            console.error('Failed to attach to audio element:', error);
            console.error('Make sure SharedAudio is loaded first');
            return false;
        }
    }
    
    enable() {
        if (!this.audioElement || !this.sourceNode) {
            console.error('No audio element attached');
            return false;
        }
        
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        
        // NOW route audio through EQ when enabled
        if (!this._wired) {
            try {
                const { masterGain } = window.SharedAudio.get(this.audioElement);
                
                // Disconnect direct routing first
                this.sourceNode.disconnect(masterGain);
                
                // Route through EQ chain: source -> filters -> gain -> master
                let head = this.sourceNode;
                this.filters.forEach(f => { 
                    head = head.connect(f); 
                });
                head.connect(this.gainNode).connect(masterGain);
                this._wired = true;
                
                console.log('Audio routed through EQ');
            } catch (error) {
                console.error('Failed to route audio through EQ:', error);
                return false;
            }
        }
        
        this.isActive = true;
        
        if (this.adaptiveMode) {
            this.startAnalysis();
        }
        
        return true;
    }
    
    disable() {
        this.isActive = false;
        this.stopAnalysis();
        this.resetFilters();
        
        // Route audio directly again when disabled
        if (this._wired) {
            try {
                const { masterGain } = window.SharedAudio.get(this.audioElement);
                
                // Disconnect EQ chain
                this.gainNode.disconnect(masterGain);
                this.filters.forEach(f => f.disconnect());
                
                // Reconnect direct routing
                this.sourceNode.connect(masterGain);
                this._wired = false;
                
                console.log('Audio routed directly (EQ bypassed)');
            } catch (error) {
                console.error('Failed to bypass EQ:', error);
            }
        }
    }
    
    setAdaptiveMode(enabled) {
        this.adaptiveMode = enabled;
        
        if (enabled && this.isActive) {
            this.startAnalysis();
        } else {
            this.stopAnalysis();
        }
    }
    
    startAnalysis() {
        if (this.analysisInterval) {
            clearInterval(this.analysisInterval);
        }
        
        this.analysisInterval = setInterval(() => {
            this.analyzeFrequencies();
            this.updateAdaptiveEQ();
            console.log('check')
        }, 1200); // Update every 2 seconds for song section changes
    }
    
    stopAnalysis() {
        if (this.analysisInterval) {
            clearInterval(this.analysisInterval);
            this.analysisInterval = null;
        }
    }
    
    analyzeFrequencies() {
        this.analyserNode.getByteFrequencyData(this.frequencyData);
        
        const sampleRate = this.audioContext.sampleRate;
        const binCount = this.frequencyData.length;
        const binWidth = sampleRate / (2 * binCount);
        
        // Calculate levels for bass, mid, treble
        const bassStart = Math.floor(60 / binWidth);
        const bassEnd = Math.floor(250 / binWidth);
        const midStart = Math.floor(250 / binWidth);
        const midEnd = Math.floor(4000 / binWidth);
        const trebleStart = Math.floor(4000 / binWidth);
        const trebleEnd = Math.min(Math.floor(16000 / binWidth), binCount - 1);
        
        this.bassLevel = this.getAverageLevel(bassStart, bassEnd);
        this.midLevel = this.getAverageLevel(midStart, midEnd);
        this.trebleLevel = this.getAverageLevel(trebleStart, trebleEnd);
        
        // Store in history
        this.adaptiveHistory.push({
            bass: this.bassLevel,
            mid: this.midLevel,
            treble: this.trebleLevel,
            timestamp: Date.now()
        });
        
        if (this.adaptiveHistory.length > this.historySize) {
            this.adaptiveHistory.shift();
        }
    }
    
    getAverageLevel(startBin, endBin) {
        let sum = 0;
        for (let i = startBin; i <= endBin; i++) {
            sum += this.frequencyData[i];
        }
        return sum / (endBin - startBin + 1);
    }
    
    updateAdaptiveEQ() {
        if (this.adaptiveHistory.length < 10) return;
        
        const recentHistory = this.adaptiveHistory.slice(-20);
        const avgBass = recentHistory.reduce((sum, item) => sum + item.bass, 0) / recentHistory.length;
        const avgMid = recentHistory.reduce((sum, item) => sum + item.mid, 0) / recentHistory.length;
        const avgTreble = recentHistory.reduce((sum, item) => sum + item.treble, 0) / recentHistory.length;
        
        // Calculate total energy
        const totalEnergy = avgBass + avgMid + avgTreble;
        
        // Don't make changes during very quiet periods
        if (totalEnergy < 10) return;
        
        // Get the current user-selected preset/mode
        const userMode = this.getUserSelectedMode();
        
        // Apply dynamic adjustments based on user's chosen mode
        this.applyDynamicAdjustments(avgBass, avgMid, avgTreble, userMode);
    }
    
    getUserSelectedMode() {
        // Check which preset the user has selected
        const activePreset = document.querySelector('.preset-option.active');
        if (activePreset) {
            return activePreset.dataset.preset;
        }
        return 'adaptive'; // Default fallback
    }
    
    applyDynamicAdjustments(bassLevel, midLevel, trebleLevel, userMode) {
        const currentTime = this.audioContext.currentTime;
        const transitionTime = 0.5; // Slower transitions to reduce distortion
        
        // Determine what's prominent in the current audio
        const bassRatio = bassLevel / (midLevel + trebleLevel + 1);
        const vocalRatio = midLevel / (bassLevel + trebleLevel + 1);
        
        let adjustments = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; // Default flat
        let adjustmentReason = '';
        
        switch (userMode) {
            case 'adaptive':
                // Automatically focus on whatever is prominent
                if (bassRatio > 0.4 && bassLevel > 25) {
                    // Bass is prominent - gentle bass boost
                    adjustments = [3, 2, 1, 0, -1, 0, 1, 1, 0, 0];
                    adjustmentReason = `bass-heavy content detected (bass: ${bassLevel.toFixed(1)}, ratio: ${bassRatio.toFixed(2)})`;
                } else if (vocalRatio > 0.4 && midLevel > 30) {
                    // Vocals are prominent - gentle vocal boost
                    adjustments = [-2, -1, 1, 2, 3, 2, 1, 0, 0, -1];
                    adjustmentReason = `vocal-heavy content detected (mid: ${midLevel.toFixed(1)}, ratio: ${vocalRatio.toFixed(2)})`;
                } else {
                    // Balanced content - gentle enhancement
                    adjustments = [1, 0, 0, 1, 1, 0, 0, 1, 0, 0];
                    adjustmentReason = `balanced content detected (bass: ${bassLevel.toFixed(1)}, mid: ${midLevel.toFixed(1)})`;
                }
                break;
                
            case 'bass':
                // User wants bass focus - dynamically boost bass when detected
                if (bassLevel > 20) {
                    // Strong bass detected - boost it more (but gently)
                    const bassMultiplier = Math.min(1.5, 1 + (bassLevel - 20) * 0.02);
                    adjustments = [3 * bassMultiplier, 2 * bassMultiplier, 1, 0, -1, 0, 1, 1, 0, 0];
                    adjustmentReason = `strong bass detected, boosting (level: ${bassLevel.toFixed(1)}, multiplier: ${bassMultiplier.toFixed(2)})`;
                } else {
                    // Weak bass - moderate boost to compensate
                    adjustments = [4, 2, 1, 0, 0, 0, 1, 1, 0, 0];
                    adjustmentReason = `weak bass detected, compensating (level: ${bassLevel.toFixed(1)})`;
                }
                break;
                
            case 'vocals':
                    // User wants vocal focus - dynamically boost vocals when detected
                    if (midLevel > 25) {
                        // Strong vocals detected - boost them more (but gently)
                        const vocalMultiplier = Math.min(1.3, 1 + (midLevel - 25) * 0.015);
                        adjustments = [-2, -1, 1, 2 * vocalMultiplier, 3 * vocalMultiplier, 2 * vocalMultiplier, 2, 1, 0, 0];
                        adjustmentReason = `strong vocals detected, boosting (level: ${midLevel.toFixed(1)}, multiplier: ${vocalMultiplier.toFixed(2)})`;
                    } else {
                        // Weak vocals - moderate boost to bring them forward
                        adjustments = [-2, 0, 1, 3, 4, 3, 2, 1, 0, -1];
                        adjustmentReason = `weak vocals detected, bringing forward (level: ${midLevel.toFixed(1)})`;
                    }
                    break;
                
            case 'chill':
                // User wants chill mode - gentle, consistent adjustments regardless of content
                if (trebleLevel > 30) {
                    // Reduce harsh treble when detected
                    adjustments = [2, 1, 0, 0, 1, 0, -1, -2, -1, -1];
                    adjustmentReason = `harsh treble detected, smoothing (level: ${trebleLevel.toFixed(1)})`;
                } else {
                    // Standard chill curve
                    adjustments = [2, 1, 0, 0, 1, 0, -1, -1, 0, 0];
                    adjustmentReason = `maintaining chill profile (treble: ${trebleLevel.toFixed(1)})`;
                }
                break;
                
            case 'rock':
                // Dynamic rock adjustments
                if (bassLevel > 25 && midLevel > 25) {
                    adjustments = [3, 2, 0, -1, 1, 2, 3, 3, 2, 1];
                    adjustmentReason = `high-energy rock detected (bass: ${bassLevel.toFixed(1)}, mid: ${midLevel.toFixed(1)})`;
                } else {
                    adjustments = [3, 2, -1, -2, 0, 2, 4, 3, 2, 1];
                    adjustmentReason = `standard rock profile applied (bass: ${bassLevel.toFixed(1)}, mid: ${midLevel.toFixed(1)})`;
                }
                break;
                
            case 'electronic':
                // Dynamic electronic adjustments
                if (bassLevel > 30 || trebleLevel > 25) {
                    adjustments = [4, 2, 1, 0, 1, 2, 2, 3, 3, 2];
                    adjustmentReason = `electronic peak detected (bass: ${bassLevel.toFixed(1)}, treble: ${trebleLevel.toFixed(1)})`;
                } else {
                    adjustments = [4, 2, 0, -1, 2, 3, 2, 3, 4, 2];
                    adjustmentReason = `standard electronic profile applied (bass: ${bassLevel.toFixed(1)}, treble: ${trebleLevel.toFixed(1)})`;
                }
                break;
                
            default:
                adjustments = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
                adjustmentReason = 'flat response (no mode selected)';
        }
        
        // Check if adjustments actually changed
        const currentAdjustments = this.filters.map(filter => filter.gain.value);
        const hasChanged = adjustments.some((gain, index) => {
            const limitedGain = Math.max(-6, Math.min(6, gain));
            return Math.abs(limitedGain - currentAdjustments[index]) > 0.1; // 0.1dB threshold
        });
        
        if (hasChanged) {
            console.log(`🎵 EQ Adjustment [${userMode.toUpperCase()}]: ${adjustmentReason}`);
            console.log(`   Levels - Bass: ${bassLevel.toFixed(1)}, Mid: ${midLevel.toFixed(1)}, Treble: ${trebleLevel.toFixed(1)}`);
            console.log(`   Applied: [${adjustments.map(g => g.toFixed(1)).join(', ')}] dB`);
        }
        
        // Apply the dynamic adjustments with limiting to prevent distortion
        adjustments.forEach((gain, index) => {
            if (this.filters[index]) {
                // Limit gains to prevent distortion
                const limitedGain = Math.max(-6, Math.min(6, gain));
                this.filters[index].gain.setTargetAtTime(limitedGain, currentTime, transitionTime);
            }
        });
        
        // Update slider display
        if (this.adaptiveMode) {
            this.updateSliderUI(adjustments);
        }
    }
    
    applyPreset(presetName) {
        const presets = {
            flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            vocal: [-3, -1, 1, 3, 4, 3, 2, 1, 0, -1],
            bass: [6, 4, 2, 0, -1, 0, 1, 2, 1, 0],
            chill: [2, 1, 0, 0, 1, 0, -1, -1, 0, 0],
            rock: [3, 2, -1, -2, 0, 2, 4, 3, 2, 1],
            jazz: [-1, 0, 1, 2, 1, 0, 1, 2, 1, 0],
            electronic: [4, 2, 0, -1, 2, 3, 2, 3, 4, 2],
            classical: [0, 0, 0, 0, -1, -1, 0, 1, 2, 2]
        };
        
        const values = presets[presetName] || presets.flat;
        const currentTime = this.audioContext.currentTime;
        
        values.forEach((gain, index) => {
            if (this.filters[index]) {
                // Limit gains to prevent distortion
                const limitedGain = Math.max(-6, Math.min(6, gain));
                this.filters[index].gain.setTargetAtTime(limitedGain, currentTime, 0.3);
            }
        });
        
        this.currentPreset = presetName;
        
        // Update manual sliders if not in adaptive mode
        if (!this.adaptiveMode) {
            this.updateSliderUI(values);
        }
    }
    
    setManualGains(gains) {
        if (this.adaptiveMode) return; // Don't allow manual changes in adaptive mode
        
        const currentTime = this.audioContext.currentTime;
        
        gains.forEach((gain, index) => {
            if (this.filters[index]) {
                // Limit gains to prevent distortion
                const limitedGain = Math.max(-6, Math.min(6, gain));
                this.filters[index].gain.setTargetAtTime(limitedGain, currentTime, 0.1);
            }
        });
    }
    
    updateSliderUI(values) {
        const verticalSliders = document.querySelectorAll('.vertical-slider');
        verticalSliders.forEach((slider, index) => {
            if (values[index] !== undefined) {
                slider.value = Math.max(-6, Math.min(6, values[index]));
                this.updateGainValueDisplay(slider);
            }
        });
    }
    
    updatePresetUI(presetName) {
        // Only update UI in adaptive mode, otherwise respect user selection
        if (this.getUserSelectedMode() === 'adaptive') {
            const presetOptions = document.querySelectorAll('.preset-option');
            presetOptions.forEach(option => {
                option.classList.remove('active');
                if (option.dataset.preset === presetName) {
                    option.classList.add('active');
                }
            });
        }
    }
    
    updateGainValueDisplay(slider) {
        const gainValue = slider.parentElement.nextElementSibling;
        const value = parseFloat(slider.value);
        const sign = value >= 0 ? '+' : '';
        gainValue.textContent = `${sign}${value} dB`;
    }
    
    resetFilters() {
        if (!this.filters.length) return;
        
        const currentTime = this.audioContext.currentTime;
        this.filters.forEach(filter => {
            filter.gain.setTargetAtTime(0, currentTime, 0.5);
        });
    }
    
    getStatus() {
        return {
            isActive: this.isActive,
            adaptiveMode: this.adaptiveMode,
            currentPreset: this.currentPreset,
            userSelectedMode: this.getUserSelectedMode(),
            bassLevel: Math.round(this.bassLevel),
            midLevel: Math.round(this.midLevel),
            trebleLevel: Math.round(this.trebleLevel)
        };
    }
}

// Initialize the global EQ system
window.dynamicEQ = new DynamicEQ();

// Menu Integration
document.addEventListener('DOMContentLoaded', () => {
    // State management
    let eqEnabled = false;
    let adaptiveEnabled = false;
    let currentPreset = null;

    // DOM elements
    const mainToggle = document.getElementById('mainToggle');
    const adaptiveToggle = document.getElementById('adaptiveToggle');
    const eqContent = document.getElementById('eqContent');
    const eqSliders = document.getElementById('eqSliders');
    const presetOptions = document.querySelectorAll('.preset-option');
    const verticalSliders = document.querySelectorAll('.vertical-slider');

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
        
        window.dynamicEQ.setAdaptiveMode(adaptiveEnabled);
        
        if (!adaptiveEnabled) {
            // Clear preset selection and reset to flat
            presetOptions.forEach(option => option.classList.remove('active'));
            currentPreset = null;
            window.dynamicEQ.currentPreset = null;
            // Reset to flat EQ when disabling adaptive mode
            window.dynamicEQ.applyPreset('flat');
        }
    });

    // Preset selection
    presetOptions.forEach(option => {
        option.addEventListener('click', () => {
            if (!adaptiveEnabled) return;
            
            // Remove active from all options
            presetOptions.forEach(opt => opt.classList.remove('active'));
            
            // Add active to clicked option
            option.classList.add('active');
            
            // Store the user's choice - the EQ will now work in this mode
            const preset = option.dataset.preset;
            currentPreset = preset;
            
            console.log(`User selected ${preset} mode - EQ will dynamically adjust for ${preset} focus`);
        });
    });

    // Update gain value display
    function updateGainValue(slider) {
        const gainValue = slider.parentElement.nextElementSibling;
        const value = parseFloat(slider.value);
        const sign = value >= 0 ? '+' : '';
        gainValue.textContent = `${sign}${value} dB`;
    }

    // Slider change events
    verticalSliders.forEach((slider, index) => {
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

    // Settings menu toggle
    var isopenmenu = false;
    window.togglesetting = function() {
        if(isopenmenu === true) {
            document.body.style.overflow = 'auto';
            document.getElementById('settings-cont').style.opacity = 0;

            setTimeout(() => {
                document.getElementById('settings-cont').style.visibility = 'hidden';
            }, 350);
            isopenmenu = false;
        } else {
            document.body.style.overflow = 'hidden';
            document.getElementById('settings-cont').style.visibility = 'visible';
            document.getElementById('settings-cont').style.opacity = 1;
            isopenmenu = true;
        }
    };
});

// Global helper functions
window.attachEQToAudio = function(audioElement) {
    return window.dynamicEQ.attachToAudio(audioElement);
};

window.getEQStatus = function() {
    return window.dynamicEQ.getStatus();
};


var alreadyon = false
window.starteq = function() {
        if(alreadyon===false) {
            mainToggle.classList.add('active');
            eqContent?.classList.add('enabled');
            window.dynamicEQ.enable();
            alreadyon=true
        }
}
// Export for module environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DynamicEQ, dynamicEQ: window.dynamicEQ };
}



*/

var alreadyon = false
window.starteq = function() {
        if(alreadyon===false) {
            mainToggle.classList.add('active');
            eqContent?.classList.add('enabled');
            window.dynamicEQ.enable();
            alreadyon=true
        }
}


// Integrated Dynamic EQ System with Menu Controls
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
        
        // Analysis data
        this.frequencyData = null;
        this.bassLevel = 0;
        this.midLevel = 0;
        this.trebleLevel = 0;
        this.analysisInterval = null;

        this.originalFilterGains = null;
        this.reductionActive = false;
        this.distortionLevel = 0;
        

        this.originalFilterGains = null;
        this.reductionActive = false;
        this.distortionLevel = 0; // 0 = green, 1 = orange, 2 = red
        this.gradualReductions = { bass: 0, mids: 0, treble: 0 }; // Track current reductions
        this.distortionHistory = []; 
        this.alreadyenabledd = false

        // Adaptive history
        this.adaptiveHistory = [];
        this.historySize = 100;
        // In constructor, after this._tapConnected = false;
        this.adaptiveIntensity = 'normal';
        // EQ frequency bands (Hz)
        this.frequencies = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];
        
        // Connection state
        this._wired = false;
        this._tapConnected = false;
        
        this.init();
    }
    
    init() {
        // don't create an AudioContext here
        this.frequencyData = null;
        // leave analyser/filters/gain uninitialized until we know the shared ctx
    }
      
    buildNodes(ctx) {
        // (re)create everything in the shared AudioContext
        this.analyserNode = ctx.createAnalyser();
        this.analyserNode.fftSize = 2048;
        this.analyserNode.smoothingTimeConstant = 0.8;
      
        this.filters = [];
        this.frequencies.forEach((freq, index) => {
            const f = ctx.createBiquadFilter();
            if (index === 0) f.type = 'lowshelf';
            else if (index === this.frequencies.length - 1) f.type = 'highshelf';
            else { 
                f.type = 'peaking'; 
                f.Q.setValueAtTime(0.7, ctx.currentTime); // Lower Q to reduce distortion
            }
            f.frequency.setValueAtTime(freq, ctx.currentTime);
            f.gain.setValueAtTime(0, ctx.currentTime);
            this.filters.push(f);
        });
      
        this.gainNode = ctx.createGain();
        this.gainNode.gain.setValueAtTime(1, ctx.currentTime);
      
        this.frequencyData = new Uint8Array(this.analyserNode.frequencyBinCount);
    }
    
    attachToAudio(audioElement) {
        if (!audioElement || !(audioElement instanceof HTMLAudioElement)) {
            console.error('Invalid audio element provided');
            return false;
        }
        
        try {
            // Ensure SharedAudio exists and works
            if (!window.SharedAudio) {
                console.error('SharedAudio not available');
                return false;
            }
            
            const { ctx, source, masterGain } = window.SharedAudio.get(audioElement);
            
            if (!ctx || !source || !masterGain) {
                console.error('SharedAudio returned invalid objects');
                return false;
            }
      
            // if first time or context changed, rebuild nodes for the shared ctx
            if (this.audioContext !== ctx) {
                this.audioContext = ctx;
                this.buildNodes(ctx);
                this._wired = false;
                this._tapConnected = false;
            }
      
            this.audioElement = audioElement;
            this.sourceNode = source;
      
            // Connect analysis tap (parallel connection for frequency analysis)
            if (!this._tapConnected) {
                this.sourceNode.connect(this.analyserNode);
                this._tapConnected = true;
            }
            
            // DON'T connect EQ chain here - let audio flow directly until EQ is enabled
            console.log('Dynamic EQ attached successfully');
            console.log('Audio should play normally - EQ is ready but not active');
            return true;
        } catch (error) {
            console.error('Failed to attach to audio element:', error);
            console.error('Make sure SharedAudio is loaded first');
            return false;
        }
    }
    /*
    enable() {
        if (!this.audioElement || !this.sourceNode) {
            console.error('No audio element attached');
            return false;
        }
        
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        
        // NOW route audio through EQ when enabled
        if (!this._wired) {
            try {
                const { masterGain } = window.SharedAudio.get(this.audioElement);
                
                // Disconnect direct routing first
                this.sourceNode.disconnect(masterGain);
                
                // Route through EQ chain: source -> filters -> gain -> master
                let head = this.sourceNode;
                this.filters.forEach(f => { 
                    head = head.connect(f); 
                });
                head.connect(this.gainNode).connect(masterGain);
                this._wired = true;
                
                console.log('Audio routed through EQ');
            } catch (error) {
                console.error('Failed to route audio through EQ:', error);
                return false;
            }
        }
        
        this.isActive = true;
        
        if (this.adaptiveMode) {
            this.startAnalysis();
        }
        
        return true;
    }
    */

    // === Dynamic EQ: robust enable() with mix-bus support + auto-rewire ===
enable() {
    if (!this.audioElement || !this.sourceNode) {
      console.error('No audio element attached');
      return false;
    }
    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume().catch(()=>{});
    }
  
    // Resolve a masterGain that works with/without SharedAudio
    const resolvedMasterGain =
      (window.autoMixEngine?.masterGain) ||
      (window.SharedAudio?.get?.(this.audioElement)?.masterGain) ||
      this.audioContext.destination;
  
        
      if (!this._wired) {
        try {
            const { masterGain } = window.SharedAudio.get(this.audioElement);
            
            // Disconnect ONLY the masterGain connection, preserve analyser
            try { this.sourceNode.disconnect(masterGain); } catch(_) {}
            
            // Route through EQ chain
            let head = this.sourceNode;
            this.filters.forEach(f => { 
                head = head.connect(f); 
            });
            head.connect(this.gainNode).connect(masterGain);
            
            // Ensure analyser is still connected (reconnect if needed)
            if (this.analyserNode) {
                try { this.sourceNode.connect(this.analyserNode); } catch(_) {}
            }
            
            this._wired = true;
        } catch (error) {
            // ... error handling
        }
    }
    // If we started before AutoMix created its mix bus, hop over when it appears.
    if (!this._usingMixBus) {
      this._maybeStartBusWatcher?.(); // clear any old
      this._maybeStartBusWatcher = () => {
        if (this._busWatchTimer) return;
        this._busWatchTimer = setInterval(() => {
          if (window.autoMixEngine?.mixBus) {
            clearInterval(this._busWatchTimer);
            this._busWatchTimer = null;
            this._rewireToMixBus(resolvedMasterGain);
          }
        }, 500);
      };
      this._maybeStartBusWatcher();
    }
  
    this.isActive = true;
    if (this.adaptiveMode) this.startAnalysis();
    return true;
  }
  
  // === Clean rewire from per-track to mix bus once AutoMix bus exists ===
  _rewireToMixBus(masterGain) {
    try {
      const bus = window.autoMixEngine?.mixBus;
      if (!this._wired || !bus) return;
      if (this._usingMixBus) return;
  
      // 1) Remove the EQ output from master
      try { this.gainNode.disconnect(); } catch (_) {}
  
      // 2) Restore the old tap (currentGain/source) back to its vanilla path
      //    (currentGain → mixBus, or source → master if no bus)
      try {
        if (this._tapRef && this._tapRef !== bus) {
          // reconnect currentGain to bus so AutoMix crossfades still work
          try { this._tapRef.disconnect(); } catch (_){}
          this._tapRef.connect(bus);
        }
      } catch (_){}
  
      // 3) Ensure bus is not already feeding master directly (we’ll put EQ there)
      try { bus.disconnect(masterGain || window.autoMixEngine?.masterGain || this.audioContext.destination); } catch (_){}
  
      // 4) Reinsert EQ at the bus: bus → filters… → gainNode → master
      let node = bus;
      for (const f of (this.filters || [])) node = node.connect(f);
      node.connect(this.gainNode).connect(
        masterGain || window.autoMixEngine?.masterGain || this.audioContext.destination
      );
  
      this._tapRef = bus;
      this._usingMixBus = true;
      console.log('DynamicEQ rewired to AutoMix mix bus');
    } catch (err) {
      console.warn('DynamicEQ: rewire to mix bus failed:', err);
    }
  }
  
      
    /*disable() {
        this.isActive = false;
        this.stopAnalysis();
        this.resetFilters();
        
        // Route audio directly again when disabled
        if (this._wired) {
            try {
                const { masterGain } = window.SharedAudio.get(this.audioElement);
                
                // Disconnect EQ chain
                this.gainNode.disconnect(masterGain);
                this.filters.forEach(f => f.disconnect());
                
                // Reconnect direct routing
                this.sourceNode.connect(masterGain);
                this._wired = false;
                
                console.log('Audio routed directly (EQ bypassed)');
            } catch (error) {
                console.error('Failed to bypass EQ:', error);
            }
        }
    }
    */

    disable() {
  this.isActive = false;
  try { this.stopAnalysis?.(); } catch(_) {}
  try { this.resetFilters?.(); } catch(_) {}

  // Stop any bus watcher you may have started in enable()
  if (this._busWatchTimer) { clearInterval(this._busWatchTimer); this._busWatchTimer = null; }

  if (!this._wired) return true;

  // Resolve a masterGain that works in all setups
  const resolvedMasterGain =
    (window.autoMixEngine?.masterGain) ||
    (window.SharedAudio?.get?.(this.audioElement)?.masterGain) ||
    this.audioContext?.destination;

  try {
    // 1) Disconnect EQ chain outputs (don’t assume specific destinations)
    try { this.gainNode?.disconnect(); } catch(_) {}
    if (Array.isArray(this.filters)) {
      for (const f of this.filters) { try { f.disconnect(); } catch(_) {} }
    }

    const auto = window.autoMixEngine;

    if (auto?.mixBus) {
      // 2a) AutoMix with mix bus: ensure currentGain → mixBus and mixBus → master
      try { auto.currentGain?.disconnect(); } catch(_) {}
      try { auto.currentGain?.connect(auto.mixBus); } catch(_) {}

      // (nextGain should already feed mixBus; we leave it alone)

      // Reconnect mixBus to master (we may have replaced this with EQ earlier)
      try { auto.mixBus.disconnect(); } catch(_) {}
      auto.mixBus.connect(resolvedMasterGain);

    } else if (auto?.currentGain) {
      // 2b) AutoMix without mix bus: restore currentGain → master
      try { auto.currentGain.disconnect(); } catch(_) {}
      auto.currentGain.connect(resolvedMasterGain);

    } else {
      // 2c) No AutoMix: restore source → master
      try { this.sourceNode?.disconnect(); } catch(_) {}
      this.sourceNode?.connect(resolvedMasterGain);
    }

    this._wired = false;
    this._usingMixBus = false;   // if you set this in enable()
    this._tapRef = null;         // if you set this in enable()
    console.log('Audio routed directly (EQ bypassed)');
    return true;

  } catch (error) {
    console.error('Failed to bypass EQ:', error);
    return false;
  }
}

    setAdaptiveMode(enabled) {
        this.adaptiveMode = enabled;
        
        if (enabled && this.isActive) {
            this.startAnalysis();
        } else {
            this.stopAnalysis();
        }
    }
    
  

   
    startdistort() {
      

        this.distortdetect = setInterval(() => {
            this.analyzeFrequencies();

            this.detectAndCorrectDistortion();
        }, 500);
    }
    stopdistort() {
        if (this.distortdetect) {
            clearInterval(this.distortdetect);
        }
        this.restoreGradually();

    }
     
    startAnalysis() {
        if (this.analysisInterval) {
            clearInterval(this.analysisInterval);
        }
        

        
        this.analysisInterval = setInterval(() => {
            this.analyzeFrequencies();
            this.updateAdaptiveEQ();
            console.log('check')
            if(this.distortdetect) {
                clearInterval(this.distortdetect);
            }
        }, 1200); 
        
    }
       /* startAnalysis() {
            if (this.analysisInterval) {
                clearInterval(this.analysisInterval);
            }
            
            this.analysisInterval = setInterval(() => {
                this.analyzeFrequencies();
                
                // Check for distortion first and apply corrections if needed
                const distortionCorrected = this.detectAndCorrectDistortion();
                
                // Only apply normal adaptive EQ if no distortion correction was made
                // This prevents conflicting adjustments
                if (!distortionCorrected) {
                    this.updateAdaptiveEQ();
                }
                
                console.log('check')
            }, 1200); 
        }
    */
    
    stopAnalysis() {
        if (this.analysisInterval) {
            clearInterval(this.analysisInterval);
            this.analysisInterval = null;
        }
        
    }
    
    analyzeFrequencies() {
        this.analyserNode.getByteFrequencyData(this.frequencyData);
        
        const sampleRate = this.audioContext.sampleRate;
        const binCount = this.frequencyData.length;
        const binWidth = sampleRate / (2 * binCount);
        
        // Calculate levels for bass, mid, treble
        const bassStart = Math.floor(60 / binWidth);
        const bassEnd = Math.floor(250 / binWidth);
        const midStart = Math.floor(250 / binWidth);
        const midEnd = Math.floor(4000 / binWidth);
        const trebleStart = Math.floor(4000 / binWidth);
        const trebleEnd = Math.min(Math.floor(16000 / binWidth), binCount - 1);
        
        this.bassLevel = this.getAverageLevel(bassStart, bassEnd);
        this.midLevel = this.getAverageLevel(midStart, midEnd);
        this.trebleLevel = this.getAverageLevel(trebleStart, trebleEnd);
        
        // Store in history
        this.adaptiveHistory.push({
            bass: this.bassLevel,
            mid: this.midLevel,
            treble: this.trebleLevel,
            timestamp: Date.now()
        });
        
        if (this.adaptiveHistory.length > this.historySize) {
            this.adaptiveHistory.shift();
        }
    }
    
    getAverageLevel(startBin, endBin) {
        let sum = 0;
        for (let i = startBin; i <= endBin; i++) {
            sum += this.frequencyData[i];
        }
        return sum / (endBin - startBin + 1);
    }
    
    updateAdaptiveEQ() {
        if (this.adaptiveHistory.length < 10) return;
        
        const recentHistory = this.adaptiveHistory.slice(-20);
        const avgBass = recentHistory.reduce((sum, item) => sum + item.bass, 0) / recentHistory.length;
        const avgMid = recentHistory.reduce((sum, item) => sum + item.mid, 0) / recentHistory.length;
        const avgTreble = recentHistory.reduce((sum, item) => sum + item.treble, 0) / recentHistory.length;
        
        // Calculate total energy
        const totalEnergy = avgBass + avgMid + avgTreble;
        
        // Don't make changes during very quiet periods
        if (totalEnergy < 10) return;
        
        // Get the current user-selected preset/mode
        const userMode = this.getUserSelectedMode();
        
        // Apply dynamic adjustments based on user's chosen mode
        this.applyDynamicAdjustments(avgBass, avgMid, avgTreble, userMode);
    }
    
    getUserSelectedMode() {
        // Check which preset the user has selected
        const activePreset = document.querySelector('.preset-option.active');
        if (activePreset) {
            return activePreset.dataset.preset;
        }
        return 'adaptive'; // Default fallback
    }
    
    getAdaptiveMultipliers() {
        // Get the current user mode to apply mode-specific intensity
        const userMode = this.getUserSelectedMode();
        
        // Mode-specific intensity configurations
        const intensityConfigs = {
            'chill2': {
                adaptive: { gain: 0.35, threshold: 1.6, transition: 0.6, maxGain: 2.5 },
                bass: { gain: 0.4, threshold: 1.5, transition: 0.5, maxGain: 3 },
                vocals: { gain: 0.25, threshold: 1.7, transition: 0.7, maxGain: 2 },
                chill: { gain: 0.5, threshold: 1.4, transition: 0.8, maxGain: 2.5 }
            },
            'aggressive': {
                adaptive: { gain: 1.35, threshold: 0.7, transition: 0.2, maxGain: 8 },
                bass: { gain: 1.7, threshold: 0.6, transition: 0.15, maxGain: 8 },
                vocals: { gain: 1.0, threshold: 0.8, transition: 0.25, maxGain: 7 },
                chill: { gain: 1.5, threshold: 0.9, transition: 0.4, maxGain: 6 }
            },
            'normal': {
                adaptive: { gain: 1.0, threshold: 1.0, transition: 0.5, maxGain: 6 },
                bass: { gain: 1.2, threshold: 1.0, transition: 0.5, maxGain: 6 },
                vocals: { gain: 0.7, threshold: 1.1, transition: 0.5, maxGain: 5.5 },
                chill: { gain: 1.0, threshold: 1.0, transition: 0.6, maxGain: 5 }
            }
        };
        
        // Get the configuration for current intensity and mode
        const config = intensityConfigs[this.adaptiveIntensity] || intensityConfigs['normal'];
        return config[userMode] || config['adaptive']; // Fallback to adaptive if mode not found
    }
    
    setAdaptiveIntensity(intensity) {
        if (['chill2', 'normal', 'aggressive'].includes(intensity)) {
            this.adaptiveIntensity = intensity;
            console.log(`Adaptive intensity set to: ${intensity}`);
            return true;
        }
        return false;
    }
    
    applyDynamicAdjustments(bassLevel, midLevel, trebleLevel, userMode) {
        const currentTime = this.audioContext.currentTime;
        const multipliers = this.getAdaptiveMultipliers();
        const transitionTime = multipliers.transition;
        
        // Determine what's prominent in the current audio (with intensity-adjusted thresholds)
        const bassRatio = bassLevel / (midLevel + trebleLevel + 1);
        const vocalRatio = midLevel / (bassLevel + trebleLevel + 1);
        
        let adjustments = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; // Default flat
        let adjustmentReason = '';
        
        switch (userMode) {
            case 'adaptive':
                // Automatically focus on whatever is prominent (with intensity modulation)
                if (bassRatio > (0.4 / multipliers.threshold) && bassLevel > (25 / multipliers.threshold)) {
                    // Bass is prominent - apply intensity-modified bass boost
                    const baseGains = [3, 2, 1, 0, -1, 0, 1, 1, 0, 0];
                    adjustments = baseGains.map(gain => Math.min(multipliers.maxGain, gain * multipliers.gain));
                    adjustmentReason = `bass-heavy content detected [${this.adaptiveIntensity}] (bass: ${bassLevel.toFixed(1)}, ratio: ${bassRatio.toFixed(2)})`;
                } else if (vocalRatio > (0.4 / multipliers.threshold) && midLevel > (30 / multipliers.threshold)) {
                    // Vocals are prominent - apply intensity-modified vocal boost
                    const baseGains = [-2, -1, 1, 2, 3, 2, 1, 0, 0, -1];
                    adjustments = baseGains.map(gain => Math.max(-multipliers.maxGain, Math.min(multipliers.maxGain, gain * multipliers.gain)));
                    adjustmentReason = `vocal-heavy content detected [${this.adaptiveIntensity}] (mid: ${midLevel.toFixed(1)}, ratio: ${vocalRatio.toFixed(2)})`;
                } else {
                    // Balanced content - gentle enhancement with intensity
                    const baseGains = [1, 0, 0, 1, 1, 0, 0, 1, 0, 0];
                    adjustments = baseGains.map(gain => gain * multipliers.gain * 0.5); // More subtle for balanced content
                    adjustmentReason = `balanced content detected [${this.adaptiveIntensity}] (bass: ${bassLevel.toFixed(1)}, mid: ${midLevel.toFixed(1)})`;
                }
                break;
                
            case 'bass':
                // User wants bass focus - dynamically boost bass when detected (with intensity)
                if (bassLevel > (20 / multipliers.threshold)) {
                    // Strong bass detected - boost it more with intensity
                    const bassMultiplier = Math.min(1.5 * multipliers.gain, 1 + (bassLevel - 20) * 0.02 * multipliers.gain);
                    const baseGains = [3, 2, 1, 0, -1, 0, 1, 1, 0, 0];
                    adjustments = baseGains.map((gain, i) => {
                        if (i < 3) {
                            const adjustedGain = gain * bassMultiplier;
                            return Math.max(-6, Math.min(6, adjustedGain)); // Clamp to prevent distortion
                        }
                        return Math.max(-6, Math.min(6, gain));
                    });
                    adjustmentReason = `strong bass detected [${this.adaptiveIntensity}], boosting (level: ${bassLevel.toFixed(1)}, multiplier: ${bassMultiplier.toFixed(2)})`;
                } else {
                    // Weak bass - moderate boost to compensate with intensity
                    const baseGains = [4, 2, 1, 0, 0, 0, 1, 1, 0, 0];
                    adjustments = baseGains.map(gain => Math.max(-6, Math.min(6, gain * multipliers.gain)));
                    adjustmentReason = `weak bass detected [${this.adaptiveIntensity}], compensating (level: ${bassLevel.toFixed(1)})`;
                }
                break;
                
            case 'vocals':
                // User wants vocal focus - dynamically boost vocals when detected (with intensity)
                if (midLevel > (25 / multipliers.threshold)) {
                    // Strong vocals detected - boost them more with intensity
                    const vocalMultiplier = Math.min(1.3 * multipliers.gain, 1 + (midLevel - 25) * 0.015 * multipliers.gain);
                    const baseGains = [-2, -1, 1, 2, 3, 2, 2, 1, 0, 0];
                    adjustments = baseGains.map((gain, i) => {
                        if (i >= 2 && i <= 6) return Math.max(-multipliers.maxGain, Math.min(multipliers.maxGain, gain * vocalMultiplier)); // Apply to vocal range
                        return Math.max(-multipliers.maxGain, Math.min(multipliers.maxGain, gain));
                    });
                    adjustmentReason = `strong vocals detected [${this.adaptiveIntensity}], boosting (level: ${midLevel.toFixed(1)}, multiplier: ${vocalMultiplier.toFixed(2)})`;
                } else {
                    // Weak vocals - moderate boost to bring them forward with intensity
                    const baseGains = [-2, 0, 1, 3, 4, 3, 2, 1, 0, -1];
                    adjustments = baseGains.map(gain => Math.max(-multipliers.maxGain, Math.min(multipliers.maxGain, gain * multipliers.gain)));
                    adjustmentReason = `weak vocals detected [${this.adaptiveIntensity}], bringing forward (level: ${midLevel.toFixed(1)})`;
                }
                break;
                
            case 'chill':
                // User wants chill mode - gentle, consistent adjustments with intensity modulation
                if (trebleLevel > (30 / multipliers.threshold)) {
                    // Reduce harsh treble when detected
                    const baseGains = [2, 1, 0, 0, 1, 0, -1, -2, -1, -1];
                    adjustments = baseGains.map(gain => Math.max(-multipliers.maxGain, Math.min(multipliers.maxGain, gain * multipliers.gain)));
                    adjustmentReason = `harsh treble detected [${this.adaptiveIntensity}], smoothing (level: ${trebleLevel.toFixed(1)})`;
                } else {
                    // Standard chill curve with intensity
                    const baseGains = [2, 1, 0, 0, 1, 0, -1, -1, 0, 0];
                    adjustments = baseGains.map(gain => gain * multipliers.gain * 0.8); // Slightly more gentle for chill
                    adjustmentReason = `maintaining chill profile [${this.adaptiveIntensity}] (treble: ${trebleLevel.toFixed(1)})`;
                }
                break;
                
            case 'rock':
                // Dynamic rock adjustments with intensity
                const baseGainsRock = bassLevel > 25 && midLevel > 25 ? 
                    [3, 2, 0, -1, 1, 2, 3, 3, 2, 1] : 
                    [3, 2, -1, -2, 0, 2, 4, 3, 2, 1];
                adjustments = baseGainsRock.map(gain => Math.max(-multipliers.maxGain, Math.min(multipliers.maxGain, gain * multipliers.gain)));
                adjustmentReason = `rock profile [${this.adaptiveIntensity}] applied (bass: ${bassLevel.toFixed(1)}, mid: ${midLevel.toFixed(1)})`;
                break;
                
            case 'electronic':
                // Dynamic electronic adjustments with intensity
                const baseGainsElectronic = bassLevel > 30 || trebleLevel > 25 ? 
                    [4, 2, 1, 0, 1, 2, 2, 3, 3, 2] : 
                    [4, 2, 0, -1, 2, 3, 2, 3, 4, 2];
                adjustments = baseGainsElectronic.map(gain => Math.max(-multipliers.maxGain, Math.min(multipliers.maxGain, gain * multipliers.gain)));
                adjustmentReason = `electronic profile [${this.adaptiveIntensity}] applied (bass: ${bassLevel.toFixed(1)}, treble: ${trebleLevel.toFixed(1)})`;
                break;
                
            default:
                adjustments = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
                adjustmentReason = 'flat response (no mode selected)';
        }
        
        // Check if adjustments actually changed
        const currentAdjustments = this.filters.map(filter => filter.gain.value);
        const hasChanged = adjustments.some((gain, index) => {
            return Math.abs(gain - currentAdjustments[index]) > 0.1; // 0.1dB threshold
        });
        
        if (hasChanged) {
            console.log(`EQ Adjustment [${userMode.toUpperCase()}]: ${adjustmentReason}`);
            console.log(`   Levels - Bass: ${bassLevel.toFixed(1)}, Mid: ${midLevel.toFixed(1)}, Treble: ${trebleLevel.toFixed(1)}`);
            console.log(`   Applied: [${adjustments.map(g => g.toFixed(1)).join(', ')}] dB`);
        }
        
        // Apply the dynamic adjustments
        adjustments.forEach((gain, index) => {
            if (this.filters[index]) {
                this.filters[index].gain.setTargetAtTime(gain, currentTime, transitionTime);
            }
        });
        
        // Update slider display
        if (this.adaptiveMode) {
            this.updateSliderUI(adjustments);
        }
    }

    
    
    applyPreset(presetName) {
        const presets = {
            flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            vocal: [-3, -1, 1, 3, 4, 3, 2, 1, 0, -1],
            bass: [6, 4, 2, 0, -1, 0, 1, 2, 1, 0],
            chill: [2, 1, 0, 0, 1, 0, -1, -1, 0, 0],
            rock: [3, 2, -1, -2, 0, 2, 4, 3, 2, 1],
            jazz: [-1, 0, 1, 2, 1, 0, 1, 2, 1, 0],
            electronic: [4, 2, 0, -1, 2, 3, 2, 3, 4, 2],
            classical: [0, 0, 0, 0, -1, -1, 0, 1, 2, 2]
        };
        
        const values = presets[presetName] || presets.flat;
        const currentTime = this.audioContext.currentTime;
        
        values.forEach((gain, index) => {
            if (this.filters[index]) {
                // Limit gains to prevent distortion
                const limitedGain = Math.max(-6, Math.min(6, gain));
                this.filters[index].gain.setTargetAtTime(limitedGain, currentTime, 0.3);
            }
        });
        
        this.currentPreset = presetName;
        
        // Update manual sliders if not in adaptive mode
        if (!this.adaptiveMode) {
            this.updateSliderUI(values);
        }
    }
    
    setManualGains(gains) {
        if (this.adaptiveMode) return; // Don't allow manual changes in adaptive mode
        
        const currentTime = this.audioContext.currentTime;
        
        gains.forEach((gain, index) => {
            if (this.filters[index]) {
                // Limit gains to prevent distortion
                const limitedGain = Math.max(-6, Math.min(6, gain));
                this.filters[index].gain.setTargetAtTime(limitedGain, currentTime, 0.1);
            }
        });
    }
    
    updateSliderUI(values) {
        const verticalSliders = document.querySelectorAll('.vertical-slider');
        verticalSliders.forEach((slider, index) => {
            if (values[index] !== undefined) {
                slider.value = Math.max(-6, Math.min(6, values[index]));
                this.updateGainValueDisplay(slider);
            }
        });
    }
    
    updatePresetUI(presetName) {
        // Only update UI in adaptive mode, otherwise respect user selection
        if (this.getUserSelectedMode() === 'adaptive') {
            const presetOptions = document.querySelectorAll('.preset-option');
            presetOptions.forEach(option => {
                option.classList.remove('active');
                if (option.dataset.preset === presetName) {
                    option.classList.add('active');
                }
            });
        }
    }
    
    updateGainValueDisplay(slider) {
        const gainValue = slider.parentElement.nextElementSibling;
        const value = parseFloat(slider.value);
        const sign = value >= 0 ? '+' : '';
        gainValue.textContent = `${sign}${value} dB`;
    }
    
    resetFilters() {
        if (!this.filters.length) return;
        
        const currentTime = this.audioContext.currentTime;
        this.filters.forEach(filter => {
            filter.gain.setTargetAtTime(0, currentTime, 0.5);
        });
    }
    
    getStatus() {
        return {
            isActive: this.isActive,
            adaptiveMode: this.adaptiveMode,
            currentPreset: this.currentPreset,
            userSelectedMode: this.getUserSelectedMode(),
            bassLevel: Math.round(this.bassLevel),
            midLevel: Math.round(this.midLevel),
            trebleLevel: Math.round(this.trebleLevel)
        };
    }

    // Add this method to set sensitivity level
setDistortionSensitivity(level) {
    // level can be: 'low', 'normal', 'high'
    this.distortionSensitivity = level;
    //console.log(`Distortion sensitivity set to: ${level}`);
}

// Add this method to get current thresholds based on sensitivity
getDistortionThresholds() {
    const sensitivity = this.distortionSensitivity || 'normal';
    
    const thresholds = {
        'low': {
            bassStatic: 250,        // Very high - only severe bass distortion
            vocalStatic: 220,       // Very high - only harsh screaming vocals  
            trebleStatic: 200,      // Very high - only severe sibilance
            bassModerate: 220,      // High moderate threshold
            vocalModerate: 180,     // High moderate threshold
            trebleModerate: 160,    // High moderate threshold
            clippingPercentage: 0.08, // 8% of bins clipping
            hotPercentage: 0.15,    // 15% of bins hot
            emergencyThreshold: 252  // Almost actual clipping
        },
        'normal': {
            bassStatic: 230,        // High - noticeable bass distortion
            vocalStatic: 200,       // High - harsh vocals
            trebleStatic: 180,      // High - noticeable sibilance  
            bassModerate: 200,      // Moderate threshold
            vocalModerate: 160,     // Moderate threshold
            trebleModerate: 140,    // Moderate threshold
            clippingPercentage: 0.05, // 5% of bins clipping
            hotPercentage: 0.1,     // 10% of bins hot
            emergencyThreshold: 250  // Actual clipping
        },
        'high': {
            bassStatic: 210,        // Lower - catches more bass issues
            vocalStatic: 180,       // Lower - catches more vocal harshness
            trebleStatic: 160,      // Lower - catches more treble issues
            bassModerate: 180,      // Lower moderate threshold
            vocalModerate: 140,     // Lower moderate threshold  
            trebleModerate: 120,    // Lower moderate threshold
            clippingPercentage: 0.03, // 3% of bins clipping
            hotPercentage: 0.08,    // 8% of bins hot
            emergencyThreshold: 245  // Earlier emergency intervention
        }
    };
    
    return thresholds[sensitivity];
}



// New gradual reduction method with stricter limits
applyGradualReduction(problematicFrequency, distortionScore) {
    if (!this.filters.length) return;
    
    const currentTime = this.audioContext.currentTime;
    const transitionTime = 0.2; // Smooth transitions
    
    // Store original gains if not already stored
    if (!this.originalFilterGains) {
        this.originalFilterGains = this.filters.map(filter => filter.gain.value);
    }
    
    // STRICTER LIMITS: Much lower maximum reduction
    const maxReduction = 3; // Maximum 2dB reduction (was 4dB)
    const targetReduction = Math.min(maxReduction, distortionScore * 3); // Scale 0-1 score to 0-3dB, cap at 2dB
    
    // Determine which filters to target
    let targetFilters = [];
    switch (problematicFrequency) {
        case 'bass':
            targetFilters = [0, 1, 2]; // 60Hz, 170Hz, 310Hz
            break;
        case 'mids':
            targetFilters = [3, 4, 5]; // 600Hz, 1kHz, 3kHz
            break;
        case 'treble':
            targetFilters = [6, 7, 8, 9]; // 6kHz, 12kHz, 14kHz, 16kHz
            break;
    }
    
    // SMALLER STEPS: More gradual adjustment
    const currentReduction = this.gradualReductions[problematicFrequency];
    const reductionStep = 0.15; // Smaller steps (was 0.3)
    
    let newReduction;
    if (targetReduction > currentReduction) {
        // Increase reduction gradually
        newReduction = Math.min(targetReduction, currentReduction + reductionStep);
    } else {
        // Decrease reduction gradually (shouldn't happen in this function)
        newReduction = Math.max(targetReduction, currentReduction - reductionStep);
    }
    
    this.gradualReductions[problematicFrequency] = newReduction;
    
    // Apply the reduction to target filters
    targetFilters.forEach(filterIndex => {
        if (this.filters[filterIndex] && this.originalFilterGains[filterIndex] !== undefined) {
            const originalGain = this.originalFilterGains[filterIndex];
            const targetGain = Math.max(-6, originalGain - newReduction);
            this.filters[filterIndex].gain.setTargetAtTime(targetGain, currentTime, transitionTime);
        }
    });
    
    this.reductionActive = true;
    //console.log(`Gradual ${problematicFrequency} reduction: ${newReduction.toFixed(1)}dB (target: ${targetReduction.toFixed(1)}dB, score: ${distortionScore.toFixed(2)})`);
}

// Updated restoration with smaller steps
restoreGradually() {
    if (!this.reductionActive || !this.originalFilterGains) return;
    
    const currentTime = this.audioContext.currentTime;
    const transitionTime = 0.3; // Slower restoration
    const restorationStep = 0.1; // Even smaller restoration steps (was 0.2)
    
    let anyReductionRemaining = false;
    
    // Gradually restore each frequency range
    ['bass', 'mids', 'treble'].forEach((freq, freqIndex) => {
        const currentReduction = this.gradualReductions[freq];
        
        if (currentReduction > 0) {
            const newReduction = Math.max(0, currentReduction - restorationStep);
            this.gradualReductions[freq] = newReduction;
            
            if (newReduction > 0) {
                anyReductionRemaining = true;
            }
            
            // Determine target filters for this frequency range
            let targetFilters = [];
            switch (freq) {
                case 'bass':
                    targetFilters = [0, 1, 2];
                    break;
                case 'mids':
                    targetFilters = [3, 4, 5];
                    break;
                case 'treble':
                    targetFilters = [6, 7, 8, 9];
                    break;
            }
            
            // Apply restoration
            targetFilters.forEach(filterIndex => {
                if (this.filters[filterIndex] && this.originalFilterGains[filterIndex] !== undefined) {
                    const originalGain = this.originalFilterGains[filterIndex];
                    const targetGain = originalGain - newReduction;
                    this.filters[filterIndex].gain.setTargetAtTime(targetGain, currentTime, transitionTime);
                }
            });
            
            if (newReduction < 0.05) {
                console.log(`${freq} frequencies restored to original levels`);
            }
        }
    });
    
    // If all frequencies are restored, clean up
    if (!anyReductionRemaining) {
        this.reductionActive = false;
        this.originalFilterGains = null;
        console.log('All frequencies fully restored');
    }
}

detectAndCorrectDistortion() {
    if (!this.frequencyData || !this.isActive) {
        this.updateDistortionIndicator(0); // Green when inactive
        this.restoreGradually(); // Gradually restore when inactive
        return false;
    }
    
    const sampleRate = this.audioContext.sampleRate;
    const binCount = this.frequencyData.length;
    const binWidth = sampleRate / (2 * binCount);
    
    // ADVANCED DISTORTION DETECTION - Focus on distortion patterns, not just volume
    const maxValue = Math.max(...this.frequencyData);
    const minValue = Math.min(...this.frequencyData);
    const averageValue = this.frequencyData.reduce((sum, val) => sum + val, 0) / this.frequencyData.length;
    
    // Calculate frequency ranges
    const ranges = {
        subBass: { start: Math.floor(20 / binWidth), end: Math.floor(60 / binWidth) },
        bass: { start: Math.floor(60 / binWidth), end: Math.floor(250 / binWidth) },
        lowMid: { start: Math.floor(250 / binWidth), end: Math.floor(500 / binWidth) },
        vocals: { start: Math.floor(500 / binWidth), end: Math.floor(2000 / binWidth) },
        upperMid: { start: Math.floor(2000 / binWidth), end: Math.floor(4000 / binWidth) },
        treble: { start: Math.floor(4000 / binWidth), end: Math.floor(16000 / binWidth) }
    };
    
    // Calculate levels and statistical properties for each range
    const levels = {};
    const maxLevels = {};
    const variance = {};
    const spikiness = {};
    
    for (const [rangeName, range] of Object.entries(ranges)) {
        const rangeData = [];
        let sum = 0;
        let max = 0;
        
        for (let i = range.start; i <= Math.min(range.end, binCount - 1); i++) {
            const val = this.frequencyData[i];
            rangeData.push(val);
            sum += val;
            max = Math.max(max, val);
        }
        
        const avg = sum / rangeData.length;
        levels[rangeName] = avg;
        maxLevels[rangeName] = max;
        
        // Calculate variance (spread of values)
        const varianceSum = rangeData.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0);
        variance[rangeName] = varianceSum / rangeData.length;
        
        // Calculate "spikiness" - how many bins are way above average (indicates distortion)
        const spikes = rangeData.filter(val => val > avg + Math.sqrt(variance[rangeName]) * 2).length;
        spikiness[rangeName] = spikes / rangeData.length;
    }
    
    // DISTORTION PATTERN DETECTION (not just volume)
    
    // Calculate distortion scores (0-1 scale)
    const bassDistortionScore = (spikiness.bass * 0.4) + (variance.bass > 2000 ? 0.3 : 0) + (maxLevels.bass > 240 ? 0.3 : 0);
    const vocalDistortionScore = (spikiness.vocals * 0.4) + (variance.vocals > 1500 ? 0.3 : 0) + (maxLevels.vocals > 230 ? 0.3 : 0);
    const trebleDistortionScore = (spikiness.treble * 0.4) + (variance.treble > 1000 ? 0.3 : 0) + (maxLevels.treble > 220 ? 0.3 : 0);
    
    // Clipping detection
    const actualClipping = this.frequencyData.filter(val => val >= 254).length > 0;
    const nearClipping = this.frequencyData.filter(val => val >= 250).length;
    const clippingPercentage = nearClipping / this.frequencyData.length;
    
    //console.log(`Distortion Scores - Bass: ${bassDistortionScore.toFixed(2)}, Vocal: ${vocalDistortionScore.toFixed(2)}, Treble: ${trebleDistortionScore.toFixed(2)}`);
    //console.log(`Current Reductions - Bass: ${this.gradualReductions.bass.toFixed(1)}dB, Mids: ${this.gradualReductions.mids.toFixed(1)}dB, Treble: ${this.gradualReductions.treble.toFixed(1)}dB`);
    
    let correctionApplied = false;
    let maxDistortionScore = 0;
    let distortionSeverity = 0;
    
    // ACTUAL CLIPPING EMERGENCY - find worst frequency and target it
    if (actualClipping || clippingPercentage > 0.02) {
        let worstFrequency = 'bass';
        let worstScore = maxLevels.bass;
        
        if (maxLevels.vocals > worstScore) {
            worstFrequency = 'mids';
            worstScore = maxLevels.vocals;
        }
        if (maxLevels.treble > worstScore) {
            worstFrequency = 'treble';
            worstScore = maxLevels.treble;
        }
        
        //console.log(`DIGITAL CLIPPING - Targeting ${worstFrequency} (peak: ${worstScore})`);
        this.updateDistortionIndicator(2);
        this.applyGradualReduction(worstFrequency, 1.0); // Max score for clipping
        return true;
    }
    
    // GRADUAL DISTORTION CORRECTION - Apply to any frequency with distortion
    
    // Bass distortion
    if (bassDistortionScore > 0.3) { // Lower threshold for gradual approach
        this.applyGradualReduction('bass', bassDistortionScore);
        correctionApplied = true;
        maxDistortionScore = Math.max(maxDistortionScore, bassDistortionScore);
        //console.log(`Bass distortion detected: ${bassDistortionScore.toFixed(2)}`);
    }
    
    // Vocal distortion
    if (vocalDistortionScore > 0.3) {
        this.applyGradualReduction('mids', vocalDistortionScore);
        correctionApplied = true;
        maxDistortionScore = Math.max(maxDistortionScore, vocalDistortionScore);
        //console.log(`Vocal distortion detected: ${vocalDistortionScore.toFixed(2)}`);
    }
    
    // Treble distortion
    if (trebleDistortionScore > 0.3) {
        this.applyGradualReduction('treble', trebleDistortionScore);
        correctionApplied = true;
        maxDistortionScore = Math.max(maxDistortionScore, trebleDistortionScore);
        //console.log(`Treble distortion detected: ${trebleDistortionScore.toFixed(2)}`);
    }
    
    // Determine visual indicator based on worst distortion
    if (maxDistortionScore > 0.6) {
        distortionSeverity = 2; // Red
    } else if (maxDistortionScore > 0.3 || correctionApplied) {
        distortionSeverity = 1; // Orange
    } else {
        distortionSeverity = 0; // Green
        this.restoreGradually(); // Gradually restore when no distortion
    }
    
    this.updateDistortionIndicator(distortionSeverity);
    
    return correctionApplied;
}

// FIXED: Emergency reduction function for extreme cases
applyEmergencyReduction() {
    if (!this.filters.length) return;
    
    const currentTime = this.audioContext.currentTime;
    const transitionTime = 0.05; // Very fast emergency response
    
    // Store original gains if not already stored
    if (!this.originalFilterGains) {
        this.originalFilterGains = this.filters.map(filter => filter.gain.value);
    }
    
    // Emergency reduction across ALL frequencies to prevent damage/distortion
    const emergencyReductions = [
        -6, // 60Hz - heavy bass reduction
        -5, // 170Hz - strong bass reduction  
        -4, // 310Hz - moderate low-mid reduction
        -3, // 600Hz - vocal range reduction
        -3, // 1kHz - vocal clarity reduction
        -3, // 3kHz - vocal intelligibility reduction
        -4, // 6kHz - treble reduction
        -5, // 12kHz - high treble reduction
        -5, // 14kHz - very high reduction
        -6  // 16kHz - extreme high reduction
    ];
    
    emergencyReductions.forEach((reduction, index) => {
        if (this.filters[index]) {
            const currentGain = this.filters[index].gain.value;
            const targetGain = Math.max(-6, currentGain + reduction);
            this.filters[index].gain.setTargetAtTime(targetGain, currentTime, transitionTime);
        }
    });
    
    this.reductionActive = true;
    //console.log('EMERGENCY REDUCTION APPLIED - Protecting against extreme distortion/clipping');
}

// FIXED: Targeted frequency reduction function
applyTargetedReduction(problematicFrequency, reductionAmount) {
    if (!this.filters.length) return;
    
    const currentTime = this.audioContext.currentTime;
    const transitionTime = 0.15; // Quick response to prevent distortion
    
    // Store original filter gains if not already stored
    if (!this.originalFilterGains) {
        this.originalFilterGains = this.filters.map(filter => filter.gain.value);
        this.reductionActive = false;
    }
    
    let targetFilters = [];
    let reductionReason = '';
    
    switch (problematicFrequency) {
        case 'bass':
            // Target low frequency filters (60Hz, 170Hz, 310Hz)
            targetFilters = [0, 1, 2];
            reductionReason = 'bass frequencies';
            break;
        case 'mids':
            // Target mid frequency filters (600Hz, 1kHz, 3kHz)
            targetFilters = [3, 4, 5];
            reductionReason = 'mid frequencies';
            break;
        case 'treble':
            // Target high frequency filters (6kHz, 12kHz, 14kHz, 16kHz)
            targetFilters = [6, 7, 8, 9];
            reductionReason = 'treble frequencies';
            break;
    }
    
    // Apply reduction to targeted frequency bands
    targetFilters.forEach(filterIndex => {
        if (this.filters[filterIndex]) {
            const currentGain = this.filters[filterIndex].gain.value;
            const targetGain = Math.max(-6, currentGain - reductionAmount);
            this.filters[filterIndex].gain.setTargetAtTime(targetGain, currentTime, transitionTime);
        }
    });
    
    this.reductionActive = true;
    console.log(`Reduced ${reductionReason} by ${reductionAmount.toFixed(1)}dB to prevent distortion`);
}

// FIXED: Proper restoration function
restoreOriginalEQ() {
    if (this.reductionActive && this.originalFilterGains) {
        const currentTime = this.audioContext.currentTime;
        const transitionTime = 0.3; // Slower restoration for smooth transition
        
        this.filters.forEach((filter, index) => {
            if (filter && this.originalFilterGains[index] !== undefined) {
                filter.gain.setTargetAtTime(this.originalFilterGains[index], currentTime, transitionTime);
            }
        });
        
        this.reductionActive = false;
        console.log('EQ restored to original settings');
        
        // Clear stored gains for next detection cycle
        setTimeout(() => {
            this.originalFilterGains = null;
        }, transitionTime * 1000 + 100);
    }
}

// FIXED: Updated visual indicator function
updateDistortionIndicator(severity) {
    const distCircle = document.getElementById('distcircle');
    if (!distCircle) return;
    
    this.distortionLevel = severity;
    
    switch (severity) {
        case 0: // Green - No distortion
            distCircle.style.backgroundColor = '#22c55e'; // Green
            distCircle.style.boxShadow = '0 0 10px rgba(34, 197, 94, 0.5)';
            break;
        case 1: // Orange - Moderate distortion/warning
            distCircle.style.backgroundColor = '#f97316'; // Orange
            distCircle.style.boxShadow = '0 0 15px rgba(249, 115, 22, 0.6)';
            break;
        case 2: // Red - Severe distortion
            distCircle.style.backgroundColor = '#ef4444'; // Red
            distCircle.style.boxShadow = '0 0 20px rgba(239, 68, 68, 0.8)';
            break;
    }
}
}

// Initialize the global EQ system
window.dynamicEQ = new DynamicEQ();

// Menu Integration
document.addEventListener('DOMContentLoaded', () => {
    // State management
    let eqEnabled = false;
    let adaptiveEnabled = false;
    let distortEnabled = false;

    let currentPreset = null;

    // DOM elements
    const mainToggle = document.getElementById('mainToggle');
    const adaptiveToggle = document.getElementById('adaptiveToggle');
    const eqContent = document.getElementById('eqContent');
    const eqSliders = document.getElementById('eqSliders');
    const presetOptions = document.querySelectorAll('.preset-option');
    const verticalSliders = document.querySelectorAll('.vertical-slider');

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
        
        window.dynamicEQ.setAdaptiveMode(adaptiveEnabled);
        
        if (!adaptiveEnabled) {
            // Clear preset selection and reset to flat
            presetOptions.forEach(option => option.classList.remove('active'));
            currentPreset = null;
            window.dynamicEQ.currentPreset = null;
            // Reset to flat EQ when disabling adaptive mode
            window.dynamicEQ.applyPreset('flat');
            window.dynamicEQ.stopAnalysis()
        }
    });
    
    document.getElementById('distoggle')?.addEventListener('click', () => {
        distortEnabled = !distortEnabled;
        document.getElementById('distoggle').classList.toggle('active', distortEnabled);
        
        
        if (!distortEnabled) {
            window.dynamicEQ.stopdistort();
        } else if(distortEnabled) {
            window.dynamicEQ.startdistort();
            console.log('onn')
        }
    });

    // Adaptive intensity presets (chill, normal, aggressive)
    const adaptiveIntensityOptions = document.querySelectorAll('[data-preset="chill2"], [data-preset="normal"], [data-preset="aggressive"]');
    
    adaptiveIntensityOptions.forEach(option => {
        option.addEventListener('click', () => {
            if (!adaptiveEnabled) return; // Only work when adaptive mode is enabled
            
            // Remove active from all intensity options
            adaptiveIntensityOptions.forEach(opt => opt.classList.remove('active'));
            
            // Add active to clicked option
            option.classList.add('active');
            
            // Set adaptive intensity
            const intensity = option.dataset.preset;
            window.dynamicEQ.setAdaptiveIntensity(intensity);
            
            console.log(`Adaptive intensity set to: ${intensity}`);
        });
    });

    // Preset selection
    presetOptions.forEach(option => {
        option.addEventListener('click', () => {
            if (!adaptiveEnabled) return;
            
            // Remove active from all options
            presetOptions.forEach(opt => opt.classList.remove('active'));
            
            // Add active to clicked option
            option.classList.add('active');
            
            // Store the user's choice - the EQ will now work in this mode
            const preset = option.dataset.preset;
            currentPreset = preset;
            
            console.log(`User selected ${preset} mode - EQ will dynamically adjust for ${preset} focus`);
        });
    });

    // Update gain value display
    function updateGainValue(slider) {
        const gainValue = slider.parentElement.nextElementSibling;
        const value = parseFloat(slider.value);
        const sign = value >= 0 ? '+' : '';
        gainValue.textContent = `${sign}${value} dB`;
    }

    // Slider change events
    verticalSliders.forEach((slider, index) => {
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
    
});



// Global helper functions
window.attachEQToAudio = function(audioElement) {
    return window.dynamicEQ.attachToAudio(audioElement);
};

window.getEQStatus = function() {
    return window.dynamicEQ.getStatus();
};



// Export for module environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DynamicEQ, dynamicEQ: window.dynamicEQ };
}

