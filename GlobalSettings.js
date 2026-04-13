(function() {
  function getBootstrapBase() {
    const currentScript = document.currentScript;
    if (currentScript && currentScript.src) {
      return new URL('./', currentScript.src).href;
    }

    return window.location.pathname.includes('/Games/')
      ? '../'
      : './';
  }

  function loadScriptSequentially(src) {
    return new Promise((resolve, reject) => {
      const existingScript = document.querySelector(`script[data-qz-global-helper="${src}"]`);
      if (existingScript) {
        if (existingScript.dataset.loaded === 'true') {
          resolve();
          return;
        }

        existingScript.addEventListener('load', resolve, { once: true });
        existingScript.addEventListener('error', reject, { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.dataset.qzGlobalHelper = src;
      script.addEventListener('load', () => {
        script.dataset.loaded = 'true';
        resolve();
      }, { once: true });
      script.addEventListener('error', () => {
        script.dataset.loadFailed = 'true';
        reject(new Error(`Failed to load global helper: ${src}`));
      }, { once: true });
      document.head.appendChild(script);
    });
  }

  const base = getBootstrapBase();
  const helperScripts = [
    `${base}globalscripts/globalsettings-page-guards.js`,
    `${base}globalscripts/globalsettings-cache.js`,
    `${base}globalscripts/tab-cloak.js`,
    `${base}globalscripts/globalsettings-translate.js`
  ];

  async function init() {
    for (const src of helperScripts) {
      await loadScriptSequentially(src);
    }
  }

  const ready = init().then(() => {
    window.dispatchEvent(new CustomEvent('qz:global-settings-ready'));
    return true;
  }).catch((error) => {
    console.error('Failed to bootstrap global settings helpers.', error);
    window.dispatchEvent(new CustomEvent('qz:global-settings-error', {
      detail: { error }
    }));
    return false;
  });

  window.QZGlobalSettings = {
    init,
    ready
  };
})();
