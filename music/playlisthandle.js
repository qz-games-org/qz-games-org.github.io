/**
 * PlaylistHandle - Context Menu Integration for Playlist Management
 *
 * Handles:
 * - "Add to playlist" context menu interaction
 * - Playlist submenu display
 * - Song data extraction from quick-addd attribute
 * - Playlist creation dialog
 */

(function() {
    'use strict';

    // Wait for DOM and dependencies
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    function init() {
        if (!window.playlistManager) {
            console.error('[PlaylistHandle] PlaylistManager not found. Make sure playlistbackend.js is loaded first.');
            return;
        }

        setupPlaylistContextMenu();
        console.log('[PlaylistHandle] Initialized');
    }

    function setupPlaylistContextMenu() {
        // Find the "Add to playlist" button in the context menu
        const contextMenu = document.querySelector('.music-ctx');
        if (!contextMenu) {
            console.warn('[PlaylistHandle] Context menu (.music-ctx) not found');
            return;
        }

        const addToPlaylistBtn = contextMenu.querySelector('.music-ctx-item:first-child');
        if (!addToPlaylistBtn) {
            console.warn('[PlaylistHandle] Add to playlist button not found');
            return;
        }

        // Enable the button
        addToPlaylistBtn.disabled = false;
        addToPlaylistBtn.style.cursor = 'pointer';

        // Handle "Add to playlist" button click
        addToPlaylistBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showAddToPlaylistModal();
            // Hide the context menu
            contextMenu.style.display = 'none';
        });
    }

    function showAddToPlaylistModal() {
        // Get all playlists
        const playlists = window.playlistManager.getAllPlaylists();

        // Create backdrop
        const backdrop = document.createElement('div');
        backdrop.className = 'playlist-dialog-backdrop';

        // Create modal dialog
        const modal = document.createElement('div');
        modal.className = 'playlist-dialog';
        modal.style.maxWidth = '500px';

        // Build playlist list HTML
        let playlistsHTML = '';
        if (playlists.length === 0) {
            playlistsHTML = `
                <div class="playlist-submenu-empty" style="padding: 40px 20px; text-align: center;">
                    <span class="material-icons" style="font-size: 48px; color: #666; display: block; margin-bottom: 12px;">queue_music</span>
                    <div style="color: #999; font-size: 14px;">No playlists yet</div>
                    <div style="color: #666; font-size: 12px; margin-top: 4px;">Create your first playlist below</div>
                </div>
            `;
        } else {
            playlistsHTML = '<div style="display: flex; flex-direction: column; gap: 8px; max-height: 400px; overflow-y: auto;">';
            playlists.forEach(playlist => {
                playlistsHTML += `
                    <button class="playlist-submenu-item" data-playlist-id="${playlist.id}" style="width: 100%; text-align: left;">
                        <span class="material-icons">queue_music</span>
                        <div class="playlist-submenu-item-info">
                            <span class="playlist-submenu-item-name">${escapeHTML(playlist.name)}</span>
                            <span class="playlist-submenu-item-count">${playlist.songCount} song${playlist.songCount !== 1 ? 's' : ''}</span>
                        </div>
                    </button>
                `;
            });
            playlistsHTML += '</div>';
        }

        modal.innerHTML = `
            <div class="playlist-dialog-header">
                <h2>Add to Playlist</h2>
                <button class="playlist-dialog-close">
                    <span class="material-icons">close</span>
                </button>
            </div>
            <div class="playlist-dialog-body">
                ${playlistsHTML}
            </div>
            <div class="playlist-dialog-footer">
                <button class="playlist-dialog-btn playlist-dialog-btn-create" id="add-playlist-create-new">
                    <span class="material-icons" style="margin-right: 8px;">add</span>
                    Create New Playlist
                </button>
            </div>
        `;

        backdrop.appendChild(modal);
        document.body.appendChild(backdrop);

        // Handle close
        const closeBtn = modal.querySelector('.playlist-dialog-close');
        const closeModal = () => {
            backdrop.remove();
        };

        closeBtn.addEventListener('click', closeModal);
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) closeModal();
        });

        // Handle playlist selection
        const playlistButtons = modal.querySelectorAll('[data-playlist-id]');
        playlistButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const playlistId = btn.getAttribute('data-playlist-id');
                addCurrentSongToPlaylist(playlistId);
                closeModal();
            });
        });

        // Handle create new playlist
        const createBtn = modal.querySelector('#add-playlist-create-new');
        createBtn.addEventListener('click', () => {
            closeModal();
            showCreatePlaylistDialog();
        });

        // Close on Escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    }

    function addCurrentSongToPlaylist(playlistId) {
        // Get current song from context menu
        const contextMenu = document.querySelector('.music-ctx');
        const currentItemCode = contextMenu?._currentItemCode;

        if (!currentItemCode) {
            console.error('[PlaylistHandle] No song data available');
            showNotification('Failed to add song', 'error');
            return;
        }

        // Parse song data from quick-addd code
        const songData = parseSongData(currentItemCode);
        if (!songData) {
            console.error('[PlaylistHandle] Failed to parse song data');
            showNotification('Failed to add song', 'error');
            return;
        }

        // Add to playlist
        const success = window.playlistManager.addSongToPlaylist(playlistId, songData);

        if (success) {
            const playlist = window.playlistManager.getAllPlaylists().find(p => p.id === playlistId);
            showNotification(`Added to "${playlist.name}"`, 'success');
        } else {
            showNotification('Song already in playlist', 'warning');
        }
    }

    function parseSongData(quickAddCode) {
        try {
            // Parse: player.addSongToQueue('Name', 'Artist', 'ft', 'cover.jpg', '../music/assets/music/' + 'file.mp3')
            // Note: The path has a + concatenation operator in the original code
            const regex = /player\.addSongToQueue\('([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'[^']*'\s*\+\s*'([^']+)'\)/;
            const match = quickAddCode.match(regex);

            if (!match) {
                console.error('[PlaylistHandle] Failed to match quick-addd pattern');
                console.error('[PlaylistHandle] Code:', quickAddCode);
                return null;
            }

            return {
                name: match[1],
                artist: match[2],
                ft: match[3],
                cover: match[4],
                file: match[5]
            };
        } catch (err) {
            console.error('[PlaylistHandle] Error parsing song data:', err);
            return null;
        }
    }

    function showCreatePlaylistDialog() {
        // Create dialog backdrop
        const backdrop = document.createElement('div');
        backdrop.className = 'playlist-dialog-backdrop';

        // Create dialog
        const dialog = document.createElement('div');
        dialog.className = 'playlist-dialog';
        dialog.innerHTML = `
            <div class="playlist-dialog-header">
                <h2>Create New Playlist</h2>
                <button class="playlist-dialog-close">
                    <span class="material-icons">close</span>
                </button>
            </div>
            <div class="playlist-dialog-body">
                <div class="playlist-dialog-field">
                    <label for="playlist-name-input">Playlist Name</label>
                    <input
                        type="text"
                        id="playlist-name-input"
                        placeholder="My Awesome Playlist"
                        maxlength="50"
                        autocomplete="off"
                    />
                </div>
                <div class="playlist-dialog-field">
                    <label for="playlist-cover-input">Cover Image (Optional)</label>
                    <div class="playlist-cover-upload">
                        <input
                            type="file"
                            id="playlist-cover-input"
                            accept="image/*"
                            style="display: none;"
                        />
                        <div class="playlist-cover-dropzone" id="cover-dropzone">
                            <span class="material-icons" style="font-size: 48px; color: #00d4ff; margin-bottom: 12px;">add_photo_alternate</span>
                            <span style="color: #fff; font-size: 14px; font-weight: 600; margin-bottom: 4px;">Drop image here</span>
                            <span style="color: #999; font-size: 12px; margin-bottom: 12px;">or</span>
                            <button class="playlist-cover-upload-btn" id="upload-cover-btn" type="button">
                                <span class="material-icons">upload</span>
                                <span>Choose Image</span>
                            </button>
                            <span style="color: #666; font-size: 11px; margin-top: 12px;">Max 500KB - Compressed to 100x100px</span>
                        </div>
                        <div class="playlist-cover-preview" id="cover-preview" style="display: none;">
                            <img src="" alt="Cover preview" />
                            <button class="playlist-cover-remove" id="remove-cover-btn" type="button">
                                <span class="material-icons">close</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div class="playlist-dialog-footer">
                <button class="playlist-dialog-btn playlist-dialog-btn-cancel">Cancel</button>
                <button class="playlist-dialog-btn playlist-dialog-btn-create">Create Playlist</button>
            </div>
        `;

        backdrop.appendChild(dialog);
        document.body.appendChild(backdrop);

        // Focus name input
        setTimeout(() => {
            const nameInput = dialog.querySelector('#playlist-name-input');
            nameInput?.focus();
        }, 100);

        // Handle cover image upload
        const coverInput = dialog.querySelector('#playlist-cover-input');
        const uploadBtn = dialog.querySelector('#upload-cover-btn');
        const dropzone = dialog.querySelector('#cover-dropzone');
        const preview = dialog.querySelector('#cover-preview');
        const previewImg = preview.querySelector('img');
        const removeBtn = dialog.querySelector('#remove-cover-btn');
        let coverImageBase64 = null;

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

            const reader = new FileReader();
            reader.onload = (event) => {
                // Resize and compress image - use smaller size for cookie storage
                compressImage(event.target.result, 100, 100, (compressed) => {
                    coverImageBase64 = compressed;
                    previewImg.src = compressed;
                    preview.style.display = 'block';
                    dropzone.style.display = 'none';
                    console.log('[PlaylistHandle] Compressed image size:', compressed.length, 'bytes');
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
        const createBtn = dialog.querySelector('.playlist-dialog-btn-create');
        const nameInput = dialog.querySelector('#playlist-name-input');

        const closeDialog = () => {
            backdrop.remove();
        };

        closeBtn.addEventListener('click', closeDialog);
        cancelBtn.addEventListener('click', closeDialog);
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) closeDialog();
        });

        // Handle create button
        createBtn.addEventListener('click', () => {
            const name = nameInput.value.trim();

            if (!name) {
                showNotification('Please enter a playlist name', 'error');
                nameInput.focus();
                return;
            }

            if (window.playlistManager.playlistNameExists(name)) {
                showNotification('A playlist with this name already exists', 'error');
                nameInput.focus();
                return;
            }

            // Create playlist
            const playlist = window.playlistManager.createPlaylist(name, coverImageBase64);

            if (playlist) {
                showNotification(`Created playlist "${name}"`, 'success');
                closeDialog();

                // Add current song to new playlist if there is one
                const contextMenu = document.querySelector('.music-ctx');
                const currentItemCode = contextMenu?._currentItemCode;
                if (currentItemCode) {
                    addCurrentSongToPlaylist(playlist.id);
                }

                // Dispatch event for playlist menu to refresh
                window.dispatchEvent(new CustomEvent('playlistsUpdated'));
            } else {
                showNotification('Failed to create playlist', 'error');
            }
        });

        // Handle Enter key
        nameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                createBtn.click();
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

    // Store current song data on context menu for access
    document.addEventListener('contextmenu', (e) => {
        const item = e.target.closest('.music-item');
        if (item) {
            const contextMenu = document.querySelector('.music-ctx');
            const code = item.getAttribute('quick-addd') || item.dataset.quickAddd;
            if (contextMenu) {
                contextMenu._currentItemCode = code;
            }
        }
    });

    // Export function for use by playlistmenu.js
    window.showCreatePlaylistDialog = showCreatePlaylistDialog;
})();
