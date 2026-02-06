/*
class MusicPlayer {
    constructor(audioElementId = 'audio') {
        // Get or create audio element
        this.audio = document.getElementById(audioElementId);
        if (!this.audio) {
            this.audio = document.createElement('audio');
            this.audio.id = audioElementId;
            this.audio.preload = 'auto';
            document.body.appendChild(this.audio);
        }
        
        // Player state
        this.isPlaying = false;
        this.isPaused = false;
        this.volume = 1.0; // 0.0 to 1.0
        this.currentTime = 0;
        this.duration = 0;
        
        // Current song
        this.currentSong = null;
        
        // Queue system
        this.queue = [];
        this.queueIndex = -1;
        
        // Recently played songs (max 50)
        this.recentlyPlayed = [];
        this.maxRecentlyPlayed = 50;
        
        // Shuffle and repeat modes
        this.shuffleMode = false;
        this.repeatMode = 'off'; // 'off', 'all', 'one'
        
        // Original queue for shuffle
        this.originalQueue = [];
        
        // Event listeners
        this.eventListeners = {};
        
        // Time update interval
        this.timeUpdateInterval = null;
        
        // Display elements (will be auto-detected or can be set manually)
        this.displayElements = {
            coverImage: document.getElementById('coverpic'),
            songTitle: null,
            artistName: null,
            featuredArtist: null,
            currentTime: null,
            duration: null,
            progressBar: document.getElementById('progress-bar')
        };
        
        // Initialize audio event listeners
        this.initializeAudioEvents();
        
        // Set initial volume
        this.audio.volume = this.volume;
        
        // Auto-detect common display elements
        this.autoDetectDisplayElements();
    }
    
    // Auto-detect common display elements by ID
    autoDetectDisplayElements() {
        const elementIds = {
            coverImage: ['cover-image', 'album-cover', 'song-cover', 'cover'],
            songTitle: ['song-title', 'track-title', 'title', 'song-name'],
            artistName: ['artist-name', 'artist', 'song-artist'],
            featuredArtist: ['featured-artist', 'ft-artist', 'featuring'],
            currentTime: ['current-time', 'time-current', 'current'],
            duration: ['song-duration', 'total-time', 'duration'],
            progressBar: ['progress-bar', 'seek-bar', 'progress']
        };
        
        for (const [key, ids] of Object.entries(elementIds)) {
            for (const id of ids) {
                const element = document.getElementById(id);
                if (element) {
                    this.displayElements[key] = element;
                    break;
                }
            }
        }
    }
    
    // Manually set display elements
    setDisplayElements(elements) {
        Object.assign(this.displayElements, elements);
        this.updateDisplay();
        return this;
    }
    
    // Set individual display element
    setDisplayElement(type, element) {
        if (typeof element === 'string') {
            element = document.getElementById(element) || document.querySelector(element);
        }
        this.displayElements[type] = element;
        this.updateDisplay();
        return this;
    }
    
    // Update all display elements
    updateDisplay() {
        this.updateCoverImage();
        this.updateSongInfo();
        this.updateTimeDisplay();
        this.updateProgressBar();
        this.emit('displayUpdated', {
            song: this.currentSong,
            currentTime: this.currentTime,
            duration: this.duration
        });
    }
    
    // Update cover image
    updateCoverImage() {
        const coverElement = this.displayElements.coverImage;
        
        coverElement.src = this.currentSong.cover;
        coverElement.alt = `${this.currentSong.name} by ${this.currentSong.artist}`;
           
        
    }
    
    // Update song information
    updateSongInfo() {
        if (this.currentSong) {
            // Update song title
            if (this.displayElements.songTitle) {
                this.displayElements.songTitle.textContent = this.currentSong.name;
            }
            
            // Update artist name
            if (this.displayElements.artistName) {
                this.displayElements.artistName.textContent = this.currentSong.artist;
            }
            
            // Update featured artist
            if (this.displayElements.featuredArtist) {
                if (this.currentSong.ft) {
                    this.displayElements.featuredArtist.textContent = `ft. ${this.currentSong.ft}`;
                    this.displayElements.featuredArtist.style.display = '';
                } else {
                    this.displayElements.featuredArtist.textContent = '';
                    this.displayElements.featuredArtist.style.display = 'none';
                }
            }
        } else {
            // Clear display when no song
            if (this.displayElements.songTitle) {
                this.displayElements.songTitle.textContent = 'No song selected';
            }
            if (this.displayElements.artistName) {
                this.displayElements.artistName.textContent = '';
            }
            if (this.displayElements.featuredArtist) {
                this.displayElements.featuredArtist.textContent = '';
                this.displayElements.featuredArtist.style.display = 'none';
            }
        }
    }
    
    // Update time display
    updateTimeDisplay() {
        // Update current time display
        if (this.displayElements.currentTime) {
            this.displayElements.currentTime.textContent = this.formatTime(this.currentTime);
        }
        
        // Update duration display
        if (this.displayElements.duration) {
            this.displayElements.duration.textContent = this.formatTime(this.duration);
        }
    }
    
    // Update progress bar
    updateProgressBar() {
        if (this.displayElements.progressBar && this.duration > 0) {
            const progress = Math.min(100, Math.max(0, (this.currentTime / this.duration) * 100));
            
            if (this.displayElements.progressBar.type === 'range') {
                this.displayElements.progressBar.value = progress;
            } else {
                this.displayElements.progressBar.style.width = `${progress}%`;
                this.displayElements.progressBar.setAttribute('data-progress', progress.toFixed(0.6));
            }
        }
    }
    
    // Enable click-to-seek on progress bar
    enableProgressBarSeeking() {
        const progressContainer = document.getElementById('progress-container');
        
        if (progressContainer && this.displayElements.progressBar) {
            const handleSeek = (e) => {
                if (this.duration > 0) {
                    const rect = progressContainer.getBoundingClientRect();
                    const clickX = e.clientX - rect.left;
                    const percentage = clickX / rect.width;
                    const seekTime = percentage * this.duration;
                    this.seek(Math.max(0, Math.min(this.duration, seekTime)));
                }
            };
            
            progressContainer.addEventListener('click', handleSeek);
            
            // Store reference for cleanup
            this.progressBarClickHandler = handleSeek;
        }
        
        return this;
    }
    
    // Initialize audio element event listeners
    initializeAudioEvents() {
        // When audio can start playing
        this.audio.addEventListener('canplay', () => {
            this.duration = this.audio.duration || 0;
            if (this.currentSong) {
                this.currentSong.duration = this.duration;
            }
            this.emit('durationChanged', this.duration);
            this.updateDisplay();
        });
        
        // When audio metadata is loaded
        this.audio.addEventListener('loadedmetadata', () => {
            this.duration = this.audio.duration || 0;
            if (this.currentSong) {
                this.currentSong.duration = this.duration;
            }
            this.emit('durationChanged', this.duration);
            this.updateDisplay();
        });
        
        // When audio starts playing
        this.audio.addEventListener('play', () => {
            this.isPlaying = true;
            this.isPaused = false;
            this.startTimeUpdate();
            this.emit('playStateChanged', true);
        });
        
        // When audio is paused
        this.audio.addEventListener('pause', () => {
            this.isPaused = true;
            this.stopTimeUpdate();
            this.emit('playStateChanged', false);
        });
        
        // When audio ends
        this.audio.addEventListener('ended', () => {
            this.stopTimeUpdate();
            this.handleSongEnd();
        });
        
        // When audio encounters an error
        this.audio.addEventListener('error', (e) => {
            const error = this.audio.error;
            let errorMessage = 'Unknown audio error';
            
            if (error) {
                switch (error.code) {
                    case error.MEDIA_ERR_ABORTED:
                        errorMessage = 'Audio playback aborted';
                        break;
                    case error.MEDIA_ERR_NETWORK:
                        errorMessage = 'Network error while loading audio';
                        break;
                    case error.MEDIA_ERR_DECODE:
                        errorMessage = 'Audio decoding error';
                        break;
                    case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
                        errorMessage = 'Audio format not supported';
                        break;
                }
            }
            
            console.error('Audio error:', errorMessage, error);
            this.emit('error', { message: errorMessage, originalError: error });
            
            // Don't auto-skip on error, let user handle it
            this.stop();
        });
        
        // When audio is seeking
        this.audio.addEventListener('seeking', () => {
            this.emit('seeking', true);
        });
        
        // When audio seek is complete
        this.audio.addEventListener('seeked', () => {
            this.emit('seeking', false);
        });
        
        // Volume change
        this.audio.addEventListener('volumechange', () => {
            this.volume = this.audio.volume;
            this.emit('volumeChanged', this.volume);
        });
    }
    
    // Start time update interval
    startTimeUpdate() {
        this.stopTimeUpdate(); // Clear any existing interval
        this.timeUpdateInterval = setInterval(() => {
            if (!this.audio.paused && !this.audio.seeking) {
                this.currentTime = this.audio.currentTime;
                this.updateTimeDisplay();
                this.updateProgressBar();
                playerUI.updateProgress(this.currentTime);

                
                this.emit('timeUpdate', this.currentTime);
            }
        }, 1000);
    }
    
    // Stop time update interval
    stopTimeUpdate() {
        if (this.timeUpdateInterval) {
            clearInterval(this.timeUpdateInterval);
            this.timeUpdateInterval = null;
        }
    }
    
    // Handle when song ends
    handleSongEnd() {
        this.isPlaying = false;
        this.isPaused = false;
        
        if (this.repeatMode === 'one') {
            // Replay current song
            this.audio.currentTime = 0;
            this.audio.play();
        } else {
            // Skip to next song
            this.skip();
        }
    }
    
    // Load audio source
    loadAudioSource(src) {
        if (src) {
            this.audio.src = src;
            this.audio.load();
        }
    }
    
    // Event system
    addEventListener(event, callback) {
        if (!this.eventListeners[event]) {
            this.eventListeners[event] = [];
        }
        this.eventListeners[event].push(callback);
    }
    
    removeEventListener(event, callback) {
        if (this.eventListeners[event]) {
            this.eventListeners[event] = this.eventListeners[event].filter(cb => cb !== callback);
        }
    }
    
    emit(event, data = null) {
        if (this.eventListeners[event]) {
            this.eventListeners[event].forEach(callback => callback(data));
        }
    }
    
    // Song creation helper
    createSong(name, artist, ft = null, cover = null, src) {
        cover = './music/assets/covers/' + cover
        return {
            id: Date.now() + Math.random(), // Simple ID generation
            name,
            artist,
            ft,
            cover,
            src, // Audio source URL
            addedAt: new Date(),
            duration: 0 // Will be set when audio loads
        };
    }
    
    // Play a song directly
    play(name, artist, ft = null, cover = null, src) {
        const song = this.createSong(name, artist, ft, cover, src);
        this.currentSong = song;
        playerUI.updatePlayState(true);

        // Load audio source
        this.loadAudioSource(src);
        
        // Add to recently played
        this.addToRecentlyPlayed(song);
        
        // Emit events
        this.emit('songChanged', song);
        
        // Update display
        this.updateDisplay();
        
        // Play audio
        const playPromise = this.audio.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.error('Play failed:', error);
                this.emit('error', error);
            });
        }
        
        console.log(`Now playing: ${this.getSongDisplayName(song)}`);
        return this;
    }
    
    // Pause playback
    pause() {
        if (!this.audio.paused) {
            playerUI.updatePlayState(false);
            this.audio.pause();
            console.log('Playback paused');
        }
        return this;
    }
    
    // Resume playback
    resume() {
        if (this.audio.paused && this.currentSong) {
            const playPromise = this.audio.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.error('Resume failed:', error);
                    this.emit('error', error);
                });
            }
            console.log('Playback resumed');
            playerUI.updatePlayState(true);
        }
        return this;
    }
    
    // Toggle play/pause
    togglePlayPause() {
        if (this.audio.paused) {
            if (this.currentSong) {
                this.resume();
            } else if (this.queue.length > 0) {
                this.playFromQueue(this.queueIndex >= 0 ? this.queueIndex : 0);
            }
        } else {
            this.pause();
        }
        return this;
    }
    
    // Stop playback
    stop() {
        this.audio.pause();
        this.audio.currentTime = 0;
        this.currentTime = 0;
        this.isPlaying = false;
        this.isPaused = false;
        this.stopTimeUpdate();
        
        this.emit('playStateChanged', false);
        this.emit('timeUpdate', 0);
        console.log('Playback stopped');
        return this;
    }
    
    // Add song to queue
    addSongToQueue(name, artist, ft = null, cover = null, src) {
        const song = this.createSong(name, artist, ft, cover, src);
        this.queue.push(song);
        
        // Update original queue for shuffle
        if (!this.shuffleMode) {
            this.originalQueue = [...this.queue];
        }
        
        this.emit('queueUpdated', this.queue);
        console.log(`Added to queue: ${this.getSongDisplayName(song)}`);
        return this;
    }
    
    // Remove song from queue by index
    removeSongFromQueue(index) {
        if (index >= 0 && index < this.queue.length) {
            const removedSong = this.queue.splice(index, 1)[0];
            
            // Adjust current queue index if necessary
            if (index < this.queueIndex) {
                this.queueIndex--;
            } else if (index === this.queueIndex) {
                // If we removed the currently playing song
                if (this.queue.length === 0) {
                    this.stop();
                    this.queueIndex = -1;
                } else {
                    // Play next song or adjust index
                    if (this.queueIndex >= this.queue.length) {
                        this.queueIndex = this.queue.length - 1;
                    }
                }
            }
            
            // Update original queue
            if (!this.shuffleMode) {
                this.originalQueue = [...this.queue];
            }
            
            this.emit('queueUpdated', this.queue);
            console.log(`Removed from queue: ${this.getSongDisplayName(removedSong)}`);
            return removedSong;
        }
        return null;
    }
    
    // Remove song from queue by song object
    removeSongFromQueueBySong(song) {
        const index = this.queue.findIndex(s => s.id === song.id);
        if (index !== -1) {
            return this.removeSongFromQueue(index);
        }
        return null;
    }
    
    // Play song from queue by index
    playFromQueue(index) {
        if (index >= 0 && index < this.queue.length) {
            this.queueIndex = index;
            const song = this.queue[index];
            this.currentSong = song;
            
            // Load and play audio
            this.loadAudioSource(song.src);
            
            // Add to recently played
            this.addToRecentlyPlayed(song);
            
            this.emit('songChanged', song);
            this.emit('queuePositionChanged', index);
            
            // Update display
            this.updateDisplay();
            
            // Play audio
            const playPromise = this.audio.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.error('Play from queue failed:', error);
                    this.emit('error', error);
                });
            }
            
            console.log(`Playing from queue [${index + 1}/${this.queue.length}]: ${this.getSongDisplayName(song)}`);
        }
        return this;
    }
    
    // Skip to next song
    skip() {
        if (this.queue.length === 0) {
            console.log('No songs in queue to skip to');
            return this;
        }
        
        let nextIndex;
        
        if (this.repeatMode === 'one') {
            // Stay on same song
            nextIndex = this.queueIndex;
        } else {
            nextIndex = this.queueIndex + 1;
            
            if (nextIndex >= this.queue.length) {
                if (this.repeatMode === 'all') {
                    nextIndex = 0;
                } else {
                    // End of queue
                    this.stop();
                    console.log('Reached end of queue');
                    return this;
                }
            }
        }
        
        this.playFromQueue(nextIndex);
        return this;
    }
    
    // Skip back to previous song
    skipBack() {
        if (this.queue.length === 0) {
            console.log('No songs in queue to skip back to');
            return this;
        }
        
        // If more than 3 seconds into song, restart current song
        if (this.audio.currentTime > 3) {
            this.seek(0);
            console.log('Restarting current song');
            return this;
        }
        
        let prevIndex = this.queueIndex - 1;
        
        if (prevIndex < 0) {
            if (this.repeatMode === 'all') {
                prevIndex = this.queue.length - 1;
            } else {
                prevIndex = 0; // Stay at first song
            }
        }
        
        this.playFromQueue(prevIndex);
        return this;
    }
    
    // Adjust volume (0.0 to 1.0)
    adjustVolume(volume) {
        const newVolume = Math.max(0, Math.min(1, volume));
        this.audio.volume = newVolume;
        this.volume = newVolume;
        console.log(`Volume set to ${Math.round(this.volume * 100)}%`);
        return this;
    }
    
    // Mute/unmute
    mute() {
        this.audio.muted = true;
        this.emit('muteChanged', true);
        console.log('Audio muted');
        return this;
    }
    
    unmute() {
        this.audio.muted = false;
        this.emit('muteChanged', false);
        console.log('Audio unmuted');
        return this;
    }
    
    // Toggle mute
    toggleMute() {
        if (this.audio.muted) {
            this.unmute();
        } else {
            this.mute();
        }
        return this;
    }
    
    // Seek to position (in seconds)
    seek(seconds) {
        const seekTime = Math.max(0, Math.min(this.duration, seconds));
        this.audio.currentTime = seekTime;
        this.currentTime = seekTime;
        this.updateTimeDisplay();
        this.updateProgressBar();
        this.emit('timeUpdate', this.currentTime);
        console.log(`Seeked to ${this.formatTime(this.currentTime)}`);
        return this;
    }
    
    // Seek by percentage (0-1)
    seekToPercentage(percentage) {
        const seekTime = this.duration * Math.max(0, Math.min(1, percentage));
        return this.seek(seekTime);
    }
    
    // Toggle shuffle mode
    toggleShuffle() {
        this.shuffleMode = !this.shuffleMode;
        
        if (this.shuffleMode) {
            // Save original queue and shuffle
            this.originalQueue = [...this.queue];
            this.shuffleArray(this.queue);
            
            // Find current song in shuffled queue
            if (this.currentSong) {
                this.queueIndex = this.queue.findIndex(song => song.id === this.currentSong.id);
            }
        } else {
            // Restore original queue
            this.queue = [...this.originalQueue];
            
            // Find current song in original queue
            if (this.currentSong) {
                this.queueIndex = this.queue.findIndex(song => song.id === this.currentSong.id);
            }
        }
        
        this.emit('shuffleChanged', this.shuffleMode);
        this.emit('queueUpdated', this.queue);
        console.log(`Shuffle ${this.shuffleMode ? 'enabled' : 'disabled'}`);
        return this;
    }
    
    // Toggle repeat mode
    toggleRepeat() {
        const modes = ['off', 'all', 'one'];
        const currentIndex = modes.indexOf(this.repeatMode);
        this.repeatMode = modes[(currentIndex + 1) % modes.length];
        
        this.emit('repeatChanged', this.repeatMode);
        console.log(`Repeat mode: ${this.repeatMode}`);
        return this;
    }
    
    // Clear queue
    clearQueue() {
        this.queue = [];
        this.originalQueue = [];
        this.queueIndex = -1;
        this.stop();
        
        this.emit('queueUpdated', this.queue);
        console.log('Queue cleared');
        return this;
    }
    
    // Add to recently played
    addToRecentlyPlayed(song) {
        // Remove if already in recently played
        this.recentlyPlayed = this.recentlyPlayed.filter(s => s.id !== song.id);
        
        // Add to beginning
        this.recentlyPlayed.unshift({...song, playedAt: new Date()});
        
        // Limit size
        if (this.recentlyPlayed.length > this.maxRecentlyPlayed) {
            this.recentlyPlayed = this.recentlyPlayed.slice(0, this.maxRecentlyPlayed);
        }
        
        this.emit('recentlyPlayedUpdated', this.recentlyPlayed);
    }
    
    // Get recently played songs
    getRecentlyPlayed() {
        return [...this.recentlyPlayed];
    }
    
    // Clear recently played
    clearRecentlyPlayed() {
        this.recentlyPlayed = [];
        this.emit('recentlyPlayedUpdated', this.recentlyPlayed);
        console.log('Recently played cleared');
        return this;
    }
    
    // Get current queue
    getQueue() {
        return [...this.queue];
    }
    
    // Get current song info
    getCurrentSong() {
        return this.currentSong ? {...this.currentSong} : null;
    }
    
    // Get player state
    getState() {
        return {
            isPlaying: !this.audio.paused && !this.audio.ended,
            isPaused: this.audio.paused,
            volume: this.volume,
            isMuted: this.audio.muted,
            currentTime: this.audio.currentTime,
            duration: this.duration,
            currentSong: this.getCurrentSong(),
            queue: this.getQueue(),
            queueIndex: this.queueIndex,
            shuffleMode: this.shuffleMode,
            repeatMode: this.repeatMode,
            recentlyPlayed: this.getRecentlyPlayed()
        };
    }
    
    // Get audio element (for advanced usage)
    getAudioElement() {
        return this.audio;
    }
    
    // Destroy player and cleanup
    destroy() {
        this.stopTimeUpdate();
        this.stop();
        this.clearQueue();
        this.clearRecentlyPlayed();
        
        // Remove progress bar click handler
        if (this.progressBarClickHandler && this.displayElements.progressBar) {
            const progressContainer = this.displayElements.progressBar.parentElement || this.displayElements.progressBar;
            progressContainer.removeEventListener('click', this.progressBarClickHandler);
        }
        
        // Remove audio element if it was created by this class
        if (this.audio && this.audio.parentNode) {
            this.audio.parentNode.removeChild(this.audio);
        }
        
        this.eventListeners = {};
    }
    
    // Helper methods
    getSongDisplayName(song) {
        let displayName = `${song.name} by ${song.artist}`;
        if (song.ft) {
            displayName += ` (ft. ${song.ft})`;
        }
        return displayName;
    }
    
    formatTime(seconds) {
        if (isNaN(seconds) || seconds < 0) return '0:00';
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
    
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }
}

// Example usage:
const player = new MusicPlayer('audio');

// Add event listeners
player.addEventListener('songChanged', (song) => {
    console.log('Song changed:', player.getSongDisplayName(song));
});

player.addEventListener('playStateChanged', (isPlaying) => {
    console.log(isPlaying ? 'Playing' : 'Paused');
});

function toggleplaystate() {
    if(isPlaying ? player.resume() : player.pause());
}

player.addEventListener('queueUpdated', (queue) => {
    console.log(`Queue updated: ${queue.length} songs`);
});

player.addEventListener('timeUpdate', (currentTime) => {
    // Update progress bar or time display
    const progress = (currentTime / player.duration) * 100;
    //console.log(`${player.formatTime(currentTime)} / ${player.formatTime(player.duration)} (${progress.toFixed(1)}%)`);
});

player.addEventListener('error', (error) => {
    console.error('Player error:', error);
});


// Example usage:
//console.log('=== Music Player Demo ===');

// Add some songs to queue with audio sources
//player.addSongToQueue('Blinding Lights', 'The Weeknd', null, 'cover1.jpg', 'audio/blinding-lights.mp3');
//player.addSongToQueue('Good 4 U', 'Olivia Rodrigo', null, 'cover2.jpg', 'audio/good-4-u.mp3');
//player.addSongToQueue('Industry Baby', 'Lil Nas X', 'Jack Harlow', 'cover3.jpg', 'audio/industry-baby.mp3');
//player.addSongToQueue('Stay', 'The Kid LAROI', 'Justin Bieber', 'cover4.jpg', 'audio/stay.mp3');

// Play directly with audio source
//player.play('Levitating', 'Dua Lipa', null, 'cover5.jpg', 'audio/levitating.mp3');

// Control examples
//setTimeout(() => player.pause(), 1000);
//setTimeout(() => player.resume(), 2000);
//setTimeout(() => player.adjustVolume(0.5), 3000);
//setTimeout(() => player.skip(), 4000);

// Export for use
// module.exports = MusicPlayer; // For Node.js
// export default MusicPlayer; // For ES6 modules




var ispaused = true;

class MusicPlayerUI {
    constructor() {
        this.initializeElements();
        this.setupEventListeners();
    }

    initializeElements() {
        // Song info elements
        this.coverImg = document.getElementById('coverpic');
        this.songTitle = document.getElementById('song-title');
        this.artistName = document.getElementById('artist-name');
        this.featuredArtist = document.getElementById('featured-artist');
        this.currentTime = document.getElementById('current-time');
        this.duration = document.getElementById('duration');
        
        // Control elements
        this.playPauseBtn = document.getElementById('play-pause-btn');
        this.prevBtn = document.getElementById('prev-btn');
        this.nextBtn = document.getElementById('next-btn');
        this.shuffleBtn = document.getElementById('shuffle-btn');
        this.repeatBtn = document.getElementById('repeat-btn');
        
        // Progress elements
        this.progressContainer = document.getElementById('progress-container');
        this.progressBar = document.getElementById('progress-bar');
        
        // Volume elements
        this.volumeBtn = document.getElementById('volume-btn');
        this.volumeSlider = document.getElementById('volume-slider');
        this.volumeProgress = document.getElementById('volume-progress');
    }
   
    setupEventListeners() {
        // Control button events
        this.playPauseBtn.addEventListener('click', () => {
            console.log('Play/Pause clicked');
            player.togglePlayPause()
            
        });

        this.prevBtn.addEventListener('click', () => {
            console.log('Previous clicked');
            player.skipBack()
        });

        this.nextBtn.addEventListener('click', () => {
            console.log('Next clicked');
            player.skip()
        });

        // Mode buttons
        this.shuffleBtn.addEventListener('click', () => {
            this.shuffleBtn.classList.toggle('active');
            console.log('Shuffle toggled');
            player.toggleShuffle()
        });

        this.repeatBtn.addEventListener('click', () => {
            this.toggleRepeatMode();
            console.log('Repeat mode changed');
            player.toggleRepeat()
        });

        // Progress bar seeking
        this.progressContainer.addEventListener('click', (e) => {
            const rect = this.progressContainer.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const percentage = (clickX / rect.width) * 100;
            this.updateProgress(percentage);
            console.log(`Seek to ${percentage.toFixed(1)}%`);
            player.seekToPercentage(percentage / 100)
        });

        // Volume controls
        this.volumeBtn.addEventListener('click', () => {
            this.toggleMute();
            console.log('Volume mute toggled');
            player.toggleMute()
        });

        this.volumeSlider.addEventListener('click', (e) => {
            const rect = this.volumeSlider.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const percentage = (clickX / rect.width) * 100;
            this.updateVolume(percentage);
            console.log(`Volume set to ${percentage.toFixed(1)}%`);
            player.adjustVolume(percentage / 100)
        });
    }

    // Update song information
    updateSongInfo(title, artist, featured = null, coverUrl = null) {
        this.songTitle.textContent = title || 'No song selected';
        this.artistName.textContent = artist || 'Unknown Artist';
        
        if (featured) {
            this.featuredArtist.textContent = ` ft. ${featured}`;
            this.featuredArtist.style.display = 'inline';
        } else {
            this.featuredArtist.style.display = 'none';
        }
        
        if (coverUrl) {
            this.coverImg.src = coverUrl;
            this.coverImg.alt = `${title} by ${artist}`;
        }
    }

    // Update play/pause state
    updatePlayState(isPlaying) {
        const icon = this.playPauseBtn.querySelector('.material-icons');
        icon.textContent = isPlaying ? 'pause' : 'play_arrow';
        this.playPauseBtn.title = isPlaying ? 'Pause' : 'Play';
    }

    // Update progress bar
    updateProgress(percentage) {
        
    }

    // Update time display
    updateTimeDisplay(current, total) {
        this.currentTime.textContent = this.formatTime(current);
        this.duration.textContent = this.formatTime(total);
    }

    // Toggle repeat mode
    toggleRepeatMode() {
        const icon = this.repeatBtn.querySelector('.material-icons');
        const currentIcon = icon.textContent;
        
        if (currentIcon === 'repeat' && !this.repeatBtn.classList.contains('active')) {
            // Off -> All
            this.repeatBtn.classList.add('active');
            this.repeatBtn.title = 'Repeat All';
        } else if (currentIcon === 'repeat' && this.repeatBtn.classList.contains('active')) {
            // All -> One
            icon.textContent = 'repeat_one';
            this.repeatBtn.title = 'Repeat One';
        } else {
            // One -> Off
            icon.textContent = 'repeat';
            this.repeatBtn.classList.remove('active');
            this.repeatBtn.title = 'Repeat Off';
        }
    }

    // Update volume
    updateVolume(percentage) {
        const clampedPercentage = Math.max(0, Math.min(100, percentage));
        this.volumeProgress.style.width = `${clampedPercentage}%`;
        this.volumeSlider.style.setProperty('--volume', `${clampedPercentage}%`);
        
        const icon = this.volumeBtn.querySelector('.material-icons');
        if (percentage === 0) {
            icon.textContent = 'volume_off';
        } else if (percentage < 50) {
            icon.textContent = 'volume_down';
        } else {
            icon.textContent = 'volume_up';
        }
    }

    // Toggle mute
    toggleMute() {
        const icon = this.volumeBtn.querySelector('.material-icons');
        if (icon.textContent === 'volume_off') {
            this.updateVolume(100);
        } else {
            this.updateVolume(0);
        }
    }

    // Format time helper
    formatTime(seconds) {
        if (isNaN(seconds) || seconds < 0) return '0:00';
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
}

// Initialize the UI
const playerUI = new MusicPlayerUI();

/*
setTimeout(() => {
    playerUI.updateSongInfo(
        'Sample Song Title',
        'Demo Artist',
        'Featured Artist'
    );
    playerUI.updateTimeDisplay(45, 210);
    playerUI.updateProgress(21.4);
    playerUI.updatePlayState(true);
}, 1000);
*/
class MusicPlayer {
    constructor(audioElementId = 'audio', songsJsonPath = './music/music.json') {
        // Get or create audio element
        this.audio = document.getElementById(audioElementId);
        if (!this.audio) {
            this.audio = document.createElement('audio');
            this.audio.id = audioElementId;
            this.audio.preload = 'auto';
            document.body.appendChild(this.audio);
        }
        
        // Player state
        this.isPlaying = false;
        this.isPaused = false;
        this.volume = 1.0;
        this.currentTime = 0;
        this.duration = 0;
        
        // Current song
        this.currentSong = null;
        
        // Queue system
        this.queue = [];
        this.queueIndex = -1;
        
        // Recently played songs (max 50)
        this.recentlyPlayed = [];
        this.maxRecentlyPlayed = 50;
        
        // Simple navigation history - separate from recently played
        this.navigationHistory = [];
        this.navigationIndex = -1;
        
        // Shuffle and repeat modes
        this.shuffleMode = false;
        this.repeatMode = 'off';
        
        // Original queue for shuffle
        this.originalQueue = [];
        
        // Event listeners
        this.eventListeners = {};
        
        // Time update interval
        this.timeUpdateInterval = null;
        
        // JSON songs data
        this.songsJsonPath = songsJsonPath;
        this.songsData = {};
        this.songsArray = [];
        this.autoplayEnabled = true;
        
        // AutoMix control variable
        this.doAutoMix = true;
        
        // Display elements
        this.displayElements = {
            coverImage: document.getElementById('coverpic'),
            songTitle: null,
            artistName: null,
            featuredArtist: null,
            currentTime: null,
            duration: null,
            progressBar: document.getElementById('progress-bar')
        };
        
        // Initialize
        this.initializeAudioEvents();
        this.audio.volume = this.volume;
        this.autoDetectDisplayElements();
        this.loadSongsFromJson();
    }
    
    // Load songs from JSON file
    async loadSongsFromJson() {
        try {
            console.log(`Loading songs from: ${this.songsJsonPath}`);
            const response = await fetch(this.songsJsonPath);
            
            if (!response.ok) {
                throw new Error(`Failed to load songs JSON: ${response.status} ${response.statusText}`);
            }
            
            this.songsData = await response.json();
            this.songsArray = Object.entries(this.songsData).map(([key, song]) => ({
                id: key,
                ...song
            }));
            
            console.log(`Loaded ${this.songsArray.length} songs from JSON`);
            this.emit('songsLoaded', this.songsArray);
            
        } catch (error) {
            console.error('Error loading songs from JSON:', error);
            this.emit('error', { message: 'Failed to load songs database', originalError: error });
        }
    }
    
    // Get random song from loaded JSON data
    getRandomSong() {
        if (this.songsArray.length === 0) {
            console.warn('No songs loaded from JSON');
            return null;
        }
        
        // Avoid recently played songs if possible
        let availableSongs = this.songsArray;
        
        if (this.recentlyPlayed.length > 0 && this.songsArray.length > this.recentlyPlayed.length) {
            const recentIds = this.recentlyPlayed.map(song => song.id);
            availableSongs = this.songsArray.filter(song => !recentIds.includes(song.id));
        }
        
        const randomIndex = Math.floor(Math.random() * availableSongs.length);
        const selectedSong = availableSongs[randomIndex];
        
        return this.createSongFromJsonData(selectedSong);
    }
    
    // Create song object from JSON data
    createSongFromJsonData(jsonSong) {
        if (!jsonSong) return null;
        
        return {
            id: jsonSong.id || (Date.now() + Math.random()),
            name: jsonSong.name,
            artist: jsonSong.artist,
            ft: jsonSong.ft || null,
            cover: jsonSong.cover ? './music/assets/covers/' + jsonSong.cover : null,
            src: jsonSong.file ? './music/assets/music/' + jsonSong.file : null,
            addedAt: new Date(),
            duration: 0
        };
    }
    
    // Add song to navigation history
    addToNavigationHistory(song) {
        // If we're in the middle of history, cut off everything after current position
        if (this.navigationIndex >= 0 && this.navigationIndex < this.navigationHistory.length - 1) {
            this.navigationHistory = this.navigationHistory.slice(0, this.navigationIndex + 1);
        }
        
        // Don't add duplicate of current song
        if (this.navigationHistory.length > 0 && 
            this.navigationHistory[this.navigationHistory.length - 1].id === song.id) {
            return;
        }
        
        // Add song to history
        this.navigationHistory.push({...song});
        this.navigationIndex = this.navigationHistory.length - 1;
        
        // Limit history size
        if (this.navigationHistory.length > 100) {
            this.navigationHistory.shift();
            this.navigationIndex--;
        }
        
        console.log(`Added to navigation history: ${this.getSongDisplayName(song)} (index: ${this.navigationIndex})`);
    }
    
    // Play a random song from JSON
    playRandomSong() {
        const randomSong = this.getRandomSong();
        if (randomSong) {
            console.log(`Playing random song: ${this.getSongDisplayName(randomSong)}`);
            this.playDirectly(randomSong);
            return randomSong;
        }
        return null;
    }
    
    // Add multiple random songs to queue
    addRandomSongsToQueue(count = 5) {
        let addedCount = 0;
        const maxAttempts = Math.min(count * 3, this.songsArray.length);
        
        for (let attempts = 0; attempts < maxAttempts && addedCount < count; attempts++) {
            const randomSong = this.getRandomSong();
            if (randomSong) {
                const isInQueue = this.queue.some(song => song.id === randomSong.id);
                if (!isInQueue) {
                    this.queue.push(randomSong);
                    addedCount++;
                }
            }
        }
        
        if (!this.shuffleMode) {
            this.originalQueue = [...this.queue];
        }
        
        this.emit('queueUpdated', this.queue);
        console.log(`Added ${addedCount} random songs to queue`);
        return addedCount;
    }
    
    // Enable/disable autoplay
    setAutoplay(enabled) {
        this.autoplayEnabled = enabled;
        console.log(`Autoplay ${enabled ? 'enabled' : 'disabled'}`);
        return this;
    }
    
    // Auto-detect common display elements by ID
    autoDetectDisplayElements() {
        const elementIds = {
            coverImage: ['cover-image', 'album-cover', 'song-cover', 'cover'],
            songTitle: ['song-title', 'track-title', 'title', 'song-name'],
            artistName: ['artist-name', 'artist', 'song-artist'],
            featuredArtist: ['featured-artist', 'ft-artist', 'featuring'],
            currentTime: ['current-time', 'time-current', 'current'],
            duration: ['song-duration', 'total-time', 'duration'],
            progressBar: ['progress-bar', 'seek-bar', 'progress']
        };
        
        for (const [key, ids] of Object.entries(elementIds)) {
            for (const id of ids) {
                const element = document.getElementById(id);
                if (element) {
                    this.displayElements[key] = element;
                    break;
                }
            }
        }
    }
    
    // Update all display elements
    updateDisplay() {
        this.updateCoverImage();
        this.updateSongInfo();
        this.updateTimeDisplay();
        this.updateProgressBar();
        this.emit('displayUpdated', {
            song: this.currentSong,
            currentTime: this.currentTime,
            duration: this.duration
        });
    }
    
    // Update cover image
    updateCoverImage() {
        const coverElement = this.displayElements.coverImage;
        
        if (coverElement && this.currentSong && this.currentSong.cover) {
            coverElement.src = this.currentSong.cover;
            coverElement.alt = `${this.currentSong.name} by ${this.currentSong.artist}`;
        }
    }
    
    // Update song information
    updateSongInfo() {
        if (this.currentSong) {
            if (this.displayElements.songTitle) {
                this.displayElements.songTitle.textContent = this.currentSong.name;
            }
            
            if (this.displayElements.artistName) {
                this.displayElements.artistName.textContent = this.currentSong.artist;
            }
            
            if (this.displayElements.featuredArtist) {
                if (this.currentSong.ft) {
                    this.displayElements.featuredArtist.textContent = `ft. ${this.currentSong.ft}`;
                    this.displayElements.featuredArtist.style.display = '';
                } else {
                    this.displayElements.featuredArtist.textContent = '';
                    this.displayElements.featuredArtist.style.display = 'none';
                }
            }
        } else {
            if (this.displayElements.songTitle) {
                this.displayElements.songTitle.textContent = 'No song selected';
            }
            if (this.displayElements.artistName) {
                this.displayElements.artistName.textContent = '';
            }
            if (this.displayElements.featuredArtist) {
                this.displayElements.featuredArtist.textContent = '';
                this.displayElements.featuredArtist.style.display = 'none';
            }
        }
    }
    
    // Update time display
    updateTimeDisplay() {
        if (this.displayElements.currentTime) {
            this.displayElements.currentTime.textContent = this.formatTime(this.currentTime);
        }
        
        if (this.displayElements.duration) {
            this.displayElements.duration.textContent = this.formatTime(this.duration);
        }
    }
    
    // Update progress bar
    updateProgressBar() {
        if (this.displayElements.progressBar && this.duration > 0) {
            const progress = Math.min(100, Math.max(0, (this.currentTime / this.duration) * 100));
            
            if (this.displayElements.progressBar.type === 'range') {
                this.displayElements.progressBar.value = progress;
            } else {
                this.displayElements.progressBar.style.width = `${progress}%`;
                this.displayElements.progressBar.setAttribute('data-progress', progress.toFixed(0.6));
            }
        }
    }
    
    // Initialize audio element event listeners
    initializeAudioEvents() {
        this.audio.addEventListener('canplay', () => {
            this.duration = this.audio.duration || 0;
            if (this.currentSong) {
                this.currentSong.duration = this.duration;
            }
            this.emit('durationChanged', this.duration);
            this.updateDisplay();
        });
        
        this.audio.addEventListener('loadedmetadata', () => {
            this.duration = this.audio.duration || 0;
            if (this.currentSong) {
                this.currentSong.duration = this.duration;
            }
            this.emit('durationChanged', this.duration);
            this.updateDisplay();
        });
        
        this.audio.addEventListener('play', () => {
            this.isPlaying = true;
            this.isPaused = false;
            this.startTimeUpdate();
            this.emit('playStateChanged', true);
        });
        
        this.audio.addEventListener('pause', () => {
            this.isPaused = true;
            this.stopTimeUpdate();
            this.emit('playStateChanged', false);
        });
        
        this.audio.addEventListener('ended', () => {
            this.stopTimeUpdate();
            this.handleSongEnd();
        });
        
        this.audio.addEventListener('error', (e) => {
            const error = this.audio.error;
            let errorMessage = 'Unknown audio error';
            
            if (error) {
                switch (error.code) {
                    case error.MEDIA_ERR_ABORTED:
                        errorMessage = 'Audio playback aborted';
                        break;
                    case error.MEDIA_ERR_NETWORK:
                        errorMessage = 'Network error while loading audio';
                        break;
                    case error.MEDIA_ERR_DECODE:
                        errorMessage = 'Audio decoding error';
                        break;
                    case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
                        errorMessage = 'Audio format not supported';
                        break;
                }
            }
            
            console.error('Audio error:', errorMessage, error);
            this.emit('error', { message: errorMessage, originalError: error });
            
            if (this.queue.length > 0) {
                this.skip();
            } else if (this.autoplayEnabled) {
                setTimeout(() => this.playRandomSong(), 1000);
            }
        });
        
        this.audio.addEventListener('volumechange', () => {
            this.volume = this.audio.volume;
            this.emit('volumeChanged', this.volume);
        });
    }
    
    // Start time update interval
    startTimeUpdate() {
        this.stopTimeUpdate();
        this.timeUpdateInterval = setInterval(() => {
            if (!this.audio.paused && !this.audio.seeking) {
                this.currentTime = this.audio.currentTime;
                this.updateTimeDisplay();
                this.updateProgressBar();
                if (typeof playerUI !== 'undefined') {
                    playerUI.updateProgress(this.currentTime);
                }
                this.emit('timeUpdate', this.currentTime);
            }
        }, 1000);
    }
    
    // Stop time update interval
    stopTimeUpdate() {
        if (this.timeUpdateInterval) {
            clearInterval(this.timeUpdateInterval);
            this.timeUpdateInterval = null;
        }
    }
    
    // Handle when song ends
    handleSongEnd() {
        this.isPlaying = false;
        this.isPaused = false;
        
        // Check if automix should handle the transition (if automix engine exists)
        if (this.doAutoMix && typeof window.autoMixEngine !== 'undefined' && window.autoMixEngine.isTransitioning) {
            // AutoMix is handling the transition, let it complete
            return;
        }
        
        if (this.repeatMode === 'one') {
            this.audio.currentTime = 0;
            this.audio.play();
        } else if (this.queue.length > 0 && this.queueIndex < this.queue.length - 1) {
            this.skip();
        } else if (this.repeatMode === 'all' && this.queue.length > 0) {
            this.playFromQueue(0);
        } else if (this.autoplayEnabled) {
            setTimeout(() => this.playRandomSong(), 500);
        } else {
            this.stop();
        }
    }
    
    // Load audio source
    loadAudioSource(src) {
        if (src) {
            this.audio.src = src;
            this.audio.load();
        }
    }
    
    // Event system
    addEventListener(event, callback) {
        if (!this.eventListeners[event]) {
            this.eventListeners[event] = [];
        }
        this.eventListeners[event].push(callback);
    }
    
    removeEventListener(event, callback) {
        if (this.eventListeners[event]) {
            this.eventListeners[event] = this.eventListeners[event].filter(cb => cb !== callback);
        }
    }
    
    emit(event, data = null) {
        if (this.eventListeners[event]) {
            this.eventListeners[event].forEach(callback => callback(data));
        }
    }
    
    // Song creation helper
    createSong(name, artist, ft = null, cover = null, src) {
        cover = cover ? './music/assets/covers/' + cover : null;
        return {
            id: Date.now() + Math.random(),
            name,
            artist,
            ft,
            cover,
            src,
            addedAt: new Date(),
            duration: 0
        };
    }
    
    // Play a song directly (internal method)
    playDirectly(song, addToHistory = true) {
        this.currentSong = song;
        if (typeof playerUI !== 'undefined') {
            playerUI.updatePlayState(true);
        }

        this.loadAudioSource(song.src);
        
        // Add to recently played and navigation history (unless explicitly told not to)
        if (addToHistory) {
            this.addToRecentlyPlayed(song);
            this.addToNavigationHistory(song);
        }
        
        this.emit('songChanged', song);
        this.updateDisplay();
        
        const playPromise = this.audio.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.error('Play failed:', error);
                this.emit('error', error);
            });
        }
        
        console.log(`Now playing: ${this.getSongDisplayName(song)}`);
        return this;
    }
    
    // Play a song directly
    play(name, artist, ft = null, cover = null, src) {
        const song = this.createSong(name, artist, ft, cover, src);
        return this.playDirectly(song);
    }
    
    // Pause playback
    pause() {
        if (!this.audio.paused) {
            if (typeof playerUI !== 'undefined') {
                playerUI.updatePlayState(false);
            }
            this.audio.pause();
            console.log('Playback paused');
        }
        return this;
    }
    
    // Resume playback
    resume() {
        if (this.audio.paused && this.currentSong) {
            const playPromise = this.audio.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.error('Resume failed:', error);
                    this.emit('error', error);
                });
            }
            console.log('Playback resumed');
            if (typeof playerUI !== 'undefined') {
                playerUI.updatePlayState(true);
            }
        }
        return this;
    }
    
    // Toggle play/pause
    togglePlayPause() {
        if (this.audio.paused) {
            if (this.currentSong) {
                this.resume();
            } else if (this.queue.length > 0) {
                this.playFromQueue(this.queueIndex >= 0 ? this.queueIndex : 0);
            } else if (this.autoplayEnabled) {
                this.playRandomSong();
            }
        } else {
            this.pause();
        }
        return this;
    }
    
    // Stop playback
    stop() {
        this.audio.pause();
        this.audio.currentTime = 0;
        this.currentTime = 0;
        this.isPlaying = false;
        this.isPaused = false;
        this.stopTimeUpdate();
        
        this.emit('playStateChanged', false);
        this.emit('timeUpdate', 0);
        console.log('Playback stopped');
        return this;
    }
    
    // Add song to queue
    addSongToQueue(name, artist, ft = null, cover = null, src) {
        const song = this.createSong(name, artist, ft, cover, src);
        this.queue.push(song);
        
        if (!this.shuffleMode) {
            this.originalQueue = [...this.queue];
        }
        
        this.emit('queueUpdated', this.queue);
        console.log(`Added to queue: ${this.getSongDisplayName(song)}`);
        return this;
    }
    
    // Play song from queue by index
    playFromQueue(index) {
        if (index >= 0 && index < this.queue.length) {
            this.queueIndex = index;
            const song = this.queue[index];
            
            // Play with full history tracking
            this.playDirectly(song, true);
            
            this.emit('queuePositionChanged', index);
            console.log(`Playing from queue [${index + 1}/${this.queue.length}]: ${this.getSongDisplayName(song)}`);
        }
        return this;
    }
    
    // Skip to next song
    skip() {
        // Check if we can go forward in navigation history
        if (this.navigationIndex >= 0 && this.navigationIndex < this.navigationHistory.length - 1) {
            this.navigationIndex++;
            const nextSong = this.navigationHistory[this.navigationIndex];
            console.log(`Going forward in history: ${this.getSongDisplayName(nextSong)} (index: ${this.navigationIndex})`);
            
            // Play without adding to history (we're navigating through existing history)
            this.playDirectly(nextSong, false);
            return this;
        }
        
        // Normal queue/autoplay logic
        if (this.queue.length > 0) {
            let nextIndex;
            
            if (this.repeatMode === 'one') {
                nextIndex = this.queueIndex;
            } else {
                nextIndex = this.queueIndex + 1;
                
                if (nextIndex >= this.queue.length) {
                    if (this.repeatMode === 'all') {
                        nextIndex = 0;
                    } else if (this.autoplayEnabled) {
                        this.playRandomSong();
                        return this;
                    } else {
                        this.stop();
                        console.log('Reached end of queue');
                        return this;
                    }
                }
            }
            
            this.playFromQueue(nextIndex);
            return this;
        }
        
        // No queue
        if (this.autoplayEnabled) {
            console.log('No queue - playing random song');
            this.playRandomSong();
        } else {
            console.log('No songs in queue to skip to');
            this.stop();
        }
        return this;
    }
    
    // Skip back to previous song
    skipBack() {
        // If more than 3 seconds into song, restart current song
        if (this.audio.currentTime > 3) {
            this.seek(0);
            console.log('Restarting current song');
            return this;
        }
        
        // Check if we can go back in navigation history
        if (this.navigationIndex > 0) {
            this.navigationIndex--;
            const prevSong = this.navigationHistory[this.navigationIndex];
            console.log(`Going back in history: ${this.getSongDisplayName(prevSong)} (index: ${this.navigationIndex})`);
            
            // Play without adding to history (we're navigating through existing history)
            this.playDirectly(prevSong, false);
            return this;
        }
        
        // Fallback to queue navigation if we have a queue
        if (this.queue.length > 0 && this.queueIndex >= 0) {
            let prevIndex = this.queueIndex - 1;
            
            if (prevIndex < 0) {
                if (this.repeatMode === 'all') {
                    prevIndex = this.queue.length - 1;
                } else {
                    prevIndex = 0;
                }
            }
            
            this.playFromQueue(prevIndex);
            return this;
        }
        
        // No history or queue to go back to
        console.log('No previous songs to go back to');
        return this;
    }
    
    // Adjust volume (0.0 to 1.0)
    adjustVolume(volume) {
        const newVolume = Math.max(0, Math.min(1, volume));
        this.audio.volume = newVolume;
        this.volume = newVolume;
        console.log(`Volume set to ${Math.round(this.volume * 100)}%`);
        return this;
    }
    
    // Toggle mute
    toggleMute() {
        if (this.audio.muted) {
            this.audio.muted = false;
            this.emit('muteChanged', false);
            console.log('Audio unmuted');
        } else {
            this.audio.muted = true;
            this.emit('muteChanged', true);
            console.log('Audio muted');
        }
        return this;
    }
    
    // Seek to position (in seconds)
    seek(seconds) {
        const seekTime = Math.max(0, Math.min(this.duration, seconds));
        this.audio.currentTime = seekTime;
        this.currentTime = seekTime;
        this.updateTimeDisplay();
        this.updateProgressBar();
        this.emit('timeUpdate', this.currentTime);
        console.log(`Seeked to ${this.formatTime(this.currentTime)}`);
        return this;
    }
    
    // Seek by percentage (0-1)
    seekToPercentage(percentage) {
        const seekTime = this.duration * Math.max(0, Math.min(1, percentage));
        return this.seek(seekTime);
    }
    
    // Toggle shuffle mode
    toggleShuffle() {
        this.shuffleMode = !this.shuffleMode;
        
        if (this.shuffleMode) {
            this.originalQueue = [...this.queue];
            this.shuffleArray(this.queue);
            
            if (this.currentSong) {
                this.queueIndex = this.queue.findIndex(song => song.id === this.currentSong.id);
            }
        } else {
            this.queue = [...this.originalQueue];
            
            if (this.currentSong) {
                this.queueIndex = this.queue.findIndex(song => song.id === this.currentSong.id);
            }
        }
        
        this.emit('shuffleChanged', this.shuffleMode);
        this.emit('queueUpdated', this.queue);
        console.log(`Shuffle ${this.shuffleMode ? 'enabled' : 'disabled'}`);
        return this;
    }
    
    // Toggle repeat mode
    toggleRepeat() {
        const modes = ['off', 'all', 'one'];
        const currentIndex = modes.indexOf(this.repeatMode);
        this.repeatMode = modes[(currentIndex + 1) % modes.length];
        
        this.emit('repeatChanged', this.repeatMode);
        console.log(`Repeat mode: ${this.repeatMode}`);
        return this;
    }
    
    // Clear queue
    clearQueue() {
        this.queue = [];
        this.originalQueue = [];
        this.queueIndex = -1;
        this.stop();
        
        this.emit('queueUpdated', this.queue);
        console.log('Queue cleared');
        return this;
    }
    
    // Add to recently played
    addToRecentlyPlayed(song) {
        this.recentlyPlayed = this.recentlyPlayed.filter(s => s.id !== song.id);
        this.recentlyPlayed.unshift({...song, playedAt: new Date()});
        
        if (this.recentlyPlayed.length > this.maxRecentlyPlayed) {
            this.recentlyPlayed = this.recentlyPlayed.slice(0, this.maxRecentlyPlayed);
        }
        
        this.emit('recentlyPlayedUpdated', this.recentlyPlayed);
    }
    
    // Get recently played songs
    getRecentlyPlayed() {
        return [...this.recentlyPlayed];
    }
    
    // Clear recently played
    clearRecentlyPlayed() {
        this.recentlyPlayed = [];
        this.emit('recentlyPlayedUpdated', this.recentlyPlayed);
        console.log('Recently played cleared');
        return this;
    }
    
    // Get current queue
    getQueue() {
        return [...this.queue];
    }
    
    // Get current song info
    getCurrentSong() {
        return this.currentSong ? {...this.currentSong} : null;
    }
    
    // Get loaded songs from JSON
    getAvailableSongs() {
        return [...this.songsArray];
    }
    
    // Search songs by name, artist, or featured artist
    searchSongs(query) {
        if (!query || this.songsArray.length === 0) {
            return [];
        }
        
        const lowercaseQuery = query.toLowerCase();
        return this.songsArray.filter(song => 
            song.name.toLowerCase().includes(lowercaseQuery) ||
            song.artist.toLowerCase().includes(lowercaseQuery) ||
            (song.ft && song.ft.toLowerCase().includes(lowercaseQuery))
        );
    }
    
    // Play song by ID from JSON data
    playSongById(songId) {
        const songData = this.songsArray.find(song => song.id === songId);
        if (songData) {
            const song = this.createSongFromJsonData(songData);
            this.playDirectly(song);
            return song;
        } else {
            console.warn(`Song with ID "${songId}" not found`);
            return null;
        }
    }
    
    // Add song by ID to queue
    addSongByIdToQueue(songId) {
        const songData = this.songsArray.find(song => song.id === songId);
        if (songData) {
            const song = this.createSongFromJsonData(songData);
            this.queue.push(song);
            
            if (!this.shuffleMode) {
                this.originalQueue = [...this.queue];
            }
            
            this.emit('queueUpdated', this.queue);
            console.log(`Added to queue: ${this.getSongDisplayName(song)}`);
            return song;
        } else {
            console.warn(`Song with ID "${songId}" not found`);
            return null;
        }
    }
    
    // Get player state
    getState() {
        return {
            isPlaying: !this.audio.paused && !this.audio.ended,
            isPaused: this.audio.paused,
            volume: this.volume,
            isMuted: this.audio.muted,
            currentTime: this.audio.currentTime,
            duration: this.duration,
            currentSong: this.getCurrentSong(),
            queue: this.getQueue(),
            queueIndex: this.queueIndex,
            shuffleMode: this.shuffleMode,
            repeatMode: this.repeatMode,
            recentlyPlayed: this.getRecentlyPlayed(),
            autoplayEnabled: this.autoplayEnabled,
            songsLoaded: this.songsArray.length,
            navigationHistory: this.navigationHistory.length,
            navigationIndex: this.navigationIndex,
            doAutoMix: this.doAutoMix
        };
    }
    
    // Helper methods
    getSongDisplayName(song) {
        let displayName = `${song.name} by ${song.artist}`;
        if (song.ft) {
            displayName += ` (ft. ${song.ft})`;
        }
        return displayName;
    }
    
    formatTime(seconds) {
        if (isNaN(seconds) || seconds < 0) return '0:00';
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
    
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }
}

// Initialize the player with JSON path
const player = new MusicPlayer('audio', './music/music.json');

// Add event listeners
player.addEventListener('songChanged', (song) => {
    console.log('Song changed:', player.getSongDisplayName(song));
    if (typeof playerUI !== 'undefined') {
        playerUI.updateSongInfo(
            song.name,
            song.artist,
            song.ft,
            song.cover
        );
    }
});

player.addEventListener('playStateChanged', (isPlaying) => {
    console.log(isPlaying ? 'Playing' : 'Paused');
});

player.addEventListener('queueUpdated', (queue) => {
    console.log(`Queue updated: ${queue.length} songs`);
});

player.addEventListener('timeUpdate', (currentTime) => {
    const progress = (currentTime / player.duration) * 100;
});

player.addEventListener('error', (error) => {
    console.error('Player error:', error);
});

player.addEventListener('songsLoaded', (songs) => {
    console.log(`Songs database loaded: ${songs.length} tracks available`);
});

// Music Player UI Class
var ispaused = true;

class MusicPlayerUI {
    constructor() {
        this.initializeElements();
        this.setupEventListeners();
    }

    initializeElements() {
        // Song info elements
        this.coverImg = document.getElementById('coverpic');
        this.songTitle = document.getElementById('song-title');
        this.artistName = document.getElementById('artist-name');
        this.featuredArtist = document.getElementById('featured-artist');
        this.currentTime = document.getElementById('current-time');
        this.duration = document.getElementById('duration');
        
        // Control elements
        this.playPauseBtn = document.getElementById('play-pause-btn');
        this.prevBtn = document.getElementById('prev-btn');
        this.nextBtn = document.getElementById('next-btn');
        this.shuffleBtn = document.getElementById('shuffle-btn');
        this.repeatBtn = document.getElementById('repeat-btn');
        
        // Progress elements
        this.progressContainer = document.getElementById('progress-container');
        this.progressBar = document.getElementById('progress-bar');
        
        // Volume elements
        this.volumeBtn = document.getElementById('volume-btn');
        this.volumeSlider = document.getElementById('volume-slider');
        this.volumeProgress = document.getElementById('volume-progress');
    }
   
    setupEventListeners() {
        // Control button events
        this.playPauseBtn.addEventListener('click', () => {
            console.log('Play/Pause clicked');
            player.togglePlayPause();
        });

        this.prevBtn.addEventListener('click', () => {
            console.log('Previous clicked');
            player.skipBack();
        });
        // ADD THIS TO setupEventListeners():
        player.addEventListener('queueUpdated', () => {
            if (player.doAutoMix && window.autoMixEngine) {  // ✅ Use global player reference
            console.log('Queue updated, re-preparing next track');
            window.autoMixEngine.prepareNextTrack();       // ✅ Call method on AutoMix engine
            }
        });

        this.nextBtn.addEventListener('click', () => {
            console.log('Next clicked');
            player.skip();
        });

        // Mode buttons
        this.shuffleBtn.addEventListener('click', () => {
            this.shuffleBtn.classList.toggle('active');
            console.log('Shuffle toggled');
            player.toggleShuffle();
        });

        this.repeatBtn.addEventListener('click', () => {
            this.toggleRepeatMode();
            console.log('Repeat mode changed');
            player.toggleRepeat();
        });

        // Progress bar seeking
        this.progressContainer.addEventListener('click', (e) => {
            const rect = this.progressContainer.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const percentage = (clickX / rect.width) * 100;
            this.updateProgress(percentage);
            console.log(`Seek to ${percentage.toFixed(1)}%`);
            player.seekToPercentage(percentage / 100);
        });

        // Volume controls
        this.volumeBtn.addEventListener('click', () => {
            this.toggleMute();
            console.log('Volume mute toggled');
            player.toggleMute();
        });

        this.volumeSlider.addEventListener('click', (e) => {
            const rect = this.volumeSlider.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const percentage = (clickX / rect.width) * 100;
            this.updateVolume(percentage);
            console.log(`Volume set to ${percentage.toFixed(1)}%`);
            player.adjustVolume(percentage / 100);
        });
    }

    // Update song information
    updateSongInfo(title, artist, featured = null, coverUrl = null) {
        this.songTitle.textContent = title || 'No song selected';
        this.artistName.textContent = artist || 'Unknown Artist';
        
        if (featured) {
            this.featuredArtist.textContent = ` ft. ${featured}`;
            this.featuredArtist.style.display = 'inline';
        } else {
            this.featuredArtist.style.display = 'none';
        }
        
        if (coverUrl) {
            this.coverImg.src = coverUrl;
            this.coverImg.alt = `${title} by ${artist}`;
        }
    }

    // Update play/pause state
    updatePlayState(isPlaying) {
        const icon = this.playPauseBtn.querySelector('.material-icons');
        icon.textContent = isPlaying ? 'pause' : 'play_arrow';
        this.playPauseBtn.title = isPlaying ? 'Pause' : 'Play';
    }

    // Update progress bar
    updateProgress(percentage) {
        // Progress bar update logic can be implemented here
    }

    // Update time display
    updateTimeDisplay(current, total) {
        this.currentTime.textContent = this.formatTime(current);
        this.duration.textContent = this.formatTime(total);
    }

    // Toggle repeat mode
    toggleRepeatMode() {
        const icon = this.repeatBtn.querySelector('.material-icons');
        const currentIcon = icon.textContent;
        
        if (currentIcon === 'repeat' && !this.repeatBtn.classList.contains('active')) {
            // Off -> All
            this.repeatBtn.classList.add('active');
            this.repeatBtn.title = 'Repeat All';
        } else if (currentIcon === 'repeat' && this.repeatBtn.classList.contains('active')) {
            // All -> One
            icon.textContent = 'repeat_one';
            this.repeatBtn.title = 'Repeat One';
        } else {
            // One -> Off
            icon.textContent = 'repeat';
            this.repeatBtn.classList.remove('active');
            this.repeatBtn.title = 'Repeat Off';
        }
    }

    // Update volume
    updateVolume(percentage) {
        const clampedPercentage = Math.max(0, Math.min(100, percentage));
        this.volumeProgress.style.width = `${clampedPercentage}%`;
        this.volumeSlider.style.setProperty('--volume', `${clampedPercentage}%`);
        
        const icon = this.volumeBtn.querySelector('.material-icons');
        if (percentage === 0) {
            icon.textContent = 'volume_off';
        } else if (percentage < 50) {
            icon.textContent = 'volume_down';
        } else {
            icon.textContent = 'volume_up';
        }
    }

    // Toggle mute
    toggleMute() {
        const icon = this.volumeBtn.querySelector('.material-icons');
        if (icon.textContent === 'volume_off') {
            this.updateVolume(100);
        } else {
            this.updateVolume(0);
        }
    }

    // Format time helper
    formatTime(seconds) {
        if (isNaN(seconds) || seconds < 0) return '0:00';
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
}

// Initialize the UI
const playerUI = new MusicPlayerUI();

// Utility functions for easy usage
function playRandomSong() {
    return player.playRandomSong();
}

function addRandomSongsToQueue(count = 5) {
    return player.addRandomSongsToQueue(count);
}

function searchAndPlay(query) {
    const results = player.searchSongs(query);
    if (results.length > 0) {
        return player.playSongById(results[0].id);
    }
    return null;
}

function enableAutoplay() {
    player.setAutoplay(true);
}

function disableAutoplay() {
    player.setAutoplay(false);
}

// Simple AutoMix control functions (assumes your separate AutoMix file exposes these)
function enableAutoMix() {
    player.doAutoMix = true;
    console.log('AutoMix enabled');
    // Your AutoMix file should listen for this change
    if (typeof window.initializeAutoMix === 'function') {
        window.initializeAutoMix(player);
    }
}

function disableAutoMix() {
    player.doAutoMix = false;
    console.log('AutoMix disabled');
    // Your AutoMix file should listen for this change
    if (typeof window.cleanupAutoMix === 'function') {
        window.cleanupAutoMix();
    }
}

// Additional utility functions for JSON song management
function getSongsByArtist(artistName) {
    return player.getAvailableSongs().filter(song => 
        song.artist.toLowerCase().includes(artistName.toLowerCase())
    );
}

function playArtist(artistName) {
    const songs = getSongsByArtist(artistName);
    if (songs.length > 0) {
        const randomSong = songs[Math.floor(Math.random() * songs.length)];
        return player.playSongById(randomSong.id);
    }
    return null;
}

function addArtistToQueue(artistName, maxSongs = 5) {
    const songs = getSongsByArtist(artistName);
    let added = 0;
    
    for (let i = 0; i < Math.min(songs.length, maxSongs); i++) {
        const song = songs[i];
        if (!player.queue.some(queueSong => queueSong.id === song.id)) {
            player.addSongByIdToQueue(song.id);
            added++;
        }
    }
    
    return added;
}

// Get player statistics
function getPlayerStats() {
    const state = player.getState();
    return {
        totalSongsAvailable: player.songsArray.length,
        queueLength: state.queue.length,
        recentlyPlayedCount: state.recentlyPlayed.length,
        navigationHistoryLength: state.navigationHistory,
        currentNavigationIndex: state.navigationIndex,
        currentSong: state.currentSong ? player.getSongDisplayName(state.currentSong) : 'None',
        playbackTime: player.formatTime(state.currentTime),
        totalDuration: player.formatTime(state.duration),
        volume: Math.round(state.volume * 100) + '%',
        modes: {
            shuffle: state.shuffleMode,
            repeat: state.repeatMode,
            autoplay: state.autoplayEnabled,
            automix: state.doAutoMix
        }
    };
}

// Debug function to log player state
function debugPlayer() {
    console.log('=== Music Player Debug Info ===');
    console.log(getPlayerStats());
    console.log('Available songs:', player.getAvailableSongs().map(s => `${s.name} - ${s.artist}`));
    console.log('Queue:', player.getQueue().map(s => player.getSongDisplayName(s)));
    console.log('Recently played:', player.getRecentlyPlayed().map(s => player.getSongDisplayName(s)));
    console.log('Navigation history:', player.navigationHistory.map(s => player.getSongDisplayName(s)));
    console.log(`Navigation index: ${player.navigationIndex}`);
}

// Initialize player with better error handling
document.addEventListener('DOMContentLoaded', function() {
    console.log('Music Player initialized with JSON support, fixed navigation, and AutoMix support');
    console.log('Available functions:');
    console.log('- playRandomSong()');
    console.log('- addRandomSongsToQueue(count)');
    console.log('- searchAndPlay(query)');
    console.log('- playArtist(artistName)');
    console.log('- addArtistToQueue(artistName, maxSongs)');
    console.log('- enableAutoplay() / disableAutoplay()');
    console.log('- enableAutoMix() / disableAutoMix()');
    console.log('- getPlayerStats()');
    console.log('- debugPlayer()');
    
    // Wait for songs to load before enabling controls
    player.addEventListener('songsLoaded', function(songs) {
        console.log(`Ready to play! ${songs.length} songs loaded.`);
        
        // Enable progress bar seeking if method exists
        if (typeof player.enableProgressBarSeeking === 'function') {
            player.enableProgressBarSeeking();
        }
    });
    // Add this new listener
    
    // Handle errors gracefully
    player.addEventListener('error', function(error) {
        console.error('Playback error:', error.message);
        
        // Try to recover by playing another random song
        if (player.autoplayEnabled && player.songsArray.length > 0) {
            setTimeout(() => {
                console.log('Attempting to recover with random song...');
                playRandomSong();
            }, 2000);
        }
    });
});

// Keyboard shortcuts (optional)
document.addEventListener('keydown', function(event) {
    // Only handle shortcuts when not typing in input fields
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
        return;
    }
    
    switch(event.code) {
        case 'Space':
            event.preventDefault();
            player.togglePlayPause();
            break;
        case 'ArrowRight':
            event.preventDefault();
            player.skip();
            break;
        case 'ArrowLeft':
            event.preventDefault();
            player.skipBack();
            break;
        case 'KeyR':
            if (event.ctrlKey || event.metaKey) {
                event.preventDefault();
                playRandomSong();
            }
            break;
        case 'KeyS':
            if (event.ctrlKey || event.metaKey) {
                event.preventDefault();
                player.toggleShuffle();
            }
            break;
        case 'KeyM':
            if (event.ctrlKey || event.metaKey) {
                event.preventDefault();
                player.toggleMute();
            }
            break;
        case 'KeyA':
            if (event.ctrlKey || event.metaKey) {
                event.preventDefault();
                player.doAutoMix ? disableAutoMix() : enableAutoMix();
            }
            break;
    }
});

// Export player for global access (if using modules)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MusicPlayer, MusicPlayerUI, player, playerUI };
}

// Make player globally accessible
window.musicPlayer = player;
window.musicPlayerUI = playerUI;

console.log('Music Player with AutoMix support loaded successfully!');
