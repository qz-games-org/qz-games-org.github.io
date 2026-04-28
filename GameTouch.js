// ===================================
// GameTouch.js - On-screen touch controls (mirrors GameInput.js dispatch)
// ===================================

(function() {
  // eslint-disable-next-line no-console
  console.log('[GameTouch] IIFE start — v2');

  if (window.QZGameTouchInput && window.QZGameTouchInput.__ready) {
    // eslint-disable-next-line no-console
    console.log('[GameTouch] already initialized, skipping');
    return;
  }

  // Flip to true at runtime in DevTools (`window.__qzTouchDebug = true`) to log every dispatch.
  let DEBUG = false;
  function debugLog() {
    if (!DEBUG && !window.__qzTouchDebug) return;
    // eslint-disable-next-line no-console
    console.log.apply(console, ['[touch]'].concat([].slice.call(arguments)));
  }

  // -----------------------------------------------------------------
  // Config
  // -----------------------------------------------------------------
  const DEFAULT_TOUCH_CONFIG = {
    enabled: 'auto',
    opacity: 0.65,
    joystickEnabled: true,
    buttonsEnabled: true,
    mouseLookSensitivity: 8,
    buttonMappings: {
      btnA: ' ',
      btnB: 'w',
      btnX: 'r',
      btnY: 'e',
      btnL1: 'q',
      btnR1: 'f'
    }
  };

  const TOUCH_BUTTON_LABELS = {
    btnA: 'A', btnB: 'B', btnX: 'X', btnY: 'Y', btnL1: 'L1', btnR1: 'R1'
  };
  const TOUCH_BUTTON_NAMES = {
    btnA: 'A Button',
    btnB: 'B Button',
    btnX: 'X Button',
    btnY: 'Y Button',
    btnL1: 'Left Shoulder (L1)',
    btnR1: 'Right Shoulder (R1)'
  };

  const JOYSTICK_RADIUS = 46;
  const MOVE_PRESS_THRESHOLD = 0.34;
  const MOVE_RELEASE_THRESHOLD = 0.22;

  // Standard Gamepad API button indices (Web Gamepad standard layout)
  const BUTTON_GAMEPAD_INDEX = {
    btnA: 0,   // South  / A
    btnB: 1,   // East   / B
    btnX: 2,   // West   / X
    btnY: 3,   // North  / Y
    btnL1: 4,  // Left bumper / L1
    btnR1: 5   // Right bumper / R1
  };

  // Virtual gamepad — injected into the iframe's navigator.getGamepads().
  // Unity WebGL and other games poll this directly; no synthetic keyboard events needed.
  const virtualGamepad = {
    id: 'QZ Virtual Touch Gamepad (Vendor: 0000 Product: 0001)',
    index: 0,
    connected: true,
    timestamp: 0,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 }))
  };
  let gamepadInjected = false;

  function setVirtualButton(buttonId, pressed) {
    const idx = BUTTON_GAMEPAD_INDEX[buttonId];
    if (idx == null) return;
    virtualGamepad.buttons[idx].pressed = pressed;
    virtualGamepad.buttons[idx].touched = pressed;
    virtualGamepad.buttons[idx].value = pressed ? 1 : 0;
  }

  function resetVirtualGamepad() {
    virtualGamepad.axes[0] = 0;
    virtualGamepad.axes[1] = 0;
    virtualGamepad.axes[2] = 0;
    virtualGamepad.axes[3] = 0;
    virtualGamepad.buttons.forEach((b) => {
      b.pressed = false;
      b.touched = false;
      b.value = 0;
    });
  }

  // Inject our virtual gamepad into the iframe's navigator.getGamepads().
  // Works by shadowing the method on the navigator instance (same-origin only).
  // Unity / Godot / other WebAssembly games poll getGamepads() every frame —
  // they'll see our virtual gamepad and respond to it without needing keyboard events.
  function injectVirtualGamepad(iframeWindow) {
    if (!iframeWindow) return false;
    try {
      const nav = iframeWindow.navigator;
      if (!nav || typeof nav.getGamepads !== 'function') return false;

      const orig = nav.getGamepads.bind(nav);
      Object.defineProperty(nav, 'getGamepads', {
        configurable: true,
        value: function getGamepads() {
          virtualGamepad.timestamp = iframeWindow.performance.now();
          const real = orig();
          // Slot 0: virtual gamepad (unless a real one is plugged in)
          if (real[0]) return real;
          return [virtualGamepad, real[1] || null, real[2] || null, real[3] || null];
        }
      });

      // Tell the game a gamepad appeared
      iframeWindow.dispatchEvent(
        new iframeWindow.GamepadEvent('gamepadconnected', { gamepad: virtualGamepad })
      );

      debugLog('virtual gamepad injected into iframe');
      return true;
    } catch (err) {
      console.warn('[touch] Virtual gamepad injection failed:', err);
      return false;
    }
  }

  // -----------------------------------------------------------------
  // Same key/mouse maps the controller uses, copied so we can fall
  // back to a direct dispatch when QZGameInput is not ready.
  // -----------------------------------------------------------------
  const SPECIAL_KEYS = {
    ' ':       { keyCode: 32, code: 'Space',       key: ' ' },
    Space:     { keyCode: 32, code: 'Space',       key: ' ' },
    Spacebar:  { keyCode: 32, code: 'Space',       key: ' ' },
    Escape:    { keyCode: 27, code: 'Escape',      key: 'Escape' },
    Enter:     { keyCode: 13, code: 'Enter',       key: 'Enter' },
    Shift:     { keyCode: 16, code: 'ShiftLeft',   key: 'Shift' },
    Control:   { keyCode: 17, code: 'ControlLeft', key: 'Control' },
    Ctrl:      { keyCode: 17, code: 'ControlLeft', key: 'Control' },
    Alt:       { keyCode: 18, code: 'AltLeft',     key: 'Alt' },
    Tab:       { keyCode:  9, code: 'Tab',         key: 'Tab' },
    ArrowUp:   { keyCode: 38, code: 'ArrowUp',     key: 'ArrowUp' },
    ArrowDown: { keyCode: 40, code: 'ArrowDown',   key: 'ArrowDown' },
    ArrowLeft: { keyCode: 37, code: 'ArrowLeft',   key: 'ArrowLeft' },
    ArrowRight:{ keyCode: 39, code: 'ArrowRight',  key: 'ArrowRight' }
  };

  const MOUSE_BUTTONS = {
    MouseLeft: 0, MouseMiddle: 1, MouseRight: 2, MouseBack: 3, MouseForward: 4
  };

  function getKeyInfo(key) {
    if (SPECIAL_KEYS[key]) return SPECIAL_KEYS[key];
    const text = String(key || '');
    if (/^[a-z]$/i.test(text)) {
      const lower = text.toLowerCase();
      return { key: lower, code: `Key${lower.toUpperCase()}`, keyCode: lower.toUpperCase().charCodeAt(0) };
    }
    if (/^[0-9]$/.test(text)) {
      return { key: text, code: `Digit${text}`, keyCode: text.charCodeAt(0) };
    }
    return { key: text, code: text, keyCode: text.length > 0 ? text.toUpperCase().charCodeAt(0) : 0 };
  }

  function defineLegacyKeyboardProps(event, keyInfo) {
    const props = {
      keyCode: keyInfo.keyCode,
      which: keyInfo.keyCode,
      charCode: keyInfo.key.length === 1 ? keyInfo.keyCode : 0
    };
    Object.entries(props).forEach(([name, value]) => {
      try {
        Object.defineProperty(event, name, { configurable: true, get: () => value });
      } catch (err) { /* legacy props locked on some browsers */ }
    });
  }

  // -----------------------------------------------------------------
  // Local iframe binding (independent of QZGameInput, so a stale
  // QZGameInput state can't break us). Mirrors GameInput.js exactly.
  // -----------------------------------------------------------------
  const local = {
    frame: null,
    boundFrame: null,
    w: null,
    d: null,
    canvas: null,
    keyOwners: new Map(),
    mouseOwners: new Map()
  };

  function setupLocalTarget() {
    if (!local.frame) return false;
    try {
      local.w = local.frame.contentWindow;
      local.d = local.frame.contentDocument || (local.w && local.w.document) || null;
      local.canvas = local.d ? (local.d.querySelector('#unity-canvas, canvas') || local.d.body || local.d.documentElement) : null;
      if (local.canvas && local.canvas !== local.d.body && local.canvas.tabIndex < 0) {
        local.canvas.tabIndex = -1;
      }
      return Boolean(local.w && local.d && local.canvas);
    } catch (err) {
      local.w = null;
      local.d = null;
      local.canvas = null;
      return false;
    }
  }

  function refreshLocalFrame() {
    const next = document.getElementById('gameiframe');
    if (!next) {
      local.frame = null;
      local.w = null;
      local.d = null;
      local.canvas = null;
      return false;
    }
    local.frame = next;
    if (local.boundFrame !== local.frame) {
      if (local.boundFrame) {
        local.boundFrame.removeEventListener('load', setupLocalTarget);
      }
      local.boundFrame = local.frame;
      local.boundFrame.addEventListener('load', setupLocalTarget);
    }
    return setupLocalTarget();
  }

  function ensureLocalTarget() {
    if (local.w && local.canvas) return true;
    return refreshLocalFrame();
  }

  function getOwnerSet(map, name) {
    let set = map.get(name);
    if (!set) {
      set = new Set();
      map.set(name, set);
    }
    return set;
  }

  // -----------------------------------------------------------------
  // Primary dispatch: route through QZGameInput so we share its
  // owner-tracked state with the controller. Fall back to a direct
  // dispatch (identical event construction) if QZGameInput is gone.
  // -----------------------------------------------------------------
  function localSendKey(key, pressed, owner) {
    if (!ensureLocalTarget()) {
      debugLog('localSendKey: no canvas');
      return false;
    }
    const owners = getOwnerSet(local.keyOwners, key);
    if (pressed && owners.has(owner)) return true;
    if (!pressed && !owners.has(owner)) {
      if (owners.size === 0) local.keyOwners.delete(key);
      return true;
    }
    if (pressed && owners.size > 0) { owners.add(owner); return true; }
    if (!pressed && owners.size > 1) { owners.delete(owner); return true; }

    try {
      const info = getKeyInfo(key);
      const event = new local.w.KeyboardEvent(pressed ? 'keydown' : 'keyup', {
        bubbles: true,
        cancelable: true,
        key: info.key,
        code: info.code,
        location: 0,
        repeat: false,
        view: local.w
      });
      defineLegacyKeyboardProps(event, info);
      local.canvas.dispatchEvent(event);

      if (pressed) owners.add(owner);
      else {
        owners.delete(owner);
        if (owners.size === 0) local.keyOwners.delete(key);
      }
      debugLog('local key', pressed ? 'down' : 'up', key);
      return true;
    } catch (err) {
      console.error('[touch] localSendKey error:', err);
      return false;
    }
  }

  function localSendMouseButton(name, pressed, owner) {
    if (!ensureLocalTarget()) return false;
    const button = MOUSE_BUTTONS[name];
    if (typeof button !== 'number') return false;
    const owners = getOwnerSet(local.mouseOwners, name);
    if (pressed && owners.has(owner)) return true;
    if (!pressed && !owners.has(owner)) {
      if (owners.size === 0) local.mouseOwners.delete(name);
      return true;
    }
    if (pressed && owners.size > 0) { owners.add(owner); return true; }
    if (!pressed && owners.size > 1) { owners.delete(owner); return true; }

    try {
      const event = new local.w.MouseEvent(pressed ? 'mousedown' : 'mouseup', {
        bubbles: true, cancelable: true, button,
        buttons: pressed ? (button === 2 ? 2 : 1) : 0,
        clientX: 0, clientY: 0
      });
      local.canvas.dispatchEvent(event);
      if (!pressed && button === 0) {
        local.canvas.dispatchEvent(new local.w.MouseEvent('click', {
          bubbles: true, cancelable: true, button: 0, buttons: 0, clientX: 0, clientY: 0
        }));
      }
      if (pressed) owners.add(owner);
      else {
        owners.delete(owner);
        if (owners.size === 0) local.mouseOwners.delete(name);
      }
      return true;
    } catch (err) {
      console.error('[touch] localSendMouseButton error:', err);
      return false;
    }
  }

  function localSendMouseMove(dx, dy) {
    if (!ensureLocalTarget()) return false;
    try {
      const event = new local.w.MouseEvent('mousemove', {
        bubbles: true, cancelable: true, clientX: 0, clientY: 0
      });
      Object.defineProperty(event, 'movementX', { configurable: true, value: dx });
      Object.defineProperty(event, 'movementY', { configurable: true, value: dy });
      local.canvas.dispatchEvent(event);
      return true;
    } catch (err) {
      console.error('[touch] localSendMouseMove error:', err);
      return false;
    }
  }

  function dispatchKey(key, pressed, owner) {
    if (window.QZGameInput && typeof window.QZGameInput.sendKey === 'function') {
      const ok = window.QZGameInput.sendKey(key, pressed, { owner });
      debugLog('QZ key', pressed ? 'down' : 'up', key, '=>', ok);
      if (ok) return true;
      // QZGameInput returned false (target not ready) — fall through to local.
    }
    return localSendKey(key, pressed, owner);
  }

  function dispatchMouseButton(name, pressed, owner) {
    if (window.QZGameInput && typeof window.QZGameInput.sendMouseButton === 'function') {
      const ok = window.QZGameInput.sendMouseButton(name, pressed, { owner });
      if (ok) return true;
    }
    return localSendMouseButton(name, pressed, owner);
  }

  function dispatchMouseMove(dx, dy) {
    if (window.QZGameInput && typeof window.QZGameInput.sendMouseMove === 'function') {
      if (window.QZGameInput.sendMouseMove(dx, dy)) return true;
    }
    return localSendMouseMove(dx, dy);
  }

  function dispatchBinding(binding, pressed, owner) {
    if (!binding) return false;
    return String(binding).startsWith('Mouse')
      ? dispatchMouseButton(binding, pressed, owner)
      : dispatchKey(binding, pressed, owner);
  }

  // Eagerly tell QZGameInput to bind to the iframe too.
  function refreshAllInputTargets() {
    refreshLocalFrame();
    if (window.QZGameInput && typeof window.QZGameInput.refreshFrame === 'function') {
      try { window.QZGameInput.refreshFrame(); } catch (err) { /* noop */ }
    }
    // Inject virtual gamepad into the iframe once we have its window.
    if (local.w && !gamepadInjected) {
      gamepadInjected = injectVirtualGamepad(local.w);
    }
  }

  // -----------------------------------------------------------------
  // State
  // -----------------------------------------------------------------
  const state = {
    config: cloneConfig(DEFAULT_TOUCH_CONFIG),
    left: {
      pointerKey: null,
      origin: { x: 0, y: 0 },
      x: 0,           // last-known normalized X from touchmove (read by rAF loop)
      y: 0,           // last-known normalized Y from touchmove (read by rAF loop)
      rafId: null,    // rAF loop id — same pattern as right stick
      activeKeys: new Set()
    },
    right: {
      pointerKey: null,
      origin: { x: 0, y: 0 },
      x: 0,
      y: 0,
      rafId: null,
      lastTime: 0
    },
    buttons: new Map(),
    listening: { active: false, buttonId: null, element: null }
  };

  function cloneConfig(config) {
    return { ...config, buttonMappings: { ...(config.buttonMappings || {}) } };
  }

  function normalizeConfig(config) {
    return {
      ...cloneConfig(DEFAULT_TOUCH_CONFIG),
      ...(config || {}),
      opacity: Number.isFinite(parseFloat(config && config.opacity))
        ? Math.min(1, Math.max(0.2, parseFloat(config.opacity)))
        : DEFAULT_TOUCH_CONFIG.opacity,
      mouseLookSensitivity: Number.isFinite(parseFloat(config && config.mouseLookSensitivity))
        ? Math.max(0, parseFloat(config.mouseLookSensitivity))
        : DEFAULT_TOUCH_CONFIG.mouseLookSensitivity,
      buttonMappings: {
        ...DEFAULT_TOUCH_CONFIG.buttonMappings,
        ...((config && config.buttonMappings) || {})
      }
    };
  }

  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    return parts.length === 2 ? parts.pop().split(';').shift() : null;
  }

  function setCookie(name, value, days = 365) {
    try {
      const expires = new Date(Date.now() + days * 864e5).toUTCString();
      document.cookie = `${name}=${encodeURIComponent(JSON.stringify(value))};expires=${expires};path=/`;
      return true;
    } catch (err) { return false; }
  }

  function loadTouchConfig() {
    try {
      const saved = getCookie('user_game_touch_config');
      state.config = saved
        ? normalizeConfig(JSON.parse(decodeURIComponent(saved)))
        : normalizeConfig(DEFAULT_TOUCH_CONFIG);
    } catch (err) {
      state.config = normalizeConfig(DEFAULT_TOUCH_CONFIG);
      setCookie('user_game_touch_config', '', -1);
    }
  }

  function saveTouchConfig() {
    setCookie('user_game_touch_config', state.config);
  }

  function isTouchFirstDevice() {
    return Boolean(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  }

  // -----------------------------------------------------------------
  // Pointer/touch helpers — we accept both pointer events and
  // touch events. Each "touch" gets a stable key string we use to
  // match move/end against the start.
  // -----------------------------------------------------------------
  function pointerKeyFromPointer(event) {
    return `pointer:${event.pointerId}`;
  }
  function pointerKeyFromTouch(touch) {
    return `touch:${touch.identifier}`;
  }

  function clampStick(clientX, clientY, origin) {
    const dx = clientX - origin.x;
    const dy = clientY - origin.y;
    const distance = Math.hypot(dx, dy);
    const clamped = Math.min(distance, JOYSTICK_RADIUS);
    const angle = Math.atan2(dy, dx);
    return {
      x: distance > 0 ? Math.cos(angle) * clamped : 0,
      y: distance > 0 ? Math.sin(angle) * clamped : 0,
      normalizedX: distance > 0 ? (Math.cos(angle) * clamped) / JOYSTICK_RADIUS : 0,
      normalizedY: distance > 0 ? (Math.sin(angle) * clamped) / JOYSTICK_RADIUS : 0
    };
  }

  function setStickVisual(side, origin, stick) {
    const suffix = side === 'right' ? '-right' : '';
    const zone = document.getElementById(`touch-joystick-zone${suffix}`);
    const base = document.getElementById(`touch-stick-base${suffix}`);
    const knob = document.getElementById(`touch-stick-knob${suffix}`);
    if (!zone || !base || !knob) return;
    const rect = zone.getBoundingClientRect();
    const baseX = origin.x - rect.left;
    const baseY = origin.y - rect.top;
    base.style.left = `${baseX}px`;
    base.style.top = `${baseY}px`;
    base.style.display = 'block';
    knob.style.left = `${baseX + stick.x}px`;
    knob.style.top = `${baseY + stick.y}px`;
    knob.style.display = 'block';
  }

  function resetStickVisual(side) {
    const suffix = side === 'right' ? '-right' : '';
    const base = document.getElementById(`touch-stick-base${suffix}`);
    const knob = document.getElementById(`touch-stick-knob${suffix}`);
    if (base) base.style.display = 'none';
    if (knob) knob.style.display = 'none';
  }

  function shouldPressAxis(value, positiveKey, negativeKey) {
    const active = state.left.activeKeys;
    const posThreshold = active.has(positiveKey) ? MOVE_RELEASE_THRESHOLD : MOVE_PRESS_THRESHOLD;
    const negThreshold = active.has(negativeKey) ? MOVE_RELEASE_THRESHOLD : MOVE_PRESS_THRESHOLD;
    if (value > posThreshold) return positiveKey;
    if (value < -negThreshold) return negativeKey;
    return null;
  }

  function updateLeftKeys(normalizedX, normalizedY) {
    const desired = new Set();
    const horiz = shouldPressAxis(normalizedX, 'd', 'a');
    const vert  = shouldPressAxis(normalizedY, 's', 'w');
    if (horiz) desired.add(horiz);
    if (vert)  desired.add(vert);

    Array.from(state.left.activeKeys).forEach((key) => {
      if (!desired.has(key)) {
        dispatchKey(key, false, `touch:left-stick:${key}`);
        state.left.activeKeys.delete(key);
      }
    });
    desired.forEach((key) => {
      if (!state.left.activeKeys.has(key) && dispatchKey(key, true, `touch:left-stick:${key}`)) {
        state.left.activeKeys.add(key);
      }
    });
  }

  // rAF loop for left stick — identical rhythm to the controller's gamepad poll.
  // touchmove only stores x/y; this loop reads them at 60fps to dispatch keys.
  // This eliminates the 120Hz jitter that caused rapid keydown/keyup flicker.
  function leftStickTick() {
    if (!state.left.pointerKey) {
      state.left.rafId = null;
      return;
    }
    // Feed virtual gamepad axes (for Unity / Gamepad-API-aware games)
    virtualGamepad.axes[0] = state.left.x;
    virtualGamepad.axes[1] = state.left.y;
    // Also dispatch keyboard events (fallback for games that only use keyboard)
    updateLeftKeys(state.left.x, state.left.y);
    state.left.rafId = requestAnimationFrame(leftStickTick);
  }

  function releaseLeftStick() {
    if (state.left.rafId) {
      cancelAnimationFrame(state.left.rafId);
      state.left.rafId = null;
    }
    state.left.activeKeys.forEach((key) => dispatchKey(key, false, `touch:left-stick:${key}`));
    state.left.activeKeys.clear();
    state.left.pointerKey = null;
    state.left.x = 0;
    state.left.y = 0;
    virtualGamepad.axes[0] = 0;
    virtualGamepad.axes[1] = 0;
    resetStickVisual('left');
  }

  function rightLookTick() {
    if (!state.right.pointerKey) {
      state.right.rafId = null;
      return;
    }
    const now = performance.now();
    const dt = state.right.lastTime ? Math.min(0.05, Math.max(0, (now - state.right.lastTime) / 1000)) : 0.016;
    state.right.lastTime = now;

    // Feed virtual gamepad right stick axes
    virtualGamepad.axes[2] = state.right.x;
    virtualGamepad.axes[3] = state.right.y;

    // Also dispatch mouse-move events (for pointer-lock / FPS games)
    const sensitivity = state.config.mouseLookSensitivity * 60;
    const dx = state.right.x * sensitivity * dt;
    const dy = state.right.y * sensitivity * dt;
    if (Math.abs(dx) >= 0.1 || Math.abs(dy) >= 0.1) {
      dispatchMouseMove(dx, dy);
    }
    state.right.rafId = requestAnimationFrame(rightLookTick);
  }

  function stopRightLook() {
    if (state.right.rafId) {
      cancelAnimationFrame(state.right.rafId);
      state.right.rafId = null;
    }
    state.right.pointerKey = null;
    state.right.x = 0;
    state.right.y = 0;
    state.right.lastTime = 0;
    virtualGamepad.axes[2] = 0;
    virtualGamepad.axes[3] = 0;
    resetStickVisual('right');
  }

  // -----------------------------------------------------------------
  // Joystick — accepts both pointer and touch events
  // -----------------------------------------------------------------
  function startStick(side, key, clientX, clientY) {
    if (!state.config.joystickEnabled) return false;
    refreshAllInputTargets();
    if (side === 'left') {
      if (state.left.pointerKey) return false;
      state.left.pointerKey = key;
      state.left.origin = { x: clientX, y: clientY };
      state.left.x = 0;
      state.left.y = 0;
      setStickVisual('left', state.left.origin, { x: 0, y: 0 });
      if (!state.left.rafId) {
        state.left.rafId = requestAnimationFrame(leftStickTick);
      }
      debugLog('left stick start', key);
      return true;
    }
    if (state.right.pointerKey) return false;
    state.right.pointerKey = key;
    state.right.origin = { x: clientX, y: clientY };
    state.right.x = 0;
    state.right.y = 0;
    state.right.lastTime = 0;
    setStickVisual('right', state.right.origin, { x: 0, y: 0 });
    if (!state.right.rafId) {
      state.right.rafId = requestAnimationFrame(rightLookTick);
    }
    debugLog('right stick start', key);
    return true;
  }

  function moveStick(side, key, clientX, clientY) {
    if (side === 'left') {
      if (state.left.pointerKey !== key) return;
      const stick = clampStick(clientX, clientY, state.left.origin);
      // Store position only — the rAF loop (leftStickTick) reads it at 60fps.
      // Calling updateLeftKeys here directly caused 120Hz flicker from touch jitter.
      state.left.x = stick.normalizedX;
      state.left.y = stick.normalizedY;
      setStickVisual('left', state.left.origin, stick);
      return;
    }
    if (state.right.pointerKey !== key) return;
    const stick = clampStick(clientX, clientY, state.right.origin);
    state.right.x = stick.normalizedX;
    state.right.y = stick.normalizedY;
    setStickVisual('right', state.right.origin, stick);
  }

  function endStick(side, key) {
    if (side === 'left') {
      if (state.left.pointerKey !== key) return;
      releaseLeftStick();
      return;
    }
    if (state.right.pointerKey !== key) return;
    stopRightLook();
  }

  // -----------------------------------------------------------------
  // Action buttons
  // -----------------------------------------------------------------
  function pressButton(buttonId) {
    if (!state.config.buttonsEnabled || state.buttons.get(buttonId)) return false;
    // Mark pressed and show visual feedback immediately — don't gate on dispatch success.
    state.buttons.set(buttonId, true);
    const el = document.getElementById(`touch-btn-${buttonId}`);
    if (el) el.classList.add('active');
    refreshAllInputTargets();
    // Feed virtual gamepad button (Gamepad-API-aware games, e.g. Unity WebGL)
    setVirtualButton(buttonId, true);
    // Also dispatch keyboard/mouse binding (fallback for keyboard-only games)
    const ok = dispatchBinding(state.config.buttonMappings[buttonId], true, `touch:button:${buttonId}`);
    debugLog('button down', buttonId, '->', state.config.buttonMappings[buttonId], '| dispatch ok:', ok);
    return true;
  }

  function releaseButton(buttonId) {
    if (!state.buttons.get(buttonId)) return;
    state.buttons.set(buttonId, false);
    const el = document.getElementById(`touch-btn-${buttonId}`);
    if (el) el.classList.remove('active');
    setVirtualButton(buttonId, false);
    const ok = dispatchBinding(state.config.buttonMappings[buttonId], false, `touch:button:${buttonId}`);
    debugLog('button up', buttonId, '| dispatch ok:', ok);
  }

  function releaseAllButtons() {
    Array.from(state.buttons.keys()).forEach(releaseButton);
  }

  function releaseAll() {
    releaseLeftStick();
    stopRightLook();
    releaseAllButtons();
    resetVirtualGamepad();
  }

  // -----------------------------------------------------------------
  // Event wiring — listens to BOTH pointer events and raw touch
  // events for maximum mobile reliability.
  // -----------------------------------------------------------------
  function bindStickEvents(zone, side) {
    if (!zone) return;

    // Pointer events
    zone.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      event.preventDefault();
      const key = pointerKeyFromPointer(event);
      if (startStick(side, key, event.clientX, event.clientY)) {
        try { zone.setPointerCapture(event.pointerId); } catch (err) { /* noop */ }
      }
    }, { passive: false });

    zone.addEventListener('pointermove', (event) => {
      const key = pointerKeyFromPointer(event);
      moveStick(side, key, event.clientX, event.clientY);
    }, { passive: false });

    const endPointer = (event) => {
      const key = pointerKeyFromPointer(event);
      endStick(side, key);
      try { zone.releasePointerCapture(event.pointerId); } catch (err) { /* noop */ }
    };
    zone.addEventListener('pointerup', endPointer, { passive: false });
    zone.addEventListener('pointercancel', endPointer, { passive: false });
    zone.addEventListener('lostpointercapture', endPointer, { passive: false });

    // Touch events (iOS reliability)
    zone.addEventListener('touchstart', (event) => {
      event.preventDefault();
      const touch = event.changedTouches[0];
      if (!touch) return;
      const key = pointerKeyFromTouch(touch);
      startStick(side, key, touch.clientX, touch.clientY);
    }, { passive: false });

    zone.addEventListener('touchmove', (event) => {
      event.preventDefault();
      Array.from(event.changedTouches).forEach((touch) => {
        const key = pointerKeyFromTouch(touch);
        moveStick(side, key, touch.clientX, touch.clientY);
      });
    }, { passive: false });

    const endTouch = (event) => {
      event.preventDefault();
      Array.from(event.changedTouches).forEach((touch) => {
        const key = pointerKeyFromTouch(touch);
        endStick(side, key);
      });
    };
    zone.addEventListener('touchend', endTouch, { passive: false });
    zone.addEventListener('touchcancel', endTouch, { passive: false });
  }

  function createTouchButton(buttonId, shoulder) {
    state.buttons.set(buttonId, false);

    const button = document.createElement('button');
    button.id = `touch-btn-${buttonId}`;
    button.className = shoulder ? 'touch-btn touch-btn-shoulder' : 'touch-btn';
    button.type = 'button';
    button.textContent = TOUCH_BUTTON_LABELS[buttonId];
    button.setAttribute('aria-label', TOUCH_BUTTON_NAMES[buttonId]);

    // Pointer events
    button.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      pressButton(buttonId);
      try { button.setPointerCapture(event.pointerId); } catch (err) { /* noop */ }
    }, { passive: false });

    const endPointer = (event) => {
      event.preventDefault();
      event.stopPropagation();
      releaseButton(buttonId);
      try { button.releasePointerCapture(event.pointerId); } catch (err) { /* noop */ }
    };
    button.addEventListener('pointerup', endPointer, { passive: false });
    button.addEventListener('pointercancel', endPointer, { passive: false });
    button.addEventListener('lostpointercapture', endPointer, { passive: false });

    // Touch events (mobile)
    button.addEventListener('touchstart', (event) => {
      event.preventDefault();
      event.stopPropagation();
      pressButton(buttonId);
    }, { passive: false });

    const endTouch = (event) => {
      event.preventDefault();
      event.stopPropagation();
      releaseButton(buttonId);
    };
    button.addEventListener('touchend', endTouch, { passive: false });
    button.addEventListener('touchcancel', endTouch, { passive: false });

    // Suppress synthetic mouse click (so iframe under doesn't get it)
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
    });

    // Mouse fallback (desktop testing)
    button.addEventListener('contextmenu', (event) => event.preventDefault());

    return button;
  }

  // -----------------------------------------------------------------
  // Overlay build & visibility
  // -----------------------------------------------------------------
  function clearGeneratedControls(zone) {
    zone.querySelectorAll('.touch-top-row').forEach((el) => el.remove());
  }

  function buildOverlay() {
    const overlay   = document.getElementById('touch-overlay');
    const leftZone  = document.getElementById('touch-zone-left');
    const rightZone = document.getElementById('touch-zone-right');
    if (!overlay || !leftZone || !rightZone) return;

    overlay.style.opacity = state.config.opacity;
    clearGeneratedControls(leftZone);
    clearGeneratedControls(rightZone);

    // Left side: L1 + (Y, X)
    const leftRow  = document.createElement('div');
    leftRow.className = 'touch-top-row';
    const leftPair = document.createElement('div');
    leftPair.className = 'touch-face-pair';
    leftPair.appendChild(createTouchButton('btnY'));
    leftPair.appendChild(createTouchButton('btnX'));
    leftRow.appendChild(createTouchButton('btnL1', true));
    leftRow.appendChild(leftPair);
    leftZone.insertBefore(leftRow, document.getElementById('touch-joystick-zone'));

    // Right side: (A, B) + R1
    const rightRow  = document.createElement('div');
    rightRow.className = 'touch-top-row';
    const rightPair = document.createElement('div');
    rightPair.className = 'touch-face-pair';
    rightPair.appendChild(createTouchButton('btnA'));
    rightPair.appendChild(createTouchButton('btnB'));
    rightRow.appendChild(rightPair);
    rightRow.appendChild(createTouchButton('btnR1', true));
    rightZone.insertBefore(rightRow, document.getElementById('touch-joystick-zone-right'));

    bindStickEvents(document.getElementById('touch-joystick-zone'), 'left');
    bindStickEvents(document.getElementById('touch-joystick-zone-right'), 'right');

    applyZoneVisibility();
  }

  function applyZoneVisibility() {
    ['touch-joystick-zone', 'touch-joystick-zone-right'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.style.display = state.config.joystickEnabled ? '' : 'none';
    });
    ['#touch-zone-left .touch-top-row', '#touch-zone-right .touch-top-row'].forEach((sel) => {
      const el = document.querySelector(sel);
      if (el) el.style.display = state.config.buttonsEnabled ? '' : 'none';
    });
    if (!state.config.joystickEnabled) { releaseLeftStick(); stopRightLook(); }
    if (!state.config.buttonsEnabled)  { releaseAllButtons(); }
  }

  function showTouchOverlay() {
    const overlay = document.getElementById('touch-overlay');
    if (overlay) {
      overlay.classList.remove('hidden');
      overlay.style.opacity = state.config.opacity;
    }
    const button = document.getElementById('touch-toggle-btn');
    if (button) button.classList.add('touch-active');
    refreshAllInputTargets();
  }

  function hideTouchOverlay() {
    const overlay = document.getElementById('touch-overlay');
    if (overlay) overlay.classList.add('hidden');
    releaseAll();
    const button = document.getElementById('touch-toggle-btn');
    if (button) button.classList.remove('touch-active');
  }

  function toggleTouchOverlay() {
    const overlay = document.getElementById('touch-overlay');
    if (!overlay) return;
    if (overlay.classList.contains('hidden')) showTouchOverlay();
    else hideTouchOverlay();
  }

  function applyEnabledMode() {
    if (state.config.enabled === 'on' || (state.config.enabled === 'auto' && isTouchFirstDevice())) {
      showTouchOverlay();
    } else {
      hideTouchOverlay();
    }
  }

  // -----------------------------------------------------------------
  // Settings UI (mirrors controller bindings UI)
  // -----------------------------------------------------------------
  function getKeyDisplay(key) {
    const names = {
      ' ': 'Space', Escape: 'Esc', Enter: 'Enter', Shift: 'Shift',
      Control: 'Ctrl', Alt: 'Alt', Tab: 'Tab',
      MouseLeft: 'LMB', MouseRight: 'RMB', MouseMiddle: 'MMB'
    };
    return names[key] || (String(key).length === 1 ? String(key).toUpperCase() : String(key || '-'));
  }

  function updateTouchUI() {
    const setValue   = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    const setChecked = (id, v) => { const el = document.getElementById(id); if (el) el.checked = v; };
    const setText    = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

    setValue('touch-enable-select', state.config.enabled);
    setValue('touch-opacity', state.config.opacity);
    setChecked('touch-joystick-toggle', state.config.joystickEnabled);
    setChecked('touch-buttons-toggle', state.config.buttonsEnabled);
    setText('touch-opacity-value', `${Math.round(state.config.opacity * 100)}%`);
    populateTouchBindings();
  }

  function populateTouchBindings() {
    const container = document.getElementById('touch-bindings');
    if (!container) return;
    container.innerHTML = '';

    Object.entries(TOUCH_BUTTON_NAMES).forEach(([buttonId, name]) => {
      const item = document.createElement('div');
      item.className = 'binding-item';
      item.innerHTML = `
        <div>
          <strong>${name}</strong>
          <div class="bind-current">Currently: ${getKeyDisplay(state.config.buttonMappings[buttonId])}</div>
        </div>
        <button class="bind-button" type="button">Rebind</button>
      `;
      item.querySelector('.bind-button').addEventListener('click', () => {
        startTouchListening(buttonId, item.querySelector('.bind-button'));
      });
      container.appendChild(item);
    });
  }

  function startTouchListening(buttonId, button) {
    if (state.listening.active) return;
    state.listening.active = true;
    state.listening.buttonId = buttonId;
    state.listening.element = button;
    button.textContent = 'Press key...';
    button.classList.add('listening');
    document.addEventListener('keydown', handleTouchKeyBinding, true);
    document.addEventListener('mousedown', handleTouchMouseBinding, true);
  }

  function stopTouchListening() {
    if (state.listening.element) {
      state.listening.element.textContent = 'Rebind';
      state.listening.element.classList.remove('listening');
    }
    state.listening.active = false;
    state.listening.buttonId = null;
    state.listening.element = null;
    document.removeEventListener('keydown', handleTouchKeyBinding, true);
    document.removeEventListener('mousedown', handleTouchMouseBinding, true);
  }

  function handleTouchKeyBinding(event) {
    if (!state.listening.active) return;
    event.preventDefault(); event.stopPropagation();
    if (event.key === 'Escape') { stopTouchListening(); showTouchNotification('Binding cancelled'); return; }
    state.config.buttonMappings[state.listening.buttonId] = event.key;
    stopTouchListening();
    populateTouchBindings();
    showTouchNotification(`${TOUCH_BUTTON_NAMES[state.listening.buttonId]} bound to ${getKeyDisplay(event.key)}`);
  }

  function handleTouchMouseBinding(event) {
    if (!state.listening.active) return;
    event.preventDefault(); event.stopPropagation();
    const mouseButton = ['MouseLeft', 'MouseMiddle', 'MouseRight'][event.button] || `Mouse${event.button}`;
    state.config.buttonMappings[state.listening.buttonId] = mouseButton;
    stopTouchListening();
    populateTouchBindings();
    showTouchNotification(`${TOUCH_BUTTON_NAMES[state.listening.buttonId]} bound to ${getKeyDisplay(mouseButton)}`);
  }

  function showTouchNotification(message) {
    const n = document.getElementById('notificationn');
    if (!n) return;
    n.textContent = message;
    n.classList.add('show');
    clearTimeout(n._touchHideTimer);
    n._touchHideTimer = setTimeout(() => n.classList.remove('show'), 3000);
  }

  function initTouchSettingsHandlers() {
    const enableSelect   = document.getElementById('touch-enable-select');
    const opacitySlider  = document.getElementById('touch-opacity');
    const joystickToggle = document.getElementById('touch-joystick-toggle');
    const buttonsToggle  = document.getElementById('touch-buttons-toggle');

    if (enableSelect) {
      enableSelect.addEventListener('change', (e) => { state.config.enabled = e.target.value; });
    }
    if (opacitySlider) {
      opacitySlider.addEventListener('input', (e) => {
        state.config.opacity = parseFloat(e.target.value);
        const v = document.getElementById('touch-opacity-value');
        if (v) v.textContent = `${Math.round(state.config.opacity * 100)}%`;
        const overlay = document.getElementById('touch-overlay');
        if (overlay) overlay.style.opacity = state.config.opacity;
      });
    }
    if (joystickToggle) {
      joystickToggle.addEventListener('change', (e) => {
        state.config.joystickEnabled = e.target.checked;
        applyZoneVisibility();
      });
    }
    if (buttonsToggle) {
      buttonsToggle.addEventListener('change', (e) => {
        state.config.buttonsEnabled = e.target.checked;
        applyZoneVisibility();
      });
    }
  }

  // -----------------------------------------------------------------
  // Iframe load watcher
  // -----------------------------------------------------------------
  function onGameIframeLoad() {
    releaseAll();
    resetVirtualGamepad();
    gamepadInjected = false; // re-inject on each new page load
    window.setTimeout(refreshAllInputTargets, 50);
    window.setTimeout(refreshAllInputTargets, 500);
    // Unity WebGL takes a few seconds to init — retry injection several times
    window.setTimeout(refreshAllInputTargets, 1500);
    window.setTimeout(refreshAllInputTargets, 3000);
  }

  function initTouchIframeWatcher() {
    const frame = document.getElementById('gameiframe');
    if (frame) {
      frame.addEventListener('load', onGameIframeLoad);
    }
    refreshAllInputTargets();
    // The iframe element may not even exist yet (catalog flow). Retry a few times.
    if (!frame) {
      let tries = 0;
      const retry = () => {
        if (tries++ > 20) return;
        const f = document.getElementById('gameiframe');
        if (f) {
          f.addEventListener('load', onGameIframeLoad);
          refreshAllInputTargets();
          return;
        }
        window.setTimeout(retry, 250);
      };
      retry();
    }
  }

  // -----------------------------------------------------------------
  // Init
  // -----------------------------------------------------------------
  function initGameTouch() {
    loadTouchConfig();
    buildOverlay();
    initTouchIframeWatcher();
    initTouchSettingsHandlers();
    updateTouchUI();
    applyEnabledMode();

    const previousSave = window.saveSettings;
    window.saveSettings = function() {
      if (typeof previousSave === 'function') previousSave();
      state.config = normalizeConfig(state.config);
      saveTouchConfig();
      applyEnabledMode();
    };

    const previousReset = window.resetToDefaults;
    window.resetToDefaults = function() {
      if (typeof previousReset === 'function') previousReset();
      state.config = normalizeConfig(DEFAULT_TOUCH_CONFIG);
      saveTouchConfig();
      updateTouchUI();
      applyZoneVisibility();
      applyEnabledMode();
    };

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) releaseAll();
      else refreshAllInputTargets();
    });

    window.addEventListener('focus', refreshAllInputTargets);
  }

  // eslint-disable-next-line no-console
  console.log('[GameTouch] registering window.QZGameTouchInput');

  window.QZGameTouchInput = {
    __ready: true,
    show: showTouchOverlay,
    hide: hideTouchOverlay,
    toggle: toggleTouchOverlay,
    releaseAll,
    isVisible: () => {
      const overlay = document.getElementById('touch-overlay');
      return overlay ? !overlay.classList.contains('hidden') : false;
    },
    getConfig: () => normalizeConfig(state.config),
    saveConfig: saveTouchConfig,
    updateUI: updateTouchUI,
    setDebug: (v) => { DEBUG = Boolean(v); window.__qzTouchDebug = Boolean(v); },
    refreshFrame: refreshAllInputTargets,
    // Expose dispatch helpers for one-off testing in DevTools.
    _dispatchKey: dispatchKey,
    _dispatchBinding: dispatchBinding,
    _dispatchMouseMove: dispatchMouseMove
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGameTouch, { once: true });
  } else {
    initGameTouch();
  }
})();
