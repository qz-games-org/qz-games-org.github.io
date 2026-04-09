(function() {
  document.addEventListener('DOMContentLoaded', () => {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const sections = document.querySelectorAll('.section');

    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        tabButtons.forEach(btn => btn.classList.remove('active'));
        sections.forEach(section => section.classList.remove('active'));
        button.classList.add('active');
        const target = button.getAttribute('data-target');
        document.getElementById(target).classList.add('active');
      });
    });

    const themeOptions = document.querySelectorAll('.theme-option');
    themeOptions.forEach(option => {
      option.addEventListener('click', () => {
        themeOptions.forEach(opt => opt.classList.remove('active'));
        option.classList.add('active');
        setCookie('theme', option.getAttribute('data-theme'));
        applyTheme(option.getAttribute('data-theme'));
      });
    });

    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const navMenu = document.querySelector('.settings-nav');
    if (mobileMenuToggle) {
      mobileMenuToggle.addEventListener('click', () => {
        navMenu.classList.toggle('show');
        const menuIcon = mobileMenuToggle.querySelector('.material-icons');
        menuIcon.textContent = navMenu.classList.contains('show') ? 'close' : 'menu';
      });
    }

    const interfaceSlider = document.getElementById('interface-size');
    const rangeValue = document.querySelector('.range-value');
    if (interfaceSlider && rangeValue) {
      interfaceSlider.addEventListener('input', () => {
        rangeValue.textContent = `${interfaceSlider.value}%`;
      });
    }

    const preventPageClose = document.getElementById('checkprevent');
    if (preventPageClose) {
      preventPageClose.checked = getCookie('preventPageClose') === 'true';
      preventPageClose.addEventListener('change', () => {
        setCookie('preventPageClose', preventPageClose.checked);
        if (preventPageClose.checked) {
          enablePreventPageClose();
        } else {
          disablePreventPageClose();
        }
      });

      if (preventPageClose.checked) {
        enablePreventPageClose();
      }
    }

    loadSavedPreferences();
  });

  function applyTheme(theme) {
    console.log(`Theme applied: ${theme}`);
  }

  function applyBackground(background) {
    console.log(`Background applied: ${background}`);
  }

  function enablePreventPageClose() {
    if (window.QZGlobalPageGuards && typeof window.QZGlobalPageGuards.enablePreventPageClose === 'function') {
      window.QZGlobalPageGuards.enablePreventPageClose();
      return;
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
  }

  function disablePreventPageClose() {
    if (window.QZGlobalPageGuards && typeof window.QZGlobalPageGuards.disablePreventPageClose === 'function') {
      window.QZGlobalPageGuards.disablePreventPageClose();
      return;
    }

    window.removeEventListener('beforeunload', handleBeforeUnload);
  }

  function handleBeforeUnload(event) {
    event.preventDefault();
    event.returnValue = '';
    return '';
  }

  function applyInterfaceSize(size) {
    document.documentElement.style.setProperty('--ui-scale', `${size / 100}`);
    console.log(`Interface size set to ${size}%`);
  }

  window.addEventListener('resize', handleWindowResize);

  function handleWindowResize() {
    const isMobile = window.innerWidth <= 768;
    const navMenu = document.querySelector('.settings-nav');

    if (!isMobile && navMenu) {
      navMenu.classList.remove('show');
      const menuIcon = document.querySelector('.mobile-menu-toggle .material-icons');
      if (menuIcon) {
        menuIcon.textContent = 'menu';
      }
    }
  }

  function loadSavedPreferences() {
    const savedTheme = getCookie('theme');
    if (savedTheme) {
      const themeElement = document.querySelector(`[data-theme="${savedTheme}"]`);
      if (themeElement) {
        themeElement.click();
      }
    }

    const disab = document.getElementById('disab');
    if (disab) {
      disab.checked = getCookie('disableAnimations') === 'true';
      disab.addEventListener('change', () => {
        setCookie('disableAnimations', disab.checked);
      });
    }

    const reduceEffects = document.getElementById('reduceEffects');
    if (reduceEffects) {
      const saved = localStorage.getItem('reduceVisualEffects') === 'true';
      reduceEffects.checked = saved;
      if (saved) {
        document.body.classList.add('reduce-effects');
      }
      reduceEffects.addEventListener('change', () => {
        localStorage.setItem('reduceVisualEffects', reduceEffects.checked);
        if (reduceEffects.checked) {
          document.body.classList.add('reduce-effects');
        } else {
          document.body.classList.remove('reduce-effects');
        }
      });
    }

    const customBackgrounds = document.getElementById('customBackgrounds');
    if (customBackgrounds) {
      customBackgrounds.checked = getCookie('customBackgrounds') !== 'false';
      customBackgrounds.addEventListener('change', () => {
        setCookie('customBackgrounds', customBackgrounds.checked);
      });
    }

    const weatherEnabledToggle = document.getElementById('weatherEnabledToggle');
    const weatherLocationMethod = document.getElementById('weatherLocationMethod');
    const weatherTempUnit = document.getElementById('weatherTempUnit');
    const weatherLocationDisplay = document.getElementById('weatherLocation');
    const weatherLastUpdate = document.getElementById('weatherLastUpdate');
    const refreshWeatherBtn = document.getElementById('refreshWeatherBtn');

    function updateWeatherInfo() {
      const savedLocation = localStorage.getItem('weather_location');
      const lastUpdate = localStorage.getItem('weather_last_update');

      if (savedLocation) {
        try {
          const location = JSON.parse(savedLocation);
          weatherLocationDisplay.textContent = location.name || 'Unknown';
        } catch (e) {
          weatherLocationDisplay.textContent = 'Unknown';
        }
      } else {
        weatherLocationDisplay.textContent = 'Not set';
      }

      if (lastUpdate) {
        const date = new Date(parseInt(lastUpdate));
        weatherLastUpdate.textContent = date.toLocaleString();
      } else {
        weatherLastUpdate.textContent = 'Never';
      }
    }

    if (weatherEnabledToggle) {
      const enabled = localStorage.getItem('weather_enabled');
      weatherEnabledToggle.checked = enabled === 'false' ? false : true;
      weatherEnabledToggle.addEventListener('change', () => {
        localStorage.setItem('weather_enabled', weatherEnabledToggle.checked.toString());
        if (typeof window.updateWeatherSettings === 'function') {
          window.updateWeatherSettings();
        }
      });
    }

    if (weatherLocationMethod) {
      const savedMethod = localStorage.getItem('weather_location_method') || 'ip';
      weatherLocationMethod.value = savedMethod;
      weatherLocationMethod.addEventListener('change', () => {
        localStorage.setItem('weather_location_method', weatherLocationMethod.value);
        if (typeof window.updateWeatherSettings === 'function') {
          window.updateWeatherSettings();
        }
      });
    }

    if (weatherTempUnit) {
      const savedUnit = localStorage.getItem('weather_temp_unit') || 'fahrenheit';
      weatherTempUnit.value = savedUnit;
      weatherTempUnit.addEventListener('change', () => {
        localStorage.setItem('weather_temp_unit', weatherTempUnit.value);
        if (typeof window.updateWeatherSettings === 'function') {
          window.updateWeatherSettings();
        }
      });
    }

    if (weatherLocationDisplay && weatherLastUpdate) {
      updateWeatherInfo();
    }

    if (refreshWeatherBtn) {
      refreshWeatherBtn.addEventListener('click', () => {
        if (typeof window.updateWeatherSettings === 'function') {
          window.updateWeatherSettings();
        }
        setTimeout(() => {
          updateWeatherInfo();
        }, 1000);
      });
    }

    const backgroundOptions = document.querySelectorAll('[data-background]');
    const savedBackground = getCookie('selectedBackground') || 'none';
    backgroundOptions.forEach(option => {
      if (option.getAttribute('data-background') === savedBackground) {
        option.classList.add('active');
      } else {
        option.classList.remove('active');
      }
    });

    backgroundOptions.forEach(option => {
      option.addEventListener('click', () => {
        backgroundOptions.forEach(opt => opt.classList.remove('active'));
        option.classList.add('active');
        const selectedBackground = option.getAttribute('data-background');
        setCookie('selectedBackground', selectedBackground);
        if (customBackgrounds && customBackgrounds.checked) {
          applyBackground(selectedBackground);
        }
      });
    });

    const soundEffectsToggle = document.getElementById('soundeffects');
    if (soundEffectsToggle) {
      const savedSoundEffects = localStorage.getItem('enableSoundEffects');
      soundEffectsToggle.checked = savedSoundEffects === null ? true : savedSoundEffects === 'true';
      soundEffectsToggle.addEventListener('change', () => {
        localStorage.setItem('enableSoundEffects', soundEffectsToggle.checked);
      });
    }

    const interfaceSizeSlider = document.getElementById('interface-size');
    if (interfaceSizeSlider) {
      const savedSize = localStorage.getItem('interfaceSize');
      if (savedSize) {
        interfaceSizeSlider.value = savedSize;
        document.querySelector('.range-value').textContent = `${savedSize}%`;
        applyInterfaceSize(savedSize);
      }

      interfaceSizeSlider.addEventListener('change', () => {
        const newSize = interfaceSizeSlider.value;
        localStorage.setItem('interfaceSize', newSize);
        applyInterfaceSize(newSize);
      });
    }

    const enableCacheToggle = document.getElementById('enableCache');
    const clearCacheBtn = document.getElementById('clearCacheBtn');
    const updateSwBtn = document.getElementById('updateSwBtn');
    const refreshCacheInfoBtn = document.getElementById('refreshCacheInfoBtn');
    const cacheSizeEl = document.getElementById('cacheSize');
    const swStatusEl = document.getElementById('swStatus');

    const cacheEnabled = localStorage.getItem('cacheEnabled') === 'true';
    if (enableCacheToggle) {
      enableCacheToggle.checked = cacheEnabled;
      enableCacheToggle.addEventListener('change', async () => {
        const enabled = enableCacheToggle.checked;
        localStorage.setItem('cacheEnabled', enabled);
        if (!enabled) {
          await clearAllCaches();
          updateCacheInfo();
        }

        issuenote(
          enabled ? 'Caching Enabled' : 'Caching Disabled',
          enabled ? 'Caching has been enabled. Reload the page to apply changes.' : 'Caching has been disabled and cache cleared.',
          true,
          'cache'
        );
      });
    }

    async function calculateCacheSize() {
      try {
        if (!('caches' in window)) {
          return 'Not supported';
        }

        const cacheNames = await caches.keys();
        let totalSize = 0;

        for (const cacheName of cacheNames) {
          const cache = await caches.open(cacheName);
          const keys = await cache.keys();
          for (const request of keys) {
            const response = await cache.match(request);
            if (response) {
              const blob = await response.blob();
              totalSize += blob.size;
            }
          }
        }

        if (totalSize === 0) return '0 KB';
        if (totalSize < 1024) return `${totalSize} bytes`;
        if (totalSize < 1024 * 1024) return `${(totalSize / 1024).toFixed(2)} KB`;
        return `${(totalSize / (1024 * 1024)).toFixed(2)} MB`;
      } catch (error) {
        return 'Error calculating';
      }
    }

    async function getServiceWorkerStatus() {
      try {
        if (!('serviceWorker' in navigator)) {
          return 'Not supported';
        }

        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration) {
          return 'Not registered';
        }

        if (registration.active) return 'Active';
        if (registration.installing) return 'Installing';
        if (registration.waiting) return 'Waiting';
        return 'Unknown';
      } catch (error) {
        return 'Error';
      }
    }

    async function updateCacheInfo() {
      if (cacheSizeEl) {
        cacheSizeEl.textContent = 'Calculating...';
        cacheSizeEl.textContent = await calculateCacheSize();
      }

      if (swStatusEl) {
        swStatusEl.textContent = 'Checking...';
        swStatusEl.textContent = await getServiceWorkerStatus();
      }
    }

    async function clearAllCaches() {
      try {
        if (!('caches' in window)) {
          issuenote('Cache Not Supported', 'Cache API is not supported in your browser.', true, 'error');
          return false;
        }

        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
        return true;
      } catch (error) {
        issuenote('Error Clearing Cache', `An error occurred: ${error.message}`, true, 'error');
        return false;
      }
    }

    if (clearCacheBtn) {
      clearCacheBtn.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to clear all cached data?')) {
          return;
        }

        clearCacheBtn.disabled = true;
        clearCacheBtn.innerHTML = '<span class="material-icons">hourglass_empty</span>Clearing...';

        const success = await clearAllCaches();
        if (success) {
          issuenote('Cache Cleared', 'All cached data has been successfully cleared.', true, 'success');
          await updateCacheInfo();
        }

        clearCacheBtn.disabled = false;
        clearCacheBtn.innerHTML = '<span class="material-icons">delete_sweep</span>Clear All Cache';
      });
    }

    if (updateSwBtn) {
      updateSwBtn.addEventListener('click', async () => {
        try {
          const registration = await navigator.serviceWorker.getRegistration();
          if (!registration) {
            issuenote('No Service Worker', 'No service worker is currently registered.', true, 'error');
            return;
          }

          updateSwBtn.disabled = true;
          updateSwBtn.innerHTML = '<span class="material-icons">hourglass_empty</span>Updating...';
          await registration.update();

          if (registration.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          }

          issuenote('Service Worker Updated', 'Service worker update initiated. Reload the page to apply changes.', true, 'success');
          updateSwBtn.disabled = false;
          updateSwBtn.innerHTML = '<span class="material-icons">update</span>Force Update Service Worker';
        } catch (error) {
          issuenote('Update Error', `Error updating service worker: ${error.message}`, true, 'error');
          updateSwBtn.disabled = false;
          updateSwBtn.innerHTML = '<span class="material-icons">update</span>Force Update Service Worker';
        }
      });
    }

    if (refreshCacheInfoBtn) {
      refreshCacheInfoBtn.addEventListener('click', updateCacheInfo);
    }

    updateCacheInfo();

    const autoTranslateToggle = document.getElementById('autoTranslateToggle');
    const languageSelect = document.getElementById('languageSelect');
    const resetLangBtn = document.getElementById('resetLangBtn');
    const browserLangEl = document.getElementById('browserLang');
    const currentLangEl = document.getElementById('currentLang');

    function loadGoogleTranslateForSettings() {
      if (document.getElementById('translatescript')) {
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
      script.type = 'text/javascript';
      script.id = 'translatescript';
      document.head.appendChild(script);
    }

    window.googleTranslateElementInit = function() {
      let translateMount = document.getElementById('google_translate_element');
      if (!translateMount) {
        translateMount = document.createElement('div');
        translateMount.id = 'google_translate_element';
        translateMount.style.display = 'none';
        document.body.appendChild(translateMount);
      }

      if (!window.google || !window.google.translate) {
        return;
      }

      new google.translate.TranslateElement({
        pageLanguage: 'en',
        layout: google.translate.TranslateElement.InlineLayout.SIMPLE
      }, 'google_translate_element');
    };

    if (autoTranslateToggle) {
      const enabled = localStorage.getItem('autoTranslateEnabled');
      autoTranslateToggle.checked = enabled === null || enabled === 'true';
      autoTranslateToggle.addEventListener('change', () => {
        localStorage.setItem('autoTranslateEnabled', autoTranslateToggle.checked);
        if (window.autoTranslate) {
          window.autoTranslate.setAutoTranslateEnabled(autoTranslateToggle.checked);
        }
      });
    }

    if (browserLangEl) {
      browserLangEl.textContent = navigator.language || navigator.userLanguage;
    }

    function updateCurrentLangDisplay(langCode) {
      if (currentLangEl) {
        if (!langCode || langCode === 'en') {
          currentLangEl.textContent = 'English (en)';
        } else {
          const option = languageSelect.querySelector(`option[value="${langCode}"]`);
          currentLangEl.textContent = option ? `${option.textContent} (${langCode})` : langCode;
        }
      }
    }

    function populateLanguages() {
      let attempts = 0;
      const maxAttempts = 20;

      function tryPopulateLanguages() {
        attempts++;
        const translateElement = document.querySelector('.goog-te-combo');
        if (translateElement && languageSelect) {
          const options = translateElement.options;
          languageSelect.innerHTML = '<option value="">Select a language...</option>';

          for (let i = 0; i < options.length; i++) {
            const option = options[i];
            if (option.value) {
              const newOption = document.createElement('option');
              newOption.value = option.value;
              newOption.textContent = option.text;
              languageSelect.appendChild(newOption);
            }
          }

          const savedLang = localStorage.getItem('preferredLanguage');
          if (savedLang) {
            languageSelect.value = savedLang;
            updateCurrentLangDisplay(savedLang);
          }
          return;
        }

        if (attempts < maxAttempts) {
          setTimeout(tryPopulateLanguages, 500);
        } else if (languageSelect) {
          updateCurrentLangDisplay(localStorage.getItem('preferredLanguage') || 'en');
        }
      }

      setTimeout(tryPopulateLanguages, 1000);
    }

    if (languageSelect) {
      languageSelect.addEventListener('change', () => {
        const selectedLang = languageSelect.value;
        if (selectedLang && window.autoTranslate) {
          window.autoTranslate.translateToLanguage(selectedLang);
          updateCurrentLangDisplay(selectedLang);
        }
      });
    }

    if (resetLangBtn) {
      resetLangBtn.addEventListener('click', () => {
        if (window.autoTranslate) {
          window.autoTranslate.resetToDefault();
          languageSelect.value = '';
          updateCurrentLangDisplay('en');
          issuenote('Language Reset', 'Language has been reset to English.', true, 'success');
        }
      });
    }

    loadGoogleTranslateForSettings();
    populateLanguages();
  }
})();
