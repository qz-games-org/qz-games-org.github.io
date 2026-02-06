/**
 * KeyDetectionEngine - Musical Key Detection using Chromagram Analysis
 *
 * Uses pitch class profiles and the Krumhansl-Schmuckler algorithm
 * to detect the musical key of audio tracks.
 */

class KeyDetectionEngine {
  constructor() {
    // Krumhansl-Schmuckler key profiles (correlation weights)
    // These represent how strongly each pitch class correlates with major/minor keys
    // Profiles: [C, C#, D, D#, E, F, F#, G, G#, A, A#, B]
    this.majorProfile = [
      6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88
    ];

    // Enhanced minor profile with boosted characteristic notes
    this.minorProfile = [
      6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17
    ];

    // Note names for pitch classes
    this.noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    // Camelot wheel mappings for harmonic mixing (with enharmonic equivalents)
    this.camelotWheel = {
      'Cmajor': '8B', 'Aminor': '8A',
      'Gmajor': '9B', 'Eminor': '9A',
      'Dmajor': '10B', 'Bminor': '10A',
      'Amajor': '11B', 'F#minor': '11A', 'G#minor': '11A', // F# = Gb
      'Emajor': '12B', 'C#minor': '12A', 'D#minor': '12A', // C# = Db
      'Bmajor': '1B', 'G#minor': '1A', 'A#minor': '1A',
      'F#major': '2B', 'G#major': '2B', 'D#minor': '2A', 'E#minor': '2A',
      'C#major': '3B', 'D#major': '3B', 'A#minor': '3A', 'B#minor': '3A',
      'G#major': '4B', 'A#major': '4B', 'Fminor': '4A', 'E#minor': '4A',
      'D#major': '5B', 'E#major': '5B', 'Cminor': '5A', 'B#minor': '5A',
      'A#major': '6B', 'B#major': '6B', 'Gminor': '6A', 'F#minor': '6A',
      'Fmajor': '7B', 'Dminor': '7A',
      // Flat equivalents
      'Dbmajor': '3B', 'Bbminor': '3A',
      'Abmajor': '4B', 'Ebmajor': '5B',
      'Bbmajor': '6B'
    };

    this.cache = new Map(); // Cache detected keys
  }

  /**
   * Detect the musical key of an audio file
   * @param {string} audioSrc - URL of the audio file
   * @param {AudioContext} audioContext - Web Audio context
   * @returns {Promise<Object>} - {key, confidence, camelot}
   */
  async detectKey(audioSrc, audioContext) {
    try {
      console.log('🎹 Analyzing musical key...');

      // Fetch and decode audio
      const response = await fetch(audioSrc, { cache: 'force-cache' });
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      // Extract pitch class profile (chromagram)
      const pitchProfile = await this.extractPitchClassProfile(audioBuffer, audioContext.sampleRate);

      // Correlate with key profiles to find best match
      const keyResult = this.findBestKeyMatch(pitchProfile);

      console.log(`✓ Key detected: ${keyResult.key} (${keyResult.camelot}) - confidence: ${keyResult.confidence.toFixed(2)}`);

      return keyResult;

    } catch (err) {
      console.error('Key detection error:', err);
      return { key: 'unknown', confidence: 0, camelot: null };
    }
  }

  /**
   * Extract pitch class profile (chromagram) from audio buffer
   * Optimized to analyze only the beginning of the song for faster transitions
   */
  async extractPitchClassProfile(audioBuffer, sampleRate) {
    const channelData = audioBuffer.getChannelData(0);
    const duration = audioBuffer.duration;

    // Focus on the first 30-60 seconds where key is usually established
    const analysisWindow = Math.min(60, duration * 0.4); // Max 60 seconds or 40% of song

    // Take 4-6 strategic samples from the beginning
    const numSamples = Math.min(6, Math.max(4, Math.floor(analysisWindow / 10)));
    const pitchCounts = new Array(12).fill(0);

    for (let i = 0; i < numSamples; i++) {
      // Sample from intro/first verse (skip first 5 seconds for intro effects)
      const startTime = 5 + (i * analysisWindow / numSamples);
      const startSample = Math.floor(startTime * sampleRate);

      // Use large windows for better frequency resolution
      const windowSize = Math.min(32768, channelData.length - startSample);

      if (windowSize < 4096) continue;

      // Extract window
      const window = channelData.slice(startSample, startSample + windowSize);

      // Perform chromagram analysis to get pitch classes
      const pitches = this.analyzePitchClasses(window, sampleRate);

      // Weight earlier samples slightly higher (intro/verse more reliable than bridge)
      const timeWeight = 1.0 - (i / numSamples) * 0.2; // Decay from 1.0 to 0.8

      // Accumulate pitch class counts with time weighting
      for (let j = 0; j < 12; j++) {
        pitchCounts[j] += pitches[j] * timeWeight;
      }
    }

    // Normalize pitch profile
    const total = pitchCounts.reduce((a, b) => a + b, 0);
    return pitchCounts.map(count => total > 0 ? count / total : 0);
  }

  /**
   * Analyze pitch classes from audio window using improved chromagram
   */
  analyzePitchClasses(audioWindow, sampleRate) {
    const pitchClasses = new Array(12).fill(0);
    const fftSize = Math.min(16384, audioWindow.length); // Increased for better resolution

    // Apply Hann window to reduce spectral leakage
    const windowed = this.applyHannWindow(audioWindow.slice(0, fftSize));

    // Perform simple FFT
    const spectrum = this.simpleFFT(windowed);

    // Map frequency bins to pitch classes with improved weighting
    // Concert A (440 Hz) = pitch class 9 (A)
    const A4_freq = 440;
    const C0_freq = A4_freq * Math.pow(2, -4.75); // C0 reference (~16.35 Hz)

    for (let i = 1; i < spectrum.length / 2; i++) {
      const freq = (i * sampleRate) / fftSize;

      // Focus on core musical range (more selective)
      if (freq < 80 || freq > 3500) continue;

      const magnitude = spectrum[i];
      if (magnitude < 0.02) continue; // Increased threshold to filter noise

      // Calculate pitch class (0-11) for this frequency
      const semitones = 12 * Math.log2(freq / C0_freq);
      const pitchClass = Math.round(semitones) % 12;
      const normalizedPitch = (pitchClass + 12) % 12;

      // Calculate how "in-tune" this frequency is (sharper curve for better tuning)
      const detuning = Math.abs(semitones - Math.round(semitones));
      const tuningWeight = Math.exp(-detuning * 15); // Increased from 10 for sharper tuning

      // Improved harmonic weighting with sweet spot for voice/lead instruments
      const octave = Math.floor(Math.log2(freq / C0_freq));
      let harmonicWeight;
      if (octave >= 3 && octave <= 5) {
        // Octaves 3-5 (voice/lead range) get highest weight
        harmonicWeight = 1.0;
      } else if (octave === 2 || octave === 6) {
        // Adjacent octaves get medium weight
        harmonicWeight = 0.7;
      } else {
        // Other octaves decay
        harmonicWeight = Math.exp(-Math.abs(octave - 4) * 0.4);
      }

      // Combined weight
      const weight = magnitude * tuningWeight * harmonicWeight;

      pitchClasses[normalizedPitch] += weight;
    }

    return pitchClasses;
  }

  /**
   * Apply Hann window function to reduce spectral leakage
   */
  applyHannWindow(data) {
    const windowed = new Float32Array(data.length);
    for (let i = 0; i < data.length; i++) {
      const multiplier = 0.5 * (1 - Math.cos(2 * Math.PI * i / (data.length - 1)));
      windowed[i] = data[i] * multiplier;
    }
    return windowed;
  }

  /**
   * Optimized DFT focusing on core musical frequency range (80-3500 Hz)
   * Only computes bins we actually need for pitch detection
   */
  simpleFFT(data) {
    const N = data.length;
    const sampleRate = 44100; // Assume standard sample rate
    const spectrum = new Float32Array(N / 2);

    // Calculate which bins correspond to our frequency range (80-3500 Hz)
    const minBin = Math.floor((80 * N) / sampleRate);
    const maxBin = Math.ceil((3500 * N) / sampleRate);

    // Pre-calculate twiddle factors for better performance
    const cosTable = new Float32Array(N);
    const sinTable = new Float32Array(N);
    for (let n = 0; n < N; n++) {
      cosTable[n] = Math.cos((2 * Math.PI * n) / N);
      sinTable[n] = Math.sin((2 * Math.PI * n) / N);
    }

    // Only compute DFT for frequency bins we care about
    for (let k = minBin; k <= Math.min(maxBin, N / 2 - 1); k++) {
      let real = 0;
      let imag = 0;

      // Optimized DFT using pre-calculated twiddle factors
      for (let n = 0; n < N; n++) {
        const twiddle = (k * n) % N;
        real += data[n] * cosTable[twiddle];
        imag -= data[n] * sinTable[twiddle];
      }

      spectrum[k] = Math.sqrt(real * real + imag * imag) / N; // Normalize
    }

    return spectrum;
  }

  /**
   * Find best key match using Krumhansl-Schmuckler algorithm
   * Correlates the pitch class profile with major/minor key profiles
   */
  findBestKeyMatch(pitchProfile) {
    let bestKey = 'unknown';
    let bestCorrelation = -Infinity;
    let bestMode = 'major';
    let secondBestCorrelation = -Infinity;

    const correlations = [];

    // Try all 24 keys (12 major + 12 minor)
    for (let tonic = 0; tonic < 12; tonic++) {
      // Test major key
      const majorCorrelation = this.correlate(pitchProfile, this.majorProfile, tonic);
      const majorKey = this.noteNames[tonic] + 'major';
      correlations.push({ key: majorKey, correlation: majorCorrelation, mode: 'major', tonic });

      // Test minor key
      const minorCorrelation = this.correlate(pitchProfile, this.minorProfile, tonic);
      const minorKey = this.noteNames[tonic] + 'minor';
      correlations.push({ key: minorKey, correlation: minorCorrelation, mode: 'minor', tonic });
    }

    // Sort by correlation
    correlations.sort((a, b) => b.correlation - a.correlation);

    bestKey = correlations[0].key;
    bestCorrelation = correlations[0].correlation;
    bestMode = correlations[0].mode;

    if (correlations.length > 1) {
      secondBestCorrelation = correlations[1].correlation;
    }

    // Check if the difference between best and second-best is small
    // This might indicate confusion between relative major/minor
    const diff = bestCorrelation - secondBestCorrelation;
    if (diff < 0.05) {
      // Close match - could be relative major/minor
      // Use additional heuristics: minor keys often have stronger minor 3rd
      const minorThird = (correlations[0].tonic + 3) % 12;
      const majorThird = (correlations[0].tonic + 4) % 12;

      if (pitchProfile[minorThird] > pitchProfile[majorThird] * 1.2) {
        // Stronger minor third suggests minor key
        const minorCandidate = correlations.find(c => c.tonic === correlations[0].tonic && c.mode === 'minor');
        if (minorCandidate) {
          bestKey = minorCandidate.key;
          bestCorrelation = minorCandidate.correlation;
          bestMode = 'minor';
        }
      }
    }

    // Calculate confidence (normalize correlation to 0-1 range)
    const confidence = Math.max(0, Math.min(1, (bestCorrelation + 1) / 2));

    return {
      key: bestKey,
      mode: bestMode,
      confidence: confidence,
      camelot: this.camelotWheel[bestKey] || null
    };
  }

  /**
   * Calculate Pearson correlation between pitch profile and key profile
   * with rotation for different tonics
   */
  correlate(pitchProfile, keyProfile, rotation) {
    const n = 12;

    // Rotate key profile to match tonic
    const rotatedProfile = [...keyProfile.slice(rotation), ...keyProfile.slice(0, rotation)];

    // Calculate means
    const meanPitch = pitchProfile.reduce((a, b) => a + b) / n;
    const meanKey = rotatedProfile.reduce((a, b) => a + b) / n;

    // Calculate correlation
    let numerator = 0;
    let denomPitch = 0;
    let denomKey = 0;

    for (let i = 0; i < n; i++) {
      const pitchDiff = pitchProfile[i] - meanPitch;
      const keyDiff = rotatedProfile[i] - meanKey;

      numerator += pitchDiff * keyDiff;
      denomPitch += pitchDiff * pitchDiff;
      denomKey += keyDiff * keyDiff;
    }

    if (denomPitch === 0 || denomKey === 0) return 0;

    return numerator / Math.sqrt(denomPitch * denomKey);
  }

  /**
   * Check if two keys are harmonically compatible for mixing
   */
  areKeysCompatible(key1, key2) {
    if (key1 === 'unknown' || key2 === 'unknown') return false;

    const camelot1 = this.camelotWheel[key1];
    const camelot2 = this.camelotWheel[key2];

    if (!camelot1 || !camelot2) return false;

    // Extract number and letter from Camelot notation (e.g., "8B")
    const num1 = parseInt(camelot1);
    const letter1 = camelot1.slice(-1);
    const num2 = parseInt(camelot2);
    const letter2 = camelot2.slice(-1);

    // Compatible if:
    // 1. Same number (relative major/minor)
    // 2. Adjacent numbers (±1) with same letter
    // 3. Same number and letter (perfect match)

    if (num1 === num2) return true; // Relative major/minor or perfect match

    const numDiff = Math.abs(num1 - num2);
    if (letter1 === letter2 && (numDiff === 1 || numDiff === 11)) return true;

    return false;
  }

  /**
   * Get cached key or return null
   */
  getCachedKey(songId) {
    return this.cache.get(songId) || null;
  }

  /**
   * Cache a detected key
   */
  setCachedKey(songId, keyResult) {
    this.cache.set(songId, keyResult);
  }
}

// Initialize global instance
if (typeof window !== 'undefined') {
  window.keyDetectionEngine = new KeyDetectionEngine();
  console.log('🎹 KeyDetectionEngine loaded');
}
