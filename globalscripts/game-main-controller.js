(function() {
  let controllerOpen = false;

  function getControllerElements() {
    return {
      settingsContainer: document.getElementById('settings-container'),
      menuOverlay: document.getElementById('menusforgame'),
      backdrop: document.getElementById('bgcontroller')
    };
  }

  function hasControllerUI() {
    const { settingsContainer, menuOverlay, backdrop } = getControllerElements();
    return Boolean(settingsContainer && menuOverlay && backdrop);
  }

  function toggleControllerSettings() {
    if (!hasControllerUI()) {
      return;
    }

    const { settingsContainer, menuOverlay, backdrop } = getControllerElements();

    if (!controllerOpen) {
      settingsContainer.style.animation = '';
      settingsContainer.style.display = 'flex';
      settingsContainer.style.opacity = '1';
      settingsContainer.style.animation = 'showcons 0.5s';
      menuOverlay.classList.add('active');
      backdrop.style.display = 'block';
      backdrop.style.opacity = '1';
      controllerOpen = true;
      return;
    }

    settingsContainer.style.animation = '';
    settingsContainer.style.opacity = '0';
    menuOverlay.classList.remove('active');
    settingsContainer.style.animation = 'showconh 0.5s';
    backdrop.style.opacity = '0';
    backdrop.style.display = 'none';

    window.setTimeout(() => {
      settingsContainer.style.display = 'none';
      backdrop.style.display = 'none';
    }, 450);

    controllerOpen = false;
  }

  function init() {
    if (window.__qzGameControllerInitialized || !hasControllerUI()) {
      return;
    }

    window.__qzGameControllerInitialized = true;
  }

  if (typeof window.toggleControllerSettings !== 'function') {
    window.toggleControllerSettings = toggleControllerSettings;
  }

  window.QZGameMainController = {
    init,
    toggleControllerSettings
  };
})();
