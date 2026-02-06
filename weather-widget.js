// Weather Widget using Open-Meteo API
// Free weather API - no API key required

(function() {
    'use strict';

    // Configuration
    const CONFIG = {
        WEATHER_API: 'https://api.open-meteo.com/v1/forecast',
        GEOCODING_API: 'https://geocoding-api.open-meteo.com/v1/search',
        REVERSE_GEOCODING_API: 'https://nominatim.openstreetmap.org/reverse',
        IP_GEOLOCATION_API: 'https://ipapi.co/json/', // Free, HTTPS support, 1000 req/day
        UPDATE_INTERVAL: 600000, // 10 minutes
        DEFAULT_LOCATION: {
            name: 'New York',
            latitude: 40.7128,
            longitude: -74.0060
        },
        STORAGE_KEYS: {
            LOCATION: 'weather_location',
            TEMP_UNIT: 'weather_temp_unit',
            LAST_UPDATE: 'weather_last_update',
            LOCATION_METHOD: 'weather_location_method',
            ENABLED: 'weather_enabled',
            EXPANDED_STATE: 'weather_expanded'
        }
    };

    // Weather code to icon mapping (Weather Icons with day/night variants)
    const WEATHER_CODES = {
        0: { day: 'wi-day-sunny', night: 'wi-night-clear', description: 'Clear Sky' },
        1: { day: 'wi-day-sunny-overcast', night: 'wi-night-alt-cloudy', description: 'Mainly Clear' },
        2: { day: 'wi-day-cloudy', night: 'wi-night-alt-cloudy', description: 'Partly Cloudy' },
        3: { day: 'wi-cloudy', night: 'wi-cloudy', description: 'Overcast' },
        45: { day: 'wi-day-fog', night: 'wi-night-fog', description: 'Foggy' },
        48: { day: 'wi-day-fog', night: 'wi-night-fog', description: 'Fog' },
        51: { day: 'wi-day-sprinkle', night: 'wi-night-alt-sprinkle', description: 'Light Drizzle' },
        53: { day: 'wi-day-sprinkle', night: 'wi-night-alt-sprinkle', description: 'Drizzle' },
        55: { day: 'wi-day-rain', night: 'wi-night-alt-rain', description: 'Heavy Drizzle' },
        56: { day: 'wi-day-rain-mix', night: 'wi-night-alt-rain-mix', description: 'Freezing Drizzle' },
        57: { day: 'wi-day-rain-mix', night: 'wi-night-alt-rain-mix', description: 'Heavy Freezing Drizzle' },
        61: { day: 'wi-day-rain', night: 'wi-night-alt-rain', description: 'Light Rain' },
        63: { day: 'wi-day-rain', night: 'wi-night-alt-rain', description: 'Rain' },
        65: { day: 'wi-day-rain', night: 'wi-night-alt-rain', description: 'Heavy Rain' },
        66: { day: 'wi-day-rain-mix', night: 'wi-night-alt-rain-mix', description: 'Freezing Rain' },
        67: { day: 'wi-day-rain-mix', night: 'wi-night-alt-rain-mix', description: 'Heavy Freezing Rain' },
        71: { day: 'wi-day-snow', night: 'wi-night-alt-snow', description: 'Light Snow' },
        73: { day: 'wi-day-snow', night: 'wi-night-alt-snow', description: 'Snow' },
        75: { day: 'wi-day-snow', night: 'wi-night-alt-snow', description: 'Heavy Snow' },
        77: { day: 'wi-day-snow', night: 'wi-night-alt-snow', description: 'Snow Grains' },
        80: { day: 'wi-day-showers', night: 'wi-night-alt-showers', description: 'Light Showers' },
        81: { day: 'wi-day-showers', night: 'wi-night-alt-showers', description: 'Showers' },
        82: { day: 'wi-day-showers', night: 'wi-night-alt-showers', description: 'Heavy Showers' },
        85: { day: 'wi-day-snow', night: 'wi-night-alt-snow', description: 'Snow Showers' },
        86: { day: 'wi-day-snow', night: 'wi-night-alt-snow', description: 'Heavy Snow Showers' },
        95: { day: 'wi-day-thunderstorm', night: 'wi-night-alt-thunderstorm', description: 'Thunderstorm' },
        96: { day: 'wi-day-storm-showers', night: 'wi-night-alt-storm-showers', description: 'Thunderstorm with Hail' },
        99: { day: 'wi-day-storm-showers', night: 'wi-night-alt-storm-showers', description: 'Heavy Thunderstorm' }
    };

    // Determine if it's currently daytime (6am-8pm)
    function isDaytime() {
        const hour = new Date().getHours();
        return hour >= 6 && hour < 20;
    }

    // DOM Elements
    let weatherWidget = null;
    let weatherWidgetContainer = null;
    let updateInterval = null;
    let lastReverseGeocodeTime = 0;
    let locationAttemptInProgress = false;

    // Initialize Weather Widget
    function init() {
        weatherWidget = {
            icon: document.getElementById('weather-icon'),
            condition: document.getElementById('weather-condition'),
            temp: document.getElementById('weather-temp'),
            location: document.getElementById('weather-location'),
            humidity: document.getElementById('weather-humidity'),
            wind: document.getElementById('weather-wind'),
            feelsLike: document.getElementById('weather-feels-like'),
            loading: document.getElementById('weather-loading')
        };

        weatherWidgetContainer = document.getElementById('weather-widget');

        // Check if all elements exist
        if (!weatherWidget.icon || !weatherWidget.temp || !weatherWidgetContainer) {
            console.error('Weather widget elements not found');
            return;
        }

        // Check if weather widget is enabled
        const isEnabled = getWeatherEnabled();
        if (!isEnabled) {
            // Hide the weather widget
            const footerElement = weatherWidgetContainer.closest('.sidenav-footer');
            if (footerElement) {
                footerElement.style.display = 'none';
            }
            return;
        }

        // Setup click toggle
        setupToggle();

        // Restore expanded state
        const isExpanded = getExpandedState();
        if (isExpanded) {
            weatherWidgetContainer.setAttribute('aria-expanded', 'true');
        }

        // Load weather based on location method
        loadWeatherByMethod();

        // Set up auto-update
        updateInterval = setInterval(() => {
            loadWeatherByMethod();
        }, CONFIG.UPDATE_INTERVAL);
    }

    // Load weather based on selected location method
    function loadWeatherByMethod() {
        const method = getLocationMethod();
        const savedLocation = getSavedLocation();

        switch(method) {
            case 'geolocation':
                getUserLocation();
                break;
            case 'ip':
                getIPLocation();
                break;
            case 'manual':
                if (savedLocation) {
                    fetchWeather(savedLocation.latitude, savedLocation.longitude, savedLocation.name);
                } else {
                    // Fallback to default if no manual location set
                    const loc = CONFIG.DEFAULT_LOCATION;
                    fetchWeather(loc.latitude, loc.longitude, loc.name);
                }
                break;
            default:
                // Default to geolocation
                getUserLocation();
        }
    }

    // Get user's location via browser geolocation (GPS/WiFi)
    function getUserLocation() {
        if (locationAttemptInProgress) {
            console.log('Location attempt already in progress, skipping...');
            return;
        }

        if ('geolocation' in navigator) {
            locationAttemptInProgress = true;
            showLoading(true);
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    locationAttemptInProgress = false;
                    const lat = position.coords.latitude;
                    const lon = position.coords.longitude;

                    // Reverse geocode to get location name
                    reverseGeocode(lat, lon).then(name => {
                        saveLocation({ latitude: lat, longitude: lon, name: name });
                        fetchWeather(lat, lon, name);
                    }).catch(error => {
                        console.error('Reverse geocoding failed:', error);
                        // Fallback to "Your Location"
                        const locationName = 'Your Location';
                        saveLocation({ latitude: lat, longitude: lon, name: locationName });
                        fetchWeather(lat, lon, locationName);
                    });
                },
                (error) => {
                    locationAttemptInProgress = false;
                    console.log('Geolocation error:', error.message);
                    // Fallback to default location (do NOT call getIPLocation to avoid infinite loop)
                    const loc = CONFIG.DEFAULT_LOCATION;
                    saveLocation(loc);
                    fetchWeather(loc.latitude, loc.longitude, loc.name);
                }
            );
        } else {
            // Geolocation not supported, use default location
            const loc = CONFIG.DEFAULT_LOCATION;
            saveLocation(loc);
            fetchWeather(loc.latitude, loc.longitude, loc.name);
        }
    }

    // Get user's location via IP address
    async function getIPLocation() {
        if (locationAttemptInProgress) {
            console.log('Location attempt already in progress, skipping...');
            return;
        }

        locationAttemptInProgress = true;
        showLoading(true);
        try {
            // Using ipapi.co - Free tier with HTTPS support
            // 1000 requests per day, no API key needed
            const response = await fetch(CONFIG.IP_GEOLOCATION_API, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`IP geolocation HTTP error: ${response.status}`);
            }

            const data = await response.json();

            // Check for error response
            if (data.error) {
                throw new Error(`IP geolocation error: ${data.reason || 'Unknown error'}`);
            }

            // ipapi.co returns: latitude, longitude, city, region, country_name
            if (data.latitude && data.longitude) {
                const locationName = data.city || data.region || data.country_name || 'Your Location';
                const lat = data.latitude;
                const lon = data.longitude;

                saveLocation({ latitude: lat, longitude: lon, name: locationName });
                fetchWeather(lat, lon, locationName);
                locationAttemptInProgress = false;
            } else {
                throw new Error('IP geolocation data incomplete');
            }
        } catch (error) {
            locationAttemptInProgress = false;
            console.error('IP geolocation error:', error);
            // Fallback to default location (do NOT call getUserLocation to avoid infinite loop)
            const loc = CONFIG.DEFAULT_LOCATION;
            saveLocation(loc);
            fetchWeather(loc.latitude, loc.longitude, loc.name);
        }
    }

    // Reverse geocode coordinates to location name using Nominatim (OpenStreetMap)
    async function reverseGeocode(lat, lon) {
        try {
            // Rate limiting: Nominatim requires max 1 request per second
            const now = Date.now();
            const timeSinceLastRequest = now - lastReverseGeocodeTime;
            if (timeSinceLastRequest < 1000) {
                // Wait for the remaining time
                await new Promise(resolve => setTimeout(resolve, 1000 - timeSinceLastRequest));
            }
            lastReverseGeocodeTime = Date.now();

            const params = new URLSearchParams({
                lat: lat,
                lon: lon,
                format: 'json',
                zoom: 10, // City level
                addressdetails: 1
            });

            const response = await fetch(
                `${CONFIG.REVERSE_GEOCODING_API}?${params}`,
                {
                    headers: {
                        'User-Agent': 'QZ-Games-Weather-Widget/1.0' // Required by Nominatim
                    }
                }
            );

            if (!response.ok) {
                throw new Error('Reverse geocoding request failed');
            }

            const data = await response.json();

            // Try to get the most appropriate location name
            if (data.address) {
                const addr = data.address;
                // Prefer city, town, or village names
                const locationName = addr.city ||
                                    addr.town ||
                                    addr.village ||
                                    addr.county ||
                                    addr.state ||
                                    'Your Location';
                return locationName;
            }

            return 'Your Location';
        } catch (error) {
            console.error('Reverse geocoding error:', error);
            return 'Your Location';
        }
    }

    // Fetch weather data from Open-Meteo
    async function fetchWeather(latitude, longitude, locationName) {
        showLoading(true);

        try {
            const tempUnit = getTempUnit();
            const windSpeedUnit = tempUnit === 'fahrenheit' ? 'mph' : 'kmh';

            const params = new URLSearchParams({
                latitude: latitude,
                longitude: longitude,
                current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weathercode,windspeed_10m',
                temperature_unit: tempUnit,
                windspeed_unit: windSpeedUnit
            });

            const response = await fetch(`${CONFIG.WEATHER_API}?${params}`);

            if (!response.ok) {
                throw new Error('Weather API request failed');
            }

            const data = await response.json();

            if (data.current) {
                updateWeatherDisplay(data.current, locationName);
                saveLastUpdate();
            } else {
                throw new Error('Invalid weather data');
            }
        } catch (error) {
            console.error('Weather fetch error:', error);
            showError();
        } finally {
            showLoading(false);
        }
    }

    // Track previous icon for animation detection
    let previousIconClass = '';

    // Update weather display with fetched data (with smooth animations)
    function updateWeatherDisplay(weatherData, locationName) {
        const weatherCode = weatherData.weathercode || 0;
        const weatherInfo = WEATHER_CODES[weatherCode] || WEATHER_CODES[0];
        const tempUnit = getTempUnit() === 'celsius' ? '°C' : '°F';
        const windUnit = getTempUnit() === 'fahrenheit' ? 'mph' : 'km/h';

        // Determine day or night icon
        const isDay = isDaytime();
        const newIconClass = isDay ? weatherInfo.day : weatherInfo.night;
        const iconChanged = previousIconClass && previousIconClass !== newIconClass;

        // Function to update all content
        const updateContent = () => {
            // Fade out text content
            if (weatherWidget.temp) weatherWidget.temp.style.opacity = '0';
            if (weatherWidget.condition) weatherWidget.condition.style.opacity = '0';

            setTimeout(() => {
                // Update temperature
                if (weatherWidget.temp) {
                    const temp = Math.round(weatherData.temperature_2m);
                    weatherWidget.temp.textContent = `${temp}${tempUnit}`;
                    weatherWidget.temp.style.opacity = '1';
                }

                // Update condition
                if (weatherWidget.condition) {
                    weatherWidget.condition.textContent = weatherInfo.description;
                    weatherWidget.condition.style.opacity = '1';
                }

                // Update location
                if (weatherWidget.location) {
                    weatherWidget.location.textContent = locationName || 'Unknown';
                }

                // Update humidity
                if (weatherWidget.humidity) {
                    weatherWidget.humidity.textContent = `${Math.round(weatherData.relative_humidity_2m)}%`;
                }

                // Update wind speed
                if (weatherWidget.wind) {
                    const windSpeed = Math.round(weatherData.windspeed_10m);
                    weatherWidget.wind.textContent = `${windSpeed} ${windUnit}`;
                }

                // Update feels like
                if (weatherWidget.feelsLike) {
                    const feelsLike = Math.round(weatherData.apparent_temperature);
                    weatherWidget.feelsLike.textContent = `${feelsLike}${tempUnit}`;
                }
            }, 150);
        };

        // Update icon with animation if changed
        if (weatherWidget.icon) {
            if (iconChanged) {
                // Icon is changing - animate the transition
                // Step 1: Exit animation (slide left + fade out)
                weatherWidget.icon.classList.add('icon-exit');

                setTimeout(() => {
                    // Step 2: Update the icon class
                    weatherWidget.icon.className = 'wi weather-icon ' + newIconClass;

                    // Step 3: Enter animation (slide in from right + fade in)
                    weatherWidget.icon.classList.add('icon-enter');

                    // Step 4: Clean up animation classes
                    setTimeout(() => {
                        weatherWidget.icon.classList.remove('icon-enter');
                    }, 300);
                }, 300);

                previousIconClass = newIconClass;
            } else {
                // First load or same icon - just set it without animation
                weatherWidget.icon.className = 'wi weather-icon ' + newIconClass;
                previousIconClass = newIconClass;
            }
        }

        // Update all other content
        updateContent();

        // Dispatch event for greeting banner to sync
        window.dispatchEvent(new CustomEvent('weatherUpdated', {
            detail: {
                weatherCode: weatherCode,
                condition: weatherInfo.description,
                iconClass: newIconClass,
                temperature: weatherData.temperature_2m,
                location: locationName
            }
        }));
    }

    // Show/hide loading state
    function showLoading(isLoading) {
        if (weatherWidget.loading) {
            weatherWidget.loading.style.display = isLoading ? 'flex' : 'none';
        }

        const container = document.querySelector('.weather-widget');
        if (container) {
            container.style.opacity = isLoading ? '0.5' : '1';
        }
    }

    // Show error state
    function showError() {
        if (weatherWidget.condition) {
            weatherWidget.condition.textContent = 'Unable to load weather';
        }
        if (weatherWidget.temp) {
            weatherWidget.temp.textContent = '--°';
        }
        if (weatherWidget.location) {
            weatherWidget.location.textContent = 'Error';
        }
    }

    // LocalStorage helpers
    function saveLocation(location) {
        try {
            localStorage.setItem(CONFIG.STORAGE_KEYS.LOCATION, JSON.stringify(location));
        } catch (e) {
            console.error('Failed to save location:', e);
        }
    }

    function getSavedLocation() {
        try {
            const saved = localStorage.getItem(CONFIG.STORAGE_KEYS.LOCATION);
            return saved ? JSON.parse(saved) : null;
        } catch (e) {
            console.error('Failed to get saved location:', e);
            return null;
        }
    }

    function getTempUnit() {
        try {
            return localStorage.getItem(CONFIG.STORAGE_KEYS.TEMP_UNIT) || 'fahrenheit';
        } catch (e) {
            return 'fahrenheit';
        }
    }

    function saveLastUpdate() {
        try {
            localStorage.setItem(CONFIG.STORAGE_KEYS.LAST_UPDATE, Date.now().toString());
        } catch (e) {
            console.error('Failed to save last update:', e);
        }
    }

    function getWeatherEnabled() {
        try {
            const value = localStorage.getItem(CONFIG.STORAGE_KEYS.ENABLED);
            return value === 'false' ? false : true; // Default to true
        } catch (e) {
            return true;
        }
    }

    function getLocationMethod() {
        try {
            return localStorage.getItem(CONFIG.STORAGE_KEYS.LOCATION_METHOD) || 'ip';
        } catch (e) {
            return 'ip';
        }
    }

    function getExpandedState() {
        try {
            return localStorage.getItem(CONFIG.STORAGE_KEYS.EXPANDED_STATE) === 'true';
        } catch (e) {
            return false;
        }
    }

    function saveExpandedState(isExpanded) {
        try {
            localStorage.setItem(CONFIG.STORAGE_KEYS.EXPANDED_STATE, isExpanded.toString());
        } catch (e) {
            console.error('Failed to save expanded state:', e);
        }
    }

    // Setup click toggle for expand/collapse
    function setupToggle() {
        if (!weatherWidgetContainer) return;

        const toggleWidget = (e) => {
            // Prevent default if Enter or Space key
            if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') {
                return;
            }
            if (e.type === 'keydown') {
                e.preventDefault();
            }

            const isExpanded = weatherWidgetContainer.getAttribute('aria-expanded') === 'true';
            const newState = !isExpanded;

            weatherWidgetContainer.setAttribute('aria-expanded', newState.toString());
            saveExpandedState(newState);
        };

        weatherWidgetContainer.addEventListener('click', toggleWidget);
        weatherWidgetContainer.addEventListener('keydown', toggleWidget);
    }

    // Expose function to update weather settings (called from settings page)
    window.updateWeatherSettings = function() {
        // Check if weather widget is enabled
        const isEnabled = getWeatherEnabled();
        const footerElement = weatherWidgetContainer ? weatherWidgetContainer.closest('.sidenav-footer') : null;

        if (!isEnabled) {
            // Hide the weather widget
            if (footerElement) {
                footerElement.style.display = 'none';
            }
            return;
        } else {
            // Show the weather widget
            if (footerElement) {
                footerElement.style.display = '';
            }
        }

        // Reload weather based on current settings
        loadWeatherByMethod();
    };

    // Debug function: Set weather condition manually for testing
    // Usage: setWeather('rain'), setWeather('snow'), setWeather('sunny'), etc.
    window.setWeather = function(condition) {
        // Friendly name to WMO code mapping
        const conditionMap = {
            'clear': 0,
            'sunny': 0,
            'clear-sky': 0,
            'mainly-clear': 1,
            'partly-cloudy': 2,
            'cloudy': 3,
            'overcast': 3,
            'fog': 45,
            'foggy': 45,
            'drizzle': 53,
            'light-drizzle': 51,
            'heavy-drizzle': 55,
            'rain': 63,
            'light-rain': 61,
            'heavy-rain': 65,
            'freezing-rain': 66,
            'snow': 73,
            'light-snow': 71,
            'heavy-snow': 75,
            'showers': 81,
            'light-showers': 80,
            'heavy-showers': 82,
            'snow-showers': 85,
            'thunderstorm': 95,
            'thunder': 95,
            'storm': 95,
            'hail': 96
        };

        const code = conditionMap[condition.toLowerCase()];
        if (code === undefined) {
            console.error('Unknown weather condition:', condition);
            console.log('Available conditions:', Object.keys(conditionMap).join(', '));
            return;
        }

        // Create mock weather data
        const mockData = {
            weathercode: code,
            temperature_2m: 72,
            relative_humidity_2m: 65,
            apparent_temperature: 70,
            windspeed_10m: 8
        };

        console.log(`Setting weather to: ${condition} (WMO code ${code})`);
        updateWeatherDisplay(mockData, 'Debug Location');
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        if (updateInterval) {
            clearInterval(updateInterval);
        }
    });

})();
