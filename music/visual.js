/*
function createAudioVisualizer(audioElement = null) {
    audioElement = document.getElementById('audio') || audioElement;
    if (!audioElement) {
      console.error('No audio element found');
      return null;
    }
  
    // --- Fast/slow behavior knobs (tweak to taste) ---
    
    const CFG = {
      ATTACK: 0.60,      // how fast the envelope rises
      RELEASE: 0.12,     // how fast it falls
      RISE_LERP: 0.55,   // UI lerp when target is higher (snappy)
      FALL_LERP: 0.20,   // UI lerp when target is lower (smooth)
      GATE: 0.5,        // noise gate for bass average
      BASS_GAIN: 0.55,   // base scale from bass envelope
      BOOST_GAIN: 0.25,  // extra scale from transients (flux)
      FLUX_GAIN: 3.9,    // scales transient sensitivity
      FLUX_GATE: 0.01,   // ignore tiny flux changes
      SCALE_MAX: 8    // clamp to keep sane size
    };
    const CFG = {
        ATTACK: 0.60,      // how fast the envelope rises
        RELEASE: 0.12,     // how fast it falls
        RISE_LERP: 0.55,   // UI lerp when target is higher (snappy)
        FALL_LERP: 0.20,   // UI lerp when target is lower (smooth)
        GATE: 0.5,        // noise gate for bass average
        BASS_GAIN: 0.35,   // base scale from bass envelope
        BOOST_GAIN: 0.5,  // extra scale from transients (flux)
        FLUX_GAIN: 3.9,    // scales transient sensitivity
        FLUX_GATE: 0.01,   // ignore tiny flux changes
        SCALE_MAX: 2    // clamp to keep sane size
      };
  
    // Root container
    const container = document.createElement('div');
    container.style.cssText = `
      position: fixed; inset: 0; display: grid; place-items: center;
      z-index: 1000; user-select: none; pointer-events: none;
    `;
    container.innerHTML = `
   
      <div class="visualizer" id="vis">
        <div class="bass-ring" id="bassRing"></div>
        <div class="center-bars">
          <div class="center-bar"></div><div class="center-bar"></div><div class="center-bar"></div>
          <div class="center-bar"></div><div class="center-bar"></div>
        </div>
        <div class="treble-particle particle-1"></div>
        <div class="treble-particle particle-2"></div>
        <div class="treble-particle particle-3"></div>
        <div class="treble-particle particle-4"></div>
        <div class="treble-particle particle-5"></div>
        <div class="treble-particle particle-6"></div>
      </div>
    `;
    document.body.appendChild(container);
  
    const vis = container.querySelector('#vis');
    const bars = container.querySelectorAll('.center-bar');
    const bassRing = container.querySelector('#bassRing');
    const particles = container.querySelectorAll('.treble-particle');
  
    let audioContext, analyser, source, dataArray, rafId = null;
    let isRunning = false;
    let bin = () => 0;
    let bassStart = 0, bassEnd = 0;
    let midSplits = [], trebleSplits = [];
    let prevBass = null;      // per-bin previous bass frame (0..1)
    let bassEnv = 0, bassPeak = 0, ringScale = 1;
  
    function setup() {
      try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.3; // less smoothing -> more responsive
        analyser.minDecibels = -90;
        analyser.maxDecibels = -25;
  
        source = audioContext.createMediaElementSource(audioElement);
        source.connect(analyser);
        source.connect(audioContext.destination);
  
        dataArray = new Uint8Array(analyser.frequencyBinCount);
  
        const hzPerBin = audioContext.sampleRate / analyser.fftSize;
        bin = (hz) => Math.max(0, Math.min(analyser.frequencyBinCount - 1, Math.round(hz / hzPerBin)));
  
        bassStart = bin(20);
        bassEnd   = bin(250);
  
        midSplits = [
          [bin(250), bin(650)], [bin(650), bin(1000)],
          [bin(1000), bin(1700)], [bin(1700), bin(2600)], [bin(2600), bin(4000)]
        ];
  
        trebleSplits = [
          [bin(4000), bin(5200)], [bin(5200), bin(6500)], [bin(6500), bin(7800)],
          [bin(7800), bin(9500)], [bin(9500), bin(12000)], [bin(12000), bin(15000)]
        ];
  
        prevBass = new Float32Array(Math.max(1, bassEnd - bassStart));
        isRunning = true;
        animate();
      } catch (e) {
        console.error('Audio setup failed:', e);
      }
    }
  
    function avgRange(start, end) {
      const hi = Math.min(end, dataArray.length);
      const lo = Math.max(0, start);
      let sum = 0, n = hi - lo;
      if (n <= 0) return 0;
      for (let i = lo; i < hi; i++) sum += dataArray[i];
      return (sum / n) / 255; // 0..1
    }
  
    function animate() {
      if (!isRunning) return;
      rafId = requestAnimationFrame(animate);
      analyser.getByteFrequencyData(dataArray);
  
      // --- Bass average with gate ---
      let bassAvg = avgRange(bassStart, bassEnd);
      bassAvg = Math.max(0, (bassAvg - CFG.GATE) / (1 - CFG.GATE));
  
      // Envelope (attack/decay)
      if (bassAvg > bassEnv) bassEnv += (bassAvg - bassEnv) * CFG.ATTACK;
      else                   bassEnv += (bassAvg - bassEnv) * CFG.RELEASE;
  
      // --- Bass transient boost via spectral flux (fast “thump”) ---
      let fluxSum = 0, count = 0;
      for (let i = bassStart, j = 0; i < bassEnd; i++, j++) {
        const curr = dataArray[i] / 255;
        const rise = curr - prevBass[j];
        if (rise > 0) fluxSum += rise;
        prevBass[j] = curr;
        count++;
      }
      let flux = count ? (fluxSum / count) : 0;                 // average positive rise
      flux = Math.max(0, (flux - CFG.FLUX_GATE)) * CFG.FLUX_GAIN; // gate + gain
      flux = Math.min(1, flux);                                 // keep sane
  
      // Peak hold for glow
      if (bassEnv > bassPeak) bassPeak = bassEnv;
      else bassPeak *= 0.92;
  
      // Target scale combines envelope + transient boost
      let targetScale = 1 + (bassEnv * CFG.BASS_GAIN) + (flux * CFG.BOOST_GAIN);
      if (targetScale > CFG.SCALE_MAX) targetScale = CFG.SCALE_MAX;
  
      // Asymmetric lerp: pop quickly on rises, settle smoothly on falls
      const lerp = targetScale > ringScale ? CFG.RISE_LERP : CFG.FALL_LERP;
      ringScale += (targetScale - ringScale) * lerp;
  
      // --- Apply styles (minimal writes) ---
      bassRing.style.transform = `scale(${ringScale})`;
      const op = (0.6 + bassEnv * 0.4).toFixed(3);
      if (bassRing.style.opacity !== op) bassRing.style.opacity = op;
      const br = (1 + bassEnv * 0.5).toFixed(3);
      const nf = `brightness(${br})`;
      if (bassRing.style.filter !== nf) bassRing.style.filter = nf;
      bassRing.style.setProperty('--peak', bassPeak.toFixed(3));
  
      // Mids (bars)
      for (let i = 0; i < bars.length; i++) {
        const [s, e] = midSplits[i];
        const m = avgRange(s, e);
        bars[i].style.height = `${(2 + m * 36).toFixed(2)}px`;
        bars[i].style.opacity = (0.7 + m * 0.3).toFixed(3);
      }
  
      // Treble (particles)
      particles.forEach((p, i) => {
        const r = trebleSplits[i] || trebleSplits[trebleSplits.length - 1];
        const t = avgRange(r[0], r[1]);
        if (t > 0.18) {
          p.style.transform = `scale(${(1 + t * 2).toFixed(3)})`;
          p.style.opacity = (0.3 + t * 0.7).toFixed(3);
        } else {
          p.style.transform = 'scale(0.55)';
          p.style.opacity = '0.10';
        }
      });
  
      // Activity glow
      const midAvg = midSplits.reduce((a, r) => a + avgRange(r[0], r[1]), 0) / midSplits.length;
      vis.classList.toggle('active', Math.max(bassEnv, midAvg) > 0.08);
    }
  
    // Click to resume on autoplay-restricted platforms
    vis.addEventListener('click', () => {
      if (audioContext && audioContext.state === 'suspended') audioContext.resume();
    });
  
    const onPlay = () => { if (!isRunning) setup(); vis.classList.add('active'); };
    const onPause = () => vis.classList.remove('active');
    const onEnded = () => vis.classList.remove('active');
  
    audioElement.addEventListener('play', onPlay);
    audioElement.addEventListener('pause', onPause);
    audioElement.addEventListener('ended', onEnded);
  
    if (!audioElement.paused) setup();
  
    const cleanup = () => {
      isRunning = false;
      if (rafId) cancelAnimationFrame(rafId);
      if (container.parentNode) container.parentNode.removeChild(container);
      audioElement.removeEventListener('play', onPlay);
      audioElement.removeEventListener('pause', onPause);
      audioElement.removeEventListener('ended', onEnded);
      if (audioContext && audioContext.state !== 'closed') audioContext.close();
    };
  
    return { element: vis, container, cleanup, isRunning: () => isRunning };
  }
  */
  function createAudioVisualizer(audioElement = null) {
    audioElement = document.getElementById('audio') || audioElement;
    if (!audioElement) {
      console.error('No audio element found');
      return null;
    }
  
    // --- Fast/slow behavior knobs (tweak to taste) ---
    // Fixed visualizer that doesn't interfere with EQ routing
const CFG = {
    ATTACK: 0.60,      // how fast the envelope rises
    RELEASE: 0.12,     // how fast it falls
    RISE_LERP: 0.55,   // UI lerp when target is higher (snappy)
    FALL_LERP: 0.20,   // UI lerp when target is lower (smooth)
    GATE: 0.5,        // noise gate for bass average
    BASS_GAIN: 0.35,   // base scale from bass envelope
    BOOST_GAIN: 0.5,  // extra scale from transients (flux)
    FLUX_GAIN: 3.9,    // scales transient sensitivity
    FLUX_GATE: 0.01,   // ignore tiny flux changes
    SCALE_MAX: 2    // clamp to keep sane size
};

// Root container
const container = document.createElement('div');
container.style.cssText = `
  position: fixed; inset: 0; display: grid; place-items: center;
  z-index: 1000; user-select: none; pointer-events: none;
`;
container.innerHTML = `
  <div class="visualizer" id="vis">
    <div class="bass-ring" id="bassRing"></div>
    <div class="center-bars">
      <div class="center-bar"></div><div class="center-bar"></div><div class="center-bar"></div>
      <div class="center-bar"></div><div class="center-bar"></div>
    </div>
    <div class="treble-particle particle-1"></div>
    <div class="treble-particle particle-2"></div>
    <div class="treble-particle particle-3"></div>
    <div class="treble-particle particle-4"></div>
    <div class="treble-particle particle-5"></div>
    <div class="treble-particle particle-6"></div>
  </div>
`;
document.body.appendChild(container);

const vis = container.querySelector('#vis');
const bars = container.querySelectorAll('.center-bar');
const bassRing = container.querySelector('#bassRing');
const particles = container.querySelectorAll('.treble-particle');

let audioContext, analyser, dataArray, rafId = null;
let isRunning = false;
let bin = () => 0;
let bassStart = 0, bassEnd = 0;
let midSplits = [], trebleSplits = [];
let prevBass = null;      // per-bin previous bass frame (0..1)
let bassEnv = 0, bassPeak = 0, ringScale = 1;

function setup() {
  try {
    // Use the EQ's analyser if available, otherwise create our own
    if (window.dynamicEQ && window.dynamicEQ.analyserNode && window.dynamicEQ.audioContext) {
      // Reuse EQ's analyser to avoid conflicts
      audioContext = window.dynamicEQ.audioContext;
      analyser = window.dynamicEQ.analyserNode;
      console.log('Visualizer using EQ analyser node');
    } else {
      // Fallback: create our own analyser
      const { ctx, source } = window.SharedAudio.get(audioElement);
      audioContext = ctx;
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.3;
      analyser.minDecibels = -90;
      analyser.maxDecibels = -25;
      
      // Connect to source for analysis (parallel tap)
      source.connect(analyser);
      console.log('Visualizer created its own analyser');
    }

    dataArray = new Uint8Array(analyser.frequencyBinCount);

    const hzPerBin = audioContext.sampleRate / analyser.fftSize;
    bin = (hz) => Math.max(0, Math.min(analyser.frequencyBinCount - 1, Math.round(hz / hzPerBin)));

    bassStart = bin(20);
    bassEnd   = bin(250);

    midSplits = [
      [bin(250), bin(650)], [bin(650), bin(1000)],
      [bin(1000), bin(1700)], [bin(1700), bin(2600)], [bin(2600), bin(4000)]
    ];

    trebleSplits = [
      [bin(4000), bin(5200)], [bin(5200), bin(6500)], [bin(6500), bin(7800)],
      [bin(7800), bin(9500)], [bin(9500), bin(12000)], [bin(12000), bin(15000)]
    ];

    prevBass = new Float32Array(Math.max(1, bassEnd - bassStart));
    isRunning = true;
    animate();
  } catch (e) {
    console.error('Audio setup failed:', e);
  }
}

function avgRange(start, end) {
  const hi = Math.min(end, dataArray.length);
  const lo = Math.max(0, start);
  let sum = 0, n = hi - lo;
  if (n <= 0) return 0;
  for (let i = lo; i < hi; i++) sum += dataArray[i];
  return (sum / n) / 255; // 0..1
}

function animate() {
  if (!isRunning) return;
  rafId = requestAnimationFrame(animate);
  
  // Check if analyser is still valid
  if (!analyser || !dataArray) {
    console.warn('Analyser not available, stopping animation');
    isRunning = false;
    return;
  }
  
  try {
    analyser.getByteFrequencyData(dataArray);
  } catch (e) {
    console.warn('Failed to get frequency data:', e);
    return;
  }

  // --- Bass average with gate ---
  let bassAvg = avgRange(bassStart, bassEnd);
  bassAvg = Math.max(0, (bassAvg - CFG.GATE) / (1 - CFG.GATE));

  // Envelope (attack/decay)
  if (bassAvg > bassEnv) bassEnv += (bassAvg - bassEnv) * CFG.ATTACK;
  else                   bassEnv += (bassAvg - bassEnv) * CFG.RELEASE;

  // --- Bass transient boost via spectral flux (fast "thump") ---
  let fluxSum = 0, count = 0;
  for (let i = bassStart, j = 0; i < bassEnd; i++, j++) {
    const curr = dataArray[i] / 255;
    const rise = curr - prevBass[j];
    if (rise > 0) fluxSum += rise;
    prevBass[j] = curr;
    count++;
  }
  let flux = count ? (fluxSum / count) : 0;                 // average positive rise
  flux = Math.max(0, (flux - CFG.FLUX_GATE)) * CFG.FLUX_GAIN; // gate + gain
  flux = Math.min(1, flux);                                 // keep sane

  // Peak hold for glow
  if (bassEnv > bassPeak) bassPeak = bassEnv;
  else bassPeak *= 0.92;

  // Target scale combines envelope + transient boost
  let targetScale = 1 + (bassEnv * CFG.BASS_GAIN) + (flux * CFG.BOOST_GAIN);
  if (targetScale > CFG.SCALE_MAX) targetScale = CFG.SCALE_MAX;

  // Asymmetric lerp: pop quickly on rises, settle smoothly on falls
  const lerp = targetScale > ringScale ? CFG.RISE_LERP : CFG.FALL_LERP;
  ringScale += (targetScale - ringScale) * lerp;

  // --- Apply styles (minimal writes) ---
  bassRing.style.transform = `scale(${ringScale})`;
  const op = (0.6 + bassEnv * 0.4).toFixed(3);
  if (bassRing.style.opacity !== op) bassRing.style.opacity = op;
  const br = (1 + bassEnv * 0.5).toFixed(3);
  const nf = `brightness(${br})`;
  if (bassRing.style.filter !== nf) bassRing.style.filter = nf;
  bassRing.style.setProperty('--peak', bassPeak.toFixed(3));

  // Mids (bars)
  for (let i = 0; i < bars.length; i++) {
    const [s, e] = midSplits[i];
    const m = avgRange(s, e);
    bars[i].style.height = `${(2 + m * 36).toFixed(2)}px`;
    bars[i].style.opacity = (0.7 + m * 0.3).toFixed(3);
  }

  // Treble (particles)
  particles.forEach((p, i) => {
    const r = trebleSplits[i] || trebleSplits[trebleSplits.length - 1];
    const t = avgRange(r[0], r[1]);
    if (t > 0.18) {
      p.style.transform = `scale(${(1 + t * 2).toFixed(3)})`;
      p.style.opacity = (0.3 + t * 0.7).toFixed(3);
    } else {
      p.style.transform = 'scale(0.55)';
      p.style.opacity = '0.10';
    }
  });

  // Activity glow
  const midAvg = midSplits.reduce((a, r) => a + avgRange(r[0], r[1]), 0) / midSplits.length;
  vis.classList.toggle('active', Math.max(bassEnv, midAvg) > 0.08);
}

// Click to resume on autoplay-restricted platforms
vis.addEventListener('click', () => {
  if (audioContext && audioContext.state === 'suspended') audioContext.resume();
});

const onPlay = () => { 
  if (!isRunning) {
    // Delay setup to ensure EQ is ready
    setTimeout(setup, 100);
  }
  vis.classList.add('active'); 
};
const onPause = () => vis.classList.remove('active');
const onEnded = () => vis.classList.remove('active');

audioElement.addEventListener('play', onPlay);
audioElement.addEventListener('pause', onPause);
audioElement.addEventListener('ended', onEnded);

if (!audioElement.paused) {
  setTimeout(setup, 100);
}

const cleanup = () => {
  isRunning = false;
  if (rafId) cancelAnimationFrame(rafId);
  if (container.parentNode) container.parentNode.removeChild(container);
  audioElement.removeEventListener('play', onPlay);
  audioElement.removeEventListener('pause', onPause);
  audioElement.removeEventListener('ended', onEnded);
  // Don't close the shared audio context
};

return { element: vis, container, cleanup, isRunning: () => isRunning };
  }