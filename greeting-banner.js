// Greeting Banner - Time-based greeting with weather integration
// Displays personalized greeting based on time of day + current weather

(function() {
    'use strict';

    // DOM Elements
    let greetingBanner = null;
    let greetingText = null;
    let greetingWeatherIcon = null;
    let greetingWeatherCondition = null;
    let previousIconClass = '';
    let currentGreetingPeriod = '';

    // Initialize greeting banner
    function init() {
        greetingBanner = document.getElementById('greeting-banner');
        greetingText = document.querySelector('.greeting-text');
        greetingWeatherIcon = document.getElementById('greeting-weather-icon');
        greetingWeatherCondition = document.getElementById('greeting-weather-condition');

        if (!greetingBanner || !greetingText || !greetingWeatherIcon || !greetingWeatherCondition) {
            console.error('Greeting banner elements not found');
            return;
        }

        // Set initial greeting
        updateGreeting();

        // Listen for weather updates from weather widget
        window.addEventListener('weatherUpdated', handleWeatherUpdate);

        // Check for time period changes every minute
        setInterval(checkTimeUpdate, 60000);
    }

    // Get greeting based on current time
    function getGreeting() {
        const hour = new Date().getHours();

        if (hour >= 5 && hour < 12) {
            return { text: 'Good Morning!', period: 'morning' };
        } else if (hour >= 12 && hour < 17) {
            return { text: 'Good Afternoon!', period: 'afternoon' };
        } else if (hour >= 17 && hour < 21) {
            return { text: 'Good Evening!', period: 'evening' };
        } else {
            return { text: 'Good Night!', period: 'night' };
        }
    }

    // Determine if it's daytime (for weather icon selection)
    function isDaytime() {
        const hour = new Date().getHours();
        return hour >= 6 && hour < 20;
    }

    // Update greeting text
    function updateGreeting() {
        const greeting = getGreeting();

        // Only update if greeting period changed
        if (greeting.period !== currentGreetingPeriod) {
            currentGreetingPeriod = greeting.period;

            // Fade out, update, fade in
            if (greetingText) {
                greetingText.style.opacity = '0';
                setTimeout(() => {
                    greetingText.textContent = greeting.text;
                    greetingText.style.opacity = '1';
                }, 150);
            }
        }
    }

    // Check if time period has changed
    function checkTimeUpdate() {
        updateGreeting();
    }

    // Handle weather updates from weather widget
    function handleWeatherUpdate(event) {
        const data = event.detail;
        if (!data) return;

        const iconClass = data.iconClass;
        const condition = data.condition;

        // Update weather icon with animation if it changed
        updateWeatherIcon(iconClass);

        // Update condition text
        updateConditionText(condition);
    }

    // Update weather icon with smooth transition
    function updateWeatherIcon(newIconClass) {
        if (!greetingWeatherIcon) return;

        const iconChanged = previousIconClass && previousIconClass !== newIconClass;

        if (iconChanged) {
            // Icon is changing - animate the transition
            // Step 1: Exit animation (slide left + fade out)
            greetingWeatherIcon.classList.add('icon-exit');

            setTimeout(() => {
                // Step 2: Update the icon class
                greetingWeatherIcon.className = 'wi greeting-weather-icon ' + newIconClass;

                // Step 3: Enter animation (slide in from right + fade in)
                greetingWeatherIcon.classList.add('icon-enter');

                // Step 4: Clean up animation classes
                setTimeout(() => {
                    greetingWeatherIcon.classList.remove('icon-enter');
                }, 300);
            }, 300);

            previousIconClass = newIconClass;
        } else if (!previousIconClass) {
            // First load - just set it without animation
            greetingWeatherIcon.className = 'wi greeting-weather-icon ' + newIconClass;
            previousIconClass = newIconClass;
        }
    }

    // Update condition text with fade transition
    function updateConditionText(condition) {
        if (!greetingWeatherCondition) return;

        // Fade out
        greetingWeatherCondition.style.opacity = '0';

        setTimeout(() => {
            // Update text
            greetingWeatherCondition.textContent = condition;

            // Fade in
            greetingWeatherCondition.style.opacity = '1';
        }, 150);
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
