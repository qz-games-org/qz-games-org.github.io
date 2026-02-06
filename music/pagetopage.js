// Navigation history stack
window.navigationHistory = window.navigationHistory || [];
window.currentPage = window.currentPage || 'home';

// Page name mapping
const pageNames = {
    'home': 'Home',
    'music-containerr': 'Songs',
    'playlist-containerr': 'Playlists',
    'settings': 'Settings'
};

window.navigateToPage = function(from, page, file) {
    console.log(`Navigating to: ${page}`);

    const fromp = document.getElementById(from);
    const top = document.getElementById(page);
    const filee = document.getElementById(file);

    // Update navigation history
    if (window.currentPage !== page) {
        window.navigationHistory.push(window.currentPage);
        window.currentPage = page;
        updateBackButton();
        updatePageIndicator(pageNames[page] || page);
    }

    function waitForAnimation(element) {
        return new Promise((resolve) => {
            if (!element) {
                resolve();
                return;
            }

            const handleAnimationEnd = () => {
                element.removeEventListener('animationend', handleAnimationEnd);
                resolve();
            };

            // Check if element has any running animations
            const computedStyle = getComputedStyle(element);
            if (computedStyle.animationName === 'none' || computedStyle.animationDuration === '0s') {
                resolve();
                return;
            }

            element.addEventListener('animationend', handleAnimationEnd);
        });
    }

    // Reset animation on from element and wait for it to complete
    async function executeNavigation() {
        if (fromp) {
            fromp.style.animation = "pageout 0.5s";
            await waitForAnimation(fromp);
            fromp.style.display = 'none';
            fromp.style.opacity = 0;
        }

        // Add your additional animation logic here
        // For example, if you want to animate the 'to' page:
        if (top) {
            top.style.opacity = 1;
            top.style.display = 'block';
            top.style.animation = "pagein 0.5s";
            await waitForAnimation(top);
        }

        console.log("All animations completed");
    }

    // Execute the navigation with animation waits
    executeNavigation().catch(console.error);
};

// Navigate back function
window.navigateBack = function() {
    if (window.navigationHistory.length === 0) {
        console.log('No history to go back to');
        return;
    }

    const previousPage = window.navigationHistory.pop();
    const currentPageId = window.currentPage;

    window.currentPage = previousPage;
    updateBackButton();
    updatePageIndicator(pageNames[previousPage] || previousPage);

    const fromp = document.getElementById(currentPageId);
    const top = document.getElementById(previousPage);

    function waitForAnimation(element) {
        return new Promise((resolve) => {
            if (!element) {
                resolve();
                return;
            }

            const handleAnimationEnd = () => {
                element.removeEventListener('animationend', handleAnimationEnd);
                resolve();
            };

            const computedStyle = getComputedStyle(element);
            if (computedStyle.animationName === 'none' || computedStyle.animationDuration === '0s') {
                resolve();
                return;
            }

            element.addEventListener('animationend', handleAnimationEnd);
        });
    }

    async function executeBackNavigation() {
        if (fromp) {
            fromp.style.animation = "pageout 0.5s";
            await waitForAnimation(fromp);
            fromp.style.display = 'none';
            fromp.style.opacity = 0;
        }

        if (top) {
            top.style.opacity = 1;
            top.style.display = 'block';
            top.style.animation = "pagein 0.5s";
            await waitForAnimation(top);
        }

        console.log("Back navigation completed");
    }

    executeBackNavigation().catch(console.error);
};

// Update back button visibility
function updateBackButton() {
    const backBtn = document.getElementById('nav-back-btn');
    if (!backBtn) return;

    if (window.navigationHistory.length > 0) {
        backBtn.style.display = 'flex';
    } else {
        backBtn.style.display = 'none';
    }
}

// Track which element is currently active
let activeElement = 1;

// Update page indicator with slide animation
function updatePageIndicator(pageName) {
    const content1 = document.getElementById('nav-page-content-1');
    const content2 = document.getElementById('nav-page-content-2');

    if (!content1 || !content2) return;

    // Determine which element is currently active and which is inactive
    const currentElement = activeElement === 1 ? content1 : content2;
    const nextElement = activeElement === 1 ? content2 : content1;
    const nextNameElement = nextElement.querySelector('.nav-page-name');

    // Update the inactive element's text
    nextNameElement.textContent = pageName;

    // Reset the next element - remove all positioning classes first
    nextElement.classList.remove('slide-left', 'slide-center', 'slide-right', 'inactive', 'active');

    // Force positioning to right without transition
    nextElement.style.transition = 'none';
    nextElement.classList.add('slide-right');

    // Force a reflow to ensure the position is set
    void nextElement.offsetWidth;

    // Re-enable transitions
    nextElement.style.transition = '';
    nextElement.classList.add('active');

    // Small delay to ensure positioning is applied before animation
    requestAnimationFrame(() => {
        // Slide current element to the left and fade out
        currentElement.classList.remove('slide-center', 'active');
        currentElement.classList.add('slide-left', 'inactive');

        // Slide next element to center and fade in
        nextElement.classList.remove('slide-right');
        nextElement.classList.add('slide-center');
    });

    // Toggle active element for next animation
    activeElement = activeElement === 1 ? 2 : 1;
}

// Initialize back button listener
document.addEventListener('DOMContentLoaded', () => {
    const backBtn = document.getElementById('nav-back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', window.navigateBack);
    }

    // Initialize with home page
    window.currentPage = 'home';
    window.navigationHistory = [];
    updateBackButton();

    // Initialize the first page indicator element
    const content1 = document.getElementById('nav-page-content-1');
    const content2 = document.getElementById('nav-page-content-2');
    if (content1 && content2) {
        content1.classList.add('slide-center', 'active');
        content2.classList.add('slide-right', 'inactive');
    }
});