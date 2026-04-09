(function() {
  class NotificationSystem {
    constructor() {
      this.container = document.getElementById('notification-container');
      this.notifications = [];
      this.maxNotifications = 5;
      this.autoCloseDelay = 10000;
    }

    showNotification(type, title, message) {
      if (!this.container) {
        return null;
      }

      if (this.notifications.length >= this.maxNotifications) {
        this.removeNotification(this.notifications[0]);
      }

      const notification = document.createElement('div');
      notification.className = `notification ${type}`;
      notification.innerHTML = `<div class="notification-header"><div class="notification-title">${title}</div><button class="close-btn" type="button">&times;</button></div><div class="notification-message">${message}</div>`;
      notification.querySelector('.close-btn').onclick = () => this.removeNotification(notification);

      this.container.appendChild(notification);
      this.notifications.push(notification);

      window.setTimeout(() => notification.classList.add('show'), 10);
      window.setTimeout(() => this.removeNotification(notification), this.autoCloseDelay);
      return notification;
    }

    removeNotification(notification) {
      if (!notification || !notification.parentNode) {
        return;
      }

      notification.classList.remove('show');
      window.setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
        const index = this.notifications.indexOf(notification);
        if (index > -1) {
          this.notifications.splice(index, 1);
        }
      }, 300);
    }

    clearAll() {
      [...this.notifications].forEach((notification) => this.removeNotification(notification));
    }
  }

  function whenPageSettled(options = {}) {
    const { networkIdleMs = 500, includeFonts = true } = options;

    const loaded = document.readyState === 'complete'
      ? Promise.resolve()
      : new Promise((resolve) => window.addEventListener('load', resolve, { once: true }));

    const imagesReady = Promise.all(
      Array.from(document.images).map((image) => (
        image.complete
          ? Promise.resolve()
          : new Promise((resolve) => {
              image.addEventListener('load', resolve, { once: true });
              image.addEventListener('error', resolve, { once: true });
            })
      ))
    );

    const fontsReady = includeFonts && document.fonts && document.fonts.ready
      ? document.fonts.ready.catch(() => {})
      : Promise.resolve();

    const networkIdle = new Promise((resolve) => {
      if (!('PerformanceObserver' in window)) {
        resolve();
        return;
      }

      let observer;
      let timer = window.setTimeout(done, networkIdleMs);

      function done() {
        if (observer) {
          observer.disconnect();
        }
        resolve();
      }

      try {
        observer = new PerformanceObserver(() => {
          window.clearTimeout(timer);
          timer = window.setTimeout(done, networkIdleMs);
        });
        observer.observe({ type: 'resource', buffered: true });
      } catch (error) {
        resolve();
      }
    });

    return Promise.all([loaded, imagesReady, fontsReady, networkIdle]).then(() => {});
  }

  const notificationSystem = new NotificationSystem();

  window.clearAllNotifications = function clearAllNotifications() {
    notificationSystem.clearAll();
  };

  window.QZGameMainCore = {
    notificationSystem,
    whenPageSettled
  };
})();
