/**
 * PlaylistMenu - Playlist Management UI
 *
 * Handles:
 * - Playlist grid/list view
 * - Playlist detail view with songs
 * - Play entire playlist functionality
 * - Edit playlist (rename, change cover)
 * - Delete playlist with confirmation
 * - Remove songs from playlist
 */

(function() {
    'use strict';

    let currentView = 'list'; // 'list' or 'detail'
    let currentPlaylistId = null;

    // Wait for DOM and dependencies
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    function init() {
        if (!window.playlistManager) {
            console.error('[PlaylistMenu] PlaylistManager not found. Make sure playlistbackend.js is loaded first.');
            return;
        }

        // Listen for playlist updates
        window.addEventListener('playlistsUpdated', handlePlaylistsUpdated);

        console.log('[PlaylistMenu] Initialized');
    }

    function handlePlaylistsUpdated() {
        // Refresh current view if in playlist menu
        if (currentView === 'list') {
            renderPlaylistList();
        } else if (currentView === 'detail' && currentPlaylistId) {
            renderPlaylistDetail(currentPlaylistId);
        }
    }

    function showPlaylistMenu() {
        currentView = 'list';
        currentPlaylistId = null;

        // Use existing playlist-containerr
        const playlistPage = document.getElementById('playlist-containerr');
        if (!playlistPage) {
            console.error('[PlaylistMenu] playlist-containerr not found');
            return;
        }

        renderPlaylistList();
    }

    function renderPlaylistList() {
        const playlistPage = document.getElementById('playlist-containerr');
        if (!playlistPage) return;

        const playlists = window.playlistManager.getAllPlaylists();

        playlistPage.innerHTML = `
            <div class="playlist-menu-container">
                <div class="playlist-menu-header">
                    <h1 class="playlist-menu-title">Your Playlists</h1>
                    <button class="playlist-create-btn" id="create-playlist-btn">
                        <span class="material-icons">add</span>
                        <span>Create Playlist</span>
                    </button>
                </div>

                ${playlists.length === 0 ? `
                    <div class="playlist-empty">
                        <span class="material-icons">queue_music</span>
                        <div class="playlist-empty-text">No playlists yet</div>
                        <div class="playlist-empty-subtext">Create your first playlist to get started</div>
                    </div>
                ` : `
                    <div class="playlist-grid" id="playlist-grid"></div>
                `}
            </div>
        `;

        // Attach create button listener
        const createBtn = playlistPage.querySelector('#create-playlist-btn');
        if (createBtn) {
            createBtn.addEventListener('click', () => {
                // Trigger the same create dialog from playlisthandle.js
                if (window.showCreatePlaylistDialog) {
                    window.showCreatePlaylistDialog();
                } else {
                    // Fallback: dispatch custom event
                    window.dispatchEvent(new CustomEvent('createPlaylistRequested'));
                }
            });
        }

        // Render playlist cards
        if (playlists.length > 0) {
            const grid = playlistPage.querySelector('#playlist-grid');
            playlists.forEach(playlist => {
                const card = createPlaylistCard(playlist);
                grid.appendChild(card);
            });
        }
    }

    function createPlaylistCard(playlist) {
        const card = document.createElement('div');
        card.className = 'playlist-card';
        card.innerHTML = `
            <div class="playlist-card-cover">
                ${playlist.coverImage
                    ? `<img src="${escapeHTML(playlist.coverImage)}" alt="${escapeHTML(playlist.name)}" />`
                    : `<span class="material-icons">queue_music</span>`
                }
            </div>
            <div class="playlist-card-name">${escapeHTML(playlist.name)}</div>
            <div class="playlist-card-count">${playlist.songCount} song${playlist.songCount !== 1 ? 's' : ''}</div>
        `;

        card.addEventListener('click', () => {
            currentView = 'detail';
            currentPlaylistId = playlist.id;
            renderPlaylistDetail(playlist.id);
        });

        return card;
    }

    function renderPlaylistDetail(playlistId) {
        const playlistPage = document.getElementById('playlist-containerr');
        if (!playlistPage) return;

        const playlistData = window.playlistManager.getPlaylist(playlistId);
        if (!playlistData) {
            showNotification('Playlist not found', 'error');
            renderPlaylistList();
            return;
        }

        const playlist = playlistData.metadata || {};
        const songs = playlistData.songs || [];

        playlistPage.innerHTML = `
            <div class="playlist-detail-container">
                <div class="playlist-detail-header">
                    <div class="playlist-detail-cover">
                        ${playlist.coverImage
                            ? `<img src="${escapeHTML(playlist.coverImage)}" alt="${escapeHTML(playlist.name)}" />`
                            : `<span class="material-icons">queue_music</span>`
                        }
                    </div>
                    <div class="playlist-detail-info">
                        <div class="playlist-detail-type">Playlist</div>
                        <h1 class="playlist-detail-name">${escapeHTML(playlist.name || 'Untitled')}</h1>
                        <div class="playlist-detail-meta">
                            ${songs.length} song${songs.length !== 1 ? 's' : ''}
                        </div>
                    </div>
                </div>

                <div class="playlist-detail-actions">
                    <button class="playlist-action-btn playlist-action-btn-secondary" id="back-btn">
                        <span class="material-icons">arrow_back</span>
                        <span>Back</span>
                    </button>
                    ${songs.length > 0 ? `
                        <button class="playlist-action-btn playlist-action-btn-primary" id="play-all-btn">
                            <span class="material-icons">play_arrow</span>
                            <span>Play All</span>
                        </button>
                    ` : ''}
                    <button class="playlist-action-btn playlist-action-btn-secondary" id="edit-btn">
                        <span class="material-icons">edit</span>
                        <span>Edit</span>
                    </button>
                    <button class="playlist-action-btn playlist-action-btn-secondary" id="delete-btn">
                        <span class="material-icons">delete</span>
                        <span>Delete</span>
                    </button>
                </div>

                ${songs.length === 0 ? `
                    <div class="playlist-empty">
                        <span class="material-icons">music_note</span>
                        <div class="playlist-empty-text">No songs in this playlist</div>
                        <div class="playlist-empty-subtext">Right-click on songs to add them here</div>
                    </div>
                ` : `
                    <div class="playlist-songs-list" id="playlist-songs"></div>
                `}
            </div>
        `;

        // Attach button listeners
        const backBtn = playlistPage.querySelector('#back-btn');
        backBtn?.addEventListener('click', () => {
            currentView = 'list';
            currentPlaylistId = null;
            renderPlaylistList();
        });

        const playAllBtn = playlistPage.querySelector('#play-all-btn');
        playAllBtn?.addEventListener('click', () => playAllSongs(playlistId));

        const editBtn = playlistPage.querySelector('#edit-btn');
        editBtn?.addEventListener('click', () => showEditDialog(playlistId));

        const deleteBtn = playlistPage.querySelector('#delete-btn');
        deleteBtn?.addEventListener('click', () => confirmDeletePlaylist(playlistId));

        // Render songs
        if (songs.length > 0) {
            const songsList = playlistPage.querySelector('#playlist-songs');
            songs.forEach((song, index) => {
                const songItem = createSongItem(song, index, playlistId);
                songsList.appendChild(songItem);
            });
        }
    }

    function createSongItem(song, index, playlistId) {
        const item = document.createElement('div');
        item.className = 'music-item';
        item.innerHTML = `
            <div class="music-cover">
                <img src="../music/assets/covers/${escapeHTML(song.cover)}" alt="cover" onerror="this.style.display='none'">
                <button class="row-play">
                    <span class="material-icons">play_arrow</span>
                </button>
            </div>
            <div class="music-meta">
                <div class="music-title">${escapeHTML(song.name)}</div>
                <div class="music-artist">${escapeHTML(song.artist)}${song.ft ? ' ft. ' + escapeHTML(song.ft) : ''}</div>
            </div>
            <div class="music-album"></div>
            <div class="music-right">
                <button class="icon-btn" title="Remove from playlist">
                    <span class="material-icons">remove_circle_outline</span>
                </button>
            </div>
        `;

        // Play song on click
        item.addEventListener('click', (e) => {
            if (!e.target.closest('.icon-btn')) {
                playSong(song);
            }
        });

        // Remove song button
        const removeBtn = item.querySelector('.icon-btn');
        removeBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            removeSongFromPlaylist(playlistId, index);
        });

        return item;
    }

    function playSong(song) {
        starteq()

        if (player) {

           player.play(
                song.name,
                song.artist,
                song.ft,
                song.cover,
                `../music/assets/music/${song.file}`
            );
        } else {
            console.warn('[PlaylistMenu] Player not available');
        }
    }

    function playAllSongs(playlistId) {
        const playlistData = window.playlistManager.getPlaylist(playlistId);
        if (!playlistData || !playlistData.songs || playlistData.songs.length === 0) {
            showNotification('No songs to play', 'warning');
            return;
        }

        // Clear queue and add all songs
        if (window.player && window.player.clearQueue) {
            window.player.clearQueue();
        }

        playlistData.songs.forEach(song => {
            playSong(song);
        });

        showNotification(`Playing ${playlistData.songs.length} songs`, 'success');
    }

    function removeSongFromPlaylist(playlistId, songIndex) {
        const success = window.playlistManager.removeSongFromPlaylist(playlistId, songIndex);

        if (success) {
            showNotification('Song removed', 'success');
            renderPlaylistDetail(playlistId);
            window.dispatchEvent(new CustomEvent('playlistsUpdated'));
        } else {
            showNotification('Failed to remove song', 'error');
        }
    }

    function showEditDialog(playlistId) {
        const playlistData = window.playlistManager.getPlaylist(playlistId);
        if (!playlistData) return;

        const playlist = playlistData.metadata || {};

        // Create dialog backdrop
        const backdrop = document.createElement('div');
        backdrop.className = 'playlist-dialog-backdrop';

        // Create dialog
        const dialog = document.createElement('div');
        dialog.className = 'playlist-dialog';
        dialog.innerHTML = `
            <div class="playlist-dialog-header">
                <h2>Edit Playlist</h2>
                <button class="playlist-dialog-close">
                    <span class="material-icons">close</span>
                </button>
            </div>
            <div class="playlist-dialog-body">
                <div class="playlist-dialog-field">
                    <label for="edit-playlist-name-input">Playlist Name</label>
                    <input
                        type="text"
                        id="edit-playlist-name-input"
                        value="${escapeHTML(playlist.name)}"
                        maxlength="50"
                        autocomplete="off"
                    />
                </div>
                <div class="playlist-dialog-field">
                    <label for="edit-playlist-cover-input">Cover Image</label>
                    <div class="playlist-cover-upload">
                        <input
                            type="file"
                            id="edit-playlist-cover-input"
                            accept="image/*"
                            style="display: none;"
                        />
                        <div class="playlist-cover-dropzone" id="edit-cover-dropzone" style="${playlist.coverImage ? 'display: none;' : 'display: flex;'}">
                            <span class="material-icons" style="font-size: 48px; color: #00d4ff; margin-bottom: 12px;">add_photo_alternate</span>
                            <span style="color: #fff; font-size: 14px; font-weight: 600; margin-bottom: 4px;">Drop image here</span>
                            <span style="color: #999; font-size: 12px; margin-bottom: 12px;">or</span>
                            <button class="playlist-cover-upload-btn" id="edit-upload-cover-btn" type="button">
                                <span class="material-icons">upload</span>
                                <span>Choose Image</span>
                            </button>
                            <span style="color: #666; font-size: 11px; margin-top: 12px;">Max 500KB - Compressed to 100x100px</span>
                        </div>
                        <div class="playlist-cover-preview" id="edit-cover-preview" style="${playlist.coverImage ? 'display: block;' : 'display: none;'}">
                            <img src="${playlist.coverImage || ''}" alt="Cover preview" />
                            <button class="playlist-cover-remove" id="edit-remove-cover-btn" type="button">
                                <span class="material-icons">close</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div class="playlist-dialog-footer">
                <button class="playlist-dialog-btn playlist-dialog-btn-cancel">Cancel</button>
                <button class="playlist-dialog-btn playlist-dialog-btn-create">Save Changes</button>
            </div>
        `;

        backdrop.appendChild(dialog);
        document.body.appendChild(backdrop);

        // Focus name input
        setTimeout(() => {
            const nameInput = dialog.querySelector('#edit-playlist-name-input');
            nameInput?.focus();
        }, 100);

        // Handle cover image upload
        const coverInput = dialog.querySelector('#edit-playlist-cover-input');
        const uploadBtn = dialog.querySelector('#edit-upload-cover-btn');
        const dropzone = dialog.querySelector('#edit-cover-dropzone');
        const preview = dialog.querySelector('#edit-cover-preview');
        const previewImg = preview.querySelector('img');
        const removeBtn = dialog.querySelector('#edit-remove-cover-btn');
        let coverImageBase64 = playlist.coverImage;

        // Process image file
        const processImageFile = (file) => {
            // Validate file type
            if (!file.type.startsWith('image/')) {
                showNotification('Please select an image file', 'error');
                return;
            }

            // Validate file size (max 500KB)
            if (file.size > 500 * 1024) {
                showNotification('Image too large. Please use an image under 500KB', 'error');
                return;
            }

            console.log('[PlaylistMenu] Processing image file:', file.name, file.size);

            const reader = new FileReader();
            reader.onload = (event) => {
                // Resize and compress image - use smaller size for cookie storage
                compressImage(event.target.result, 100, 100, (compressed) => {
                    coverImageBase64 = compressed;
                    console.log('[PlaylistMenu] Image compressed, data length:', compressed ? compressed.length : 0);
                    previewImg.src = compressed;
                    preview.style.display = 'block';
                    dropzone.style.display = 'none';
                });
            };
            reader.readAsDataURL(file);
        };

        // Click to upload
        uploadBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            coverInput.click();
        });

        coverInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) processImageFile(file);
        });

        // Drag and drop
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.add('dragover');
        });

        dropzone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove('dragover');
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove('dragover');

            const files = e.dataTransfer.files;
            if (files.length > 0) {
                processImageFile(files[0]);
            }
        });

        // Remove cover
        removeBtn.addEventListener('click', () => {
            coverImageBase64 = null;
            preview.style.display = 'none';
            dropzone.style.display = 'flex';
            coverInput.value = '';
        });

        // Handle dialog actions
        const closeBtn = dialog.querySelector('.playlist-dialog-close');
        const cancelBtn = dialog.querySelector('.playlist-dialog-btn-cancel');
        const saveBtn = dialog.querySelector('.playlist-dialog-btn-create');
        const nameInput = dialog.querySelector('#edit-playlist-name-input');

        const closeDialog = () => {
            backdrop.remove();
        };

        closeBtn.addEventListener('click', closeDialog);
        cancelBtn.addEventListener('click', closeDialog);
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) closeDialog();
        });

        // Handle save button
        saveBtn.addEventListener('click', () => {
            const name = nameInput.value.trim();

            if (!name) {
                showNotification('Please enter a playlist name', 'error');
                nameInput.focus();
                return;
            }

            // Check if name changed and if new name already exists
            if (name.toLowerCase() !== playlist.name.toLowerCase() &&
                window.playlistManager.playlistNameExists(name)) {
                showNotification('A playlist with this name already exists', 'error');
                nameInput.focus();
                return;
            }

            // Update playlist
            const updates = {};
            if (name !== playlist.name) {
                updates.name = name;
            }

            // Always include coverImage in updates if it's been changed
            // Handle null comparison properly
            const originalCover = playlist.coverImage || null;
            const newCover = coverImageBase64 || null;

            console.log('[PlaylistMenu] Original cover:', originalCover ? `${originalCover.substring(0, 50)}...` : 'null');
            console.log('[PlaylistMenu] New cover:', newCover ? `${newCover.substring(0, 50)}...` : 'null');
            console.log('[PlaylistMenu] Covers equal?', originalCover === newCover);

            if (originalCover !== newCover) {
                updates.coverImage = newCover;
            }

            console.log('[PlaylistMenu] Updates:', {
                ...updates,
                coverImage: updates.coverImage ? `data:image... (${updates.coverImage.length} chars)` : updates.coverImage
            });

            const success = window.playlistManager.updatePlaylistMetadata(playlistId, updates);

            if (success) {
                showNotification('Playlist updated', 'success');
                closeDialog();

                // Force a fresh render of the detail page
                setTimeout(() => {
                    renderPlaylistDetail(playlistId);
                }, 100);

                window.dispatchEvent(new CustomEvent('playlistsUpdated'));
            } else {
                showNotification('Failed to update playlist', 'error');
            }
        });

        // Handle Enter key
        nameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                saveBtn.click();
            }
        });
    }

    function confirmDeletePlaylist(playlistId) {
        const playlistData = window.playlistManager.getPlaylist(playlistId);
        if (!playlistData) return;

        const playlist = playlistData.metadata || {};

        // Create confirmation dialog
        const backdrop = document.createElement('div');
        backdrop.className = 'playlist-dialog-backdrop';

        const dialog = document.createElement('div');
        dialog.className = 'playlist-dialog';
        dialog.style.maxWidth = '400px';
        dialog.innerHTML = `
            <div class="playlist-dialog-header">
                <h2>Delete Playlist</h2>
                <button class="playlist-dialog-close">
                    <span class="material-icons">close</span>
                </button>
            </div>
            <div class="playlist-dialog-body">
                <p style="color: #ccc; margin: 0 0 16px 0;">
                    Are you sure you want to delete <strong style="color: #fff;">"${escapeHTML(playlist.name)}"</strong>?
                </p>
                <p style="color: #999; font-size: 13px; margin: 0;">
                    This action cannot be undone. All ${playlistData.songs.length} song${playlistData.songs.length !== 1 ? 's' : ''} will be removed from this playlist.
                </p>
            </div>
            <div class="playlist-dialog-footer">
                <button class="playlist-dialog-btn playlist-dialog-btn-cancel">Cancel</button>
                <button class="playlist-dialog-btn playlist-dialog-btn-create" style="background: linear-gradient(45deg, #ff4444, #cc0000);">Delete</button>
            </div>
        `;

        backdrop.appendChild(dialog);
        document.body.appendChild(backdrop);

        const closeBtn = dialog.querySelector('.playlist-dialog-close');
        const cancelBtn = dialog.querySelector('.playlist-dialog-btn-cancel');
        const deleteBtn = dialog.querySelector('.playlist-dialog-btn-create');

        const closeDialog = () => {
            backdrop.remove();
        };

        closeBtn.addEventListener('click', closeDialog);
        cancelBtn.addEventListener('click', closeDialog);
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) closeDialog();
        });

        deleteBtn.addEventListener('click', () => {
            const success = window.playlistManager.deletePlaylist(playlistId);

            if (success) {
                showNotification('Playlist deleted', 'success');
                closeDialog();
                currentView = 'list';
                currentPlaylistId = null;
                renderPlaylistList();
                window.dispatchEvent(new CustomEvent('playlistsUpdated'));
            } else {
                showNotification('Failed to delete playlist', 'error');
            }
        });
    }

    function compressImage(dataUrl, maxWidth, maxHeight, callback) {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            // Calculate new dimensions
            if (width > height) {
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width = (width * maxHeight) / height;
                    height = maxHeight;
                }
            }

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            // Compress to JPEG with 0.5 quality for smaller file size (cookie storage)
            callback(canvas.toDataURL('image/jpeg', 0.5));
        };
        img.src = dataUrl;
    }

    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `playlist-notification playlist-notification-${type}`;
        notification.textContent = message;

        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => notification.classList.add('show'), 10);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    function escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // Export functions for use by playlisthandle.js
    window.showPlaylistMenu = showPlaylistMenu;
})();
