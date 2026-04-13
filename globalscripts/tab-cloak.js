(function() {
  const STORAGE_KEY = 'tabCloakConfig';
  const PRESET_CONFIG = {
    default: {
      label: 'Default',
      title: '',
      favicon: ''
    },
    classroom: {
      label: 'Google Classroom',
      title: 'Classes',
      favicon: 'https://classroom.google.com/favicon.ico'
    },
    drive: {
      label: 'Google Drive',
      title: 'My Drive - Google Drive',
      favicon: 'https://ssl.gstatic.com/images/branding/product/2x/drive_2020q4_32dp.png'
    },
    docs: {
      label: 'Google Docs',
      title: 'Google Docs',
      favicon: 'https://ssl.gstatic.com/docs/documents/images/kix-favicon7.ico'
    },
    canvas: {
      label: 'Canvas',
      title: 'Dashboard',
      favicon: 'https://www.instructure.com/favicon.ico'
    },
    schoology: {
      label: 'Schoology',
      title: 'Home | Schoology',
      favicon: 'https://www.schoology.com/favicon.ico'
    }
  };

  const originalState = {
    title: document.title,
    favicon: getCurrentFaviconHref()
  };

  let lastPageTitle = document.title;

  function getCurrentFaviconLink() {
    return document.querySelector('link[rel="icon"], link[rel="shortcut icon"]');
  }

  function getCurrentFaviconHref() {
    const iconLink = getCurrentFaviconLink();
    return iconLink ? iconLink.href : '';
  }

  function ensureFaviconLink() {
    let iconLink = getCurrentFaviconLink();
    if (iconLink) {
      return iconLink;
    }

    iconLink = document.createElement('link');
    iconLink.rel = 'icon';
    document.head.appendChild(iconLink);
    return iconLink;
  }

  function normalizeConfig(config) {
    if (!config || typeof config !== 'object') {
      return null;
    }

    const preset = PRESET_CONFIG[config.profile] || PRESET_CONFIG.default;
    const title = typeof config.title === 'string' ? config.title.trim() : '';
    const favicon = typeof config.favicon === 'string' ? config.favicon.trim() : '';

    if (!config.enabled || (!title && !favicon && config.profile === 'default')) {
      return null;
    }

    return {
      enabled: true,
      profile: config.profile in PRESET_CONFIG ? config.profile : 'default',
      title: title || preset.title,
      favicon: favicon || preset.favicon
    };
  }

  function loadConfig() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return null;
      }

      return normalizeConfig(JSON.parse(raw));
    } catch (error) {
      console.error('Failed to load tab cloak config.', error);
      return null;
    }
  }

  function saveConfig(config) {
    const normalized = normalizeConfig(config);

    if (!normalized) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  }

  function applyConfig(config, options = {}) {
    const normalized = normalizeConfig(config);
    const pageTitle = typeof options.pageTitle === 'string' && options.pageTitle.trim()
      ? options.pageTitle.trim()
      : lastPageTitle;

    if (!normalized) {
      document.title = pageTitle || originalState.title;
      const iconLink = ensureFaviconLink();
      iconLink.href = originalState.favicon || iconLink.href || '';
      return null;
    }

    document.title = normalized.title || pageTitle || originalState.title;

    if (normalized.favicon) {
      ensureFaviconLink().href = normalized.favicon;
    } else if (originalState.favicon) {
      ensureFaviconLink().href = originalState.favicon;
    }

    return normalized;
  }

  function setProfile(profile, overrides = {}) {
    const preset = PRESET_CONFIG[profile] || PRESET_CONFIG.default;
    const config = saveConfig({
      enabled: profile !== 'default' || Boolean(overrides.title) || Boolean(overrides.favicon),
      profile,
      title: overrides.title || preset.title,
      favicon: overrides.favicon || preset.favicon
    });

    applyConfig(config);
    return config;
  }

  function clear() {
    window.localStorage.removeItem(STORAGE_KEY);
    applyConfig(null);
  }

  function applyPageTitle(pageTitle) {
    if (typeof pageTitle === 'string' && pageTitle.trim()) {
      lastPageTitle = pageTitle.trim();
    }

    applyConfig(loadConfig(), { pageTitle: lastPageTitle });
  }

  function getCurrentConfig() {
    return loadConfig();
  }

  function getProfiles() {
    return PRESET_CONFIG;
  }

  function init() {
    applyPageTitle(document.title);
  }

  window.QZTabCloak = {
    STORAGE_KEY,
    init,
    getProfiles,
    getCurrentConfig,
    setProfile,
    clear,
    applyConfig,
    applyPageTitle
  };

  init();
})();
