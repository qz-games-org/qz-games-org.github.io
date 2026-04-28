// ===================================
// GameInput.js - Unified Controller Support
// ===================================

(function() {
  if (window.QZGameInput && window.QZGameInput.__ready) {
    return;
  }

  const DEFAULT_CONFIG = {
    deadzone: 0.18,
    sensitivity: 900,
    invertY: false,
    buttonMappings: {
      0: ' ',
      1: 'w',
      2: 'r',
      3: 'e',
      4: 'q',
      5: 'f',
      6: 'Shift',
      7: 'MouseLeft',
      8: 'Escape',
      9: 'Escape',
      10: 'c',
      11: 'MouseRight',
      12: 'w',
      13: 's',
      14: 'a',
      15: 'd'
    }
  };

  const BUTTON_NAMES = {
    0: 'A Button / X (PS)',
    1: 'B Button / Circle',
    2: 'X Button / Square',
    3: 'Y Button / Triangle',
    4: 'Left Bumper / L1',
    5: 'Right Bumper / R1',
    6: 'Left Trigger / L2',
    7: 'Right Trigger / R2',
    8: 'Back / Select',
    9: 'Start',
    10: 'Left Stick Click',
    11: 'Right Stick Click',
    12: 'D-Pad Up',
    13: 'D-Pad Down',
    14: 'D-Pad Left',
    15: 'D-Pad Right'
  };

  const SPECIAL_KEYS = {
    ' ': { keyCode: 32, code: 'Space', key: ' ' },
    Space: { keyCode: 32, code: 'Space', key: ' ' },
    Spacebar: { keyCode: 32, code: 'Space', key: ' ' },
    Escape: { keyCode: 27, code: 'Escape', key: 'Escape' },
    Enter: { keyCode: 13, code: 'Enter', key: 'Enter' },
    Shift: { keyCode: 16, code: 'ShiftLeft', key: 'Shift' },
    Control: { keyCode: 17, code: 'ControlLeft', key: 'Control' },
    Ctrl: { keyCode: 17, code: 'ControlLeft', key: 'Control' },
    Alt: { keyCode: 18, code: 'AltLeft', key: 'Alt' },
    Tab: { keyCode: 9, code: 'Tab', key: 'Tab' },
    ArrowUp: { keyCode: 38, code: 'ArrowUp', key: 'ArrowUp' },
    ArrowDown: { keyCode: 40, code: 'ArrowDown', key: 'ArrowDown' },
    ArrowLeft: { keyCode: 37, code: 'ArrowLeft', key: 'ArrowLeft' },
    ArrowRight: { keyCode: 39, code: 'ArrowRight', key: 'ArrowRight' }
  };

  const MOUSE_BUTTONS = {
    MouseLeft: 0,
    MouseMiddle: 1,
    MouseRight: 2,
    MouseBack: 3,
    MouseForward: 4
  };

  let config = cloneConfig(DEFAULT_CONFIG);
  let frame = null;
  let boundFrame = null;
  let w = null;
  let d = null;
  let canvas = null;
  let lastTime = performance.now();
  let prevButtonStates = new Map();
  let pressedKeys = new Set();
  let pressedMouseButtons = new Set();
  let keyOwners = new Map();
  let mouseButtonOwners = new Map();
  let leftStickKeys = new Set();
  let inputLoopStarted = false;
  let lastControllerStatus = '';
  let lastNotifiedController = '';

  let isListening = false;
  let listeningElement = null;
  let listeningButtonId = null;

  function cloneConfig(source) {
    return {
      ...source,
      buttonMappings: { ...(source.buttonMappings || {}) }
    };
  }

  function normalizeConfig(nextConfig) {
    const merged = {
      ...cloneConfig(DEFAULT_CONFIG),
      ...(nextConfig || {}),
      buttonMappings: {
        ...DEFAULT_CONFIG.buttonMappings,
        ...((nextConfig && nextConfig.buttonMappings) || {})
      }
    };

    merged.deadzone = Number.isFinite(parseFloat(merged.deadzone)) ? parseFloat(merged.deadzone) : DEFAULT_CONFIG.deadzone;
    merged.sensitivity = Number.isFinite(parseInt(merged.sensitivity, 10)) ? parseInt(merged.sensitivity, 10) : DEFAULT_CONFIG.sensitivity;
    merged.invertY = Boolean(merged.invertY);

    return merged;
  }

  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    return parts.length === 2 ? parts.pop().split(';').shift() : null;
  }

  function setCookie(name, value, days = 365) {
    try {
      const expires = new Date();
      expires.setTime(expires.getTime() + days * 864e5);
      const cookieValue = typeof value === 'object' ? JSON.stringify(value) : value;
      document.cookie = `${name}=${encodeURIComponent(cookieValue)};expires=${expires.toUTCString()};path=/`;
      return true;
    } catch (error) {
      console.error('Error saving cookie:', error);
      return false;
    }
  }

  function loadConfig() {
    try {
      const saved = getCookie('user_game_controller_config');
      if (saved) {
        config = normalizeConfig(JSON.parse(decodeURIComponent(saved)));
      }
    } catch (error) {
      console.error('Error loading controller config:', error);
      config = cloneConfig(DEFAULT_CONFIG);
      setCookie('user_game_controller_config', '', -1);
    }

    updateUI();
  }

  function saveConfig(showNotice = true) {
    if (setCookie('user_game_controller_config', config) && showNotice) {
      showNotificationn('Settings saved successfully');
    }
  }

  function refreshFrame() {
    const nextFrame = document.getElementById('gameiframe');
    if (!nextFrame) {
      frame = null;
      w = null;
      d = null;
      canvas = null;
      return false;
    }

    frame = nextFrame;

    if (boundFrame !== frame) {
      if (boundFrame) {
        boundFrame.removeEventListener('load', setupIframeTarget);
      }
      boundFrame = frame;
      boundFrame.addEventListener('load', setupIframeTarget);
    }

    return setupIframeTarget();
  }

  function setupIframeTarget() {
    if (!frame) {
      return false;
    }

    try {
      w = frame.contentWindow;
      d = frame.contentDocument || (w && w.document) || null;
      canvas = d ? (d.querySelector('#unity-canvas, canvas') || d.body || d.documentElement) : null;

      if (canvas && canvas !== d.body && canvas.tabIndex < 0) {
        canvas.tabIndex = -1;
      }

      if (canvas && typeof canvas.focus === 'function') {
        canvas.focus({ preventScroll: true });
      }

      if (w && typeof w.focus === 'function') {
        w.focus();
      }

      return Boolean(w && d && canvas);
    } catch (error) {
      w = null;
      d = null;
      canvas = null;
      return false;
    }
  }

  function ensureInputTarget() {
    if (w && canvas) {
      return true;
    }

    return refreshFrame();
  }

  function applyCurve(value, deadzone) {
    const sign = Math.sign(value);
    const amount = Math.abs(value);
    if (amount < deadzone) return 0;
    const normalized = (amount - deadzone) / (1 - deadzone);
    return sign * normalized * normalized;
  }

  function getKeyInfo(key) {
    if (SPECIAL_KEYS[key]) {
      return SPECIAL_KEYS[key];
    }

    const keyText = String(key || '');
    if (/^[a-z]$/i.test(keyText)) {
      const lowerKey = keyText.toLowerCase();
      return {
        key: lowerKey,
        code: `Key${lowerKey.toUpperCase()}`,
        keyCode: lowerKey.toUpperCase().charCodeAt(0)
      };
    }

    if (/^[0-9]$/.test(keyText)) {
      return {
        key: keyText,
        code: `Digit${keyText}`,
        keyCode: keyText.charCodeAt(0)
      };
    }

    return {
      key: keyText,
      code: keyText,
      keyCode: keyText.length > 0 ? keyText.toUpperCase().charCodeAt(0) : 0
    };
  }

  function defineLegacyKeyboardProps(event, keyInfo) {
    const props = {
      keyCode: keyInfo.keyCode,
      which: keyInfo.keyCode,
      charCode: keyInfo.key.length === 1 ? keyInfo.keyCode : 0
    };

    Object.entries(props).forEach(([name, value]) => {
      try {
        Object.defineProperty(event, name, {
          configurable: true,
          get: () => value
        });
      } catch (error) {
        // Some browsers lock legacy KeyboardEvent fields.
      }
    });
  }

  function sendMouseMove(dx, dy) {
    if (!ensureInputTarget()) return false;

    try {
      const event = new w.MouseEvent('mousemove', {
        bubbles: true,
        cancelable: true,
        clientX: 0,
        clientY: 0
      });

      Object.defineProperty(event, 'movementX', { value: dx, configurable: true });
      Object.defineProperty(event, 'movementY', { value: dy, configurable: true });
      canvas.dispatchEvent(event);
      return true;
    } catch (error) {
      console.error('Error sending mouse move:', error);
      return false;
    }
  }

  function getOwnerSet(map, name) {
    let owners = map.get(name);
    if (!owners) {
      owners = new Set();
      map.set(name, owners);
    }
    return owners;
  }

  function sendMouseButton(buttonName, pressed, options = {}) {
    if (!ensureInputTarget()) return false;

    const button = MOUSE_BUTTONS[buttonName];
    if (typeof button !== 'number') return false;
    const owner = options.owner || 'controller:mouse';
    const owners = getOwnerSet(mouseButtonOwners, buttonName);

    if (pressed && owners.has(owner)) {
      return true;
    }

    if (!pressed && !owners.has(owner)) {
      if (owners.size === 0) {
        mouseButtonOwners.delete(buttonName);
      }
      return true;
    }

    if (pressed && owners.size > 0) {
      owners.add(owner);
      pressedMouseButtons.add(buttonName);
      return true;
    }

    if (!pressed && owners.size > 1) {
      owners.delete(owner);
      return true;
    }

    try {
      const event = new w.MouseEvent(pressed ? 'mousedown' : 'mouseup', {
        bubbles: true,
        cancelable: true,
        button,
        buttons: pressed ? (button === 2 ? 2 : 1) : 0,
        clientX: 0,
        clientY: 0
      });

      canvas.dispatchEvent(event);

      if (!pressed && button === 0) {
        canvas.dispatchEvent(new w.MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          button: 0,
          buttons: 0,
          clientX: 0,
          clientY: 0
        }));
      }

      if (pressed) {
        owners.add(owner);
        pressedMouseButtons.add(buttonName);
      } else {
        owners.delete(owner);
        if (owners.size === 0) {
          mouseButtonOwners.delete(buttonName);
        }
        pressedMouseButtons.delete(buttonName);
      }

      return true;
    } catch (error) {
      console.error('Error sending mouse button:', error);
      return false;
    }
  }

  function sendKey(key, pressed, options = {}) {
    if (!ensureInputTarget()) return false;

    const keyInfo = getKeyInfo(key);
    const owner = options.owner || 'controller:key';
    const owners = getOwnerSet(keyOwners, key);

    if (pressed && owners.has(owner)) {
      return true;
    }

    if (!pressed && !owners.has(owner)) {
      if (owners.size === 0) {
        keyOwners.delete(key);
      }
      return true;
    }

    if (pressed && owners.size > 0) {
      owners.add(owner);
      pressedKeys.add(key);
      return true;
    }

    if (!pressed && owners.size > 1) {
      owners.delete(owner);
      return true;
    }

    try {
      const event = new w.KeyboardEvent(pressed ? 'keydown' : 'keyup', {
        bubbles: true,
        cancelable: true,
        key: keyInfo.key,
        code: keyInfo.code,
        location: keyInfo.location || 0,
        repeat: false,
        view: w
      });

      defineLegacyKeyboardProps(event, keyInfo);
      canvas.dispatchEvent(event);

      if (pressed) {
        owners.add(owner);
        pressedKeys.add(key);
      } else {
        owners.delete(owner);
        if (owners.size === 0) {
          keyOwners.delete(key);
        }
        pressedKeys.delete(key);
      }

      return true;
    } catch (error) {
      console.error('Error sending key:', error);
      return false;
    }
  }

  function handleButtonBinding(binding, pressed, options = {}) {
    if (!binding) return false;
    return String(binding).startsWith('Mouse')
      ? sendMouseButton(binding, pressed, options)
      : sendKey(binding, pressed, options);
  }

  function handleLeftStick(axes) {
    const x = applyCurve(axes[0] || 0, config.deadzone);
    const y = applyCurve(axes[1] || 0, config.deadzone);

    const leftPressed = x < -0.1;
    const rightPressed = x > 0.1;
    const upPressed = y < -0.1;
    const downPressed = y > 0.1;

    if (upPressed && !leftStickKeys.has('w')) {
      if (sendKey('w', true, { owner: 'controller:left-stick:w' })) leftStickKeys.add('w');
    } else if (!upPressed && leftStickKeys.has('w')) {
      sendKey('w', false, { owner: 'controller:left-stick:w' });
      leftStickKeys.delete('w');
    }

    if (downPressed && !leftStickKeys.has('s')) {
      if (sendKey('s', true, { owner: 'controller:left-stick:s' })) leftStickKeys.add('s');
    } else if (!downPressed && leftStickKeys.has('s')) {
      sendKey('s', false, { owner: 'controller:left-stick:s' });
      leftStickKeys.delete('s');
    }

    if (leftPressed && !leftStickKeys.has('a')) {
      if (sendKey('a', true, { owner: 'controller:left-stick:a' })) leftStickKeys.add('a');
    } else if (!leftPressed && leftStickKeys.has('a')) {
      sendKey('a', false, { owner: 'controller:left-stick:a' });
      leftStickKeys.delete('a');
    }

    if (rightPressed && !leftStickKeys.has('d')) {
      if (sendKey('d', true, { owner: 'controller:left-stick:d' })) leftStickKeys.add('d');
    } else if (!rightPressed && leftStickKeys.has('d')) {
      sendKey('d', false, { owner: 'controller:left-stick:d' });
      leftStickKeys.delete('d');
    }
  }

  function handleRightStick(axes, dt) {
    const x = applyCurve(axes[2] || 0, config.deadzone);
    const y = applyCurve(axes[3] || 0, config.deadzone);

    if (Math.abs(x) < 0.01 && Math.abs(y) < 0.01) return;

    sendMouseMove(
      x * config.sensitivity * dt,
      y * config.sensitivity * dt * (config.invertY ? -1 : 1)
    );
  }

  function getGamepads() {
    if (!navigator.getGamepads) return [];

    try {
      return Array.from(navigator.getGamepads()).filter(Boolean);
    } catch (error) {
      return [];
    }
  }

  function getControllerName(id) {
    const normalizedId = String(id || '').toLowerCase();
    if (normalizedId.includes('xbox') || normalizedId.includes('360') || normalizedId.includes('xinput')) {
      return 'Xbox Controller Connected';
    }
    if (normalizedId.includes('playstation') || normalizedId.includes('dualshock') || normalizedId.includes('dualsense')) {
      return 'PlayStation Controller Connected';
    }
    if (normalizedId.includes('pro controller') || normalizedId.includes('joy-con')) {
      return 'Nintendo Controller Connected';
    }
    return 'Controller Connected';
  }

  function updateControllerStatus(gamepads, notify) {
    const statusElement = document.getElementById('controllerstatus');
    if (!statusElement) return;

    if (gamepads.length === 0) {
      if (lastControllerStatus !== 'disconnected') {
        lastControllerStatus = 'disconnected';
        statusElement.classList.remove('connected');
        statusElement.classList.add('disconnected');
        statusElement.innerHTML = '<span class="status-dot"></span>No Controller Connected';
      }
      lastNotifiedController = '';
      return;
    }

    const gamepad = gamepads[0];
    const controllerName = getControllerName(gamepad.id);
    const statusKey = `${gamepad.index}:${gamepad.id}`;

    if (lastControllerStatus !== statusKey) {
      lastControllerStatus = statusKey;
      statusElement.classList.remove('disconnected');
      statusElement.classList.add('connected');
      statusElement.innerHTML = `<span class="status-dot"></span>${controllerName}`;
    }

    if (notify && lastNotifiedController !== statusKey) {
      lastNotifiedController = statusKey;
      showNotificationn(controllerName);
    }
  }

  function releaseAllInputs() {
    Array.from(keyOwners.entries()).forEach(([key, owners]) => {
      Array.from(owners).forEach((owner) => sendKey(key, false, { owner }));
    });
    pressedKeys.clear();
    keyOwners.clear();
    leftStickKeys.clear();

    Array.from(mouseButtonOwners.entries()).forEach(([buttonName, owners]) => {
      Array.from(owners).forEach((owner) => sendMouseButton(buttonName, false, { owner }));
    });
    pressedMouseButtons.clear();
    mouseButtonOwners.clear();
    prevButtonStates.clear();
  }

  function handleGamepadInput() {
    const currentTime = performance.now();
    const dt = Math.min(0.05, Math.max(0, (currentTime - lastTime) / 1000));
    lastTime = currentTime;

    const gamepads = getGamepads();
    updateControllerStatus(gamepads, false);

    if (gamepads.length === 0 && prevButtonStates.size > 0) {
      releaseAllInputs();
    }

    const currentButtons = new Map();

    gamepads.forEach((gamepad) => {
      handleLeftStick(gamepad.axes || []);
      handleRightStick(gamepad.axes || [], dt);

      (gamepad.buttons || []).forEach((button, buttonIndex) => {
        const buttonKey = `${gamepad.index}-${buttonIndex}`;
        const isPressed = Boolean(button && (button.pressed || button.value >= 0.45));
        const wasPressed = prevButtonStates.get(buttonKey) || false;
        const binding = config.buttonMappings[buttonIndex];

        if (isPressed !== wasPressed && binding) {
          const sent = handleButtonBinding(binding, isPressed, {
            owner: `controller:button:${buttonKey}`
          });
          currentButtons.set(buttonKey, sent ? isPressed : wasPressed);
          return;
        }

        currentButtons.set(buttonKey, isPressed);
      });
    });

    prevButtonStates = currentButtons;
    requestAnimationFrame(handleGamepadInput);
  }

  function startGamepadLoop() {
    if (inputLoopStarted) return;
    inputLoopStarted = true;
    lastTime = performance.now();
    requestAnimationFrame(handleGamepadInput);
  }

  function getKeyDisplayName(key) {
    const keyNames = {
      ' ': 'Spacebar',
      Escape: 'Escape',
      Enter: 'Enter',
      Shift: 'Shift',
      Control: 'Ctrl',
      Alt: 'Alt',
      Tab: 'Tab',
      CapsLock: 'Caps Lock',
      MouseLeft: 'Left Mouse',
      MouseRight: 'Right Mouse',
      MouseMiddle: 'Middle Mouse',
      MouseBack: 'Back Mouse',
      MouseForward: 'Forward Mouse'
    };
    return keyNames[key] || (String(key).length === 1 ? String(key).toUpperCase() : key);
  }

  function updateUI() {
    const sensitivitySlider = document.getElementById('sensitivity');
    const deadzoneSlider = document.getElementById('deadzone');
    const invertYCheckbox = document.getElementById('invertY');

    if (sensitivitySlider) {
      sensitivitySlider.value = config.sensitivity;
      const valueDisplay = document.getElementById('sensitivity-value');
      if (valueDisplay) valueDisplay.textContent = config.sensitivity;
    }

    if (deadzoneSlider) {
      deadzoneSlider.value = config.deadzone;
      const valueDisplay = document.getElementById('deadzone-value');
      if (valueDisplay) valueDisplay.textContent = config.deadzone.toFixed(2);
    }

    if (invertYCheckbox) {
      invertYCheckbox.checked = config.invertY;
    }

    populateBindings();
  }

  function populateBindings() {
    const container = document.getElementById('controller-bindings');
    if (!container) return;

    container.innerHTML = '';

    Object.keys(config.buttonMappings).forEach((buttonId) => {
      const binding = config.buttonMappings[buttonId];
      const buttonName = BUTTON_NAMES[buttonId] || `Button ${buttonId}`;
      const bindingItem = document.createElement('div');
      bindingItem.className = 'binding-item';
      bindingItem.innerHTML = `
        <div>
          <strong>${buttonName}</strong>
          <div class="bind-current">Bound to: <span>${getKeyDisplayName(binding)}</span></div>
        </div>
        <button class="bind-button" data-button-id="${buttonId}">Rebind</button>
      `;

      const button = bindingItem.querySelector('.bind-button');
      button.addEventListener('click', () => startListening(buttonId, button));
      container.appendChild(bindingItem);
    });
  }

  function startListening(buttonId, button) {
    if (isListening) return;

    isListening = true;
    listeningElement = button;
    listeningButtonId = buttonId;
    button.textContent = 'Press key or mouse button...';
    button.classList.add('listening');

    document.addEventListener('keydown', handleKeyboardBinding, true);
    document.addEventListener('mousedown', handleMouseBinding, true);
    document.addEventListener('contextmenu', preventContextMenu, true);
  }

  function handleKeyboardBinding(event) {
    if (!isListening) return;

    event.preventDefault();
    event.stopPropagation();

    if (event.key === 'Escape') {
      stopListening();
      showNotificationn('Binding cancelled');
      return;
    }

    config.buttonMappings[listeningButtonId] = event.key;
    stopListening();
    populateBindings();
    showNotificationn(`${BUTTON_NAMES[listeningButtonId]} bound to ${getKeyDisplayName(event.key)}`);
  }

  function handleMouseBinding(event) {
    if (!isListening) return;

    event.preventDefault();
    event.stopPropagation();

    const mouseButton = ['MouseLeft', 'MouseMiddle', 'MouseRight'][event.button] || `Mouse${event.button}`;
    config.buttonMappings[listeningButtonId] = mouseButton;
    stopListening();
    populateBindings();
    showNotificationn(`${BUTTON_NAMES[listeningButtonId]} bound to ${getKeyDisplayName(mouseButton)}`);
  }

  function preventContextMenu(event) {
    if (isListening) {
      event.preventDefault();
    }
  }

  function stopListening() {
    isListening = false;

    if (listeningElement) {
      listeningElement.textContent = 'Rebind';
      listeningElement.classList.remove('listening');
    }

    listeningElement = null;
    listeningButtonId = null;
    document.removeEventListener('keydown', handleKeyboardBinding, true);
    document.removeEventListener('mousedown', handleMouseBinding, true);
    document.removeEventListener('contextmenu', preventContextMenu, true);
  }

  function initializeSettingsHandlers() {
    const sensitivitySlider = document.getElementById('sensitivity');
    if (sensitivitySlider) {
      sensitivitySlider.addEventListener('input', (event) => {
        config.sensitivity = parseInt(event.target.value, 10);
        const valueDisplay = document.getElementById('sensitivity-value');
        if (valueDisplay) valueDisplay.textContent = config.sensitivity;
      });
    }

    const deadzoneSlider = document.getElementById('deadzone');
    if (deadzoneSlider) {
      deadzoneSlider.addEventListener('input', (event) => {
        config.deadzone = parseFloat(event.target.value);
        const valueDisplay = document.getElementById('deadzone-value');
        if (valueDisplay) valueDisplay.textContent = config.deadzone.toFixed(2);
      });
    }

    const invertYCheckbox = document.getElementById('invertY');
    if (invertYCheckbox) {
      invertYCheckbox.addEventListener('change', (event) => {
        config.invertY = event.target.checked;
      });
    }
  }

  function switchTab(tabName) {
    document.querySelectorAll('.controller-tab').forEach((button) => {
      button.classList.toggle('active', button.dataset.tab === tabName);
    });

    document.querySelectorAll('.controller-tab-content').forEach((content) => {
      content.classList.toggle('active', content.id === `${tabName}-tab`);
    });
  }

  function showNotificationn(message) {
    const notification = document.getElementById('notificationn');
    if (!notification) {
      console.log('Notification:', message);
      return;
    }

    notification.textContent = message;
    notification.classList.add('show');
    clearTimeout(notification.hideTimeout);
    notification.hideTimeout = setTimeout(() => {
      notification.classList.remove('show');
    }, 3000);
  }

  function pollGamepads(notify = false) {
    const gamepads = getGamepads();
    updateControllerStatus(gamepads, notify);
    return gamepads;
  }

  window.addEventListener('gamepadconnected', (event) => {
    pollGamepads(true);
    console.log('Gamepad connected:', event.gamepad.id);
  });

  window.addEventListener('gamepaddisconnected', (event) => {
    console.log('Gamepad disconnected:', event.gamepad.id);
    releaseAllInputs();
    pollGamepads(false);
    showNotificationn('Controller disconnected');
  });

  window.addEventListener('focus', () => {
    refreshFrame();
    pollGamepads(true);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      releaseAllInputs();
      return;
    }

    refreshFrame();
    pollGamepads(true);
  });

  window.updateControllerConfig = function(newConfig) {
    config = normalizeConfig({
      ...config,
      ...(newConfig || {}),
      buttonMappings: {
        ...config.buttonMappings,
        ...((newConfig && newConfig.buttonMappings) || {})
      }
    });
    saveConfig();
    updateUI();
  };

  window.getControllerConfig = function() {
    return cloneConfig(config);
  };

  window.resetControllerConfig = function() {
    config = cloneConfig(DEFAULT_CONFIG);
    releaseAllInputs();
    saveConfig();
    updateUI();
  };

  window.saveSettings = function() {
    saveConfig();
  };

  window.resetToDefaults = function() {
    if (confirm('Are you sure you want to reset all settings to default?')) {
      config = cloneConfig(DEFAULT_CONFIG);
      releaseAllInputs();
      updateUI();
      saveConfig();
      showNotificationn('Settings reset to defaults');
    }
  };

  window.switchTab = switchTab;

  window.QZGameInput = {
    __ready: true,
    refreshFrame,
    sendKey,
    sendMouseButton,
    sendMouseMove,
    pressBinding: handleButtonBinding,
    dispatchBinding: handleButtonBinding,
    releaseAll: releaseAllInputs,
    pollGamepads,
    getConfig: window.getControllerConfig,
    updateConfig: window.updateControllerConfig
  };

  function init() {
    loadConfig();
    setTimeout(refreshFrame, 100);
    setTimeout(initializeSettingsHandlers, 500);
    setTimeout(() => {
      pollGamepads(true);
      startGamepadLoop();
    }, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  window.addEventListener('beforeunload', () => {
    saveConfig(false);
  });
})();
