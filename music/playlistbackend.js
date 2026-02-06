/**
 * PlaylistBackend - Cookie-based Playlist Management System
 *
 * Storage Structure:
 * - playlists_index: Master list of all playlists with metadata
 * - playlist_[id]: Individual playlist data with songs
 */

class PlaylistManager {
    constructor() {
        this.INDEX_COOKIE = 'playlists_index';
        this.PLAYLIST_PREFIX = 'playlist_';
        this.MAX_COOKIE_SIZE = 3800; // Leave buffer under 4KB limit
    }

    // ==================== Cookie Utilities ====================

    /**
     * Set a cookie with JSON data
     */
    setCookie(name, data, days = 365) {
        try {
            const jsonStr = JSON.stringify(data);

            // Check size
            if (jsonStr.length > this.MAX_COOKIE_SIZE) {
                console.warn(`[Playlists] Cookie ${name} exceeds size limit (${jsonStr.length} bytes)`);
                // Could implement splitting here if needed
            }

            const expires = new Date();
            expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));

            document.cookie = `${name}=${encodeURIComponent(jsonStr)}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
            return true;
        } catch (err) {
            console.error(`[Playlists] Failed to set cookie ${name}:`, err);
            return false;
        }
    }

    /**
     * Get and parse JSON cookie data
     */
    getCookie(name) {
        try {
            const nameEQ = name + "=";
            const ca = document.cookie.split(';');

            for (let i = 0; i < ca.length; i++) {
                let c = ca[i].trim();
                if (c.indexOf(nameEQ) === 0) {
                    const value = decodeURIComponent(c.substring(nameEQ.length));
                    return JSON.parse(value);
                }
            }
            return null;
        } catch (err) {
            console.error(`[Playlists] Failed to get cookie ${name}:`, err);
            return null;
        }
    }

    /**
     * Delete a cookie
     */
    deleteCookie(name) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    }

    // ==================== Playlist Index Management ====================

    /**
     * Get all playlists metadata
     */
    getAllPlaylists() {
        const index = this.getCookie(this.INDEX_COOKIE);
        return index?.playlists || [];
    }

    /**
     * Save playlists index
     */
    _saveIndex(playlists) {
        return this.setCookie(this.INDEX_COOKIE, { playlists });
    }

    /**
     * Generate unique playlist ID
     */
    _generateId() {
        return 'pl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
    }

    // ==================== CRUD Operations ====================

    /**
     * Create a new playlist
     * @param {string} name - Playlist name
     * @param {string} coverImage - Optional base64 image data
     * @returns {Object|null} Created playlist metadata or null if failed
     */
    createPlaylist(name, coverImage = null) {
        if (!name || typeof name !== 'string') {
            console.error('[Playlists] Invalid playlist name');
            return null;
        }

        name = name.trim();
        if (name.length === 0) {
            console.error('[Playlists] Playlist name cannot be empty');
            return null;
        }

        // Check for duplicate names
        const playlists = this.getAllPlaylists();
        if (playlists.some(p => p.name.toLowerCase() === name.toLowerCase())) {
            console.error('[Playlists] Playlist with this name already exists');
            return null;
        }

        const id = this._generateId();
        const now = new Date().toISOString();

        // Create playlist metadata
        const playlistMeta = {
            id,
            name,
            coverImage: coverImage || null,
            songCount: 0,
            createdAt: now,
            updatedAt: now
        };

        // Create empty playlist data
        const playlistData = {
            id,
            name,
            songs: []
        };

        // Save playlist data cookie
        if (!this.setCookie(this.PLAYLIST_PREFIX + id, playlistData)) {
            console.error('[Playlists] Failed to save playlist data');
            return null;
        }

        // Add to index
        playlists.push(playlistMeta);
        if (!this._saveIndex(playlists)) {
            // Rollback: delete the playlist data cookie
            this.deleteCookie(this.PLAYLIST_PREFIX + id);
            console.error('[Playlists] Failed to update playlist index');
            return null;
        }

        console.log(`[Playlists] Created playlist: ${name} (${id})`);
        return playlistMeta;
    }

    /**
     * Get a specific playlist with its songs
     */
    getPlaylist(id) {
        const playlistData = this.getCookie(this.PLAYLIST_PREFIX + id);
        if (!playlistData) {
            console.warn(`[Playlists] Playlist ${id} not found`);
            return null;
        }

        // Get metadata from index for additional info
        const playlists = this.getAllPlaylists();
        const meta = playlists.find(p => p.id === id);

        return {
            ...playlistData,
            metadata: meta || null
        };
    }

    /**
     * Delete a playlist
     */
    deletePlaylist(id) {
        // Remove from index
        let playlists = this.getAllPlaylists();
        const initialLength = playlists.length;
        playlists = playlists.filter(p => p.id !== id);

        if (playlists.length === initialLength) {
            console.warn(`[Playlists] Playlist ${id} not found in index`);
            return false;
        }

        // Delete playlist data cookie
        this.deleteCookie(this.PLAYLIST_PREFIX + id);

        // Save updated index
        if (!this._saveIndex(playlists)) {
            console.error('[Playlists] Failed to update index after deletion');
            return false;
        }

        console.log(`[Playlists] Deleted playlist: ${id}`);
        return true;
    }

    /**
     * Update playlist metadata (name, cover image)
     */
    updatePlaylistMetadata(id, updates) {
        // Update in index
        const playlists = this.getAllPlaylists();
        const playlist = playlists.find(p => p.id === id);

        if (!playlist) {
            console.error(`[Playlists] Playlist ${id} not found`);
            return false;
        }

        // Apply updates
        if (updates.name !== undefined) {
            // Check for duplicate names (excluding current playlist)
            if (playlists.some(p => p.id !== id && p.name.toLowerCase() === updates.name.toLowerCase())) {
                console.error('[Playlists] Playlist with this name already exists');
                return false;
            }
            playlist.name = updates.name;
        }

        if (updates.coverImage !== undefined) {
            playlist.coverImage = updates.coverImage;
            console.log(`[Playlists] Updated coverImage for ${id}:`, updates.coverImage ? 'Image set' : 'Image cleared');
        }

        playlist.updatedAt = new Date().toISOString();

        // Save index
        if (!this._saveIndex(playlists)) {
            console.error('[Playlists] Failed to save index');
            return false;
        }

        console.log(`[Playlists] Saved index with ${playlists.length} playlists`);

        // Update playlist data cookie if name changed
        if (updates.name !== undefined) {
            const playlistData = this.getCookie(this.PLAYLIST_PREFIX + id);
            if (playlistData) {
                playlistData.name = updates.name;
                this.setCookie(this.PLAYLIST_PREFIX + id, playlistData);
            }
        }

        console.log(`[Playlists] Updated playlist ${id}`);
        return true;
    }

    // ==================== Song Management ====================

    /**
     * Add a song to a playlist
     * @param {string} playlistId - Target playlist ID
     * @param {Object} songData - {name, artist, ft, cover, file}
     */
    addSongToPlaylist(playlistId, songData) {
        const playlist = this.getCookie(this.PLAYLIST_PREFIX + playlistId);
        if (!playlist) {
            console.error(`[Playlists] Playlist ${playlistId} not found`);
            return false;
        }

        // Validate song data
        if (!songData.name || !songData.file) {
            console.error('[Playlists] Invalid song data (name and file required)');
            return false;
        }

        // Check for duplicates (same file)
        if (playlist.songs.some(s => s.file === songData.file)) {
            console.warn('[Playlists] Song already exists in playlist');
            return false;
        }

        // Add song
        playlist.songs.push({
            name: songData.name,
            artist: songData.artist || '',
            ft: songData.ft || '',
            cover: songData.cover || '',
            file: songData.file,
            addedAt: new Date().toISOString()
        });

        // Save playlist
        if (!this.setCookie(this.PLAYLIST_PREFIX + playlistId, playlist)) {
            console.error('[Playlists] Failed to save playlist after adding song');
            return false;
        }

        // Update song count in index
        const playlists = this.getAllPlaylists();
        const meta = playlists.find(p => p.id === playlistId);
        if (meta) {
            meta.songCount = playlist.songs.length;
            meta.updatedAt = new Date().toISOString();
            this._saveIndex(playlists);
        }

        console.log(`[Playlists] Added song "${songData.name}" to playlist ${playlistId}`);
        return true;
    }

    /**
     * Remove a song from a playlist by index
     */
    removeSongFromPlaylist(playlistId, songIndex) {
        const playlist = this.getCookie(this.PLAYLIST_PREFIX + playlistId);
        if (!playlist) {
            console.error(`[Playlists] Playlist ${playlistId} not found`);
            return false;
        }

        if (songIndex < 0 || songIndex >= playlist.songs.length) {
            console.error('[Playlists] Invalid song index');
            return false;
        }

        // Remove song
        const removed = playlist.songs.splice(songIndex, 1);

        // Save playlist
        if (!this.setCookie(this.PLAYLIST_PREFIX + playlistId, playlist)) {
            console.error('[Playlists] Failed to save playlist after removing song');
            return false;
        }

        // Update song count in index
        const playlists = this.getAllPlaylists();
        const meta = playlists.find(p => p.id === playlistId);
        if (meta) {
            meta.songCount = playlist.songs.length;
            meta.updatedAt = new Date().toISOString();
            this._saveIndex(playlists);
        }

        console.log(`[Playlists] Removed song "${removed[0].name}" from playlist ${playlistId}`);
        return true;
    }

    /**
     * Get all songs from a playlist
     */
    getPlaylistSongs(playlistId) {
        const playlist = this.getCookie(this.PLAYLIST_PREFIX + playlistId);
        return playlist?.songs || [];
    }

    // ==================== Utility Methods ====================

    /**
     * Get total number of playlists
     */
    getPlaylistCount() {
        return this.getAllPlaylists().length;
    }

    /**
     * Check if a playlist name exists
     */
    playlistNameExists(name) {
        const playlists = this.getAllPlaylists();
        return playlists.some(p => p.name.toLowerCase() === name.trim().toLowerCase());
    }

    /**
     * Get storage statistics
     */
    getStorageStats() {
        const playlists = this.getAllPlaylists();
        const stats = {
            playlistCount: playlists.length,
            totalSongs: 0,
            estimatedSize: 0
        };

        playlists.forEach(meta => {
            stats.totalSongs += meta.songCount;
            const playlist = this.getCookie(this.PLAYLIST_PREFIX + meta.id);
            if (playlist) {
                stats.estimatedSize += JSON.stringify(playlist).length;
            }
        });

        // Add index size
        const indexData = this.getCookie(this.INDEX_COOKIE);
        if (indexData) {
            stats.estimatedSize += JSON.stringify(indexData).length;
        }

        return stats;
    }
}

// Initialize global instance
if (typeof window !== 'undefined') {
    window.playlistManager = new PlaylistManager();
    console.log('[Playlists] PlaylistManager initialized');
}
