
let currentIndex = 0;
let totalItems = 0;
let autoPlayInterval;
let isAutoPlaying = true;
let autoPlaySpeed = 6000; // 4 seconds default
let progressInterval;

// Function to load JSON data
async function loadFeaturedItems() {
    try {
        // Replace this with actual fetch to your JSON file
        const response = await fetch('../music/featured.json');
        const data = await response.json();
        
        
        createFeaturedItems(data);
    } catch (error) {
        console.error('Error loading featured items:', error);
        document.getElementById('container').innerHTML = '<div class="loading">Error loading items</div>';
    }
}

function createFeaturedItems(data) {
    const container = document.getElementById('container');
    const items = Object.entries(data);
    totalItems = items.length;
    
    // Create the scrolling track
    const track = document.createElement('div');
    track.className = 'featured-track';
    track.id = 'featured-track';
    
    // Create items
    items.forEach(([key, item]) => {
        const featuredItem = document.createElement('div');
        featuredItem.className = 'featureditem';
        featuredItem.onclick = () => navigateToPage('home', item.page, '../music/assets/albums/' + item.file);
        
        featuredItem.innerHTML = `
            <div class="informationft">
                <h1>${item.name}</h1>
                <p>${item.artist}</p>
            </div>
            <img class="ftcovercenter" src="../music/assets/covers/${item.cover}"/>
            <div class="backgroundpicc" style="background-image: url('../music/assets/covers/${item.cover}')">
            </div>
        `;
        
        track.appendChild(featuredItem);
    });
    
    container.innerHTML = '';
    container.appendChild(track);
    
    createIndicators();
    updateCarousel();
    startAutoPlay();
}

function createIndicators() {
    const indicatorsContainer = document.getElementById('indicators');
    indicatorsContainer.innerHTML = '';
    
    for (let i = 0; i < totalItems; i++) {
        const indicator = document.createElement('div');
        indicator.className = 'indicator';
        indicator.onclick = () => goToItem(i);
        
        // Create progress ring for active indicator
        const progressRing = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        progressRing.className = 'progress-ring';
        progressRing.innerHTML = `
            <circle class="progress-circle" cx="8" cy="8" r="7"></circle>
        `;
        
        indicator.appendChild(progressRing);
        indicatorsContainer.appendChild(indicator);
    }
}

function updateCarousel() {
    const track = document.getElementById('featured-track');
    if (!track) return;
    
    // Move the track
    track.style.transform = `translateX(-${currentIndex * 520}px)`;
    
    // Update indicators
    const indicators = document.querySelectorAll('.indicator');
    indicators.forEach((indicator, index) => {
        indicator.classList.toggle('active', index === currentIndex);
    });
    
    updateProgress();
}

function updateProgress() {
    const indicators = document.querySelectorAll('.indicator');
    const activeIndicator = indicators[currentIndex];
    
    if (activeIndicator && isAutoPlaying) {
        const circle = activeIndicator.querySelector('.progress-circle');
        let progress = 0;
        const increment = 100 / (autoPlaySpeed / 100);
        
        clearInterval(progressInterval);
        circle.style.strokeDashoffset = '44';
        
        progressInterval = setInterval(() => {
            progress += increment;
            const offset = 44 - (44 * progress / 100);
            circle.style.strokeDashoffset = offset;
            
            if (progress >= 100) {
                clearInterval(progressInterval);
            }
        }, 100);
    }
}

function nextItem() {
    currentIndex = (currentIndex + 1) % totalItems;
    updateCarousel();
    resetAutoPlay();
}

function previousItem() {
    currentIndex = (currentIndex - 1 + totalItems) % totalItems;
    updateCarousel();
    resetAutoPlay();
}

function goToItem(index) {
    currentIndex = index;
    updateCarousel();
    resetAutoPlay();
}

function startAutoPlay() {
    if (!isAutoPlaying) return;
    
    autoPlayInterval = setInterval(() => {
        nextItem();
    }, autoPlaySpeed);
}

function stopAutoPlay() {
    clearInterval(autoPlayInterval);
    clearInterval(progressInterval);
}

function resetAutoPlay() {
    stopAutoPlay();
    if (isAutoPlaying) {
        startAutoPlay();
    }
}

function toggleAutoPlay() {
    isAutoPlaying = !isAutoPlaying;
    const playBtn = document.getElementById('playBtn');
    
    if (isAutoPlaying) {
        startAutoPlay();
        playBtn.textContent = 'Pause';
    } else {
        stopAutoPlay();
        playBtn.textContent = 'Play';
    }
}

function setSpeed(speed) {
    autoPlaySpeed = speed;
    
    // Update active button
    document.querySelectorAll('.control-btn[id^="speed"]').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById(`speed${speed/1000}s`).classList.add('active');
    
    resetAutoPlay();
}



// Pause on hover
document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('container');
    
    container.addEventListener('mouseenter', () => {
        if (isAutoPlaying) {
            stopAutoPlay();
        }
    });
    
    container.addEventListener('mouseleave', () => {
        if (isAutoPlaying) {
            startAutoPlay();
        }
    });
});

// Initialize the component
loadFeaturedItems();