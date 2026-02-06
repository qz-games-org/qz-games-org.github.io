window.SharedAudio = (() => {
    const map = new WeakMap();
    
    return {
        get(audioEl) {
            if (!audioEl) throw new Error('audioEl required');
            let shared = map.get(audioEl);
            if (shared) return shared;

            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const source = ctx.createMediaElementSource(audioEl);
            const masterGain = ctx.createGain();
            
            // ALWAYS connect source to master so audio flows by default
            masterGain.connect(ctx.destination);
            source.connect(masterGain);

            shared = { ctx, source, masterGain };
            map.set(audioEl, shared);
            return shared;
        }
    };
})();