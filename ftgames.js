// Get a unique seed string for the current year + week number
function getYearWeek(date = new Date()) {
    const firstJan = new Date(date.getFullYear(), 0, 1);
    const days = Math.floor((date - firstJan) / 86400000);
    const week = Math.ceil((days + firstJan.getDay() + 1) / 7);
    return `${date.getFullYear()}-${week}`;
}

// Deterministic pseudo-random generator
function mulberry32(seed) {
    return function () {
        let t = (seed += 0x6D2B79F5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Pick N unique items from data based on seed string
function pickItems(data, count, seedString) {
    let seed = 0;
    for (let i = 0; i < seedString.length; i++) {
        seed = (seed * 31 + seedString.charCodeAt(i)) >>> 0;
    }
    const rand = mulberry32(seed);
    const chosen = [];
    const used = new Set();
    const dataArray = Object.entries(data);
    
    while (chosen.length < count && chosen.length < dataArray.length) {
        const idx = Math.floor(rand() * dataArray.length);
        if (!used.has(idx)) {
            used.add(idx);
            const [key, value] = dataArray[idx];
            chosen.push({ ...value, key });
        }
    }
    return chosen;
}

// Configuration variables for gradient generation
const GRADIENT_CONFIG = {
    // Sampling configuration
    SAMPLE_RADIUS_PERCENT: 0.8,        // How much of the image to sample from center (0.1-0.8)
    SAMPLE_STEP_SIZE: 16,               // Pixel step size for sampling (4-16)
    ANGLE_STEP: 0.1,                   // Angular step for circular sampling (0.05-0.2)
    
    // Color processing
    COLOR_GROUP_SIZE: 50,              // Color grouping bucket size (20-80)
    COLOR_MUTE_FACTOR: 0.8,            // How much to mute colors (0.6-1.0)
    COLOR_BRIGHTNESS_ADD: 40,          // Brightness to add (0-60)
    
    // Gradient appearance
    PRIMARY_OPACITY: 0.85,             // Primary color opacity (0.6-1.0)
    SECONDARY_OPACITY: 0.75,           // Secondary color opacity (0.5-0.9)
    DARK_OVERLAY_OPACITY: 0.3,         // Dark overlay opacity (0.1-0.5)
    SINGLE_COLOR_DARK_FACTOR: 0.4,     // How dark to make single color gradients (0.2-0.6)
    
    // Gradient stops
    PRIMARY_STOP: 0,                   // Primary color position (0-30)
    SECONDARY_STOP: 70,                // Secondary color position (50-80)
    OVERLAY_STOP: 100                  // Overlay position (90-100)
};

// Extract dominant colors from image for gradient
function getImageColors(imgSrc, callback) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = function() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        
        ctx.drawImage(img, 0, 0);
        
        try {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            const colorCount = {};
            
            // Focus sampling on the center region of the image
            const centerX = Math.floor(canvas.width / 2);
            const centerY = Math.floor(canvas.height / 2);
            const sampleRadius = Math.min(canvas.width, canvas.height) * GRADIENT_CONFIG.SAMPLE_RADIUS_PERCENT;
            
            // Sample in a circular pattern from the center
            for (let angle = 0; angle < Math.PI * 2; angle += GRADIENT_CONFIG.ANGLE_STEP) {
                for (let radius = 0; radius < sampleRadius; radius += GRADIENT_CONFIG.SAMPLE_STEP_SIZE) {
                    const x = Math.floor(centerX + Math.cos(angle) * radius);
                    const y = Math.floor(centerY + Math.sin(angle) * radius);
                    
                    if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
                        const pixelIndex = (y * canvas.width + x) * 4;
                        const r = data[pixelIndex];
                        const g = data[pixelIndex + 1];
                        const b = data[pixelIndex + 2];
                        const alpha = data[pixelIndex + 3];
                        
                        if (alpha > 128) {
                            // Group colors very loosely for vague, artistic gradients
                            const colorKey = `${Math.floor(r/GRADIENT_CONFIG.COLOR_GROUP_SIZE)*GRADIENT_CONFIG.COLOR_GROUP_SIZE}-${Math.floor(g/GRADIENT_CONFIG.COLOR_GROUP_SIZE)*GRADIENT_CONFIG.COLOR_GROUP_SIZE}-${Math.floor(b/GRADIENT_CONFIG.COLOR_GROUP_SIZE)*GRADIENT_CONFIG.COLOR_GROUP_SIZE}`;
                            colorCount[colorKey] = (colorCount[colorKey] || 0) + 1;
                        }
                    }
                }
            }
            
            // Get the most dominant colors and make them more vague/muted
            const sortedColors = Object.entries(colorCount)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 3)
                .map(([color]) => {
                    const [r, g, b] = color.split('-').map(Number);
                    // Make colors more muted and vague
                    const mutedR = Math.floor((r + GRADIENT_CONFIG.COLOR_BRIGHTNESS_ADD) * GRADIENT_CONFIG.COLOR_MUTE_FACTOR);
                    const mutedG = Math.floor((g + GRADIENT_CONFIG.COLOR_BRIGHTNESS_ADD) * GRADIENT_CONFIG.COLOR_MUTE_FACTOR);
                    const mutedB = Math.floor((b + GRADIENT_CONFIG.COLOR_BRIGHTNESS_ADD) * GRADIENT_CONFIG.COLOR_MUTE_FACTOR);
                    return { 
                        r: mutedR, 
                        g: mutedG, 
                        b: mutedB, 
                        color: `rgb(${mutedR}, ${mutedG}, ${mutedB})` 
                    };
                });
            
            if (sortedColors.length >= 2) {
                // Create a vague, atmospheric gradient
                const vagueColor1 = `rgba(${sortedColors[0].r}, ${sortedColors[0].g}, ${sortedColors[0].b}, ${GRADIENT_CONFIG.PRIMARY_OPACITY})`;
                const vagueColor2 = `rgba(${sortedColors[1].r}, ${sortedColors[1].g}, ${sortedColors[1].b}, ${GRADIENT_CONFIG.SECONDARY_OPACITY})`;
                const darkOverlay = `rgba(0, 0, 0, ${GRADIENT_CONFIG.DARK_OVERLAY_OPACITY})`;
                
                callback(`linear-gradient(135deg, ${vagueColor1} ${GRADIENT_CONFIG.PRIMARY_STOP}%, ${vagueColor2} ${GRADIENT_CONFIG.SECONDARY_STOP}%, ${darkOverlay} ${GRADIENT_CONFIG.OVERLAY_STOP}%)`);
            } else if (sortedColors.length === 1) {
                // Create a single-color vague gradient
                const { r, g, b } = sortedColors[0];
                const lightColor = `rgba(${r}, ${g}, ${b}, ${GRADIENT_CONFIG.PRIMARY_OPACITY})`;
                const darkColor = `rgba(${Math.floor(r * GRADIENT_CONFIG.SINGLE_COLOR_DARK_FACTOR)}, ${Math.floor(g * GRADIENT_CONFIG.SINGLE_COLOR_DARK_FACTOR)}, ${Math.floor(b * GRADIENT_CONFIG.SINGLE_COLOR_DARK_FACTOR)}, ${GRADIENT_CONFIG.SECONDARY_OPACITY})`;
                
                callback(`linear-gradient(135deg, ${lightColor} ${GRADIENT_CONFIG.PRIMARY_STOP}%, ${darkColor} ${GRADIENT_CONFIG.OVERLAY_STOP}%)`);
            } else {
                // Vague fallback
                callback('linear-gradient(135deg, rgba(60, 60, 80, 0.8) 0%, rgba(20, 20, 30, 0.9) 100%)');
            }
        } catch (e) {
            // Vague artistic fallbacks
            const vagueFallbacks = [
                'linear-gradient(135deg, rgba(102, 126, 234, 0.8) 0%, rgba(118, 75, 162, 0.9) 100%)',
                'linear-gradient(135deg, rgba(240, 147, 251, 0.8) 0%, rgba(245, 87, 108, 0.9) 100%)',
                'linear-gradient(135deg, rgba(79, 172, 254, 0.8) 0%, rgba(0, 242, 254, 0.9) 100%)',
                'linear-gradient(135deg, rgba(67, 233, 123, 0.8) 0%, rgba(56, 249, 215, 0.9) 100%)'
            ];
            const randomFallback = vagueFallbacks[Math.floor(Math.random() * vagueFallbacks.length)];
            callback(randomFallback);
        }
    };
    
    img.onerror = function() {
        // Vague error fallback
        callback('linear-gradient(135deg, rgba(255, 107, 107, 0.8) 0%, rgba(78, 205, 196, 0.9) 100%)');
    };
    
    img.src = imgSrc;
}

// Create carousel slide
function createSlide(game, index, isActive = false) {
    const slide = document.createElement('div');
    slide.className = `carousel-slide${isActive ? ' active' : ''}`;
    slide.dataset.index = index;

    // Determine the link URL based on whether it's a custom link or game link
    const linkUrl = game.customlink
        ? game.link
        : `./Games/game.html?game=${game.link}&type=${game.type}&name=${game.name.toLowerCase()}`;

    slide.innerHTML = `
        <div class="game-info">
            <h2 class="game-name">${game.name}</h2>
            <p class="game-category">${game.catagory}</p>
            <a href="${linkUrl}" class="play-button">Play Now</a>
        </div>
        <div class="game-cover">
            <img src="./covers/${game.cover}" alt="${game.name}" class="cover-image">
        </div>
    `;

    // Check if game has a custom video background
    if (game.videoBackground) {
        // Create video element for background
        const video = document.createElement('video');
        video.className = 'carousel-video-bg';
        video.autoplay = true;
        video.muted = true;
        video.loop = true;
        video.playsInline = true; // Important for mobile
        video.src = `./covers/${game.videoBackground}`;

        // Style the video to cover the slide
        video.style.position = 'absolute';
        video.style.top = '0';
        video.style.left = '0';
        video.style.width = '100%';
        video.style.height = '100%';
        video.style.objectFit = 'cover';
        video.style.zIndex = '0';
        video.style.pointerEvents = 'none';

        // Add dark overlay for text readability
        const overlay = document.createElement('div');
        overlay.style.position = 'absolute';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.background = 'linear-gradient(135deg, rgba(0, 0, 0, 0.5) 0%, rgba(0, 0, 0, 0.7) 100%)';
        overlay.style.zIndex = '1';
        overlay.style.pointerEvents = 'none';

        // Make sure slide has relative positioning
        slide.style.position = 'relative';
        slide.style.overflow = 'hidden';

        // Insert video and overlay before other content
        slide.insertBefore(overlay, slide.firstChild);
        slide.insertBefore(video, slide.firstChild);

        // Ensure content is above video
        const gameInfo = slide.querySelector('.game-info');
        const gameCover = slide.querySelector('.game-cover');
        if (gameInfo) gameInfo.style.position = 'relative';
        if (gameInfo) gameInfo.style.zIndex = '2';
        if (gameCover) gameCover.style.position = 'relative';
        if (gameCover) gameCover.style.zIndex = '2';

        // Start playing video when slide becomes active
        if (isActive) {
            video.play().catch(e => console.log('Video autoplay failed:', e));
        }
    } else {
        // Generate gradient from cover image (legacy behavior)
        getImageColors('./covers/' + game.cover, (gradient) => {
            slide.style.background = gradient;
        });
    }

    return slide;
}

// Create indicators
function createIndicators(count) {
    const indicators = document.createElement('div');
    indicators.className = 'carousel-indicators';
    
    for (let i = 0; i < count; i++) {
        const indicator = document.createElement('div');
        indicator.className = `indicator${i === 0 ? ' active' : ''}`;
        indicator.dataset.index = i;
        indicators.appendChild(indicator);
    }
    
    return indicators;
}

// Initialize carousel
let currentSlide = 0;
let slides = [];
let autoPlayInterval;

function showSlide(index) {
    slides.forEach((slide, i) => {
        const isActive = i === index;
        slide.classList.toggle('active', isActive);

        // Control video playback
        const video = slide.querySelector('.carousel-video-bg');
        if (video) {
            if (isActive) {
                // Play video when slide becomes active
                video.play().catch(e => console.log('Video play failed:', e));
            } else {
                // Pause video when slide is not active to save resources
                video.pause();
            }
        }
    });

    const indicators = document.querySelectorAll('.indicator');
    indicators.forEach((indicator, i) => {
        indicator.classList.toggle('active', i === index);
    });

    currentSlide = index;
}

function nextSlide() {
    const next = (currentSlide + 1) % slides.length;
    showSlide(next);
}

function startAutoPlay() {
    autoPlayInterval = setInterval(nextSlide, 4000); // Change slide every 4 seconds
}

function stopAutoPlay() {
    clearInterval(autoPlayInterval);
}

// Load games and initialize carousel
async function loadFeaturedGames() {
    try {
        let manualGames = [];
        let autoGames = [];

        // Load manual featured games (featuredM.json)
        try {
            const manualResponse = await fetch('featuredM.json');
            if (manualResponse.ok) {
                const manualData = await manualResponse.json();
                if (manualData && Array.isArray(manualData) && manualData.length > 0) {
                    // Filter only games where present is true
                    manualGames = manualData
                        .filter(game => game.present === true || game.present === "true")
                        .map(game => ({
                            name: game.name,
                            catagory: game.catagory || game.category || 'Featured',
                            link: game.link,
                            type: game.type,
                            cover: game.cover,
                            videoBackground: game.videoBackground || null, // Optional video background
                            customlink: game.customlink || false, // Check if it's a custom link
                            key: game.name.toLowerCase().replace(/\s+/g, '-'),
                            isManual: true
                        }));
                    console.log('Loaded manual featured games (present: true):', manualGames);
                }
            }
        } catch (manualError) {
            console.log('No manual featured games found or error loading featuredM.json');
        }

        // Always load auto-selected games
        const response = await fetch('games.json');
        const gamesData = await response.json();

        const seed = getYearWeek();
        // If there's a manual game (present: true), show 4 total games (1 manual + 3 auto)
        // If no manual game, show 3 auto games
        const hasManualGame = manualGames.length > 0;
        const autoGamesNeeded = hasManualGame ? 3 : 3;
        autoGames = pickItems(gamesData, autoGamesNeeded, seed);

        console.log('Seed for this week:', seed);
        console.log('Has manual game:', hasManualGame);
        console.log('Auto-selected featured games:', autoGames);

        // Merge manual games first, then auto games
        // This will give us 4 games when manual game exists, 3 games otherwise
        const featuredGames = [...manualGames, ...autoGames];

        console.log('Final featured games lineup:', featuredGames);

        const container = document.getElementById('carouselContainer');
        container.innerHTML = '';

        // Create slides
        featuredGames.forEach((game, index) => {
            const slide = createSlide(game, index, index === 0);
            container.appendChild(slide);
            slides.push(slide);
        });

        // Create indicators
        const indicators = createIndicators(featuredGames.length);
        container.appendChild(indicators);

        // Add click handlers for indicators
        document.querySelectorAll('.indicator').forEach((indicator, index) => {
            indicator.addEventListener('click', () => {
                stopAutoPlay();
                showSlide(index);
                startAutoPlay();
            });
        });

        // Add click handlers for slides (pause on hover)
        slides.forEach(slide => {
            slide.addEventListener('mouseenter', stopAutoPlay);
            slide.addEventListener('mouseleave', startAutoPlay);
        });

        // Start auto-play
        startAutoPlay();

    } catch (error) {
        console.error('Error loading games:', error);
        document.getElementById('carouselContainer').innerHTML = `
            <div class="error">
                Error loading games. Please make sure games.json exists.<br>
                <small>Check the console for more details.</small>
            </div>
        `;
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', loadFeaturedGames);