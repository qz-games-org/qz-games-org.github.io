
class AutoMixEngine {
  constructor(musicPlayer) {
    this.player = musicPlayer;

    // Enhanced transition settings
    this.transitionDuration = 18;   // When to start transition (seconds before song ends)
    this.crossfadeDuration = 12;    // Length of crossfade (seconds)
    this.bpmTolerance = 8;          // Max BPM difference for beatmatching
    this.filterSweepIntensity = 0.8; // DJ mode filter intensity (0-1)

    // DJ modes: seamless, beatmatch, dj
    this.djMode = 'seamless';

    // Mode-specific options
    this.enableKeyMatching = true;   // Match musical keys in beatmatch/dj modes
    this.enableBeatSync = true;      // Sync beats in beatmatch/dj modes
    this.useSmoothing = true;        // Smooth volume curves
    
    // Audio context for advanced processing
    this.audioContext = null;
    this.initializeAudioContext();
    
    // State management
    this.preloadedAudio = null;
    this.nextSong = null;
    this.nextSongIsRandom = false; // Track if next song is from random/autoplay
    this.queueSnapshot = null; // Snapshot to detect queue changes
    this.isTransitioning = false;
    this.isPreparing = false; // Prevent concurrent preparation
    this.isProgrammaticChange = false; // Track AutoMix internal operations
    this.userVolume = 1.0; // Store user's desired volume

    // Transition state for pause/resume
    this.transitionState = {
      currentAudio: null,
      nextAudio: null,
      startTime: null,
      isPaused: false,
      pausedProgress: 0
    };
    
    // Enhanced analysis cache
    this.bpmCache = new Map();
    this.energyCache = new Map();
    this.keyCache = new Map();
    this.spectralCache = new Map();
    
    // Audio processing nodes
    this.currentGainNode = null;
    this.nextGainNode = null;
    this.currentFilterNode = null;
    this.nextFilterNode = null;
    this.currentCompressor = null;
    this.nextCompressor = null;
    
    this.setupEventListeners();
    console.log('Enhanced Professional AutoMix Engine initialized with advanced audio processing');
  }
  
  estimateBPMFromMetadata(song) {
    let bpm = 120; // Default fallback
    const name = (song.name || song.title || '').toLowerCase();
    const artist = (song.artist || song.performer || '').toLowerCase();
    const genre = (song.genre || '').toLowerCase();
    const album = (song.album || '').toLowerCase();
    
    console.log(`BPM Analysis Debug for: ${song.name || 'Unknown'}`);
    console.log(`- Name: "${name}"`);
    console.log(`- Artist: "${artist}"`);
    console.log(`- Genre: "${genre}"`);
    console.log(`- Album: "${album}"`);
    
    // Check if BPM is explicitly mentioned in metadata
    const bpmRegex = /(\d{2,3})\s*bpm/i;
    const allText = `${name} ${artist} ${genre} ${album}`;
    console.log(`- Combined text: "${allText}"`);
    
    const bpmMatch = allText.match(bpmRegex);
    if (bpmMatch) {
      const extractedBPM = parseInt(bpmMatch[1]);
      if (extractedBPM >= 60 && extractedBPM <= 200) {
        console.log(`✓ Found explicit BPM in metadata: ${extractedBPM}`);
        return extractedBPM;
      }
    }
    
    // More aggressive genre detection
    const genreText = `${name} ${artist} ${genre} ${album}`;
    console.log(`- Analyzing genre text: "${genreText}"`);
    
    // Electronic genres - more specific detection
    if (genreText.match(/\b(house|tech house|deep house|progressive house)\b/i)) {
      if (genreText.includes('deep')) {
        bpm = 122 + Math.random() * 6; // 122-128
        console.log(`✓ Detected Deep House: ${Math.round(bpm)} BPM`);
      } else if (genreText.includes('tech')) {
        bpm = 126 + Math.random() * 4; // 126-130
        console.log(`✓ Detected Tech House: ${Math.round(bpm)} BPM`);
      } else if (genreText.includes('progressive')) {
        bpm = 128 + Math.random() * 4; // 128-132
        console.log(`✓ Detected Progressive House: ${Math.round(bpm)} BPM`);
      } else {
        bpm = 124 + Math.random() * 6; // 124-130
        console.log(`✓ Detected House: ${Math.round(bpm)} BPM`);
      }
    }
    else if (genreText.match(/\btechno\b/i)) {
      if (genreText.includes('minimal')) {
        bpm = 128 + Math.random() * 4; // 128-132
        console.log(`✓ Detected Minimal Techno: ${Math.round(bpm)} BPM`);
      } else if (genreText.includes('hard')) {
        bpm = 135 + Math.random() * 10; // 135-145
        console.log(`✓ Detected Hard Techno: ${Math.round(bpm)} BPM`);
      } else {
        bpm = 130 + Math.random() * 6; // 130-136
        console.log(`✓ Detected Techno: ${Math.round(bpm)} BPM`);
      }
    }
    else if (genreText.match(/\b(trance|uplifting|psytrance)\b/i)) {
      if (genreText.includes('uplifting')) {
        bpm = 136 + Math.random() * 6; // 136-142
        console.log(`✓ Detected Uplifting Trance: ${Math.round(bpm)} BPM`);
      } else if (genreText.includes('psytrance') || genreText.includes('psy')) {
        bpm = 145 + Math.random() * 10; // 145-155
        console.log(`✓ Detected Psytrance: ${Math.round(bpm)} BPM`);
      } else {
        bpm = 132 + Math.random() * 8; // 132-140
        console.log(`✓ Detected Trance: ${Math.round(bpm)} BPM`);
      }
    }
    else if (genreText.match(/\b(drum.?and.?bass|dnb|d&b)\b/i)) {
      bpm = 170 + Math.random() * 10; // 170-180
      console.log(`✓ Detected Drum & Bass: ${Math.round(bpm)} BPM`);
    }
    else if (genreText.match(/\bdubstep\b/i)) {
      bpm = 138 + Math.random() * 6; // 138-144
      console.log(`✓ Detected Dubstep: ${Math.round(bpm)} BPM`);
    }
    else if (genreText.match(/\btrap\b/i)) {
      bpm = 140 + Math.random() * 20; // 140-160
      console.log(`✓ Detected Trap: ${Math.round(bpm)} BPM`);
    }
    else if (genreText.match(/\bbreakbeat\b/i)) {
      bpm = 125 + Math.random() * 15; // 125-140
      console.log(`✓ Detected Breakbeat: ${Math.round(bpm)} BPM`);
    }
    
    // Hip-hop and R&B
    else if (genreText.match(/\b(hip.?hop|rap)\b/i)) {
      if (genreText.includes('old school')) {
        bpm = 90 + Math.random() * 10; // 90-100
        console.log(`✓ Detected Old School Hip-Hop: ${Math.round(bpm)} BPM`);
      } else if (genreText.includes('trap')) {
        bpm = 140 + Math.random() * 20; // 140-160
        console.log(`✓ Detected Hip-Hop Trap: ${Math.round(bpm)} BPM`);
      } else {
        bpm = 80 + Math.random() * 20; // 80-100
        console.log(`✓ Detected Hip-Hop: ${Math.round(bpm)} BPM`);
      }
    }
    else if (genreText.match(/\b(r&b|rnb|r.n.b)\b/i)) {
      bpm = 85 + Math.random() * 15; // 85-100
      console.log(`✓ Detected R&B: ${Math.round(bpm)} BPM`);
    }
    
    // Rock genres
    else if (genreText.match(/\brock\b/i)) {
      if (genreText.includes('punk')) {
        bpm = 150 + Math.random() * 30; // 150-180
        console.log(`✓ Detected Punk Rock: ${Math.round(bpm)} BPM`);
      } else if (genreText.includes('metal')) {
        bpm = 120 + Math.random() * 40; // 120-160
        console.log(`✓ Detected Metal: ${Math.round(bpm)} BPM`);
      } else if (genreText.includes('indie')) {
        bpm = 110 + Math.random() * 20; // 110-130
        console.log(`✓ Detected Indie Rock: ${Math.round(bpm)} BPM`);
      } else {
        bpm = 115 + Math.random() * 15; // 115-130
        console.log(`✓ Detected Rock: ${Math.round(bpm)} BPM`);
      }
    }
    
    // Pop and mainstream
    else if (genreText.match(/\bpop\b/i)) {
      if (genreText.includes('dance')) {
        bpm = 120 + Math.random() * 10; // 120-130
        console.log(`✓ Detected Dance Pop: ${Math.round(bpm)} BPM`);
      } else {
        bpm = 110 + Math.random() * 20; // 110-130
        console.log(`✓ Detected Pop: ${Math.round(bpm)} BPM`);
      }
    }
    else if (genreText.match(/\bdisco\b/i)) {
      bpm = 115 + Math.random() * 8; // 115-123
      console.log(`✓ Detected Disco: ${Math.round(bpm)} BPM`);
    }
    else if (genreText.match(/\bfunk\b/i)) {
      bpm = 105 + Math.random() * 15; // 105-120
      console.log(`✓ Detected Funk: ${Math.round(bpm)} BPM`);
    }
    
    // Other genres
    else if (genreText.match(/\breggae\b/i)) {
      bpm = 85 + Math.random() * 10; // 85-95
      console.log(`✓ Detected Reggae: ${Math.round(bpm)} BPM`);
    }
    else if (genreText.match(/\bjazz\b/i)) {
      if (genreText.includes('fusion')) {
        bpm = 120 + Math.random() * 20; // 120-140
        console.log(`✓ Detected Jazz Fusion: ${Math.round(bpm)} BPM`);
      } else {
        bpm = 100 + Math.random() * 40; // 100-140
        console.log(`✓ Detected Jazz: ${Math.round(bpm)} BPM`);
      }
    }
    else if (genreText.match(/\bclassical\b/i)) {
      bpm = 60 + Math.random() * 60; // 60-120
      console.log(`✓ Detected Classical: ${Math.round(bpm)} BPM`);
    }
    else if (genreText.match(/\b(ambient|chill|chillout)\b/i)) {
      bpm = 65 + Math.random() * 15; // 65-80
      console.log(`✓ Detected Ambient/Chill: ${Math.round(bpm)} BPM`);
    }
    else if (genreText.match(/\bdowntempo\b/i)) {
      bpm = 80 + Math.random() * 20; // 80-100
      console.log(`✓ Detected Downtempo: ${Math.round(bpm)} BPM`);
    }
    else {
      console.log(`⚠ No genre match found, using default with variation`);
      bpm = 110 + Math.random() * 20; // 110-130 instead of just 120
    }
    
    // Tempo modifiers
    if (genreText.match(/\b(slow|ballad)\b/i)) {
      bpm *= 0.75;
      console.log(`- Applied slow modifier: ${Math.round(bpm)} BPM`);
    }
    if (genreText.match(/\b(fast|speed|rapid)\b/i)) {
      bpm *= 1.25;
      console.log(`- Applied fast modifier: ${Math.round(bpm)} BPM`);
    }
    if (genreText.match(/\b(remix|extended|club mix)\b/i) && !genreText.includes('chill')) {
      bpm *= 1.05;
      console.log(`- Applied remix modifier: ${Math.round(bpm)} BPM`);
    }
    
    // Add some randomization to avoid all tracks having the same BPM
    const variation = (Math.random() - 0.5) * 4; // ±2 BPM variation
    bpm += variation;
    console.log(`- Added variation (${variation.toFixed(1)}): ${Math.round(bpm)} BPM`);
    
    const finalBPM = Math.max(60, Math.min(200, bpm)); // Clamp to reasonable range
    console.log(`✓ Final BPM: ${Math.round(finalBPM)}`);
    
    return finalBPM;
  }
  
  async attemptAudioBPMAnalysis(song) {
    // Simple tempo analysis based on filename patterns and duration
    try {
      let estimatedBPM = 120;
      
      // Try to infer from filename patterns
      const filename = song.src.split('/').pop().toLowerCase();
      
      // Look for BPM in filename
      const bpmMatch = filename.match(/(\d{2,3})bpm/);
      if (bpmMatch) {
        const fileBPM = parseInt(bpmMatch[1]);
        if (fileBPM >= 60 && fileBPM <= 200) {
          console.log(`Found BPM in filename: ${fileBPM}`);
          return fileBPM;
        }
      }
      
      // Estimate based on track duration (very rough)
      if (song.duration) {
        const duration = song.duration;
        if (duration < 180) { // Short tracks often faster
          estimatedBPM = 130 + Math.random() * 20;
        } else if (duration > 360) { // Long tracks often slower
          estimatedBPM = 100 + Math.random() * 20;
        }
      }
      
      return estimatedBPM;
      
    } catch (err) {
      console.warn('Audio BPM analysis failed:', err);
      return 120 + (Math.random() - 0.5) * 20; // Random variation around 120
    }
  }
  async initializeAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      if (this.audioContext.state === 'suspended') {
        // Resume on first user interaction
        document.addEventListener('click', () => {
          this.audioContext.resume();
        }, { once: true });
      }
      console.log('AudioContext initialized for advanced processing');
    } catch (err) {
      console.warn('AudioContext not available, falling back to basic mode:', err);
    }
  }
  
  setupEventListeners() {
    // Store user volume changes
    if (this.player.audio) {
      const originalVolumeDescriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'volume');
      Object.defineProperty(this.player.audio, 'volume', {
        get: originalVolumeDescriptor.get,
        set: (value) => {
          if (!this.isTransitioning) {
            this.userVolume = value;
          }
          originalVolumeDescriptor.set.call(this.player.audio, value);
        }
      });
    }
    
    this.player.addEventListener('songChanged', async () => {
      if (this.player.doAutoMix) {
        // Analyze current song if not already done
        if (this.player.currentSong && !this.bpmCache.has(this.player.currentSong.id)) {
          await this.analyzeTrackAdvanced(this.player.currentSong);
        }
        this.prepareNextTrack();
      }
    });
    
    this.player.addEventListener('timeUpdate', (currentTime) => {
      if (this.player.doAutoMix && !this.isTransitioning) {
        this.checkTransitionTrigger(currentTime);
      }
    });
    
    this.player.addEventListener('queueUpdated', () => {
      if (this.player.doAutoMix) {
        console.log('Queue updated, re-preparing next track');
        this.prepareNextTrack();
      }
    });
    
    // Store volume changes when user adjusts
    this.player.addEventListener('volumeChange', (volume) => {
      if (!this.isTransitioning) {
        this.userVolume = volume;
      }
    });
  }
  
  getNextSong() {
    // Check queue first (deterministic)
    if (Array.isArray(this.player.queue) && this.player.queue.length > 0) {
      const idx = (typeof this.player.queueIndex === 'number' ? this.player.queueIndex : -1) + 1;
      if (idx < this.player.queue.length) return { song: this.player.queue[idx], isRandom: false };
      if (this.player.repeatMode === 'all') return { song: this.player.queue[0], isRandom: false };
    }
    // Fallback to random if autoplay enabled (non-deterministic)
    if (this.player.autoplayEnabled) {
      const s = this.player.getRandomSong?.();
      if (s && s.src && (s.id ?? true)) return { song: s, isRandom: true };
    }
    return null;
  }

  // Validate that prepared nextSong still matches actual queue position
  validateNextSong() {
    if (!this.nextSong) return false;

    // Skip validation for random/autoplay songs since they're non-deterministic
    if (this.nextSongIsRandom) {
      return true;
    }

    const result = this.getNextSong();
    if (!result) {
      console.warn('AutoMix: No next song in queue anymore');
      return false;
    }

    const actualNext = result.song;
    // Check if prepared song still matches
    if (actualNext.id !== this.nextSong.id || actualNext.src !== this.nextSong.src) {
      console.warn(`AutoMix: Next song mismatch! Expected: ${this.nextSong.name}, Actual: ${actualNext.name}`);
      return false;
    }

    return true;
  }

  // Create queue snapshot for change detection
  createQueueSnapshot() {
    if (!Array.isArray(this.player.queue)) return null;
    const nextResult = this.getNextSong();
    return {
      length: this.player.queue.length,
      index: this.player.queueIndex,
      firstId: this.player.queue[0]?.id,
      nextId: nextResult?.song?.id
    };
  }

  // Check if queue has changed since snapshot
  hasQueueChanged() {
    if (!this.queueSnapshot) return false;

    // Skip queue change detection for random songs (they're non-deterministic)
    if (this.nextSongIsRandom) {
      return false;
    }

    const current = this.createQueueSnapshot();
    if (!current) return true;

    return current.length !== this.queueSnapshot.length ||
           current.index !== this.queueSnapshot.index ||
           current.nextId !== this.queueSnapshot.nextId;
  }
  
  async prepareNextTrack() {
    if (!this.player.doAutoMix) return;

    // Prevent concurrent preparation
    if (this.isPreparing) {
      console.log('AutoMix: Already preparing, skipping...');
      return;
    }

    const result = this.getNextSong();
    if (!result) {
      this.nextSong = null;
      this.nextSongIsRandom = false;
      this.preloadedAudio = null;
      this.queueSnapshot = null;
      return;
    }

    const candidate = result.song;
    const isRandom = result.isRandom;

    const candidateChanged = !this.nextSong || this.nextSong.id !== candidate.id;
    const needsPreload = candidateChanged || !this.preloadedAudio;

    if (!needsPreload) {
      console.log(`AutoMix: Next track ready: ${candidate.name}`);
      return;
    }

    this.isPreparing = true; // Set flag
    this.preloadedAudio = null;
    this.nextSong = candidate;
    this.nextSongIsRandom = isRandom; // Store whether it's random
    this.queueSnapshot = this.createQueueSnapshot(); // Store snapshot

    try {
      console.log(`AutoMix: Preparing: ${candidate.name || candidate.src}`);

      // Analyze the track FIRST before preloading
      await this.analyzeTrackAdvanced(candidate);

      const resp = await fetch(candidate.src, { cache: 'force-cache' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`);

      this.preloadedAudio = { src: candidate.src, preloaded: true };

      const bpm = this.bpmCache.get(candidate.id) || 120;
      console.log(`AutoMix: Ready: ${candidate.name} (${bpm} BPM)`);

    } catch (err) {
      console.error('Preload failed:', err);
      this.preloadedAudio = null;
      this.nextSong = null;
      this.queueSnapshot = null;
    } finally {
      this.isPreparing = false; // Always clear flag
    }
  }
  
  async analyzeTrackAdvanced(song) {
    // Real-time audio BPM analysis
    if (!this.bpmCache.has(song.id)) {
      console.log(`🎵 Analyzing audio BPM for: ${song.name}`);
      
      try {
        const bpm = await this.performAudioBPMAnalysis(song.src);
        if (bpm > 0) {
          this.bpmCache.set(song.id, Math.round(bpm));
          console.log(`✓ Audio BPM detected: ${song.name} = ${Math.round(bpm)} BPM`);
        } else {
          // Only fallback if audio analysis completely fails
          const fallbackBPM = 120 + (Math.random() - 0.5) * 20;
          this.bpmCache.set(song.id, Math.round(fallbackBPM));
          console.warn(`⚠ Audio analysis failed, using fallback: ${Math.round(fallbackBPM)} BPM`);
        }
      } catch (err) {
        console.error('BPM analysis error:', err);
        const fallbackBPM = 120 + (Math.random() - 0.5) * 20;
        this.bpmCache.set(song.id, Math.round(fallbackBPM));
        console.warn(`⚠ Analysis error, using fallback: ${Math.round(fallbackBPM)} BPM`);
      }
    }
    
    // Enhanced energy estimation
    if (!this.energyCache.has(song.id)) {
      let energy = 0.5;
      const text = `${song.name || ''} ${song.artist || ''} ${song.genre || ''}`.toLowerCase();
      
      // Energy indicators
      if (text.includes('club') || text.includes('dance')) energy = 0.9;
      else if (text.includes('remix') || text.includes('extended')) energy = 0.8;
      else if (text.includes('radio edit')) energy = 0.6;
      else if (text.includes('chill') || text.includes('acoustic')) energy = 0.2;
      else if (text.includes('ambient') || text.includes('downtempo')) energy = 0.1;
      else if (text.includes('rock') || text.includes('metal')) energy = 0.8;
      else if (text.includes('punk') || text.includes('hardcore')) energy = 0.9;
      else if (text.includes('classical') || text.includes('jazz')) energy = 0.4;
      else if (text.includes('pop')) energy = 0.6;
      
      this.energyCache.set(song.id, energy);
    }
    
    // Musical key detection using KeyDetectionEngine
    if (!this.keyCache.has(song.id)) {
      if (window.keyDetectionEngine && this.audioContext) {
        try {
          console.log(`🎹 Detecting key for: ${song.name}`);
          const keyResult = await window.keyDetectionEngine.detectKey(song.src, this.audioContext);

          if (keyResult.confidence > 0.3) { // Only accept confident detections
            this.keyCache.set(song.id, keyResult.key);
            console.log(`✓ Key detected: ${keyResult.key} (${keyResult.camelot}) - confidence: ${keyResult.confidence.toFixed(2)}`);
          } else {
            this.keyCache.set(song.id, 'unknown');
            console.warn(`⚠ Low confidence key detection, marked as unknown`);
          }
        } catch (err) {
          console.error('Key detection failed:', err);
          this.keyCache.set(song.id, 'unknown');
        }
      } else {
        // Fallback: parse key from title
        let key = 'unknown';
        const text = (song.name || '').toLowerCase();
        const keyPatterns = [
          { pattern: /\b([a-g]#?)\s*(major|maj)\b/i, type: 'major' },
          { pattern: /\b([a-g]#?)\s*(minor|min)\b/i, type: 'minor' }
        ];

        for (const {pattern, type} of keyPatterns) {
          const match = text.match(pattern);
          if (match) {
            key = `${match[1].toUpperCase()}${type}`;
            break;
          }
        }

        this.keyCache.set(song.id, key);
      }
    }
    
    // Spectral analysis placeholder (would need actual audio analysis)
    if (!this.spectralCache.has(song.id)) {
      const spectral = {
        brightness: 0.5 + Math.random() * 0.4, // High frequency content
        warmth: 0.3 + Math.random() * 0.4,     // Mid-low frequency content
        bassiness: 0.4 + Math.random() * 0.5,  // Low frequency content
        clarity: 0.5 + Math.random() * 0.3     // Overall clarity
      };
      
      this.spectralCache.set(song.id, spectral);
    }
  }
  
  checkTransitionTrigger(currentTime) {
    const duration = this.player.duration ?? this.player.audio?.duration ?? 0;
    const timeRemaining = duration - currentTime;
    
    if (timeRemaining <= this.transitionDuration && timeRemaining > 0 && this.preloadedAudio) {
      this.startTransition();
    }
  }
  
  startTransition() {
    if (this.isTransitioning || !this.nextSong) return;

    // Validate next song is still correct
    if (!this.validateNextSong()) {
      if (!this.isPreparing) {
        console.warn('AutoMix: Next song validation failed, re-preparing...');
        this.prepareNextTrack();
      }
      return;
    }

    // Check if queue changed
    if (this.hasQueueChanged()) {
      if (!this.isPreparing) {
        console.warn('AutoMix: Queue changed, re-preparing...');
        this.prepareNextTrack();
      }
      return;
    }

    // Store current volume before transition
    this.userVolume = this.player.audio.volume;

    console.log(`AutoMix: Starting enhanced transition to ${this.nextSong.name} [${this.djMode}] at volume ${this.userVolume}`);
    this.isTransitioning = true;

    this.performEnhancedTransition();
  }
  async performAudioBPMAnalysis(audioSrc) {
    try {
      if (!this.audioContext) {
        console.warn('AudioContext not available for BPM analysis');
        return 0;
      }

      console.log('🔊 Fetching audio data...');
      const response = await fetch(audioSrc);
      const arrayBuffer = await response.arrayBuffer();
      
      console.log('🎛️ Decoding audio...');
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      // Analyze 60 seconds max for better accuracy
      const sampleRate = audioBuffer.sampleRate;
      const channelData = audioBuffer.getChannelData(0);
      const analysisLength = Math.min(sampleRate * 60, channelData.length);
      const samples = channelData.slice(0, analysisLength);
      
      console.log(`🎯 Analyzing ${analysisLength / sampleRate}s of audio at ${sampleRate}Hz...`);
      
      // Use advanced beat detection
      const bpm = this.performBeatDetection(samples, sampleRate);
      return bpm;
      
    } catch (err) {
      console.error('Audio BPM analysis failed:', err);
      return 0;
    }
  }
  
  performBeatDetection(samples, sampleRate) {
    try {
      console.log('🔍 Starting beat detection...');
      
      // Step 1: Apply high-pass filter to remove low-frequency noise
      const filtered = this.applyHighPassFilter(samples, sampleRate);
      
      // Step 2: Calculate onset detection function
      const onsets = this.findOnsets(filtered, sampleRate);
      
      // Step 3: Find tempo using autocorrelation
      const bpm = this.findTempo(onsets, sampleRate);
      
      console.log(`🎵 Beat detection result: ${bpm} BPM`);
      return bpm;
      
    } catch (err) {
      console.error('Beat detection failed:', err);
      return 0;
    }
  }
  
  applyHighPassFilter(samples, sampleRate) {
    // Simple high-pass filter to emphasize beats
    const cutoff = 100; // 100 Hz cutoff
    const rc = 1.0 / (cutoff * 2 * Math.PI);
    const dt = 1.0 / sampleRate;
    const alpha = rc / (rc + dt);
    
    const filtered = new Float32Array(samples.length);
    filtered[0] = samples[0];
    
    for (let i = 1; i < samples.length; i++) {
      filtered[i] = alpha * (filtered[i-1] + samples[i] - samples[i-1]);
    }
    
    return filtered;
  }
  
  findOnsets(samples, sampleRate) {
    // Onset detection using spectral difference
    const frameSize = 2048;
    const hopSize = 512;
    const onsets = [];
    
    for (let i = 0; i < samples.length - frameSize; i += hopSize) {
      const frame = samples.slice(i, i + frameSize);
      
      // Calculate spectral energy
      const energy = this.calculateEnergy(frame);
      const time = i / sampleRate;
      
      onsets.push({ time, energy });
    }
    
    // Find onset peaks
    return this.findEnergyPeaks(onsets);
  }
  
  calculateEnergy(frame) {
    // Simple energy calculation
    let energy = 0;
    for (let i = 0; i < frame.length; i++) {
      energy += frame[i] * frame[i];
    }
    return Math.sqrt(energy / frame.length);
  }
  
  findEnergyPeaks(onsets) {
    const peaks = [];
    const threshold = this.calculateEnergyThreshold(onsets);
    
    for (let i = 1; i < onsets.length - 1; i++) {
      const current = onsets[i];
      const prev = onsets[i - 1];
      const next = onsets[i + 1];
      
      // Peak detection with threshold
      if (current.energy > prev.energy && 
          current.energy > next.energy && 
          current.energy > threshold) {
        peaks.push(current.time);
      }
    }
    
    console.log(`Found ${peaks.length} onset peaks`);
    return peaks;
  }
  
  calculateEnergyThreshold(onsets) {
    const energies = onsets.map(o => o.energy);
    const mean = energies.reduce((sum, e) => sum + e, 0) / energies.length;
    const sorted = energies.sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    
    // Adaptive threshold: mean + (median * 0.5)
    return mean + (median * 0.5);
  }
  
  findTempo(onsetTimes, sampleRate) {
    if (onsetTimes.length < 4) {
      console.warn('Not enough onsets for tempo calculation');
      return 0;
    }
    
    // Calculate inter-onset intervals
    const intervals = [];
    for (let i = 1; i < onsetTimes.length; i++) {
      intervals.push(onsetTimes[i] - onsetTimes[i-1]);
    }
    
    // Use autocorrelation to find the most likely tempo
    const tempos = this.calculateTempoStrengths(intervals);
    
    // Find the strongest tempo in reasonable BPM range (80-180)
    let bestTempo = 0;
    let bestStrength = 0;
    
    tempos.forEach(({ bpm, strength }) => {
      if (bpm >= 80 && bpm <= 180 && strength > bestStrength) {
        bestTempo = bpm;
        bestStrength = strength;
      }
    });
    
    // If no tempo in range, try half/double time
    if (bestTempo === 0) {
      tempos.forEach(({ bpm, strength }) => {
        const halfTime = bpm / 2;
        const doubleTime = bpm * 2;
        
        if (halfTime >= 80 && halfTime <= 180 && strength > bestStrength) {
          bestTempo = halfTime;
          bestStrength = strength;
        } else if (doubleTime >= 80 && doubleTime <= 180 && strength > bestStrength) {
          bestTempo = doubleTime;
          bestStrength = strength;
        }
      });
    }
    
    console.log(`Strongest tempo: ${bestTempo} BPM (strength: ${bestStrength.toFixed(3)})`);
    return bestTempo;
  }
  
  calculateTempoStrengths(intervals) {
    // Create histogram of intervals
    const histogram = new Map();
    const bucketSize = 0.01; // 10ms resolution
    
    intervals.forEach(interval => {
      const bucket = Math.round(interval / bucketSize) * bucketSize;
      histogram.set(bucket, (histogram.get(bucket) || 0) + 1);
    });
    
    // Convert to tempo and calculate strengths
    const tempos = [];
    histogram.forEach((count, interval) => {
      if (interval > 0) {
        const bpm = 60 / interval;
        const strength = count / intervals.length;
        tempos.push({ bpm, strength });
      }
    });
    
    // Sort by strength
    return tempos.sort((a, b) => b.strength - a.strength);
  }
  
  checkTransitionTrigger(currentTime) {
    const duration = this.player.duration ?? this.player.audio?.duration ?? 0;
    const timeRemaining = duration - currentTime;
    
    if (timeRemaining <= this.transitionDuration && timeRemaining > 0 && this.preloadedAudio) {
      this.startTransition();
    }
  }
  

  async performEnhancedTransition() {
    const currentAudio = this.player.audio;
    const nextSong = this.nextSong;
    
    try {
      // Create next audio element
      const nextAudio = document.createElement('audio');
      nextAudio.src = nextSong.src;
      nextAudio.preload = 'auto';
      nextAudio.volume = 0;
      
      // Wait for next track to be ready
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);
        nextAudio.addEventListener('canplaythrough', () => {
          clearTimeout(timeout);
          resolve();
        }, { once: true });
        nextAudio.load();
      });
      
      // Start playing next track
      await nextAudio.play();
      
      // Store transition elements for pause/resume
      this.transitionState.currentAudio = currentAudio;
      this.transitionState.nextAudio = nextAudio;
      this.transitionState.startTime = performance.now();
      this.transitionState.isPaused = false;

      // Add pause/play listeners for transition control
      this.setupTransitionPauseHandlers(currentAudio, nextAudio);

      // Choose transition based on mode
      switch (this.djMode) {
        case 'seamless':
          await this.performSeamlessTransition(currentAudio, nextAudio);
          break;
        case 'beatmatch':
          await this.performBeatMatchTransition(currentAudio, nextAudio);
          break;
        case 'dj':
          await this.performDJTransition(currentAudio, nextAudio);
          break;
        default:
          await this.performSeamlessTransition(currentAudio, nextAudio);
      }
      
      this.completeTransition(nextAudio, nextSong);

    } catch (err) {
      console.error('Enhanced transition failed:', err);
      this.fallbackTransition();
    }
  }

  // Setup pause/play handlers for transition control
  setupTransitionPauseHandlers(currentAudio, nextAudio) {
    const handlePause = () => {
      // Ignore programmatic pauses from AutoMix operations
      if (this.isProgrammaticChange) return;

      if (this.isTransitioning && !this.transitionState.isPaused) {
        console.log('AutoMix: Pausing transition (user initiated)');
        this.transitionState.isPaused = true;
        currentAudio.pause();
        nextAudio.pause();
      }
    };

    const handlePlay = () => {
      // Ignore programmatic plays from AutoMix operations
      if (this.isProgrammaticChange) return;

      if (this.isTransitioning && this.transitionState.isPaused) {
        console.log('AutoMix: Resuming transition (user initiated)');
        this.transitionState.isPaused = false;
        currentAudio.play().catch(() => {});
        nextAudio.play().catch(() => {});
      }
    };

    // Listen to main player audio for pause/play
    this.player.audio.addEventListener('pause', handlePause);
    this.player.audio.addEventListener('play', handlePlay);

    // Store handlers for cleanup
    this.transitionState.pauseHandler = handlePause;
    this.transitionState.playHandler = handlePlay;
  }

  // Clean up transition state and handlers
  cleanupTransitionState() {
    if (this.transitionState.pauseHandler) {
      this.player.audio.removeEventListener('pause', this.transitionState.pauseHandler);
    }
    if (this.transitionState.playHandler) {
      this.player.audio.removeEventListener('play', this.transitionState.playHandler);
    }

    this.transitionState = {
      currentAudio: null,
      nextAudio: null,
      startTime: null,
      isPaused: false,
      pausedProgress: 0,
      pauseHandler: null,
      playHandler: null
    };
  }
  
  async performSeamlessTransition(currentAudio, nextAudio) {
    console.log('AutoMix: Seamless crossfade');

    const steps = 150;
    const stepDuration = (this.crossfadeDuration * 1000) / steps;

    for (let i = 0; i <= steps; i++) {
      // Wait for unpause if paused
      while (this.transitionState.isPaused) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const progress = i / steps;

      // Ultra-smooth S-curve
      const smoothProgress = this.useSmoothing ?
        this.createUltraSmoothCurve(progress) :
        progress;

      // Volume crossfade
      currentAudio.volume = Math.max(0, Math.min(1, (1 - smoothProgress) * this.userVolume));
      nextAudio.volume = Math.max(0, Math.min(1, smoothProgress * this.userVolume));

      await new Promise(resolve => setTimeout(resolve, stepDuration));
    }

    currentAudio.playbackRate = 1.0;
    nextAudio.playbackRate = 1.0;
  }
  
  async performBeatMatchTransition(currentAudio, nextAudio) {
    console.log('AutoMix: Beat-matched transition with BPM and key matching');

    const currentBPM = this.getCurrentBPM();
    const nextBPM = this.bpmCache.get(this.nextSong?.id) || 120;
    const bpmDiff = Math.abs(currentBPM - nextBPM);

    console.log(`BPM transition: ${currentBPM} → ${nextBPM} (diff: ${bpmDiff})`);

    // Check key matching if enabled
    let keyMatch = false;
    if (this.enableKeyMatching) {
      const currentKey = this.keyCache.get(this.player.currentSong?.id) || 'unknown';
      const nextKey = this.keyCache.get(this.nextSong?.id) || 'unknown';
      keyMatch = this.checkHarmonicCompatibility(currentKey, nextKey);
      console.log(`Key transition: ${currentKey} → ${nextKey} (match: ${keyMatch})`);
    }

    const steps = 200;
    const stepDuration = (this.crossfadeDuration * 1000) / steps;

    for (let i = 0; i <= steps; i++) {
      // Wait for unpause if paused
      while (this.transitionState.isPaused) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const progress = i / steps;

      // Smooth volume curve
      const volumeCurve = this.createUltraSmoothCurve(progress);
      currentAudio.volume = Math.max(0, Math.min(1, (1 - volumeCurve) * this.userVolume));
      nextAudio.volume = Math.max(0, Math.min(1, volumeCurve * this.userVolume));

      // BPM matching if enabled and BPM difference is within tolerance
      if (this.enableBeatSync && bpmDiff > 0 && bpmDiff <= this.bpmTolerance * 2) {
        if (progress < 0.8) {
          // Gradual tempo sync
          const tempoProgress = progress / 0.8;
          const tempoEasing = this.easeInOutCubic(tempoProgress);

          // Adjust tempo to match
          const maxRateChange = bpmDiff <= this.bpmTolerance ? 0.06 : 0.03;
          const targetRate = 1 + (nextBPM / currentBPM - 1) * tempoEasing * maxRateChange;

          currentAudio.playbackRate = Math.max(0.94, Math.min(1.06, targetRate));
          nextAudio.playbackRate = Math.max(0.97, Math.min(1.03, 1 / targetRate));
        } else {
          // Restore natural tempo
          const restoreProgress = (progress - 0.8) / 0.2;
          const restoreEasing = this.easeInOutCubic(restoreProgress);

          currentAudio.playbackRate = this.lerp(currentAudio.playbackRate, 1.0, restoreEasing);
          nextAudio.playbackRate = this.lerp(nextAudio.playbackRate, 1.0, restoreEasing);
        }
      }

      await new Promise(resolve => setTimeout(resolve, stepDuration));
    }

    currentAudio.playbackRate = 1.0;
    nextAudio.playbackRate = 1.0;
  }

  async performDJTransition(currentAudio, nextAudio) {
    console.log('AutoMix: Professional DJ transition with beatmatch + lowpass filter sweep');

    // Get BPM info for beatmatching
    const currentBPM = this.getCurrentBPM();
    const nextBPM = this.bpmCache.get(this.nextSong?.id) || 120;
    const bpmDiff = Math.abs(currentBPM - nextBPM);
    console.log(`DJ Mode - BPM: ${currentBPM} → ${nextBPM} (diff: ${bpmDiff})`);

    const steps = 200;
    const stepDuration = (this.crossfadeDuration * 1000) / steps;
  // Web Audio filter effects using SharedAudio
let useWebAudio = false;
let currentSource, currentLowPass, currentHighPass, currentGain;
let nextSource,   nextLowPass,   nextHighPass,   nextGain;

// locals for ctx/bus per track (cleanup uses these same vars)
let curCtx, nxtCtx, OUT_CUR, OUT_NEXT;
// EQ/mix flags must be visible to CLEANUP
let EQ = null;
let hadEQCurrent = false;
let eqInputDisconnected = false;

let hadEQNext = false;
let eqNextInputDisconnected = false;


if (this.audioContext && window.SharedAudio) {
  try {
    // --- CURRENT track (SharedAudio) ---
    const curShared = window.SharedAudio.get(currentAudio);
    currentSource = curShared.source;
    curCtx = curShared.ctx;
    this.audioContext = curCtx; // align field
    OUT_CUR = curShared.masterGain || curCtx.destination;

    EQ = window.dynamicEQ;
    hadEQCurrent = !!(EQ && EQ.isActive && EQ._wired &&
                      EQ.audioElement === currentAudio &&
                      Array.isArray(EQ.filters) && EQ.filters[0]);
    if (hadEQCurrent) {
      try { currentSource.disconnect(EQ.filters[0]); eqInputDisconnected = true; } catch {}
    }
    
    // --- NEXT track (reuse if present) ---
    let nextShared;
    try { nextShared = window.SharedAudio.get(nextAudio); } catch {}
    if (nextShared?.source && nextShared?.ctx) {
      nextSource = nextShared.source;
      nxtCtx = nextShared.ctx;
      OUT_NEXT = nextShared.masterGain || nxtCtx.destination;
    
      // (rare) if EQ had been wired to nextAudio already, track it too
      hadEQNext = !!(EQ && EQ.isActive && EQ._wired &&
                     EQ.audioElement === nextAudio &&
                     Array.isArray(EQ.filters) && EQ.filters[0]);
      if (hadEQNext) {
        try { nextSource.disconnect(EQ.filters[0]); eqNextInputDisconnected = true; } catch {}
      }
    } else {
      nxtCtx = curCtx;
      OUT_NEXT = OUT_CUR;
      nextSource = curCtx.createMediaElementSource(nextAudio);
    }

    // === Disconnect ONLY the master legs; keep analyser taps alive ===
    try { currentSource.disconnect(OUT_CUR); } catch {}
    try { nextSource.disconnect(OUT_NEXT); }   catch {}

    // Create filter chains (per their own contexts)
    currentLowPass = curCtx.createBiquadFilter();
    currentHighPass = curCtx.createBiquadFilter();
    currentGain    = curCtx.createGain();

    nextLowPass = nxtCtx.createBiquadFilter();
    nextHighPass = nxtCtx.createBiquadFilter();
    nextGain     = nxtCtx.createGain();

    // Init filters
    currentLowPass.type = 'lowpass'; currentLowPass.frequency.value = 20000; currentLowPass.Q.value = 0.7;
    currentHighPass.type = 'highpass'; currentHighPass.frequency.value = 20; currentHighPass.Q.value = 0.7;

    nextLowPass.type = 'lowpass'; nextLowPass.frequency.value = 300; nextLowPass.Q.value = 8;
    nextHighPass.type = 'highpass'; nextHighPass.frequency.value = 150; nextHighPass.Q.value = 3;

    // Wire chains to their buses (the same buses the EQ expects)
    currentSource
      .connect(currentLowPass)
      .connect(currentHighPass)
      .connect(currentGain)
      .connect(OUT_CUR);

    nextSource
      .connect(nextLowPass)
      .connect(nextHighPass)
      .connect(nextGain)
      .connect(OUT_NEXT);

    // Elements feed the graph; start crossfade at 0 via GainNodes
    currentAudio.muted = false; currentAudio.volume = 1.0;
    nextAudio.muted    = false; nextAudio.volume    = 1.0;
    currentGain.gain.value = this.userVolume; // current audible
    nextGain.gain.value    = 0;               // next starts at 0

    useWebAudio = true;
    console.log('DJ filter chains created (using SharedAudio master buses; analyser taps preserved).');
  } catch (err) {
    console.warn('Web Audio filter setup failed, using fallback:', err);
    useWebAudio = false;
  }
}

    for (let i = 0; i <= steps; i++) {
      // Wait for unpause if paused
      while (this.transitionState.isPaused) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const progress = i / steps;

      if (useWebAudio && currentSource && nextSource) {
        // ★ schedule using each context's clock
        const curTime = curCtx.currentTime;
        const nxtTime = nxtCtx.currentTime;

        // === CURRENT TRACK FILTER SWEEP (outgoing - drowns out highs) ===
        const intensity = this.filterSweepIntensity;
        if (progress < 0.6) {
          const p = progress / 0.6;
          const lp = 20000 * Math.pow(1 - p, 2.5 * intensity);
          currentLowPass.frequency.setValueAtTime(Math.max(80, lp), curTime);
          currentLowPass.Q.setValueAtTime(Math.min(20, 0.7 + p * 8 * intensity), curTime);
        } else {
          const p = (progress - 0.6) / 0.4;
          currentLowPass.frequency.setValueAtTime(Math.max(30, 80 * (1 - p * 0.9)), curTime);
          currentHighPass.frequency.setValueAtTime(Math.min(620, 20 + p * 600), curTime);
          currentLowPass.Q.setValueAtTime(20 * intensity, curTime);
          currentHighPass.Q.setValueAtTime(8, curTime);
        }

        // === NEXT TRACK FILTER SWEEP (incoming - starts muffled, opens up) ===
        if (progress < 0.2) {
          nextLowPass.frequency.setValueAtTime(300 * intensity, nxtTime);
          nextLowPass.Q.setValueAtTime(8 * intensity, nxtTime);
          nextHighPass.frequency.setValueAtTime(150, nxtTime);
          nextHighPass.Q.setValueAtTime(3 * intensity, nxtTime);
        } else if (progress < 0.8) {
          const p = (progress - 0.2) / 0.6;
          const nf = 300 * intensity + 19700 * Math.pow(p, 0.6);
          const hf = 150 * Math.pow(1 - p, 1.8);
          nextLowPass.frequency.setValueAtTime(Math.min(20000, nf), nxtTime);
          nextHighPass.frequency.setValueAtTime(Math.max(20, hf), nxtTime);
          nextLowPass.Q.setValueAtTime(Math.max(0.7, 8 * intensity * (1 - Math.pow(p, 0.8))), nxtTime);
          nextHighPass.Q.setValueAtTime(Math.max(0.7, 3 * (1 - p)), nxtTime);
        } else {
          nextLowPass.frequency.setValueAtTime(20000, nxtTime);
          nextHighPass.frequency.setValueAtTime(20, nxtTime);
          nextLowPass.Q.setValueAtTime(0.7, nxtTime);
          nextHighPass.Q.setValueAtTime(0.7, nxtTime);
        }

        // === VOLUME CROSSFADE (via gains, each in its ctx) ===
        const k = this.createDramaticFilterCurve(progress);
        currentGain.gain.setValueAtTime((1 - k) * this.userVolume, curTime);
        nextGain.gain.setValueAtTime(k * this.userVolume, nxtTime);

      } else {
        // Fallback without Web Audio
        const volumeCurve = this.createDramaticFilterCurve(progress);
        currentAudio.volume = Math.max(0, Math.min(1, (1 - volumeCurve) * this.userVolume));
        nextAudio.volume = Math.max(0, Math.min(1, volumeCurve * this.userVolume));
      }

      // === BPM MATCHING (applies to both Web Audio and fallback) ===
      if (this.enableBeatSync && bpmDiff > 0 && bpmDiff <= this.bpmTolerance * 2 && progress < 0.8) {
        const tempoProgress = progress / 0.8;
        const tempoEasing = this.easeInOutCubic(tempoProgress);

        // Adjust tempo to match
        const maxRateChange = bpmDiff <= this.bpmTolerance ? 0.06 : 0.03;
        const targetRate = 1 + (nextBPM / currentBPM - 1) * tempoEasing * maxRateChange;

        currentAudio.playbackRate = Math.max(0.94, Math.min(1.06, targetRate));
        nextAudio.playbackRate = Math.max(0.97, Math.min(1.03, 1 / targetRate));
      } else if (progress >= 0.8) {
        // Restore natural tempo in final phase
        const restoreProgress = (progress - 0.8) / 0.2;
        const restoreEasing = this.easeInOutCubic(restoreProgress);

        currentAudio.playbackRate = this.lerp(currentAudio.playbackRate, 1.0, restoreEasing);
        nextAudio.playbackRate = this.lerp(nextAudio.playbackRate, 1.0, restoreEasing);
      }

      await new Promise(r => setTimeout(r, stepDuration));
    }
  
    // Cleanup and restore
    if (useWebAudio && currentSource && nextSource) {
      const curTime = curCtx.currentTime;
      const nxtTime = nxtCtx.currentTime;
  
      // Reset filters to neutral
      currentLowPass.frequency.setValueAtTime(20000, curTime);
      currentLowPass.Q.setValueAtTime(0.7, curTime);
      currentHighPass.frequency.setValueAtTime(20, curTime);
      currentHighPass.Q.setValueAtTime(0.7, curTime);
  
      nextLowPass.frequency.setValueAtTime(20000, nxtTime);
      nextLowPass.Q.setValueAtTime(0.7, nxtTime);
      nextHighPass.frequency.setValueAtTime(20, nxtTime);
      nextHighPass.Q.setValueAtTime(0.7, nxtTime);
  
      // Cleanup and restore
if (useWebAudio && currentSource && nextSource) {
  const curTime = curCtx.currentTime;
  const nxtTime = nxtCtx.currentTime;

  // Reset filters to neutral
  currentLowPass.frequency.setValueAtTime(20000, curTime);
  currentLowPass.Q.setValueAtTime(0.7, curTime);
  currentHighPass.frequency.setValueAtTime(20, curTime);
  currentHighPass.Q.setValueAtTime(0.7, curTime);

  nextLowPass.frequency.setValueAtTime(20000, nxtTime);
  nextLowPass.Q.setValueAtTime(0.7, nxtTime);
  nextHighPass.frequency.setValueAtTime(20, nxtTime);
  nextHighPass.Q.setValueAtTime(0.7, nxtTime);

  // Disconnect our temporary transition chains
 // Disconnect temp chains
 try { currentGain.disconnect(); }    catch {}
 try { currentHighPass.disconnect(); } catch {}
 try { currentLowPass.disconnect(); }  catch {}
 try { nextGain.disconnect(); }       catch {}
 try { nextHighPass.disconnect(); }    catch {}
 try { nextLowPass.disconnect(); }     catch {}

 // Restore CURRENT routing exactly once
 if (hadEQCurrent && eqInputDisconnected && EQ?.filters?.[0]) {
   // Back into EQ input; do NOT also connect to master
   try { currentSource.connect(EQ.filters[0]); } catch {}
 } else {
   // No EQ inline previously → restore to SharedAudio master
   try { currentSource.disconnect(); } catch {}
   try {
     const cs = window.SharedAudio.get(currentAudio);
     (cs.masterGain || curCtx.destination) && currentSource.connect(cs.masterGain || curCtx.destination);
   } catch {}
 }

 // Restore NEXT routing
 if (hadEQNext && eqNextInputDisconnected && EQ?.filters?.[0]) {
   try { nextSource.connect(EQ.filters[0]); } catch {}
 } else {
   try { nextSource.disconnect(); } catch {}
   try {
     const ns = window.SharedAudio.get(nextAudio);
     (ns.masterGain || nxtCtx.destination) && nextSource.connect(ns.masterGain || nxtCtx.destination);
   } catch {}
 }

 console.log('Transition complete: filters reset and routing restored (no parallel paths).');
} else {
 currentAudio.playbackRate = 1.0;
 nextAudio.playbackRate = 1.0;
}

  }
  }  
  
  // More dramatic curve for filter transitions (unchanged)
  createDramaticFilterCurve(progress) {
    if (progress < 0.05) {
      return progress / 0.05 * 0.02;
    } else if (progress < 0.25) {
      const filterProgress = (progress - 0.05) / 0.2;
      return 0.02 + (filterProgress * 0.08);
    } else if (progress < 0.75) {
      const mainProgress = (progress - 0.25) / 0.5;
      const exponentialCurve = Math.pow(mainProgress, 1.5);
      return 0.1 + (exponentialCurve * 0.8);
    } else {
      const endProgress = (progress - 0.75) / 0.25;
      return 0.9 + (endProgress * 0.1);
    }
  }

  // Curve functions for transitions
  createUltraSmoothCurve(progress) {
    // Enhanced S-curve for ultra-smooth transitions
    return progress * progress * progress * (progress * (progress * 6 - 15) + 10);
  }

  // Utility functions
  easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  lerp(start, end, factor) {
    return start + (end - start) * factor;
  }

  checkHarmonicCompatibility(key1, key2) {
    if (key1 === 'unknown' || key2 === 'unknown') return false;

    // Use KeyDetectionEngine's Camelot wheel compatibility if available
    if (window.keyDetectionEngine) {
      return window.keyDetectionEngine.areKeysCompatible(key1, key2);
    }

    // Fallback: basic compatibility check
    // Same key or relative major/minor
    if (key1 === key2) return true;

    const compatibleKeys = {
      'Cmajor': ['Aminor', 'Fmajor', 'Gmajor', 'Dminor'],
      'Aminor': ['Cmajor', 'Dminor', 'Eminor', 'Fmajor'],
      'Gmajor': ['Eminor', 'Cmajor', 'Dmajor', 'Aminor'],
      'Eminor': ['Gmajor', 'Aminor', 'Bminor', 'Cmajor'],
      'Dmajor': ['Bminor', 'Gmajor', 'Amajor', 'Eminor'],
      'Bminor': ['Dmajor', 'Eminor', 'F#minor', 'Gmajor'],
      'Amajor': ['F#minor', 'Dmajor', 'Emajor', 'Bminor'],
      'F#minor': ['Amajor', 'Bminor', 'C#minor', 'Dmajor'],
      'Emajor': ['C#minor', 'Amajor', 'Bmajor', 'F#minor'],
      'C#minor': ['Emajor', 'F#minor', 'G#minor', 'Amajor'],
      'Bmajor': ['G#minor', 'Emajor', 'F#major', 'C#minor'],
      'G#minor': ['Bmajor', 'C#minor', 'D#minor', 'Emajor'],
      'Fmajor': ['Dminor', 'Bbmajor', 'Cmajor', 'Aminor'],
      'Dminor': ['Fmajor', 'Aminor', 'Gminor', 'Bbmajor'],
      'Bbmajor': ['Gminor', 'Fmajor', 'Ebmajor', 'Dminor'],
      'Gminor': ['Bbmajor', 'Dminor', 'Cminor', 'Fmajor']
    };

    return compatibleKeys[key1]?.includes(key2) || compatibleKeys[key2]?.includes(key1) || false;
  }
  
  async completeTransition(nextAudio, nextSong) {
    // Set flag to prevent pause handlers from interfering
    this.isProgrammaticChange = true;

    try {
      // Measure where the temp element is RIGHT NOW, on a stable clock
      const rate = nextAudio.playbackRate || 1;
      const ref0 = this._now();
      const nextT0 = nextAudio.currentTime;

      // Load the main <audio> with the same source
      this.player.loadAudioSource(nextSong.src);

      // Wait for metadata so we can seek precisely
      try { await this._awaitOnce(this.player.audio, 'loadedmetadata', 5000); } catch {}

      // Compute elapsed time while we were loading metadata and advance target
      const ref1 = this._now();
      let target = nextT0 + (ref1 - ref0) * rate;

      // Clamp to media duration if known
      const dur = Number.isFinite(this.player.audio.duration) ? this.player.audio.duration : null;
      if (dur) target = Math.min(Math.max(0, target), Math.max(0, dur - 0.25));

      // Seek and wait for it to land
      try { this.player.audio.currentTime = target; } catch {}
      try { await this._awaitOnce(this.player.audio, 'seeked', 5000); } catch {}

      // Clean up transition handlers BEFORE playing to prevent interference
      this.cleanupTransitionState();

      // Start main audio
      try { await this.player.audio.play(); } catch {}

      // Micro handoff crossfade (50–100 ms)
      this._microCrossfadeElements(nextAudio, this.player.audio, this.handoffDuration || 0.08);

      // Optional tiny post-seek correction (accounts for last few ms drift)
      setTimeout(() => {
        const drift = this.player.audio.currentTime - nextAudio.currentTime;
        if (Math.abs(drift) > 0.03 && !this.player.audio.seeking) {
          try { this.player.audio.currentTime -= drift; } catch {}
        }
      }, 30);

      // === Update state ===
      this.player.currentSong = nextSong;
      this.player.addToRecentlyPlayed?.(nextSong);
      this.player.addToNavigationHistory?.(nextSong);

      if (Array.isArray(this.player.queue) && this.player.queue.length > 0) {
        let nextIndex = (this.player.queueIndex ?? -1) + 1;
        if (nextIndex < this.player.queue.length) this.player.queueIndex = nextIndex;
        else if (this.player.repeatMode === 'all') this.player.queueIndex = 0;
      }

      this.player.emit?.('songChanged', nextSong);
      this.player.updateDisplay?.();

      // CRITICAL: Restore user's desired volume
      this.player.audio.volume = this.userVolume;
      console.log(`AutoMix: Volume restored to ${this.userVolume}`);

      this.isTransitioning = false;
      this.preloadedAudio = null;
      this.nextSong = null;
      this.queueSnapshot = null;

      setTimeout(() => {
        if (this.player.doAutoMix) this.prepareNextTrack();
      }, 1000);

      console.log(`AutoMix: Enhanced transition completed to ${nextSong.name} at volume ${this.userVolume}`);
    } finally {
      // Always reset the flag
      this.isProgrammaticChange = false;
    }
  }
  
  fallbackTransition() {
    if (this.nextSong) {
      console.log('AutoMix: Fallback transition');
      
      this.player.currentSong = this.nextSong;
      this.player.loadAudioSource(this.nextSong.src);
      this.player.audio.play().catch(() => {});
      
      this.player.addToRecentlyPlayed?.(this.nextSong);
      this.player.addToNavigationHistory?.(this.nextSong);
      
      // CRITICAL: Restore user's desired volume in fallback too
      this.player.audio.volume = this.userVolume;
      console.log(`AutoMix: Fallback volume restored to ${this.userVolume}`);

      if (Array.isArray(this.player.queue) && this.player.queue.length > 0) {
        let nextIndex = (this.player.queueIndex ?? -1) + 1;
        if (nextIndex < this.player.queue.length) {
          this.player.queueIndex = nextIndex;
        } else if (this.player.repeatMode === 'all') {
          this.player.queueIndex = 0;
        }
      }
      
      this.player.emit?.('songChanged', this.nextSong);
      this.player.updateDisplay?.();
    }
    
    this.isTransitioning = false;
    this.preloadedAudio = null;
    this.nextSong = null;
    this.queueSnapshot = null;

    // Clean up transition state
    this.cleanupTransitionState();

    setTimeout(() => {
      if (this.player.doAutoMix) this.prepareNextTrack();
    }, 1000);
  }

  // High-res clock (AudioContext if present, else performance)
  _now() { return (this.audioContext && this.audioContext.currentTime) || performance.now() / 1000; }

  _awaitOnce(target, event, timeoutMs = 4000) {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => {
        target.removeEventListener(event, on);
        reject(new Error(`Timeout: ${event}`));
      }, timeoutMs);
      const on = () => { clearTimeout(t); resolve(); };
      target.addEventListener(event, on, { once: true });
    });
  }

  _microCrossfadeElements(outEl, inEl, durSec = 0.08) {
    const start = performance.now();
    const inStartVol = this.userVolume; // Use stored user volume
    inEl.volume = 0;
    const step = () => {
      const k = Math.min(1, (performance.now() - start) / (durSec * 1000));
      inEl.volume = inStartVol * k;
      outEl.volume = this.userVolume * (1 - k);
      if (k < 1) requestAnimationFrame(step);
      else {
        try { outEl.pause(); } catch {}
        outEl.src = '';
        outEl.remove();
        inEl.volume = inStartVol; // restore to user volume
      }
    };
    requestAnimationFrame(step);
  }
  
  getCurrentBPM() {
    const current = this.player.currentSong;
    if (!current) return 120;
    
    // Ensure current song is analyzed
    if (!this.bpmCache.has(current.id)) {
      // Quick synchronous analysis for immediate use
      const quickBPM = this.estimateBPMFromMetadata(current);
      this.bpmCache.set(current.id, Math.round(quickBPM));
      console.log(`Quick BPM analysis for current song: ${current.name} = ${Math.round(quickBPM)} BPM`);
      
      // Schedule full analysis
      this.analyzeTrackAdvanced(current).catch(console.warn);
    }
    
    return this.bpmCache.get(current.id) || 120;
  }
  
  // Enhanced configuration
  setTransitionSettings(settings = {}) {
    if ('transitionDuration' in settings) {
      this.transitionDuration = Math.max(5, Math.min(30, settings.transitionDuration|0));
    }
    if ('crossfadeDuration' in settings) {
      this.crossfadeDuration = Math.max(5, Math.min(50, settings.crossfadeDuration|0));
    }
    if ('bpmTolerance' in settings) {
      this.bpmTolerance = Math.max(0, Math.min(20, settings.bpmTolerance|0));
    }
    if ('filterSweepIntensity' in settings) {
      this.filterSweepIntensity = Math.max(0.1, Math.min(1.0, parseFloat(settings.filterSweepIntensity)));
    }
    if ('djMode' in settings) {
      this.djMode = (['seamless','beatmatch','dj'].includes(settings.djMode) ? settings.djMode : this.djMode);
    }
    if ('useSmoothing' in settings) {
      this.useSmoothing = Boolean(settings.useSmoothing);
    }
    if ('enableBeatSync' in settings) {
      this.enableBeatSync = Boolean(settings.enableBeatSync);
    }
    if ('enableKeyMatching' in settings) {
      this.enableKeyMatching = Boolean(settings.enableKeyMatching);
    }

    console.log('AutoMix settings updated:', {
      transitionDuration: this.transitionDuration,
      crossfadeDuration: this.crossfadeDuration,
      bpmTolerance: this.bpmTolerance,
      filterSweepIntensity: this.filterSweepIntensity,
      djMode: this.djMode,
      smoothing: this.useSmoothing,
      beatSync: this.enableBeatSync,
      keyMatching: this.enableKeyMatching
    });
    return this;
  }

  getSettings() {
    return {
      enabled: !!this.player.doAutoMix,
      transitionDuration: this.transitionDuration,
      crossfadeDuration: this.crossfadeDuration,
      bpmTolerance: this.bpmTolerance,
      filterSweepIntensity: this.filterSweepIntensity,
      djMode: this.djMode,
      smoothing: this.useSmoothing,
      beatSync: this.enableBeatSync,
      keyMatching: this.enableKeyMatching,
      isTransitioning: this.isTransitioning,
      nextSongReady: !!this.preloadedAudio,
      userVolume: this.userVolume,
      bpmCacheSize: this.bpmCache.size
    };
  }
  
  cleanup() {
    this.preloadedAudio = null;
    this.nextSong = null;
    this.queueSnapshot = null;
    this.isTransitioning = false;
    this.cleanupTransitionState();
    console.log('Enhanced AutoMix: Cleaned up');
  }
  
  getStatus() {
    const currentSong = this.player.currentSong;
    const nextSong = this.nextSong;
    
    return {
      enabled: !!this.player.doAutoMix,
      mode: this.djMode,
      isTransitioning: this.isTransitioning,
      nextSongReady: !!this.preloadedAudio,
      userVolume: this.userVolume,
      currentSong: currentSong ? {
        name: this.player.getSongDisplayName?.(currentSong) || currentSong.name || currentSong.src,
        bpm: this.bpmCache.get(currentSong.id) || 120,
        energy: this.energyCache.get(currentSong.id) || 0.5,
        key: this.keyCache.get(currentSong.id) || 'unknown'
      } : null,
      nextSong: nextSong ? {
        name: this.player.getSongDisplayName?.(nextSong) || nextSong.name || nextSong.src,
        bpm: this.bpmCache.get(nextSong.id) || 120,
        energy: this.energyCache.get(nextSong.id) || 0.5,
        key: this.keyCache.get(nextSong.id) || 'unknown'
      } : null,
      compatibility: currentSong && nextSong ? {
        bpmDiff: Math.abs((this.bpmCache.get(currentSong.id) || 120) - (this.bpmCache.get(nextSong.id) || 120)),
        energyDiff: Math.abs((this.energyCache.get(currentSong.id) || 0.5) - (this.energyCache.get(nextSong.id) || 0.5)),
        harmonicMatch: this.checkHarmonicCompatibility(
          this.keyCache.get(currentSong.id) || 'unknown',
          this.keyCache.get(nextSong.id) || 'unknown'
        )
      } : null,
      settings: this.getSettings()
    };
  }
  
  // Preset mode functions
  setMode(mode) {
    switch(mode) {
      case 'seamless':
        return this.setTransitionSettings({
          djMode: 'seamless',
          crossfadeDuration: 12,
          useSmoothing: true,
          enableBeatSync: false,
          enableKeyMatching: false
        });
      case 'beatmatch':
        return this.setTransitionSettings({
          djMode: 'beatmatch',
          crossfadeDuration: 16,
          enableBeatSync: true,
          enableKeyMatching: true,
          bpmTolerance: 12
        });
      case 'dj':
        return this.setTransitionSettings({
          djMode: 'dj',
          crossfadeDuration: 20,
          enableBeatSync: true,
          enableKeyMatching: true,
          filterSweepIntensity: 0.8,
          bpmTolerance: 10
        });
      default:
        return this.setTransitionSettings({ djMode: 'seamless' });
    }
  }
}

// Enhanced bootstrapping with volume preservation
function initializeAutoMixEngine() {
  if (typeof player !== 'undefined' && player?.audio) {
    
    if (window.SharedAudio && typeof window.SharedAudio.get === 'function') {
      try {
        const shared = window.SharedAudio.get(player.audio);
        console.log('SharedAudio initialized for Enhanced AutoMix');
      } catch (err) {
        console.warn('Failed to initialize SharedAudio:', err);
      }
    }
    
    if (!window.autoMixEngine) {
      window.autoMixEngine = new AutoMixEngine(player);
      
      // Enhanced API functions
      player.configureAutoMix = (settings) => window.autoMixEngine.setTransitionSettings(settings);
      player.getAutoMixStatus = () => window.autoMixEngine.getStatus();
      player.setAutoMixMode = (mode) => window.autoMixEngine.setMode(mode);
      
      // Load any saved BPMs
      loadSavedBPMs();
      
      // Volume preservation
      player.preserveVolume = () => {
        if (window.autoMixEngine && !window.autoMixEngine.isTransitioning) {
          window.autoMixEngine.userVolume = player.audio.volume;
          console.log(`Volume preserved: ${window.autoMixEngine.userVolume}`);
        }
      };
    }
    
    if (player.doAutoMix) window.autoMixEngine.prepareNextTrack();
    console.log('Enhanced AutoMix engine attached with volume preservation');
  } else {
    setTimeout(initializeAutoMixEngine, 100);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeAutoMixEngine);
} else {
  initializeAutoMixEngine();
}

// Enhanced utility functions with manual BPM analysis
function enableAutoMix() {
  if (typeof player === 'undefined') return console.error('Player not available');
  player.doAutoMix = true;
  window.autoMixEngine?.prepareNextTrack();
  console.log('Enhanced AutoMix enabled');
}

function disableAutoMix() {
  if (typeof player === 'undefined') return console.error('Player not available');
  player.doAutoMix = false;
  window.autoMixEngine?.cleanup();
  console.log('AutoMix disabled');
}

function configureAutoMix(settings) {
  if (!window.autoMixEngine) return console.error('AutoMix engine not available');
  return window.autoMixEngine.setTransitionSettings(settings);
}

function getAutoMixStatus() {
  if (!window.autoMixEngine) {
    console.error('AutoMix engine not available');
    return { enabled: false, error: 'Engine not available' };
  }
  return window.autoMixEngine.getStatus();
}

// Force analyze current and next songs
async function analyzeCurrentQueue() {
  if (!window.autoMixEngine || !player.currentSong) {
    console.error('AutoMix engine or current song not available');
    return;
  }
  
  console.log('Analyzing current queue...');
  
  // Analyze current song
  await window.autoMixEngine.analyzeTrackAdvanced(player.currentSong);
  const currentBPM = window.autoMixEngine.bpmCache.get(player.currentSong.id);
  console.log(`Current: ${player.currentSong.name} = ${currentBPM} BPM`);
  
  // Analyze next song if available
  const nextResult = window.autoMixEngine.getNextSong();
  if (nextResult) {
    const nextSong = nextResult.song;
    await window.autoMixEngine.analyzeTrackAdvanced(nextSong);
    const nextBPM = window.autoMixEngine.bpmCache.get(nextSong.id);
    console.log(`Next: ${nextSong.name} = ${nextBPM} BPM ${nextResult.isRandom ? '(random)' : ''}`);
    console.log(`BPM difference: ${Math.abs(currentBPM - nextBPM)}`);
    return { currentBPM, nextBPM };
  }

  return { currentBPM, nextBPM: null };
}

// Manual BPM override and training
function setBPM(songId, bpm) {
  if (!window.autoMixEngine) return console.error('AutoMix engine not available');
  if (bpm < 60 || bpm > 200) return console.error('BPM must be between 60-200');
  
  window.autoMixEngine.bpmCache.set(songId, bpm);
  console.log(`✓ Manual BPM set: ${songId} = ${bpm} BPM`);
  
  // Save to localStorage for persistence
  try {
    const savedBPMs = JSON.parse(localStorage.getItem('automix_bpm_cache') || '{}');
    savedBPMs[songId] = bpm;
    localStorage.setItem('automix_bpm_cache', JSON.stringify(savedBPMs));
    console.log('BPM saved to local storage');
  } catch (err) {
    console.warn('Could not save BPM to localStorage:', err);
  }
}

// Set BPM for currently playing song
function setCurrentBPM(bpm) {
  if (!player.currentSong) return console.error('No current song');
  setBPM(player.currentSong.id, bpm);
  console.log(`✓ Set current song "${player.currentSong.name}" to ${bpm} BPM`);
}

// Quick BPM presets
function setBPMPreset(preset) {
  if (!player.currentSong) return console.error('No current song');
  
  const presets = {
    'house': 125,
    'techno': 132,
    'trance': 138,
    'dnb': 174,
    'dubstep': 140,
    'trap': 150,
    'hiphop': 90,
    'pop': 120,
    'rock': 120,
    'chill': 75
  };
  
  const bpm = presets[preset.toLowerCase()];
  if (!bpm) {
    console.error(`Unknown preset: ${preset}. Available: ${Object.keys(presets).join(', ')}`);
    return;
  }
  
  setCurrentBPM(bpm);
}

// Load saved BPMs on initialization
function loadSavedBPMs() {
  if (!window.autoMixEngine) return;
  
  try {
    const savedBPMs = JSON.parse(localStorage.getItem('automix_bpm_cache') || '{}');
    Object.entries(savedBPMs).forEach(([songId, bpm]) => {
      window.autoMixEngine.bpmCache.set(songId, bpm);
    });
    console.log(`✓ Loaded ${Object.keys(savedBPMs).length} saved BPMs`);
  } catch (err) {
    console.warn('Could not load saved BPMs:', err);
  }
}

// Tap tempo for manual BPM detection
function startTapTempo() {
  if (!window.tapTempo) {
    window.tapTempo = {
      taps: [],
      timeout: null
    };
  }
  
  window.tapTempo.lastTap = Date.now();
  window.tapTempo.taps = [];
  
  console.log('🎵 Tap tempo started - press T key or call tapBeat() in rhythm with the music');
  console.log('Press 4-8 times to the beat, then call finishTapTempo()');
  
  // Listen for T key presses
  const tapHandler = (e) => {
    if (e.key.toLowerCase() === 't') {
      tapBeat();
    }
  };
  
  document.addEventListener('keydown', tapHandler);
  
  // Auto-finish after 10 seconds
  window.tapTempo.timeout = setTimeout(() => {
    document.removeEventListener('keydown', tapHandler);
    if (window.tapTempo.taps.length >= 4) {
      finishTapTempo();
    } else {
      console.log('⚠ Tap tempo cancelled - not enough taps');
    }
  }, 10000);
}

function tapBeat() {
  if (!window.tapTempo) {
    startTapTempo();
    return;
  }
  
  const now = Date.now();
  window.tapTempo.taps.push(now);
  
  console.log(`Tap ${window.tapTempo.taps.length}`);
  
  // Auto-finish after 8 taps
  if (window.tapTempo.taps.length >= 8) {
    finishTapTempo();
  }
}

function finishTapTempo() {
  if (!window.tapTempo || window.tapTempo.taps.length < 4) {
    console.error('Need at least 4 taps to calculate BPM');
    return;
  }
  
  const taps = window.tapTempo.taps;
  const intervals = [];
  
  // Calculate intervals between taps
  for (let i = 1; i < taps.length; i++) {
    intervals.push(taps[i] - taps[i-1]);
  }
  
  // Calculate average interval
  const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
  const bpm = Math.round(60000 / avgInterval); // Convert ms to BPM
  
  console.log(`🎵 Tap tempo result: ${bpm} BPM (from ${taps.length} taps)`);
  
  if (bpm >= 60 && bpm <= 200) {
    if (player.currentSong) {
      setCurrentBPM(bpm);
      console.log(`✓ Applied ${bpm} BPM to current song`);
    } else {
      console.log(`Detected ${bpm} BPM - no current song to apply to`);
    }
  } else {
    console.error(`Invalid BPM detected: ${bpm}. Try tapping more accurately.`);
  }
  
  // Cleanup
  if (window.tapTempo.timeout) {
    clearTimeout(window.tapTempo.timeout);
  }
  window.tapTempo = null;
}

// Mode preset functions
function setSeamlessMode() {
  return window.autoMixEngine?.setMode('seamless');
}

function setBeatMatchMode() {
  return window.autoMixEngine?.setMode('beatmatch');
}

function setDJMode() {
  return window.autoMixEngine?.setMode('dj');
}

// Volume preservation helper
function preserveCurrentVolume() {
  if (typeof player !== 'undefined' && window.autoMixEngine) {
    window.autoMixEngine.userVolume = player.audio.volume;
    console.log(`Current volume preserved: ${player.audio.volume}`);
  }
}

console.log('AutoMix Engine loaded - Modes: seamless, beatmatch, dj');