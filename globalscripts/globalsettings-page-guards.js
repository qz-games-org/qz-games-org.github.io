(function() {
  let shouldConfirmPageClose = false;

  function getCookieValue(name) {
    if (typeof getCookie !== 'function') {
      return null;
    }

    return getCookie(name);
  }

  function handleBeforeUnload(e) {
    if (!shouldConfirmPageClose) {
      return;
    }

    e.preventDefault();
    e.returnValue = '';
    return '';
  }

  function enablePreventPageClose() {
    if (shouldConfirmPageClose) {
      return;
    }

    shouldConfirmPageClose = true;
    window.addEventListener('beforeunload', handleBeforeUnload);
  }

  function disablePreventPageClose() {
    if (!shouldConfirmPageClose) {
      return;
    }

    shouldConfirmPageClose = false;
    window.removeEventListener('beforeunload', handleBeforeUnload);
  }

  function applyPreventPageClose() {
    const preventPageClose = getCookieValue('preventPageClose');
    if (preventPageClose !== 'true') {
      disablePreventPageClose();
      return;
    }

    enablePreventPageClose();
  }

  function applyDisableAnimations() {
    const disableAnimations = getCookieValue('disableAnimations');
    if (disableAnimations !== 'true') {
      return;
    }

    if (document.getElementById('disable-animations')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'disable-animations';
    style.textContent = `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        scroll-behavior: auto !important;
      }
    `;
    document.head.appendChild(style);
  }

  function applyReduceVisualEffects() {
    const reduceEffects = localStorage.getItem('reduceVisualEffects');
    if (reduceEffects !== 'true') {
      return;
    }

    document.documentElement.classList.add('reduce-effects');

    if (document.body) {
      document.body.classList.add('reduce-effects');
      return;
    }

    document.addEventListener('DOMContentLoaded', function() {
      document.body.classList.add('reduce-effects');
    });
  }

  function init() {
    applyPreventPageClose();
    applyDisableAnimations();
    applyReduceVisualEffects();
  }

  window.QZGlobalPageGuards = {
    init,
    applyPreventPageClose,
    enablePreventPageClose,
    disablePreventPageClose,
    applyDisableAnimations,
    applyReduceVisualEffects
  };

  init();
})();
