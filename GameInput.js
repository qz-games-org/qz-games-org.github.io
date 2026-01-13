// ===================================
// GameInput.js - Unified Controller Support
// ===================================

// ===== CONFIGURATION =====
const DEFAULT_CONFIG = {
  deadzone: 0.18,
  sensitivity: 900,
  invertY: false,
  buttonMappings: {
    0: ' ',         // A button -> Spacebar
    1: 'w',         // B button -> W key
    2: 'r',         // X button -> R key
    3: 'e',         // Y button -> E key
    4: 'q',         // LB -> Q key
    5: 'f',         // RB -> F key
    6: 'Shift',     // LT -> Shift key
    7: 'MouseLeft', // RT -> Left Mouse Click
    8: 'Escape',    // Back/Select -> Escape
    9: 'Escape',    // Start -> Escape
    10: 'c',        // Left stick click -> C
    11: 'MouseRight',// Right stick click -> Right Mouse Click
    12: 'w',        // D-pad up -> W
    13: 's',        // D-pad down -> S
    14: 'a',        // D-pad left -> A
    15: 'd'         // D-pad right -> D
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

// ===== STATE =====
let config = { ...DEFAULT_CONFIG };
let frame = null;
let w = null;  // iframe window
let d = null;  // iframe document
let canvas = null;  // game canvas

let lastTime = performance.now();
let prevButtonStates = new Map();
let pressedKeys = new Set();
let pressedMouseButtons = new Set();

// Binding UI state
let isListening = false;
let listeningElement = null;
let listeningButtonId = null;

// ===== COOKIE UTILITIES =====
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

function setCookie(name, value, days = 365) {
  try {
    const expires = new Date();
    expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
    const cookieValue = typeof value === 'object' ? JSON.stringify(value) : value;
    document.cookie = `${name}=${cookieValue};expires=${expires.toUTCString()};path=/`;
    console.log('Cookie saved successfully');
    return true;
  } catch (error) {
    console.error('Error saving cookie:', error);
    return false;
  }
}

// ===== CONFIG MANAGEMENT =====
function loadConfig() {
  try {
    const saved = getCookie('user_game_controller_config');
    if (saved) {
      let decodedSaved = saved;
      try {
        decodedSaved = decodeURIComponent(saved);
      } catch (e) {
        decodedSaved = saved;
      }

      const parsedConfig = JSON.parse(decodedSaved);
      config = {
        ...DEFAULT_CONFIG,
        ...parsedConfig,
        buttonMappings: { ...DEFAULT_CONFIG.buttonMappings, ...parsedConfig.buttonMappings }
      };
      console.log('Controller config loaded:', config);
    } else {
      console.log('No saved config found, using defaults');
    }
  } catch (error) {
    console.error('Error loading config:', error);
    config = { ...DEFAULT_CONFIG };
    setCookie('user_game_controller_config', '', -1);
  }

  // Update UI if elements exist
  updateUI();
}

function saveConfig() {
  try {
    setCookie('user_game_controller_config', config);
    console.log('Controller config saved:', config);
    showNotificationn('Settings saved successfully!');
  } catch (error) {
    console.error('Error saving config:', error);
    showNotificationn('Error saving settings');
  }
}

// API for external updates
window.updateControllerConfig = function(newConfig) {
  config = {
    ...DEFAULT_CONFIG,
    ...newConfig,
    buttonMappings: { ...DEFAULT_CONFIG.buttonMappings, ...newConfig.buttonMappings }
  };
  saveConfig();
};

window.getControllerConfig = function() {
  return { ...config };
};

window.resetControllerConfig = function() {
  config = { ...DEFAULT_CONFIG };
  saveConfig();
  updateUI();
};

// ===== IFRAME SETUP =====
function initializeIframe() {
  frame = document.getElementById('gameiframe');
  if (!frame) {
    console.warn('Game iframe not found');
    return;
  }

  frame.addEventListener('load', () => {
    w = frame.contentWindow;
    d = w.document;
    canvas = d.querySelector('#unity-canvas, canvas') || d.body;
    w.focus();
    console.log('Game iframe initialized, canvas:', canvas ? 'found' : 'not found');
  });
}

// ===== INPUT HELPERS =====
function applyCurve(v, deadzone) {
  const s = Math.sign(v), a = Math.abs(v);
  if (a < deadzone) return 0;
  const n = (a - deadzone) / (1 - deadzone);
  return s * n * n; // Quadratic curve for smooth control
}

// ===== CHILD WINDOW INPUT DISPATCH =====
function sendMouseMove(dx, dy) {
  if (!w || !canvas) return;

  try {
    const ev = new w.MouseEvent('mousemove', {
      bubbles: true,
      cancelable: true,
      clientX: 0,
      clientY: 0
    });

    // Add movement deltas for pointer lock
    Object.defineProperty(ev, 'movementX', { value: dx, configurable: true });
    Object.defineProperty(ev, 'movementY', { value: dy, configurable: true });

    canvas.dispatchEvent(ev);
  } catch (error) {
    console.error('Error sending mouse move:', error);
  }
}

function sendMouseButton(buttonName, pressed) {
  if (!w || !canvas) return;

  let button = 0;
  if (buttonName === 'MouseLeft') button = 0;
  else if (buttonName === 'MouseRight') button = 2;
  else if (buttonName === 'MouseMiddle') button = 1;
  else if (buttonName === 'MouseBack') button = 3;
  else if (buttonName === 'MouseForward') button = 4;
  else return; // Not a mouse button

  const type = pressed ? 'mousedown' : 'mouseup';

  try {
    const ev = new w.MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      button: button,
      buttons: pressed ? (button === 2 ? 2 : 1) : 0,
      clientX: 0,
      clientY: 0
    });

    canvas.dispatchEvent(ev);

    // Track state
    if (pressed) {
      pressedMouseButtons.add(buttonName);
    } else {
      pressedMouseButtons.delete(buttonName);
    }
  } catch (error) {
    console.error('Error sending mouse button:', error);
  }
}

function sendKey(key, pressed) {
  if (!w || !canvas) return;

  const type = pressed ? 'keydown' : 'keyup';
  let keyCode, code;

  // Map special keys
  const specialKeys = {
    ' ': { keyCode: 32, code: 'Space', key: ' ' },
    'Escape': { keyCode: 27, code: 'Escape', key: 'Escape' },
    'Enter': { keyCode: 13, code: 'Enter', key: 'Enter' },
    'Shift': { keyCode: 16, code: 'ShiftLeft', key: 'Shift' },
    'Control': { keyCode: 17, code: 'ControlLeft', key: 'Control' },
    'Alt': { keyCode: 18, code: 'AltLeft', key: 'Alt' },
    'Tab': { keyCode: 9, code: 'Tab', key: 'Tab' }
  };

  if (specialKeys[key]) {
    keyCode = specialKeys[key].keyCode;
    code = specialKeys[key].code;
  } else {
    // Regular character key
    keyCode = key.toUpperCase().charCodeAt(0);
    code = `Key${key.toUpperCase()}`;
  }

  try {
    const ev = new w.KeyboardEvent(type, {
      bubbles: true,
      cancelable: true,
      key: key,
      code: code,
      keyCode: keyCode,
      which: keyCode
    });

    canvas.dispatchEvent(ev);

    // Track state to prevent double-sends
    if (pressed) {
      pressedKeys.add(key);
    } else {
      pressedKeys.delete(key);
    }
  } catch (error) {
    console.error('Error sending key:', error);
  }
}

function handleButtonBinding(binding, pressed) {
  // Check if it's a mouse button
  if (binding.startsWith('Mouse')) {
    sendMouseButton(binding, pressed);
  } else {
    // It's a keyboard key
    sendKey(binding, pressed);
  }
}

// ===== LEFT STICK MOVEMENT =====
function handleLeftStick(axes) {
  const x = applyCurve(axes[0] || 0, config.deadzone);
  const y = applyCurve(axes[1] || 0, config.deadzone);

  // Left stick controls WASD movement
  // X axis: negative = A (left), positive = D (right)
  // Y axis: negative = W (up), positive = S (down)

  const leftPressed = x < -0.1;
  const rightPressed = x > 0.1;
  const upPressed = y < -0.1;
  const downPressed = y > 0.1;

  // Send W key
  if (upPressed && !pressedKeys.has('w')) {
    sendKey('w', true);
  } else if (!upPressed && pressedKeys.has('w')) {
    sendKey('w', false);
  }

  // Send S key
  if (downPressed && !pressedKeys.has('s')) {
    sendKey('s', true);
  } else if (!downPressed && pressedKeys.has('s')) {
    sendKey('s', false);
  }

  // Send A key
  if (leftPressed && !pressedKeys.has('a')) {
    sendKey('a', true);
  } else if (!leftPressed && pressedKeys.has('a')) {
    sendKey('a', false);
  }

  // Send D key
  if (rightPressed && !pressedKeys.has('d')) {
    sendKey('d', true);
  } else if (!rightPressed && pressedKeys.has('d')) {
    sendKey('d', false);
  }
}

// ===== RIGHT STICK AIM =====
function handleRightStick(axes, dt) {
  const x = applyCurve(axes[2] || 0, config.deadzone);
  const y = applyCurve(axes[3] || 0, config.deadzone);

  if (Math.abs(x) < 0.01 && Math.abs(y) < 0.01) return;

  const dx = x * config.sensitivity * dt;
  const dy = y * config.sensitivity * dt * (config.invertY ? -1 : 1);

  sendMouseMove(dx, dy);
}

// ===== GAMEPAD LOOP =====
function handleGamepadInput() {
  const currentTime = performance.now();
  const dt = (currentTime - lastTime) / 1000; // Convert to seconds
  lastTime = currentTime;

  const gamepads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(gp => gp) : [];

  gamepads.forEach((gamepad, index) => {
    if (!gamepad) return;

    // Handle left stick (WASD movement)
    handleLeftStick(gamepad.axes);

    // Handle right stick (camera/aim)
    handleRightStick(gamepad.axes, dt);

    // Handle buttons
    const currentButtons = new Map();

    gamepad.buttons.forEach((button, buttonIndex) => {
      const isPressed = button.pressed;
      const buttonKey = `${index}-${buttonIndex}`;
      const wasPressed = prevButtonStates.get(buttonKey) || false;

      currentButtons.set(buttonKey, isPressed);

      // Button state changed
      if (isPressed !== wasPressed) {
        const binding = config.buttonMappings[buttonIndex];

        if (binding) {
          handleButtonBinding(binding, isPressed);
        }
      }
    });

    prevButtonStates = currentButtons;
  });

  requestAnimationFrame(handleGamepadInput);
}

// ===== BINDING UI FUNCTIONS =====
function updateUI() {
  // Update sliders if they exist
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

  Object.keys(config.buttonMappings).forEach(buttonId => {
    const binding = config.buttonMappings[buttonId];
    const buttonName = BUTTON_NAMES[buttonId];

    const bindingItem = document.createElement('div');
    bindingItem.className = 'binding-item';
    bindingItem.innerHTML = `
      <div>
        <strong>${buttonName}</strong>
        <div class="bind-current">Bound to: <span style="color: var(--sidenav-menu-highlight-bg-end);">${getKeyDisplayName(binding)}</span></div>
      </div>
      <button class="bind-button" data-button-id="${buttonId}">
        Rebind
      </button>
    `;

    // Add click listener
    const button = bindingItem.querySelector('.bind-button');
    button.addEventListener('click', () => startListening(buttonId, button));

    container.appendChild(bindingItem);
  });
}

function getKeyDisplayName(key) {
  const keyNames = {
    ' ': 'Spacebar',
    'Escape': 'Escape',
    'Enter': 'Enter',
    'Shift': 'Shift',
    'Control': 'Ctrl',
    'Alt': 'Alt',
    'Tab': 'Tab',
    'CapsLock': 'Caps Lock',
    'MouseLeft': 'Left Mouse',
    'MouseRight': 'Right Mouse',
    'MouseMiddle': 'Middle Mouse',
    'MouseBack': 'Back Mouse',
    'MouseForward': 'Forward Mouse'
  };
  return keyNames[key] || (key.length === 1 ? key.toUpperCase() : key);
}

function startListening(buttonId, button) {
  if (isListening) return;

  isListening = true;
  listeningElement = button;
  listeningButtonId = buttonId;

  button.textContent = 'Press key or mouse button...';
  button.classList.add('listening');

  // Add event listeners
  document.addEventListener('keydown', handleKeyboardBinding);
  document.addEventListener('mousedown', handleMouseBinding);
  document.addEventListener('contextmenu', preventContextMenu);
}

function handleKeyboardBinding(event) {
  if (!isListening) return;

  event.preventDefault();
  event.stopPropagation();

  // Press Escape alone to cancel binding
  if (event.key === 'Escape') {
    stopListening();
    showNotificationn('Binding cancelled');
    return;
  }

  const key = event.key;
  config.buttonMappings[listeningButtonId] = key;

  stopListening();
  populateBindings();
  showNotificationn(`✓ ${BUTTON_NAMES[listeningButtonId]} → ${getKeyDisplayName(key)}`);
}

function handleMouseBinding(event) {
  if (!isListening) return;

  event.preventDefault();
  event.stopPropagation();

  let mouseButton;
  switch(event.button) {
    case 0: mouseButton = 'MouseLeft'; break;
    case 1: mouseButton = 'MouseMiddle'; break;
    case 2: mouseButton = 'MouseRight'; break;
    case 3: mouseButton = 'MouseBack'; break;
    case 4: mouseButton = 'MouseForward'; break;
    default: mouseButton = `Mouse${event.button}`; break;
  }

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

  document.removeEventListener('keydown', handleKeyboardBinding);
  document.removeEventListener('mousedown', handleMouseBinding);
  document.removeEventListener('contextmenu', preventContextMenu);
}

// ===== SETTINGS UI HANDLERS =====
function initializeSettingsHandlers() {
  const sensitivitySlider = document.getElementById('sensitivity');
  if (sensitivitySlider) {
    sensitivitySlider.addEventListener('input', (e) => {
      config.sensitivity = parseInt(e.target.value);
      const valueDisplay = document.getElementById('sensitivity-value');
      if (valueDisplay) valueDisplay.textContent = e.target.value;
    });
  }

  const deadzoneSlider = document.getElementById('deadzone');
  if (deadzoneSlider) {
    deadzoneSlider.addEventListener('input', (e) => {
      config.deadzone = parseFloat(e.target.value);
      const valueDisplay = document.getElementById('deadzone-value');
      if (valueDisplay) valueDisplay.textContent = parseFloat(e.target.value).toFixed(2);
    });
  }

  const invertYCheckbox = document.getElementById('invertY');
  if (invertYCheckbox) {
    invertYCheckbox.addEventListener('change', (e) => {
      config.invertY = e.target.checked;
    });
  }
}

// Global functions for settings page
window.saveSettings = function() {
  saveConfig();
};

window.resetToDefaults = function() {
  if (confirm('Are you sure you want to reset all settings to default?')) {
    config = { ...DEFAULT_CONFIG };
    updateUI();
    saveConfig();
    showNotificationn('Settings reset to defaults');
  }
};

window.switchTab = function(tabName) {
  // Update tab buttons
  document.querySelectorAll('.controller-tab').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.querySelector(`.controller-tab[data-tab="${tabName}"]`);
  if (activeBtn) activeBtn.classList.add('active');

  // Update tab content
  document.querySelectorAll('.controller-tab-content').forEach(content => content.classList.remove('active'));
  const activeTab = document.getElementById(`${tabName}-tab`);
  if (activeTab) activeTab.classList.add('active');
};

function showNotificationn(message) {
  const notification = document.getElementById('notificationn');
  if (notification) {
    notification.textContent = message;
    notification.classList.add('show');

    // Remove previous timeout if exists
    if (notification.hideTimeout) {
      clearTimeout(notification.hideTimeout);
    }

    notification.hideTimeout = setTimeout(() => {
      notification.classList.remove('show');
    }, 3000);
  } else {
    console.log('Notification:', message);
  }
}

// ===== GAMEPAD CONNECTION EVENTS =====
window.addEventListener('gamepadconnected', (e) => {
  console.log('Gamepad connected:', e.gamepad.id);

  const statusElement = document.getElementById('controllerstatus');
  if (statusElement) {
    statusElement.classList.remove('disconnected');
    statusElement.classList.add('connected');

    // Friendly names for common controllers
    let controllerName = 'Controller Connected';
    if (e.gamepad.id.includes('Xbox') || e.gamepad.id.includes('360') || e.gamepad.id.includes('XInput')) {
      controllerName = 'Xbox Controller Connected';
    } else if (e.gamepad.id.includes('PlayStation') || e.gamepad.id.includes('DualShock') || e.gamepad.id.includes('DualSense')) {
      controllerName = 'PlayStation Controller Connected';
    } else if (e.gamepad.id.includes('Pro Controller')) {
      controllerName = 'Nintendo Pro Controller Connected';
    }

    // Update status with icon
    statusElement.innerHTML = `<span class="status-dot"></span>${controllerName}`;

    showNotificationn(`🎮 ${controllerName}`);
  }
});

window.addEventListener('gamepaddisconnected', (e) => {
  console.log('Gamepad disconnected:', e.gamepad.id);

  const statusElement = document.getElementById('controllerstatus');
  if (statusElement) {
    statusElement.classList.remove('connected');
    statusElement.classList.add('disconnected');
    statusElement.innerHTML = '<span class="status-dot"></span>No Controller Connected';

    showNotificationn('Controller disconnected');
  }

  // Release all pressed keys and buttons
  pressedKeys.forEach(key => sendKey(key, false));
  pressedKeys.clear();

  pressedMouseButtons.forEach(btn => sendMouseButton(btn, false));
  pressedMouseButtons.clear();
});

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
  console.log('GameInput.js initializing...');

  // Load configuration
  loadConfig();

  // Initialize iframe
  setTimeout(() => {
    initializeIframe();
  }, 100);

  // Initialize settings handlers
  setTimeout(() => {
    initializeSettingsHandlers();
  }, 500);

  // Start gamepad handling
  setTimeout(() => {
    console.log('Starting gamepad input handling');
    handleGamepadInput();
  }, 1000);
});

// Save config on page unload
window.addEventListener('beforeunload', () => {
  saveConfig();
});

console.log('GameInput.js loaded');
