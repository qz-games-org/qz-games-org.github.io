/*
// Spatial Audio System Extension for Dynamic EQ
class SpatialAudio {
    constructor() {
        this.audioContext = null;
        this.inputNode = null;
        this.outputNode = null;
        this.spatialMode = 'stereo'; // stereo, 2.1, 5.1, 7.1, spatial
        this.isActive = false;
        
        // Spatial processing nodes
        this.splitter = null;
        this.merger = null;
        this.panners = [];
        this.delays = [];
        this.gains = [];
        this.convolver = null;
        
        // 3D positioning
        this.listenerPosition = { x: 0, y: 0, z: 0 };
        this.sourcePosition = { x: 0, y: 0, z: -1 };
    }
    
    init(audioContext) {
        this.audioContext = audioContext;
        this.buildSpatialNodes();
    }
    
    buildSpatialNodes() {
        if (!this.audioContext) return;
        
        const ctx = this.audioContext;
        
        // Create input/output nodes
        this.inputNode = ctx.createGain();
        this.outputNode = ctx.createGain();
        
        // Channel splitter/merger for surround processing
        this.splitter = ctx.createChannelSplitter(2);
        this.merger = ctx.createChannelMerger(8); // Support up to 7.1
        
        // Convolver for spatial reverb
        this.convolver = ctx.createConvolver();
        
        // Initialize with stereo passthrough
        this.inputNode.connect(this.outputNode);
        
        console.log('Spatial audio nodes initialized');
    }
    
    setSpatialMode(mode) {
        if (this.spatialMode === mode) return;
        
        console.log(`🔊 Switching to ${mode} spatial audio`);
        
        // Disconnect current routing
        this.disconnectAll();
        
        this.spatialMode = mode;
        
        // Setup new spatial configuration
        switch (mode) {
            case '2.1':
                this.setup21Surround();
                break;
            case '5.1':
                this.setup51Surround();
                break;
            case '7.1':
                this.setup71Surround();
                break;
            case 'spatial':
                this.setupSpatialAudio();
                break;
            default:
                this.setupStereo();
        }
        
        this.isActive = mode !== 'stereo';
    }
    
    disconnectAll() {
        try {
            this.inputNode.disconnect();
            this.splitter.disconnect();
            this.merger.disconnect();
            this.panners.forEach(panner => panner.disconnect());
            this.delays.forEach(delay => delay.disconnect());
            this.gains.forEach(gain => gain.disconnect());
            
            // Clear arrays
            this.panners = [];
            this.delays = [];
            this.gains = [];
        } catch (e) {
            // Ignore disconnect errors
        }
    }
    
    setupStereo() {
        // Simple passthrough
        this.inputNode.connect(this.outputNode);
        console.log('🔊 Stereo mode active');
    }
    
    setup21Surround() {
        const ctx = this.audioContext;
        
        // Split stereo input
        this.inputNode.connect(this.splitter);
        
        // Create bass enhancement for .1 channel
        const bassFilter = ctx.createBiquadFilter();
        bassFilter.type = 'lowpass';
        bassFilter.frequency.setValueAtTime(120, ctx.currentTime);
        bassFilter.Q.setValueAtTime(0.7, ctx.currentTime);
        
        const bassGain = ctx.createGain();
        bassGain.gain.setValueAtTime(1.5, ctx.currentTime);
        
        // Route left channel (0) -> left out (0)
        this.splitter.connect(this.merger, 0, 0);
        
        // Route right channel (1) -> right out (1)
        this.splitter.connect(this.merger, 1, 1);
        
        // Create LFE channel from summed stereo
        const lfeGain = ctx.createGain();
        lfeGain.gain.setValueAtTime(0.5, ctx.currentTime);
        
        this.inputNode.connect(bassFilter).connect(bassGain).connect(lfeGain);
        lfeGain.connect(this.merger, 0, 3); // LFE channel
        
        this.merger.connect(this.outputNode);
        
        this.gains.push(bassGain, lfeGain);
        
        console.log('🔊 2.1 Surround active - Enhanced bass channel');
    }
    
    setup51Surround() {
        const ctx = this.audioContext;
        
        this.inputNode.connect(this.splitter);
        
        // Create delay and gain nodes for each channel
        const delays = {
            center: ctx.createDelay(0.1),
            surroundL: ctx.createDelay(0.1),
            surroundR: ctx.createDelay(0.1),
            lfe: ctx.createDelay(0.1)
        };
        
        const gains = {
            center: ctx.createGain(),
            surroundL: ctx.createGain(),
            surroundR: ctx.createGain(),
            lfe: ctx.createGain()
        };
        
        // Set delays for spatial effect
        delays.center.delayTime.setValueAtTime(0.005, ctx.currentTime);
        delays.surroundL.delayTime.setValueAtTime(0.015, ctx.currentTime);
        delays.surroundR.delayTime.setValueAtTime(0.020, ctx.currentTime);
        delays.lfe.delayTime.setValueAtTime(0.008, ctx.currentTime);
        
        // Set gain levels
        gains.center.gain.setValueAtTime(0.7, ctx.currentTime);
        gains.surroundL.gain.setValueAtTime(0.5, ctx.currentTime);
        gains.surroundR.gain.setValueAtTime(0.5, ctx.currentTime);
        gains.lfe.gain.setValueAtTime(1.2, ctx.currentTime);
        
        // Route channels
        // Left -> Left (0)
        this.splitter.connect(this.merger, 0, 0);
        
        // Right -> Right (1)
        this.splitter.connect(this.merger, 1, 1);
        
        // Center -> Center (2) - mix of L+R with delay
        this.inputNode.connect(delays.center).connect(gains.center);
        gains.center.connect(this.merger, 0, 2);
        
        // LFE -> LFE (3) - bass from both channels
        const lfeFilter = ctx.createBiquadFilter();
        lfeFilter.type = 'lowpass';
        lfeFilter.frequency.setValueAtTime(120, ctx.currentTime);
        
        this.inputNode.connect(lfeFilter).connect(delays.lfe).connect(gains.lfe);
        gains.lfe.connect(this.merger, 0, 3);
        
        // Surround Left -> SL (4)
        this.splitter.connect(delays.surroundL, 0).connect(gains.surroundL);
        gains.surroundL.connect(this.merger, 0, 4);
        
        // Surround Right -> SR (5)
        this.splitter.connect(delays.surroundR, 1).connect(gains.surroundR);
        gains.surroundR.connect(this.merger, 0, 5);
        
        this.merger.connect(this.outputNode);
        
        // Store references
        this.delays = Object.values(delays);
        this.gains = Object.values(gains);
        
        console.log('🔊 5.1 Surround active - Full surround matrix');
    }
    
    setup71Surround() {
        // Enhanced version of 5.1 with additional rear channels
        this.setup51Surround();
        
        const ctx = this.audioContext;
        
        // Add rear left and rear right channels
        const rearDelayL = ctx.createDelay(0.1);
        const rearDelayR = ctx.createDelay(0.1);
        const rearGainL = ctx.createGain();
        const rearGainR = ctx.createGain();
        
        rearDelayL.delayTime.setValueAtTime(0.025, ctx.currentTime);
        rearDelayR.delayTime.setValueAtTime(0.030, ctx.currentTime);
        rearGainL.gain.setValueAtTime(0.4, ctx.currentTime);
        rearGainR.gain.setValueAtTime(0.4, ctx.currentTime);
        
        // Route to rear channels (6, 7)
        this.splitter.connect(rearDelayL, 0);
        rearDelayL.connect(rearGainL);
        rearGainL.connect(this.merger, 0, 6);
        
        this.splitter.connect(rearDelayR, 1);
        rearDelayR.connect(rearGainR);
        rearGainR.connect(this.merger, 0, 7);
        
        this.delays.push(rearDelayL, rearDelayR);
        this.gains.push(rearGainL, rearGainR);
        
        console.log('🔊 7.1 Surround active - Extended rear channels');
    }
    
    setupSpatialAudio() {
        const ctx = this.audioContext;
        
        // Use Web Audio's HRTF-based 3D audio
        const panner = ctx.createPanner();
        panner.panningModel = 'HRTF';
        panner.distanceModel = 'inverse';
        panner.refDistance = 1;
        panner.maxDistance = 10;
        panner.rolloffFactor = 1;
        panner.coneInnerAngle = 360;
        panner.coneOuterAngle = 0;
        panner.coneOuterGain = 0;
        
        // Set initial 3D position
        panner.positionX.setValueAtTime(this.sourcePosition.x, ctx.currentTime);
        panner.positionY.setValueAtTime(this.sourcePosition.y, ctx.currentTime);
        panner.positionZ.setValueAtTime(this.sourcePosition.z, ctx.currentTime);
        
        // Set listener orientation
        if (ctx.listener.forwardX) {
            ctx.listener.forwardX.setValueAtTime(0, ctx.currentTime);
            ctx.listener.forwardY.setValueAtTime(0, ctx.currentTime);
            ctx.listener.forwardZ.setValueAtTime(-1, ctx.currentTime);
            ctx.listener.upX.setValueAtTime(0, ctx.currentTime);
            ctx.listener.upY.setValueAtTime(1, ctx.currentTime);
            ctx.listener.upZ.setValueAtTime(0, ctx.currentTime);
        }
        
        // Add stereo width enhancement
        const widthGain = ctx.createGain();
        widthGain.gain.setValueAtTime(1.2, ctx.currentTime);
        
        this.inputNode.connect(panner).connect(widthGain).connect(this.outputNode);
        
        this.panners.push(panner);
        this.gains.push(widthGain);
        
        console.log('🔊 Spatial Audio active - 3D HRTF positioning');
    }
    
    // Dynamic positioning based on frequency content
    updateSpatialPosition(bassLevel, midLevel, trebleLevel) {
        if (this.spatialMode !== 'spatial' || this.panners.length === 0) return;
        
        const panner = this.panners[0];
        const ctx = this.audioContext;
        
        // Move audio source based on frequency content
        const bassInfluence = (bassLevel / 255) * 0.5; // 0 to 0.5
        const trebleInfluence = (trebleLevel / 255) * 0.3; // 0 to 0.3
        
        // X: Stereo width based on treble content
        const x = (trebleInfluence - 0.15) * 2; // -0.3 to 0.3
        
        // Y: Height based on frequency balance
        const y = (midLevel / 255) * 0.4 - 0.2; // -0.2 to 0.2
        
        // Z: Depth based on bass (more bass = closer)
        const z = -1 + bassInfluence; // -1 to -0.5
        
        panner.positionX.setTargetAtTime(x, ctx.currentTime, 0.1);
        panner.positionY.setTargetAtTime(y, ctx.currentTime, 0.1);
        panner.positionZ.setTargetAtTime(z, ctx.currentTime, 0.1);
    }
    
    getStatus() {
        return {
            spatialMode: this.spatialMode,
            isActive: this.isActive,
            hasNodes: !!this.inputNode
        };
    }
}

// Add spatial audio methods to existing DynamicEQ class
Object.assign(window.dynamicEQ.constructor.prototype, {
    initSpatialAudio() {
        if (!this.spatialAudio) {
            this.spatialAudio = new SpatialAudio();
            this.spatialEnabled = false;
        }
        if (this.audioContext) {
            this.spatialAudio.init(this.audioContext);
        }
    },
    
    setSpatialMode(mode) {
        if (!this.spatialAudio) this.initSpatialAudio();
        
        this.spatialAudio.setSpatialMode(mode);
        this.spatialEnabled = mode !== 'stereo';
        
        if (this.isActive) {
            if (this.spatialEnabled) {
                this.insertSpatialAudio();
            } else {
                this.bypassSpatialAudio();
            }
        }
    },
    
    insertSpatialAudio() {
        if (!this.spatialAudio.inputNode || !this._wired) return;
        
        try {
            const { masterGain } = window.SharedAudio.get(this.audioElement);
            
            // Disconnect direct EQ -> master connection
            this.gainNode.disconnect(masterGain);
            
            // Route through spatial: EQ -> spatial -> master
            this.gainNode.connect(this.spatialAudio.inputNode);
            this.spatialAudio.outputNode.connect(masterGain);
            
            console.log('Spatial audio inserted into EQ chain');
        } catch (error) {
            console.error('Failed to insert spatial audio:', error);
        }
    },
    
    bypassSpatialAudio() {
        if (!this._wired) return;
        
        try {
            const { masterGain } = window.SharedAudio.get(this.audioElement);
            
            // Disconnect spatial routing
            this.gainNode.disconnect();
            if (this.spatialAudio.outputNode) {
                this.spatialAudio.outputNode.disconnect();
            }
            
            // Direct EQ -> master
            this.gainNode.connect(masterGain);
            
            console.log('Spatial audio bypassed');
        } catch (error) {
            console.error('Failed to bypass spatial audio:', error);
        }
    }
});

// Override the enable method to include spatial audio
const originalEnable = window.dynamicEQ.enable;
window.dynamicEQ.enable = function() {
    const result = originalEnable.call(this);
    
    if (result && this.spatialEnabled) {
        this.insertSpatialAudio();
    }
    
    return result;
};

// Override buildNodes to initialize spatial audio
const originalBuildNodes = window.dynamicEQ.buildNodes;
window.dynamicEQ.buildNodes = function(ctx) {
    originalBuildNodes.call(this, ctx);
    this.initSpatialAudio();
};

// Override analyzeFrequencies to update spatial positioning
const originalAnalyzeFrequencies = window.dynamicEQ.analyzeFrequencies;
window.dynamicEQ.analyzeFrequencies = function() {
    originalAnalyzeFrequencies.call(this);
    
    if (this.spatialEnabled && this.spatialAudio) {
        this.spatialAudio.updateSpatialPosition(
            this.bassLevel, 
            this.midLevel, 
            this.trebleLevel
        );
    }
};

// Add spatial control integration to menu
document.addEventListener('DOMContentLoaded', () => {
    // Virtual Sound toggle
    let virtualSoundEnabled = false;
    const surroundToggle = document.getElementById('surroundToggle');
    const virtualSoundContent = document.getElementById('virtualSoundContent'); // Container for spatial options
    
    surroundToggle?.addEventListener('click', () => {
        virtualSoundEnabled = !virtualSoundEnabled;
        surroundToggle.classList.toggle('active', virtualSoundEnabled);
        virtualSoundContent?.classList.toggle('enabled', virtualSoundEnabled);
        
        if (!virtualSoundEnabled) {
            // Disable spatial audio when virtual sound is turned off
            window.dynamicEQ.setSpatialMode('stereo');
            // Clear all spatial preset selections
            const spatialPresets = document.querySelectorAll('[data-preset="2.1"], [data-preset="5.1"], [data-preset="7.1"], [data-preset="spatial"]');
            spatialPresets.forEach(opt => opt.classList.remove('activee'));
        }
        
        console.log(`Virtual Sound ${virtualSoundEnabled ? 'enabled' : 'disabled'}`);
    });
    
    // Find spatial preset options
    const spatialPresets = document.querySelectorAll('[data-preset="2.1"], [data-preset="5.1"], [data-preset="7.1"], [data-preset="spatial"]');
    
    spatialPresets.forEach(option => {
        option.addEventListener('click', () => {
            // Only work if virtual sound is enabled
            if (!virtualSoundEnabled) return;
            
            // Remove active from all spatial options
            spatialPresets.forEach(opt => opt.classList.remove('activee'));
            
            // Add active to clicked option
            option.classList.add('activee');
            
            // Apply spatial mode
            const mode = option.dataset.preset;
            window.dynamicEQ.setSpatialMode(mode);
            
            console.log(`User selected ${mode} spatial audio mode`);
        });
    });
    
    // Auto-attach to existing audio elements
    setTimeout(() => {
        const audioElements = document.querySelectorAll('audio');
        if (audioElements.length > 0) {
            window.dynamicEQ.attachToAudio(audioElements[0]);
        }
    }, 100);
});

// Global helper for spatial control
window.setSpatialMode = function(mode) {
    return window.dynamicEQ.setSpatialMode(mode);
};

console.log('🔊 Enhanced Dynamic EQ with Spatial Audio loaded');
*/

//new
// Enhanced Spatial Audio System with Improved Quality
/*
// Spatial Audio System Extension for Dynamic EQ
class SpatialAudio {
    constructor() {
        this.audioContext = null;
        this.inputNode = null;
        this.outputNode = null;
        this.spatialMode = 'stereo'; // stereo, 2.1, 5.1, 7.1, spatial
        this.isActive = false;
        
        // Spatial processing nodes
        this.splitter = null;
        this.merger = null;
        this.panners = [];
        this.delays = [];
        this.gains = [];
        this.convolver = null;
        
        // 3D positioning
        this.listenerPosition = { x: 0, y: 0, z: 0 };
        this.sourcePosition = { x: 0, y: 0, z: -1 };
    }
    
    init(audioContext) {
        this.audioContext = audioContext;
        this.buildSpatialNodes();
    }
    
    buildSpatialNodes() {
        if (!this.audioContext) return;
        
        const ctx = this.audioContext;
        
        // Create input/output nodes
        this.inputNode = ctx.createGain();
        this.outputNode = ctx.createGain();
        
        // Channel splitter/merger for surround processing
        this.splitter = ctx.createChannelSplitter(2);
        this.merger = ctx.createChannelMerger(8); // Support up to 7.1
        
        // Convolver for spatial reverb
        this.convolver = ctx.createConvolver();
        
        // Initialize with stereo passthrough
        this.inputNode.connect(this.outputNode);
        
        console.log('Spatial audio nodes initialized');
    }
    
    setSpatialMode(mode) {
        if (this.spatialMode === mode) return;
        
        console.log(`🔊 Switching to ${mode} spatial audio`);
        
        // Disconnect current routing
        this.disconnectAll();
        
        this.spatialMode = mode;
        
        // Setup new spatial configuration
        switch (mode) {
            case '2.1':
                this.setup21Surround();
                break;
            case '5.1':
                this.setup51Surround();
                break;
            case '7.1':
                this.setup71Surround();
                break;
            case 'spatial':
                this.setupSpatialAudio();
                break;
            default:
                this.setupStereo();
        }
        
        this.isActive = mode !== 'stereo';
    }
    
    disconnectAll() {
        try {
            this.inputNode.disconnect();
            this.splitter.disconnect();
            this.merger.disconnect();
            this.panners.forEach(panner => panner.disconnect());
            this.delays.forEach(delay => delay.disconnect());
            this.gains.forEach(gain => gain.disconnect());
            
            // Clear arrays
            this.panners = [];
            this.delays = [];
            this.gains = [];
        } catch (e) {
            // Ignore disconnect errors
        }
    }
    
    setupStereo() {
        // Simple passthrough
        this.inputNode.connect(this.outputNode);
        console.log('🔊 Stereo mode active');
    }
    
    setup21Surround() {
        const ctx = this.audioContext;
        
        // Split stereo input
        this.inputNode.connect(this.splitter);
        
        // Create bass enhancement for .1 channel
        const bassFilter = ctx.createBiquadFilter();
        bassFilter.type = 'lowpass';
        bassFilter.frequency.setValueAtTime(120, ctx.currentTime);
        bassFilter.Q.setValueAtTime(0.7, ctx.currentTime);
        
        const bassGain = ctx.createGain();
        bassGain.gain.setValueAtTime(1.5, ctx.currentTime);
        
        // Route left channel (0) -> left out (0)
        this.splitter.connect(this.merger, 0, 0);
        
        // Route right channel (1) -> right out (1)
        this.splitter.connect(this.merger, 1, 1);
        
        // Create LFE channel from summed stereo
        const lfeGain = ctx.createGain();
        lfeGain.gain.setValueAtTime(0.5, ctx.currentTime);
        
        this.inputNode.connect(bassFilter).connect(bassGain).connect(lfeGain);
        lfeGain.connect(this.merger, 0, 3); // LFE channel
        
        this.merger.connect(this.outputNode);
        
        this.gains.push(bassGain, lfeGain);
        
        console.log('🔊 2.1 Surround active - Enhanced bass channel');
    }
    
    setup51Surround() {
        const ctx = this.audioContext;
        
        this.inputNode.connect(this.splitter);
        
        // Create delay and gain nodes for each channel
        const delays = {
            center: ctx.createDelay(0.1),
            surroundL: ctx.createDelay(0.1),
            surroundR: ctx.createDelay(0.1),
            lfe: ctx.createDelay(0.1)
        };
        
        const gains = {
            center: ctx.createGain(),
            surroundL: ctx.createGain(),
            surroundR: ctx.createGain(),
            lfe: ctx.createGain()
        };
        
        // Set delays for spatial effect
        delays.center.delayTime.setValueAtTime(0.005, ctx.currentTime);
        delays.surroundL.delayTime.setValueAtTime(0.015, ctx.currentTime);
        delays.surroundR.delayTime.setValueAtTime(0.020, ctx.currentTime);
        delays.lfe.delayTime.setValueAtTime(0.008, ctx.currentTime);
        
        // Set gain levels
        gains.center.gain.setValueAtTime(0.7, ctx.currentTime);
        gains.surroundL.gain.setValueAtTime(0.5, ctx.currentTime);
        gains.surroundR.gain.setValueAtTime(0.5, ctx.currentTime);
        gains.lfe.gain.setValueAtTime(1.2, ctx.currentTime);
        
        // Route channels
        // Left -> Left (0)
        this.splitter.connect(this.merger, 0, 0);
        
        // Right -> Right (1)
        this.splitter.connect(this.merger, 1, 1);
        
        // Center -> Center (2) - mix of L+R with delay
        this.inputNode.connect(delays.center).connect(gains.center);
        gains.center.connect(this.merger, 0, 2);
        
        // LFE -> LFE (3) - bass from both channels
        const lfeFilter = ctx.createBiquadFilter();
        lfeFilter.type = 'lowpass';
        lfeFilter.frequency.setValueAtTime(120, ctx.currentTime);
        
        this.inputNode.connect(lfeFilter).connect(delays.lfe).connect(gains.lfe);
        gains.lfe.connect(this.merger, 0, 3);
        
        // Surround Left -> SL (4)
        this.splitter.connect(delays.surroundL, 0).connect(gains.surroundL);
        gains.surroundL.connect(this.merger, 0, 4);
        
        // Surround Right -> SR (5)
        this.splitter.connect(delays.surroundR, 1).connect(gains.surroundR);
        gains.surroundR.connect(this.merger, 0, 5);
        
        this.merger.connect(this.outputNode);
        
        // Store references
        this.delays = Object.values(delays);
        this.gains = Object.values(gains);
        
        console.log('🔊 5.1 Surround active - Full surround matrix');
    }
    
    setup71Surround() {
        // Enhanced version of 5.1 with additional rear channels
        this.setup51Surround();
        
        const ctx = this.audioContext;
        
        // Add rear left and rear right channels
        const rearDelayL = ctx.createDelay(0.1);
        const rearDelayR = ctx.createDelay(0.1);
        const rearGainL = ctx.createGain();
        const rearGainR = ctx.createGain();
        
        rearDelayL.delayTime.setValueAtTime(0.025, ctx.currentTime);
        rearDelayR.delayTime.setValueAtTime(0.030, ctx.currentTime);
        rearGainL.gain.setValueAtTime(0.4, ctx.currentTime);
        rearGainR.gain.setValueAtTime(0.4, ctx.currentTime);
        
        // Route to rear channels (6, 7)
        this.splitter.connect(rearDelayL, 0);
        rearDelayL.connect(rearGainL);
        rearGainL.connect(this.merger, 0, 6);
        
        this.splitter.connect(rearDelayR, 1);
        rearDelayR.connect(rearGainR);
        rearGainR.connect(this.merger, 0, 7);
        
        this.delays.push(rearDelayL, rearDelayR);
        this.gains.push(rearGainL, rearGainR);
        
        console.log('🔊 7.1 Surround active - Extended rear channels');
    }
    
    setupSpatialAudio() {
        const ctx = this.audioContext;
        
        // Use Web Audio's HRTF-based 3D audio
        const panner = ctx.createPanner();
        panner.panningModel = 'HRTF';
        panner.distanceModel = 'inverse';
        panner.refDistance = 1;
        panner.maxDistance = 10;
        panner.rolloffFactor = 1;
        panner.coneInnerAngle = 360;
        panner.coneOuterAngle = 0;
        panner.coneOuterGain = 0;
        
        // Set initial 3D position
        panner.positionX.setValueAtTime(this.sourcePosition.x, ctx.currentTime);
        panner.positionY.setValueAtTime(this.sourcePosition.y, ctx.currentTime);
        panner.positionZ.setValueAtTime(this.sourcePosition.z, ctx.currentTime);
        
        // Set listener orientation
        if (ctx.listener.forwardX) {
            ctx.listener.forwardX.setValueAtTime(0, ctx.currentTime);
            ctx.listener.forwardY.setValueAtTime(0, ctx.currentTime);
            ctx.listener.forwardZ.setValueAtTime(-1, ctx.currentTime);
            ctx.listener.upX.setValueAtTime(0, ctx.currentTime);
            ctx.listener.upY.setValueAtTime(1, ctx.currentTime);
            ctx.listener.upZ.setValueAtTime(0, ctx.currentTime);
        }
        
        // Add stereo width enhancement
        const widthGain = ctx.createGain();
        widthGain.gain.setValueAtTime(1.2, ctx.currentTime);
        
        this.inputNode.connect(panner).connect(widthGain).connect(this.outputNode);
        
        this.panners.push(panner);
        this.gains.push(widthGain);
        
        console.log('🔊 Spatial Audio active - 3D HRTF positioning');
    }
    
    // Dynamic positioning based on frequency content
    updateSpatialPosition(bassLevel, midLevel, trebleLevel) {
        if (this.spatialMode !== 'spatial' || this.panners.length === 0) return;
        
        const panner = this.panners[0];
        const ctx = this.audioContext;
        
        // Move audio source based on frequency content
        const bassInfluence = (bassLevel / 255) * 0.5; // 0 to 0.5
        const trebleInfluence = (trebleLevel / 255) * 0.3; // 0 to 0.3
        
        // X: Stereo width based on treble content
        const x = (trebleInfluence - 0.15) * 2; // -0.3 to 0.3
        
        // Y: Height based on frequency balance
        const y = (midLevel / 255) * 0.4 - 0.2; // -0.2 to 0.2
        
        // Z: Depth based on bass (more bass = closer)
        const z = -1 + bassInfluence; // -1 to -0.5
        
        panner.positionX.setTargetAtTime(x, ctx.currentTime, 0.1);
        panner.positionY.setTargetAtTime(y, ctx.currentTime, 0.1);
        panner.positionZ.setTargetAtTime(z, ctx.currentTime, 0.1);
    }
    
    getStatus() {
        return {
            spatialMode: this.spatialMode,
            isActive: this.isActive,
            hasNodes: !!this.inputNode
        };
    }
}

// Add spatial audio methods to existing DynamicEQ class
Object.assign(window.dynamicEQ.constructor.prototype, {
    initSpatialAudio() {
        if (!this.spatialAudio) {
            this.spatialAudio = new SpatialAudio();
            this.spatialEnabled = false;
        }
        if (this.audioContext) {
            this.spatialAudio.init(this.audioContext);
        }
    },
    
    setSpatialMode(mode) {
        if (!this.spatialAudio) this.initSpatialAudio();
        
        this.spatialAudio.setSpatialMode(mode);
        this.spatialEnabled = mode !== 'stereo';
        
        if (this.isActive) {
            if (this.spatialEnabled) {
                this.insertSpatialAudio();
            } else {
                this.bypassSpatialAudio();
            }
        }
    },
    
    insertSpatialAudio() {
        if (!this.spatialAudio.inputNode || !this._wired) return;
        
        try {
            const { masterGain } = window.SharedAudio.get(this.audioElement);
            
            // Disconnect direct EQ -> master connection
            this.gainNode.disconnect(masterGain);
            
            // Route through spatial: EQ -> spatial -> master
            this.gainNode.connect(this.spatialAudio.inputNode);
            this.spatialAudio.outputNode.connect(masterGain);
            
            console.log('Spatial audio inserted into EQ chain');
        } catch (error) {
            console.error('Failed to insert spatial audio:', error);
        }
    },
    
    bypassSpatialAudio() {
        if (!this._wired) return;
        
        try {
            const { masterGain } = window.SharedAudio.get(this.audioElement);
            
            // Disconnect spatial routing
            this.gainNode.disconnect();
            if (this.spatialAudio.outputNode) {
                this.spatialAudio.outputNode.disconnect();
            }
            
            // Direct EQ -> master
            this.gainNode.connect(masterGain);
            
            console.log('Spatial audio bypassed');
        } catch (error) {
            console.error('Failed to bypass spatial audio:', error);
        }
    }
});

// Override the enable method to include spatial audio
const originalEnable = window.dynamicEQ.enable;
window.dynamicEQ.enable = function() {
    const result = originalEnable.call(this);
    
    if (result && this.spatialEnabled) {
        this.insertSpatialAudio();
    }
    
    return result;
};

// Override buildNodes to initialize spatial audio
const originalBuildNodes = window.dynamicEQ.buildNodes;
window.dynamicEQ.buildNodes = function(ctx) {
    originalBuildNodes.call(this, ctx);
    this.initSpatialAudio();
};

// Override analyzeFrequencies to update spatial positioning
const originalAnalyzeFrequencies = window.dynamicEQ.analyzeFrequencies;
window.dynamicEQ.analyzeFrequencies = function() {
    originalAnalyzeFrequencies.call(this);
    
    if (this.spatialEnabled && this.spatialAudio) {
        this.spatialAudio.updateSpatialPosition(
            this.bassLevel, 
            this.midLevel, 
            this.trebleLevel
        );
    }
};

// Add spatial control integration to menu
document.addEventListener('DOMContentLoaded', () => {
    // Virtual Sound toggle
    let virtualSoundEnabled = false;
    const surroundToggle = document.getElementById('surroundToggle');
    const virtualSoundContent = document.getElementById('virtualSoundContent'); // Container for spatial options
    
    surroundToggle?.addEventListener('click', () => {
        virtualSoundEnabled = !virtualSoundEnabled;
        surroundToggle.classList.toggle('active', virtualSoundEnabled);
        virtualSoundContent?.classList.toggle('enabled', virtualSoundEnabled);
        
        if (!virtualSoundEnabled) {
            // Disable spatial audio when virtual sound is turned off
            window.dynamicEQ.setSpatialMode('stereo');
            // Clear all spatial preset selections
            const spatialPresets = document.querySelectorAll('[data-preset="2.1"], [data-preset="5.1"], [data-preset="7.1"], [data-preset="spatial"]');
            spatialPresets.forEach(opt => opt.classList.remove('activee'));
        }
        
        console.log(`Virtual Sound ${virtualSoundEnabled ? 'enabled' : 'disabled'}`);
    });
    
    // Find spatial preset options
    const spatialPresets = document.querySelectorAll('[data-preset="2.1"], [data-preset="5.1"], [data-preset="7.1"], [data-preset="spatial"]');
    
    spatialPresets.forEach(option => {
        option.addEventListener('click', () => {
            // Only work if virtual sound is enabled
            if (!virtualSoundEnabled) return;
            
            // Remove active from all spatial options
            spatialPresets.forEach(opt => opt.classList.remove('activee'));
            
            // Add active to clicked option
            option.classList.add('activee');
            
            // Apply spatial mode
            const mode = option.dataset.preset;
            window.dynamicEQ.setSpatialMode(mode);
            
            console.log(`User selected ${mode} spatial audio mode`);
        });
    });
    
    // Auto-attach to existing audio elements
    setTimeout(() => {
        const audioElements = document.querySelectorAll('audio');
        if (audioElements.length > 0) {
            window.dynamicEQ.attachToAudio(audioElements[0]);
        }
    }, 100);
});

// Global helper for spatial control
window.setSpatialMode = function(mode) {
    return window.dynamicEQ.setSpatialMode(mode);
};

console.log('🔊 Enhanced Dynamic EQ with Spatial Audio loaded');
*/

//new
// Enhanced Spatial Audio System with Improved Quality
// Fixed Spatial Audio System - No More Switching Errors
class SpatialAudio {
    constructor() {
        this.audioContext = null;
        this.inputNode = null;
        this.outputNode = null;
        this.spatialMode = 'stereo';
        this.isActive = false;
        
        // Single processing chain approach
        this.processingChain = null;
        this.currentNodes = [];
        
        // 3D positioning
        this.sourcePosition = { x: 0, y: 0, z: -1.2 };
        this.spatialIntensity = 0.6;
        this.vocalClarity = 1.2;
    }
    
    init(audioContext) {
        this.audioContext = audioContext;
        this.buildBaseNodes();
    }
    
    buildBaseNodes() {
        if (!this.audioContext) return;
        
        const ctx = this.audioContext;
        
        // Create only the essential input/output nodes
        this.inputNode = ctx.createGain();
        this.outputNode = ctx.createGain();
        
        // Start with direct connection
        this.inputNode.connect(this.outputNode);
        
        console.log('Base spatial audio nodes initialized');
    }
    
    setSpatialMode(mode) {
        if (this.spatialMode === mode) return;
        
        console.log(`🔊 Switching to ${mode} spatial audio`);
        
        this.spatialMode = mode;
        this.rebuildProcessingChain(mode);
        this.isActive = mode !== 'stereo';
    }
    
    rebuildProcessingChain(mode) {
        // Simple approach: create new chain and swap
        const ctx = this.audioContext;
        
        // Create new processing chain
        const newChain = this.createProcessingChain(mode);
        
        // Quick swap - disconnect input from output
        this.inputNode.disconnect();
        
        // Connect new chain
        if (newChain.length > 0) {
            // Connect input to first node in chain
            this.inputNode.connect(newChain[0]);
            
            // Connect chain nodes together
            for (let i = 0; i < newChain.length - 1; i++) {
                newChain[i].connect(newChain[i + 1]);
            }
            
            // Connect last node to output
            newChain[newChain.length - 1].connect(this.outputNode);
        } else {
            // Direct connection for stereo
            this.inputNode.connect(this.outputNode);
        }
        
        // Clean up old nodes (let garbage collector handle it)
        this.currentNodes = newChain;
    }
    
    createProcessingChain(mode) {
        const ctx = this.audioContext;
        const chain = [];
        
        switch (mode) {
            case '2.1':
                chain.push(...this.create21Chain(ctx));
                break;
            case '5.1':
                chain.push(...this.create51Chain(ctx));
                break;
            case '7.1':
                chain.push(...this.create71Chain(ctx));
                break;
            case 'spatial':
                chain.push(...this.createSpatialChain(ctx));
                break;
            default:
                // Empty chain for stereo (direct connection)
                break;
        }
        
        return chain;
    }
    
    create21Chain(ctx) {
        // Simple 2.1 enhancement
        const bassBoost = ctx.createBiquadFilter();
        bassBoost.type = 'peaking';
        bassBoost.frequency.setValueAtTime(80, ctx.currentTime);
        bassBoost.Q.setValueAtTime(1.0, ctx.currentTime);
        bassBoost.gain.setValueAtTime(3, ctx.currentTime);
        
        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.setValueAtTime(-12, ctx.currentTime);
        compressor.knee.setValueAtTime(6, ctx.currentTime);
        compressor.ratio.setValueAtTime(3, ctx.currentTime);
        compressor.attack.setValueAtTime(0.01, ctx.currentTime);
        compressor.release.setValueAtTime(0.2, ctx.currentTime);
        
        return [bassBoost, compressor];
    }
    
    create51Chain(ctx) {
        // Enhanced stereo with surround simulation
        const vocalBoost = ctx.createBiquadFilter();
        vocalBoost.type = 'peaking';
        vocalBoost.frequency.setValueAtTime(2500, ctx.currentTime);
        vocalBoost.Q.setValueAtTime(0.8, ctx.currentTime);
        vocalBoost.gain.setValueAtTime(1.5, ctx.currentTime);
        
        const surroundDelay = ctx.createDelay(0.1);
        surroundDelay.delayTime.setValueAtTime(0.015, ctx.currentTime);
        
        const widthGain = ctx.createGain();
        widthGain.gain.setValueAtTime(1.2, ctx.currentTime);
        
        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.setValueAtTime(-15, ctx.currentTime);
        compressor.knee.setValueAtTime(8, ctx.currentTime);
        compressor.ratio.setValueAtTime(2.5, ctx.currentTime);
        compressor.attack.setValueAtTime(0.008, ctx.currentTime);
        compressor.release.setValueAtTime(0.25, ctx.currentTime);
        
        return [vocalBoost, surroundDelay, widthGain, compressor];
    }
    
    create71Chain(ctx) {
        // Enhanced 5.1 with additional processing
        const chain = this.create51Chain(ctx);
        
        const spatialDelay = ctx.createDelay(0.1);
        spatialDelay.delayTime.setValueAtTime(0.025, ctx.currentTime);
        
        const ambientGain = ctx.createGain();
        ambientGain.gain.setValueAtTime(1.1, ctx.currentTime);
        
        chain.push(spatialDelay, ambientGain);
        return chain;
    }
    
    createSpatialChain(ctx) {
        // High-quality spatial processing with vocal preservation
        const vocalEnhancer = ctx.createBiquadFilter();
        vocalEnhancer.type = 'peaking';
        vocalEnhancer.frequency.setValueAtTime(2000, ctx.currentTime);
        vocalEnhancer.Q.setValueAtTime(0.6, ctx.currentTime);
        vocalEnhancer.gain.setValueAtTime(this.vocalClarity, ctx.currentTime);
        
        const presenceBoost = ctx.createBiquadFilter();
        presenceBoost.type = 'peaking';
        presenceBoost.frequency.setValueAtTime(4000, ctx.currentTime);
        presenceBoost.Q.setValueAtTime(0.8, ctx.currentTime);
        presenceBoost.gain.setValueAtTime(1.2, ctx.currentTime);
        
        const panner = ctx.createPanner();
        panner.panningModel = 'HRTF';
        panner.distanceModel = 'inverse';
        panner.refDistance = 1.5;
        panner.maxDistance = 15;
        panner.rolloffFactor = 0.5; // Very gentle for vocal clarity
        panner.coneInnerAngle = 360;
        panner.coneOuterAngle = 0;
        panner.coneOuterGain = 0;
        
        // Set initial position
        panner.positionX.setValueAtTime(this.sourcePosition.x, ctx.currentTime);
        panner.positionY.setValueAtTime(this.sourcePosition.y, ctx.currentTime);
        panner.positionZ.setValueAtTime(this.sourcePosition.z, ctx.currentTime);
        
        // Set listener orientation
        if (ctx.listener.forwardX) {
            ctx.listener.forwardX.setValueAtTime(0, ctx.currentTime);
            ctx.listener.forwardY.setValueAtTime(0, ctx.currentTime);
            ctx.listener.forwardZ.setValueAtTime(-1, ctx.currentTime);
            ctx.listener.upX.setValueAtTime(0, ctx.currentTime);
            ctx.listener.upY.setValueAtTime(1, ctx.currentTime);
            ctx.listener.upZ.setValueAtTime(0, ctx.currentTime);
        }
        
        const widthGain = ctx.createGain();
        widthGain.gain.setValueAtTime(1.1, ctx.currentTime);
        
        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.setValueAtTime(-18, ctx.currentTime);
        compressor.knee.setValueAtTime(6, ctx.currentTime);
        compressor.ratio.setValueAtTime(2, ctx.currentTime);
        compressor.attack.setValueAtTime(0.01, ctx.currentTime);
        compressor.release.setValueAtTime(0.3, ctx.currentTime);
        
        // Store panner reference for position updates
        this.currentPanner = panner;
        
        return [vocalEnhancer, presenceBoost, panner, widthGain, compressor];
    }
    
    updateSpatialPosition(bassLevel, midLevel, trebleLevel) {
        if (this.spatialMode !== 'spatial' || !this.currentPanner) return;
        
        const panner = this.currentPanner;
        const ctx = this.audioContext;
        
        // Normalized levels
        const bass = Math.min(bassLevel / 255, 1.0);
        const mid = Math.min(midLevel / 255, 1.0);
        const treble = Math.min(trebleLevel / 255, 1.0);
        
        // Very subtle movement to preserve vocal clarity
        const intensity = this.spatialIntensity * 0.6;
        
        const x = (treble - 0.5) * intensity * 0.2;
        const y = (mid - 0.5) * intensity * 0.15;
        const z = this.sourcePosition.z + (bass * intensity * 0.1);
        
        // Smooth transitions
        const smoothTime = 0.3;
        panner.positionX.setTargetAtTime(x, ctx.currentTime, smoothTime);
        panner.positionY.setTargetAtTime(y, ctx.currentTime, smoothTime);
        panner.positionZ.setTargetAtTime(z, ctx.currentTime, smoothTime);
    }
    
    setSpatialIntensity(intensity) {
        this.spatialIntensity = Math.max(0.1, Math.min(1.0, intensity));
        console.log(`Spatial intensity: ${this.spatialIntensity}`);
    }
    
    setVocalClarity(clarity) {
        this.vocalClarity = Math.max(0.5, Math.min(2.5, clarity));
        console.log(`Vocal clarity: ${this.vocalClarity}`);
        
        // Update current vocal enhancer if in spatial mode
        if (this.spatialMode === 'spatial' && this.currentNodes.length > 0) {
            const vocalEnhancer = this.currentNodes[0];
            if (vocalEnhancer && vocalEnhancer.gain) {
                vocalEnhancer.gain.setValueAtTime(this.vocalClarity, this.audioContext.currentTime);
            }
        }
    }
    
    getStatus() {
        return {
            spatialMode: this.spatialMode,
            isActive: this.isActive,
            hasNodes: !!this.inputNode,
            spatialIntensity: this.spatialIntensity,
            vocalClarity: this.vocalClarity,
            chainLength: this.currentNodes.length
        };
    }
}

// Simplified integration
Object.assign(window.dynamicEQ.constructor.prototype, {
    initSpatialAudio() {
        if (!this.spatialAudio) {
            this.spatialAudio = new SpatialAudio();
            this.spatialEnabled = false;
        }
        if (this.audioContext) {
            this.spatialAudio.init(this.audioContext);
        }
    },
    
    setSpatialMode(mode) {
        if (!this.spatialAudio) this.initSpatialAudio();
        
        this.spatialAudio.setSpatialMode(mode);
        this.spatialEnabled = mode !== 'stereo';
        
        // Simple reconnection if active
        if (this.isActive && this._wired) {
            this.reconnectSpatialAudio();
        }
    },
    
    reconnectSpatialAudio() {
        if (!this.spatialAudio?.inputNode || !this._wired) return;
        
        try {
            const { masterGain } = window.SharedAudio.get(this.audioElement);
            
            // Simple disconnect and reconnect
            this.gainNode.disconnect();
            
            if (this.spatialEnabled) {
                this.gainNode.connect(this.spatialAudio.inputNode);
                this.spatialAudio.outputNode.connect(masterGain);
                console.log(`✅ Spatial ${this.spatialAudio.spatialMode} connected`);
            } else {
                this.gainNode.connect(masterGain);
                console.log('✅ Direct stereo connected');
            }
        } catch (error) {
            console.error('Reconnection failed:', error);
            // Fallback to direct connection
            try {
                this.gainNode.connect(window.SharedAudio.get(this.audioElement).masterGain);
            } catch (e) {
                console.error('Fallback failed:', e);
            }
        }
    },
    
    setSpatialIntensity(intensity) {
        if (this.spatialAudio) {
            this.spatialAudio.setSpatialIntensity(intensity);
        }
    },
    
    setVocalClarity(clarity) {
        if (this.spatialAudio) {
            this.spatialAudio.setVocalClarity(clarity);
        }
    }
});

// Clean overrides
const originalEnable = window.dynamicEQ.enable;
window.dynamicEQ.enable = function() {
    const result = originalEnable.call(this);
    
    if (result && this.spatialEnabled) {
        setTimeout(() => {
            this.reconnectSpatialAudio();
        }, 50);
    }
    
    return result;
};

const originalBuildNodes = window.dynamicEQ.buildNodes;
window.dynamicEQ.buildNodes = function(ctx) {
    originalBuildNodes.call(this, ctx);
    this.initSpatialAudio();
};

const originalAnalyzeFrequencies = window.dynamicEQ.analyzeFrequencies;
window.dynamicEQ.analyzeFrequencies = function() {
    originalAnalyzeFrequencies.call(this);
    
    if (this.spatialEnabled && this.spatialAudio && typeof this.bassLevel !== 'undefined') {
        this.spatialAudio.updateSpatialPosition(
            this.bassLevel, 
            this.midLevel, 
            this.trebleLevel
        );
    }
};

// UI Integration
document.addEventListener('DOMContentLoaded', () => {
    let virtualSoundEnabled = false;
    const surroundToggle = document.getElementById('surroundToggle');
    const virtualSoundContent = document.getElementById('virtualSoundContent');
    
    surroundToggle?.addEventListener('click', () => {
        virtualSoundEnabled = !virtualSoundEnabled;
        surroundToggle.classList.toggle('active', virtualSoundEnabled);
        virtualSoundContent?.classList.toggle('enabled', virtualSoundEnabled);
        
        if (!virtualSoundEnabled) {
            window.dynamicEQ.setSpatialMode('stereo');
            const spatialPresets = document.querySelectorAll('[data-preset="2.1"], [data-preset="5.1"], [data-preset="7.1"], [data-preset="spatial"]');
            spatialPresets.forEach(opt => opt.classList.remove('activee'));
        }
        
        console.log(`Virtual Sound ${virtualSoundEnabled ? 'ON' : 'OFF'}`);
    });
    
    const spatialPresets = document.querySelectorAll('[data-preset="2.1"], [data-preset="5.1"], [data-preset="7.1"], [data-preset="spatial"]');
    
    spatialPresets.forEach(option => {
        option.addEventListener('click', () => {
            if (!virtualSoundEnabled) return;
            
            spatialPresets.forEach(opt => opt.classList.remove('activee'));
            option.classList.add('activee');
            
            const mode = option.dataset.preset;
            window.dynamicEQ.setSpatialMode(mode);
            
            console.log(`✅ ${mode.toUpperCase()} mode activated`);
        });
    });
    
    // Auto-attach
    setTimeout(() => {
        const audioElements = document.querySelectorAll('audio');
        if (audioElements.length > 0) {
            window.dynamicEQ.attachToAudio(audioElements[0]);
           
        }
    }, 100);
});

// Global controls
window.setSpatialMode = (mode) => window.dynamicEQ.setSpatialMode(mode);
window.setSpatialIntensity = (intensity) => window.dynamicEQ.setSpatialIntensity(intensity);
window.setVocalClarity = (clarity) => window.dynamicEQ.setVocalClarity(clarity);
window.getSpatialStatus = () => window.dynamicEQ.spatialAudio?.getStatus() || { error: 'Not initialized' };

console.log('🔊 Fixed Spatial Audio System - No More Disconnect Errors!');

