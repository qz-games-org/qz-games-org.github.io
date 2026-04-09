(function() {
  function initGameMain() {
    if (window.QZGameMainLoading && typeof window.QZGameMainLoading.init === 'function') {
      window.QZGameMainLoading.init();
    }

    if (window.QZGameMainController && typeof window.QZGameMainController.init === 'function') {
      window.QZGameMainController.init();
    }

    if (window.QZGameMainPlayer && typeof window.QZGameMainPlayer.init === 'function') {
      window.QZGameMainPlayer.init();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGameMain, { once: true });
  } else {
    initGameMain();
  }
})();
