class NotificationSystem {
  constructor() {
      this.container = document.getElementById('notification-container');
      this.notifications = [];
      this.maxNotifications = 5;
      this.autoCloseDelay = 10000;
      //this.init();
  }

  init() {
      window.addEventListener('error', (e) => {
          //this.showNotification('error', 'JavaScript Error', `${e.message}\nFile: ${e.filename}\nLine: ${e.lineno}`);
      });
      window.addEventListener('unhandledrejection', (e) => {
          //this.showNotification('error', 'Promise Rejection', e.reason ? e.reason.toString() : 'Unknown rejection');
      });
      
      const origWarn = console.warn, origError = console.error;
      console.warn = (...args) => { origWarn.apply(console, args); this.showNotification('warning', 'Warning', args.join(' ')); };
      console.error = (...args) => { origError.apply(console, args); this.showNotification('error', 'Error', args.join(' ')); };
  }

  showNotification(type, title, message) {
      if (this.notifications.length >= this.maxNotifications) this.removeNotification(this.notifications[0]);
      
      const notif = document.createElement('div');
      notif.className = `notification ${type}`;
      notif.innerHTML = `<div class="notification-header"><div class="notification-title">${title}</div><button class="close-btn">×</button></div><div class="notification-message">${message}</div>`;
      notif.querySelector('.close-btn').onclick = () => this.removeNotification(notif);
      
      //this.container.appendChild(notif);
      //this.notifications.push(notif);
      setTimeout(() => notif.classList.add('show'), 10);
      setTimeout(() => this.removeNotification(notif), this.autoCloseDelay);
      return notif;
  }

  removeNotification(notif) {
      if (!notif || !notif.parentNode) return;
      notif.classList.remove('show');
      setTimeout(() => {
          if (notif.parentNode) notif.parentNode.removeChild(notif);
          const idx = this.notifications.indexOf(notif);
          if (idx > -1) this.notifications.splice(idx, 1);
      }, 300);
  }

  clearAll() { [...this.notifications].forEach(n => this.removeNotification(n)); }
}

const notificationSystem = new NotificationSystem();

function clearAllNotifications() { notificationSystem.clearAll(); }


function whenPageSettled({ networkIdleMs = 500, includeFonts = true } = {}) {
  const loaded = document.readyState === 'complete'
    ? Promise.resolve()
    : new Promise(res => window.addEventListener('load', res, { once: true }));

  const imagesReady = Promise.all(
    Array.from(document.images).map(img =>
      img.complete ? Promise.resolve() :
        new Promise(r => {
          img.addEventListener('load', r, { once: true });
          img.addEventListener('error', r, { once: true });
        })
    )
  );

  const fontsReady = includeFonts && document.fonts && document.fonts.ready
    ? document.fonts.ready.catch(() => {})
    : Promise.resolve();

  const networkIdle = new Promise(resolve => {
    if (!('PerformanceObserver' in window)) return resolve();
    let timer = setTimeout(done, networkIdleMs);
    let observer;

    function done() {
      if (observer) observer.disconnect();
      resolve();
    }

    try {
      observer = new PerformanceObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(done, networkIdleMs);
      });
      observer.observe({ type: 'resource', buffered: true });
    } catch {
      resolve();
    }
  });

  return Promise.all([loaded, imagesReady, fontsReady, networkIdle]).then(() => {});
}



function Backhome() {
  //var toolbar = document.getElementById('optiongamemain')
  //toolbar.style.transition = '0.5s'
  //toolbar.style.transform = 'translateX(-250%)'

  //var gameANIMATE = document.getElementById('gameiframe')
  //gameANIMATE.style.transition = '0.5s'
  //gameANIMATE.style.transform = 'scale(2)'
  //gameANIMATE.style.opacity = 0

  window.location = '../index.html'
}
const params = new URLSearchParams(window.location.search);
const game = params.get('game');

var iframe = document.getElementById('gameiframe');
var type = params.get('type');

if (type === 'null' || type === null) {
  type = "unset";
}

if (game) {
  if (type === "html" || type === "flash" || type === "unity") {
    initGame(game, type);
  } else {
    initGame(game, "html");
  }

  console.log(`Loaded game: ${game} (type=${type})`);
} else {
  console.warn('no param found');
  initGame('error.html', 'html');
}

async function initGame(url, type) {
  const container = document.getElementById('maingamestuff');
  const iframe = document.getElementById('gameiframe');

  switch (type) {
    case 'flash':
      await loadRuffle(url);
      break;

    case 'unity':

    
    case 'html':
    default: {
      if (container) {
        container.style.display = 'block';
        
        if (!document.getElementById('gameiframe')) {
          container.innerHTML = '<iframe src="" class="gameiframe" id="gameiframe" allowfullscreen></iframe>';
        }
      }
      
      const currentIframe = document.getElementById('gameiframe');
      if (currentIframe) {
        currentIframe.style.display = 'block';
        currentIframe.src = url;
      }

        whenPageSettled().then(() => {
          //console.log('✅ Page fully loaded, images & fonts ready, and network is idle');
          doneloading()
        });

      break;
    }
    
  }
}

async function loadRuffle(swfUrl) {
  try {
    const container = document.getElementById('maingamestuff');
    if (!container) throw new Error('#maingamestuff not found');

    container.innerHTML = '';
    
    container.style.display = 'block';
    container.style.position = 'fixed';
    container.style.width = '100%';
    container.style.height = '100%';
    if (container.offsetHeight < 100) container.style.minHeight = '600px';

    if (!window.RufflePlayer) {
      await loadRuffleScript();
    }

    await new Promise(resolve => setTimeout(resolve, 100));

    const ruffle = window.RufflePlayer.newest();
    const player = ruffle.createPlayer();
    player.id = 'rufflePlayer';
    player.style.width = '100%';
    player.style.height = '100%';
    player.style.display = 'block';
    //player.classList.add('rufflelol');
    player.addEventListener('loadeddata', () => {
      console.log("SWF fully loaded!");
      doneloading()
    });

    container.appendChild(player);

    await player.load(swfUrl);

    setTimeout(() => {
      console.log('Player:', player.offsetWidth, 'x', player.offsetHeight);
      console.log('Container:', container.offsetWidth, 'x', container.offsetHeight);
    }, 500);
    console.log(`Ruffle started: ${swfUrl}`);
  } catch (error) {
    console.error('Failed to load Ruffle:', error);
  }
}

function loadRuffleScript() {
  return new Promise((resolve, reject) => {
    if (window.RufflePlayer) {
      resolve();
      return;
    }

    window.RufflePlayer = window.RufflePlayer || {};
    window.RufflePlayer.config = {
      publicPath: 'https://unpkg.com/@ruffle-rs/ruffle/',
      autoplay: 'on',
      unmuteOverlay: 'hidden',
      letterbox: 'on',
      allowFullscreen: true,
      allowNetworking: 'all'
    };

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/@ruffle-rs/ruffle';
    script.async = true;
    script.onload = () => {
      console.log('Ruffle script loaded successfully');
      resolve();
    };
    script.onerror = (error) => {
      console.error('Failed to load Ruffle script:', error);
      reject(error);
    };
    document.head.appendChild(script);
  });
}

function ToggleFullscreen() {
  const params = new URLSearchParams(window.location.search);
  const game = params.get('game');
  
  let targetElement;
  
  if (game && game.toLowerCase().includes('.swf')) {
    targetElement = document.getElementById('rufflePlayer') || document.getElementById('maingamestuff');
  } else {
    targetElement = document.getElementById('gameiframe');
  }
  
  if (!targetElement) {
    console.error('Fullscreen Function Not Available');
    return;
  }

  if (document.fullscreenElement || document.webkitFullscreenElement || 
      document.mozFullScreenElement || document.msFullscreenElement) {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }
  } else {
    if (targetElement.requestFullscreen) {
      targetElement.requestFullscreen();
    } else if (targetElement.webkitRequestFullscreen) {
      targetElement.webkitRequestFullscreen();
    } else if (targetElement.mozRequestFullScreen) {
      targetElement.mozRequestFullScreen();
    } else if (targetElement.msRequestFullscreen) {
      targetElement.msRequestFullscreen();
    } else {
      console.warn('Fullscreen API is not supported by this browser.');
    }
  }
}



//LOADING

function getUrlParameter(name) {
  const urlParamss = new URLSearchParams(window.location.search);
  return urlParamss.get(name);
}

function applyGradientColor(color) {
  const gradientBg = document.getElementById('gradientBg');
  
  if (color.toLowerCase() === 'black') {
      gradientBg.style.background = 'radial-gradient(circle, rgba(50, 50, 50, 0.4), rgba(30, 30, 30, 0.3), transparent)';
  } else if (color.startsWith('#') || color.startsWith('rgb') || color.startsWith('hsl')) {
      gradientBg.style.background = `radial-gradient(circle, ${color}40, ${color}20, transparent)`;
  } else {
      gradientBg.style.background = `radial-gradient(circle, ${color}, transparent)`;
  }
}

async function loadGameFromJSON(jsonUrl) {
  try {
      const gameTitle = document.getElementById('gameTitle');
      gameTitle.textContent = '';
      gameTitle.opacity = 0
      //gameTitle.classList.add('pulse');

      const response = await fetch(jsonUrl);
      if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const gamesData = await response.json();
      
      const gameName = getUrlParameter('name').toLowerCase();
      if (!gameName) {
          showError("No game parameter found in URL. Add ?name=your-game-name to the URL.");
          return;
      }

      const gameData = gamesData[gameName];
      if (!gameData) {
          showError(`Game "${gameName}" not found in database`);
          return;
      }

      const gameCover = document.getElementById('gameCover');
      gameCover.src = `../covers/${gameData.cover}`;
      gameCover.style.display = 'block';
      
      gameTitle.textContent = gameData.name;
      setTimeout(() => {
        gameTitle.opacity = 1
      }, 100);
      gameTitle.classList.remove('pulse');
      
      applyGradientColor(gameData.gradient);
      
      setTimeout(() => {
          console.log(`Loading ${gameData.name}...`);
         
      }, 3200);
      
  } catch (error) {
      showError(`Failed to load game data: ${error.message}`);
      console.error('Error loading JSON:', error);
  }
}

function showError(message) {
  const errorElement = document.getElementById('errorMessage');
  const gameTitle = document.getElementById('gameTitle');
  
  gameTitle.textContent = "Error";
  gameTitle.classList.remove('pulse');
  errorElement.textContent = message;
  errorElement.style.display = 'block';
  
}

document.addEventListener('DOMContentLoaded', function() {
  const jsonUrl = '../games.json';
  loadGameFromJSON(jsonUrl);
});

document.getElementById('gameCover').addEventListener('error', function() {
  this.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTgwIiBoZWlnaHQ9IjI0MCIgdmlld0JveD0iMCAwIDE4MCAyNDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxODAiIGhlaWdodD0iMjQwIiBmaWxsPSIjNDA0MDQwIi8+Cjx0ZXh0IHg9IjkwIiB5PSIxMTAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiNiMGIwYjAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNiI+R2FtZTwvdGV4dD4KPHRleHQgeD0iOTAiIHk9IjEzMCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iI2IwYjBiMCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE2Ij5Db3ZlcjwvdGV4dD4KPC9zdmc+';
});

document.getElementById('gameCover').addEventListener('load', function() {
  setTimeout(() => {
    document.getElementById('gradientBg').style.opacity = '1';
  }, 100);
  setTimeout(() => {
      this.style.opacity = '1';
  }, 300);
});
var loadingcont = document.getElementById('loadingcont');
const elements = {
  progbar: document.getElementById('progbar'),
  gameCover: document.getElementById('gameCover'),
  loadan: document.getElementById('loadan'),
  gradientBg: document.getElementById('gradientBg'),
  options: document.getElementById('options'),
  gameTitle: document.getElementById('gameTitle'),
  loadingcont: document.getElementById('loadingcont') 
};

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const animateElement = (element, styles, duration = 0) => {
  if (!element) return Promise.resolve();
  
  return new Promise(resolve => {
    Object.assign(element.style, styles);
    if (duration > 0) {
      setTimeout(resolve, duration);
    } else {
      resolve();
    }
  });
};

async function doneloading() {
  try {
    console.log('Starting loading completion sequence...');
    
    if (!elements.progbar || !elements.gameCover) {
      console.error('Required elements (progbar, gameCover) not found');
      return;
    }

    await animateElement(elements.progbar, { opacity: '0' });
    await wait(500);

    await animateElement(elements.progbar, {
      background: 'lightgreen',
      width: '100%',
      animation: 'none'
    });
    await wait(50);

    await animateElement(elements.loadan, { opacity: '0' });
    await animateElement(elements.progbar, { opacity: '1' });
    await wait(500);

    const fadePromises = [
      animateElement(elements.gameCover, { 
        transform: 'scale(0.95)', 
        opacity: '0' 
      }),
      animateElement(elements.gradientBg, { opacity: '0' }),
      animateElement(elements.gameTitle, { opacity: '0' }),
      animateElement(elements.options, { display: 'none' })
    ];

    await Promise.all(fadePromises);
    await wait(200);

    await hideLoadingContainer();

    console.log('Loading completion sequence finished');
    if(gameType==="flash") {
      document.getElementById('maingamestuff').style.display = "block"
    } else {
      document.getElementById('maingamestuff').style.display = "none"
    }
  } catch (error) {
    console.error('Error during loading completion:', error);
    elements.loadingcont?.style.setProperty('display', 'none');
  }
}

function hideLoadingContainer() {
  return new Promise(resolve => {
    if (!elements.loadingcont) {
      resolve();
      return;
    }

    let resolved = false; 

    const onTransitionEnd = (event) => {
      if (event.propertyName === 'opacity' && !resolved) {
        resolved = true;
        console.log('Loading container transition completed');
        elements.loadingcont.style.display = 'none';
        resolve();
      }
    };

    elements.loadingcont.addEventListener('transitionend', onTransitionEnd, { once: true });
    
    const fallbackTimeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.warn('Transition timeout, hiding container directly');
        elements.loadingcont.removeEventListener('transitionend', onTransitionEnd);
        elements.loadingcont.style.display = 'none';
        resolve();
      }
    }, 1000);

    elements.loadingcont.addEventListener('transitionend', () => {
      clearTimeout(fallbackTimeout);
    }, { once: true });

    elements.loadingcont.style.opacity = '0';
  });
}

async function doneloadingWithClasses() {
  try {
    console.log('Starting CSS class-based loading completion...');

    if (!elements.progbar || !elements.loadingcont) {
      console.error('Required elements not found');
      return;
    }

    elements.progbar?.classList.add('completing');
    await wait(500);

    elements.progbar?.classList.add('complete');
    elements.loadan?.classList.add('hidden');
    await wait(550);

    elements.gameCover?.classList.add('fade-out');
    elements.gradientBg?.classList.add('fade-out');
    elements.gameTitle?.classList.add('fade-out');
    elements.options?.classList.add('hidden');
    await wait(200);

    elements.loadingcont.classList.add('fade-out');

    await new Promise(resolve => {
      let resolved = false;

      const onTransitionEnd = (event) => {
        if (event.propertyName === 'opacity' && !resolved) {
          resolved = true;
          elements.loadingcont.style.display = 'none';
          console.log('Loading container hidden via transition');
          resolve();
        }
      };
      
      elements.loadingcont.addEventListener('transitionend', onTransitionEnd, { once: true });
      
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          elements.loadingcont.style.display = 'none';
          console.log('Loading container hidden via timeout');
          resolve();
        }
      }, 1000);
    });

    console.log('CSS-based loading completion finished');

  } catch (error) {
    console.error('Error during CSS loading completion:', error);
    elements.loadingcont?.style.setProperty('display', 'none');
  }
}
var isopencontroller = false
function toggleControllerSettings() {
  if(isopencontroller===false) {
    document.getElementById('settings-container').style.animation = ''

    document.getElementById('settings-container').style.display = 'flex'
    document.getElementById('settings-container').style.opacity = 1

    document.getElementById('settings-container').style.animation = 'showcons 0.5s'
    document.getElementById('menusforgame').classList.add('active')
    document.getElementById('bgcontroller').style.display = 'block'
    document.getElementById('bgcontroller').style.opacity = 1

    isopencontroller=true
  } else if(isopencontroller===true) {
    document.getElementById('settings-container').style.animation = ''

    document.getElementById('settings-container').style.opacity = 0
    document.getElementById('menusforgame').classList.remove('active')

    document.getElementById('settings-container').style.animation = 'showconh 0.5s'

    document.getElementById('bgcontroller').style.opacity = 0

    document.getElementById('bgcontroller').style.display = 'none'
    setTimeout(() => {
      document.getElementById('settings-container').style.display = 'none'

      document.getElementById('bgcontroller').style.display = 'none'

    }, 450);

    isopencontroller = false
  }
}