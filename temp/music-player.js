// Music Player Widget with Web Audio API
// Modular implementation - can be initialized on demand

(function() {
    'use strict';

    let playerWidget = null;
    let audioContext = null;
    let audioElement = null;
    let sourceNode = null;
    let bassBoostFilter = null;
    let compressor = null;
    let gainNode = null;
    let analyser = null;
    let visualizationActive = false;

    let songs = {};
    let songKeys = [];
    let currentSongIndex = 0;
    let isPlaying = false;
    let isBassBoostActive = false;
    let currentVolume = 0.7;
    let queueOpen = false;
    let volumePopupOpen = false;

    // Initialize Music Player
    window.initMusicPlayer = async function() {
        if (playerWidget) {
            playerWidget.classList.add('active');
            return;
        }

        try {
            // Load songs from JSON
            const response = await fetch('./temp/songs.json');
            songs = await response.json();
            songKeys = Object.keys(songs);

            if (songKeys.length === 0) {
                console.error('No songs found in songs.json');
                return;
            }

            // Restore saved state
            loadPlayerState();

            // Create player widget
            createPlayerWidget();

            // Setup Web Audio API
            setupAudioContext();

            // Update UI with first song
            updatePlayerUI();
            togglePlayPause()
        } catch (error) {
            console.error('Error initializing music player:', error);
        }
    };

    // Create Player Widget DOM
    function createPlayerWidget() {
        playerWidget = document.createElement('div');
        playerWidget.className = 'music-player-widget active';
        playerWidget.innerHTML = `
            <div class="player-header">
                <img class="player-cover" id="player-cover" src="./Q-BIG.png" alt="Album Cover">
                <div class="player-info">
                    <h3 class="player-title" id="player-title">Select a song</h3>
                    <div class="player-artist-row">
                        <p class="player-artist" id="player-artist">No artist</p>
                        <a class="soundcloud-link" id="soundcloud-link" href="#" target="_blank" rel="noopener" style="display: none;">
                            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path d="M7 17.939h-1v-8.068c.308-.231.639-.429 1-.566v8.634zm3 0h1v-9.224c-.229.265-.443.548-.621.857l-.379-.184v8.551zm-2 0h1v-8.848c-.508-.079-.623-.05-1-.01v8.858zm-4 0h1v-7.02c-.312.458-.555.971-.692 1.535l-.308-.182v5.667zm-3-5.25c-.606.547-1 1.354-1 2.268 0 .914.394 1.721 1 2.268v-4.536zm18.879-.671c-.204-2.837-2.404-5.079-5.117-5.079-1.022 0-1.964.328-2.762.877v10.123h9.089c1.607 0 2.911-1.393 2.911-3.106 0-2.233-2.168-3.772-4.121-2.815zm-16.879-.027c-.302-.024-.526-.03-1 .122v5.689c.446.143.636.138 1 .138v-5.949z"/>
                            </svg>
                        </a>
                    </div>
                </div>
            </div>

            <div class="player-progress-container">
                <div class="player-progress-bar" id="progress-bar">
                    <div class="player-progress-fill" id="progress-fill"></div>
                    <div class="player-progress-handle" id="progress-handle"></div>
                </div>
                <div class="player-time">
                    <span id="current-time">0:00</span>
                    <span id="total-time">0:00</span>
                </div>
            </div>

            <div class="player-controls">
                <button class="player-btn" id="prev-btn" title="Previous">
                    <span class="material-icons">skip_previous</span>
                </button>
                <button class="player-btn play-pause" id="play-pause-btn" title="Play">
                    <span class="material-icons">play_arrow</span>
                </button>
                <button class="player-btn" id="next-btn" title="Next">
                    <span class="material-icons">skip_next</span>
                </button>
            </div>

            <div class="player-bottom-controls">
                <div class="volume-control">
                    <button class="volume-btn" id="volume-btn" title="Volume">
                        <span class="material-icons">volume_up</span>
                    </button>
                    <div class="volume-popup" id="volume-popup">
                        <div class="volume-slider-container">
                            <span class="volume-value" id="volume-value">70%</span>
                            <input type="range" class="volume-slider" id="volume-slider" min="0" max="100" value="70">
                        </div>
                    </div>
                </div>
                <button class="bass-boost-btn" id="bass-boost-btn" title="Toggle Bass Boost">
                    <span class="material-icons">equalizer</span>
                    Bass
                </button>
                <button class="queue-btn" id="queue-btn" title="Show Queue">
                    <span class="material-icons">queue_music</span>
                </button>
            </div>

            <div class="queue-list" id="queue-list"></div>
        `;

        document.body.appendChild(playerWidget);
        attachEventListeners();
        populateQueue();
    }

    // Setup Web Audio API
    function setupAudioContext() {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            audioElement = new Audio();
            audioElement.crossOrigin = 'anonymous';

            // Create audio nodes
            sourceNode = audioContext.createMediaElementSource(audioElement);
            bassBoostFilter = audioContext.createBiquadFilter();
            compressor = audioContext.createDynamicsCompressor();
            analyser = audioContext.createAnalyser();
            gainNode = audioContext.createGain();

            // Configure bass boost filter
            bassBoostFilter.type = 'lowshelf';
            bassBoostFilter.frequency.value = 200;
            bassBoostFilter.gain.value = 0; // Start at 0dB

            // Configure compressor for clipping protection
            compressor.threshold.value = -10; // Start compression at -10dB
            compressor.knee.value = 10; // Smooth compression curve
            compressor.ratio.value = 12; // Strong compression ratio
            compressor.attack.value = 0.003; // Fast attack (3ms)
            compressor.release.value = 0.25; // Quick release (250ms)

            // Configure analyser for visualization
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.8;

            // Connect nodes: source -> bass boost -> compressor -> analyser -> gain -> destination
            sourceNode.connect(bassBoostFilter);
            bassBoostFilter.connect(compressor);
            compressor.connect(analyser);
            analyser.connect(gainNode);
            gainNode.connect(audioContext.destination);

            // Set initial volume
            gainNode.gain.value = currentVolume;
            document.getElementById('volume-slider').value = currentVolume * 100;
            updateVolumeDisplay(Math.round(currentVolume * 100));

            // Audio events
            audioElement.addEventListener('timeupdate', updateProgress);
            audioElement.addEventListener('ended', playNext);
            audioElement.addEventListener('loadedmetadata', updateDuration);

            // Start visualization
            startVisualization();

        } catch (error) {
            console.error('Error setting up Web Audio API:', error);
        }
    }

    // Start Audio Visualization
    function startVisualization() {
        visualizationActive = true;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        let peakHoldTime = 0;
        let peakValue = 0;

        function animate() {
            if (!visualizationActive) return;

            requestAnimationFrame(animate);
            analyser.getByteFrequencyData(dataArray);

            // Calculate average bass energy (lower frequencies)
            let bassSum = 0;
            const bassRange = Math.floor(bufferLength * 0.2); // First 20% of frequencies
            for (let i = 0; i < bassRange; i++) {
                bassSum += dataArray[i];
            }
            const bassAverage = bassSum / bassRange / 255; // Normalize to 0-1

            // Bass threshold - only pulse when bass exceeds this level
            const threshold = 0.25; // 25% threshold - ignores quiet bass
            let pulseIntensity = 0;

            if (bassAverage > threshold) {
                // Map values above threshold to 0-1 range
                const normalizedBass = (bassAverage - threshold) / (1 - threshold);
                // Apply power curve for more dramatic pulses
                pulseIntensity = Math.pow(normalizedBass, 0.6) * 0.8;

                // Peak detection - hold strong pulses briefly
                if (pulseIntensity > peakValue) {
                    peakValue = pulseIntensity;
                    peakHoldTime = 5; // Hold peak for 5 frames (~83ms at 60fps)
                }
            }

            // Apply peak hold effect for short bass hits
            if (peakHoldTime > 0) {
                pulseIntensity = Math.max(pulseIntensity, peakValue);
                peakHoldTime--;
                // Decay peak value
                peakValue *= 0.85;
            }

            // Apply pulsing effect to player background
            const playerWidget = document.querySelector('.music-player-widget');
            if (playerWidget && isPlaying) {
                playerWidget.style.setProperty('--pulse-intensity', pulseIntensity);
            } else if (playerWidget) {
                playerWidget.style.setProperty('--pulse-intensity', 0);
            }
        }

        animate();
    }

    // Attach Event Listeners
    function attachEventListeners() {
        // Play/Pause
        document.getElementById('play-pause-btn').addEventListener('click', togglePlayPause);

        // Previous/Next
        document.getElementById('prev-btn').addEventListener('click', playPrevious);
        document.getElementById('next-btn').addEventListener('click', playNext);

        // Progress bar
        const progressBar = document.getElementById('progress-bar');
        progressBar.addEventListener('click', seekAudio);

        // Volume
        const volumeSlider = document.getElementById('volume-slider');
        volumeSlider.addEventListener('input', (e) => {
            const volume = e.target.value / 100;
            setVolume(volume);
            updateVolumeDisplay(e.target.value);
        });

        document.getElementById('volume-btn').addEventListener('click', toggleVolumePopup);

        // Close volume popup when clicking outside
        document.addEventListener('click', (e) => {
            const volumeControl = document.querySelector('.volume-control');
            if (volumePopupOpen && !volumeControl.contains(e.target)) {
                closeVolumePopup();
            }
        });

        // Bass Boost
        document.getElementById('bass-boost-btn').addEventListener('click', toggleBassBoost);

        // Queue
        document.getElementById('queue-btn').addEventListener('click', toggleQueue);
    }

    // Toggle Play/Pause
    function togglePlayPause() {
        if (!audioElement.src) {
            loadSong(currentSongIndex);
        }

        if (isPlaying) {
            audioElement.pause();
            isPlaying = false;
            document.querySelector('#play-pause-btn .material-icons').textContent = 'play_arrow';
        } else {
            if (audioContext.state === 'suspended') {
                audioContext.resume();
            }
            audioElement.play();
            isPlaying = true;
            document.querySelector('#play-pause-btn .material-icons').textContent = 'pause';
        }
    }

    // Load Song
    function loadSong(index) {
        if (index < 0 || index >= songKeys.length) return;

        currentSongIndex = index;
        const songKey = songKeys[index];
        const song = songs[songKey];

        audioElement.src = song.musicfile;
        updatePlayerUI();
        highlightQueueItem();

        if (isPlaying) {
            audioElement.play();
        }

        savePlayerState();
    }

    // Update Player UI
    function updatePlayerUI() {
        const songKey = songKeys[currentSongIndex];
        const song = songs[songKey];

        // Format title (replace hyphens/underscores with spaces, capitalize)
        const title = songKey.split('-').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');

        document.getElementById('player-title').textContent = title;
        document.getElementById('player-artist').textContent = song.artist;
        document.getElementById('player-cover').src = song.cover;

        // SoundCloud link
        const scLink = document.getElementById('soundcloud-link');
        if (song.soundcloud) {
            scLink.href = song.soundcloud;
            scLink.style.display = 'inline-flex';
        } else {
            scLink.style.display = 'none';
        }
    }

    // Update Progress Bar
    function updateProgress() {
        if (!audioElement.duration) return;

        const progress = (audioElement.currentTime / audioElement.duration) * 100;
        document.getElementById('progress-fill').style.width = progress + '%';
        document.getElementById('progress-handle').style.left = progress + '%';
        document.getElementById('current-time').textContent = formatTime(audioElement.currentTime);
    }

    // Update Duration
    function updateDuration() {
        document.getElementById('total-time').textContent = formatTime(audioElement.duration);
    }

    // Seek Audio
    function seekAudio(e) {
        if (!audioElement.duration) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        audioElement.currentTime = percent * audioElement.duration;
    }

    // Set Volume
    function setVolume(volume) {
        currentVolume = volume;
        gainNode.gain.value = volume;

        const volumeIcon = document.querySelector('#volume-btn .material-icons');
        if (volume === 0) {
            volumeIcon.textContent = 'volume_mute';
        } else if (volume < 0.5) {
            volumeIcon.textContent = 'volume_down';
        } else {
            volumeIcon.textContent = 'volume_up';
        }

        savePlayerState();
    }

    // Update Volume Display
    function updateVolumeDisplay(value) {
        document.getElementById('volume-value').textContent = value + '%';
    }

    // Toggle Volume Popup
    function toggleVolumePopup(e) {
        e.stopPropagation();
        volumePopupOpen = !volumePopupOpen;
        const popup = document.getElementById('volume-popup');
        popup.classList.toggle('active', volumePopupOpen);
    }

    // Close Volume Popup
    function closeVolumePopup() {
        volumePopupOpen = false;
        document.getElementById('volume-popup').classList.remove('active');
    }

    // Toggle Bass Boost
    function toggleBassBoost() {
        isBassBoostActive = !isBassBoostActive;
        const btn = document.getElementById('bass-boost-btn');

        if (isBassBoostActive) {
            // Smooth transition to +10dB (reduced from +12dB for less clipping risk)
            bassBoostFilter.gain.setTargetAtTime(10, audioContext.currentTime, 0.5);
            btn.classList.add('active');
        } else {
            // Smooth transition to 0dB
            bassBoostFilter.gain.setTargetAtTime(0, audioContext.currentTime, 0.5);
            btn.classList.remove('active');
        }

        savePlayerState();
    }

    // Play Previous
    function playPrevious() {
        currentSongIndex = (currentSongIndex - 1 + songKeys.length) % songKeys.length;
        loadSong(currentSongIndex);
        if (isPlaying) {
            audioElement.play();
        }
    }

    // Play Next
    function playNext() {
        currentSongIndex = (currentSongIndex + 1) % songKeys.length;
        loadSong(currentSongIndex);
        if (isPlaying) {
            audioElement.play();
        }
    }

    // Toggle Queue
    function toggleQueue() {
        queueOpen = !queueOpen;
        const queueList = document.getElementById('queue-list');
        queueList.classList.toggle('open', queueOpen);
    }

    // Populate Queue
    function populateQueue() {
        const queueList = document.getElementById('queue-list');
        queueList.innerHTML = '';

        songKeys.forEach((key, index) => {
            const song = songs[key];
            const title = key.split('-').map(word =>
                word.charAt(0).toUpperCase() + word.slice(1)
            ).join(' ');

            const item = document.createElement('div');
            item.className = 'queue-item';
            item.dataset.index = index;
            if (index === currentSongIndex) {
                item.classList.add('active');
            }

            item.innerHTML = `
                <img class="queue-item-cover" src="${song.cover}" alt="${title}">
                <div class="queue-item-info">
                    <div class="queue-item-title">${title}</div>
                    <div class="queue-item-artist">${song.artist}</div>
                </div>
            `;

            item.addEventListener('click', () => {
                loadSong(index);
                if (!isPlaying) {
                    togglePlayPause();
                }
            });

            queueList.appendChild(item);
        });
    }

    // Highlight Queue Item
    function highlightQueueItem() {
        document.querySelectorAll('.queue-item').forEach((item, index) => {
            item.classList.toggle('active', index === currentSongIndex);
        });
    }

    // Format Time
    function formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // Save Player State to LocalStorage
    function savePlayerState() {
        localStorage.setItem('musicPlayer_volume', currentVolume);
        localStorage.setItem('musicPlayer_bassBoost', isBassBoostActive);
        localStorage.setItem('musicPlayer_currentSong', currentSongIndex);
    }

    // Load Player State from LocalStorage
    function loadPlayerState() {
        const savedVolume = localStorage.getItem('musicPlayer_volume');
        if (savedVolume !== null) {
            currentVolume = parseFloat(savedVolume);
        }

        const savedBassBoost = localStorage.getItem('musicPlayer_bassBoost');
        if (savedBassBoost !== null) {
            isBassBoostActive = savedBassBoost === 'true';
        }

        const savedSong = localStorage.getItem('musicPlayer_currentSong');
        if (savedSong !== null) {
            currentSongIndex = parseInt(savedSong);
        }
    }

})();


document.getElementById('gamesearch').addEventListener('keyup', checkkkkkkkk)
function checkkkkkkkk() {
    if(document.getElementById('gamesearch').value ==="evans birthday") {
        console.log('special')
         initMusicPlayer();
    }

}