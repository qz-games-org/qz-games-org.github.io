(function() {
  function loadGoogleTranslateScript() {
    const autoTranslateEnabled = localStorage.getItem('autoTranslateEnabled');

    if (autoTranslateEnabled !== null && autoTranslateEnabled !== 'true') {
      return;
    }

    if (document.getElementById('translatescript')) {
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    script.type = 'text/javascript';
    script.id = 'translatescript';
    script.async = true;
    document.head.appendChild(script);
  }

  function ensureGoogleTranslateElementInit() {
    if (typeof window.googleTranslateElementInit === 'function') {
      return;
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
  }

  function loadAutoTranslateScript() {
    if (document.querySelector('script[src*="auto-translate.js"]')) {
      return;
    }

    const autoScript = document.createElement('script');
    autoScript.type = 'text/javascript';
    autoScript.src = window.location.pathname.includes('/Games/')
      ? '../auto-translate.js'
      : './auto-translate.js';

    document.head.appendChild(autoScript);
  }

  function init() {
    ensureGoogleTranslateElementInit();
    loadGoogleTranslateScript();
    loadAutoTranslateScript();
  }

  window.QZGlobalTranslate = {
    init,
    loadGoogleTranslateScript,
    ensureGoogleTranslateElementInit,
    loadAutoTranslateScript
  };

  init();
})();
