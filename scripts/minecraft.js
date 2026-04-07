const MINECRAFT_VIDEO_ID = 'minecraft-theme-video';
const MINECRAFT_AUDIO_ID = 'minecraft-click-sound';
const MINECRAFT_AUDIO_TARGETS = [
    'button',
    'a',
    '[role="button"]',
    '.menu-item',
    '.sidenav-icon-btn',
    '.filterbutton',
    '.filter-radio-container',
    '.widget',
    '.controller-icon-container',
    '.material-icons',
    '.naviconsit'
].join(', ');

function ensureMinecraftVideo() {
    let video = document.getElementById(MINECRAFT_VIDEO_ID);

    if (!video) {
        video = document.createElement('video');
        video.id = MINECRAFT_VIDEO_ID;
        video.className = 'mcvideobg';
        video.muted = true;
        video.controls = false;
        video.loop = true;
        video.autoplay = true;
        video.playsInline = true;
        video.setAttribute('aria-hidden', 'true');
        document.body.appendChild(video);
    }

    video.src = './scripts/assets/MC.mp4';
    return video;
}

function applyMinecraftLogos() {
    const logoPath = './scripts/assets/logopixel.png';
    const headerIcon = document.getElementById('headericon');
    const navIcon = document.getElementById('navicon');

    if (headerIcon) {
        headerIcon.src = logoPath;
    }

    if (navIcon) {
        navIcon.src = logoPath;
    }

    document.querySelectorAll('.sidenav-logo').forEach((logo) => {
        logo.src = logoPath;
    });
}

function ensureMinecraftClickSound() {
    let audio = document.getElementById(MINECRAFT_AUDIO_ID);

    if (!audio) {
        audio = document.createElement('audio');
        audio.id = MINECRAFT_AUDIO_ID;
        audio.className = 'click-sound';
        audio.preload = 'auto';
        audio.src = './scripts/assets/click.mp3';
        document.body.appendChild(audio);
    }

    if (!document.body.dataset.minecraftClickBound) {
        document.body.dataset.minecraftClickBound = 'true';
        document.addEventListener('click', (event) => {
            if (!(event.target instanceof Element) || !event.target.closest(MINECRAFT_AUDIO_TARGETS)) {
                return;
            }

            audio.pause();
            audio.currentTime = 0;
            audio.play().catch(() => {});
        }, true);
    }

    return audio;
}

function initMinecraftTheme() {
    ensureMinecraftVideo();
    applyMinecraftLogos();
    ensureMinecraftClickSound();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMinecraftTheme, { once: true });
} else {
    initMinecraftTheme();
}
