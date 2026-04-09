(function() {
    const state = {
        sidenavOpen: false,
        translateOpen: false,
        filterOpen: false,
        initialized: false
    };

    function getElements() {
        return {
            sidenavContainer: document.getElementById('sidenavcont'),
            sideBackdrop: document.getElementById('backdropside'),
            sidenav: document.getElementById('sidenav'),
            filterMenu: document.getElementById('filterM'),
            translateMenu: document.getElementById('translateM')
        };
    }

    function hideMenu(menu, animationName) {
        if (!menu) {
            return;
        }

        menu.style.opacity = '0';
        menu.style.animation = animationName;

        window.setTimeout(() => {
            menu.style.visibility = 'hidden';
        }, 450);
    }

    function loadGoogleTranslate() {
        if (document.getElementById('translatescript')) {
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
        script.type = 'text/javascript';
        script.id = 'translatescript';
        document.body.appendChild(script);
    }

    function toggleSideNav() {
        const { sidenavContainer, sideBackdrop, sidenav } = getElements();
        if (!sidenavContainer || !sideBackdrop || !sidenav) {
            return;
        }

        if (!state.sidenavOpen) {
            sidenavContainer.style.visibility = 'visible';
            sideBackdrop.style.visibility = 'visible';
            sideBackdrop.style.opacity = '1';
            sidenav.style.animation = 'sidenavin 0.5s forwards';
            state.sidenavOpen = true;
            return;
        }

        state.sidenavOpen = false;
        sideBackdrop.style.opacity = '0';

        function handleAnimationEnd(event) {
            if (event.animationName === 'sidenavout') {
                sidenavContainer.style.visibility = 'hidden';
                sideBackdrop.style.visibility = 'hidden';
                sidenav.removeEventListener('animationend', handleAnimationEnd);
            }
        }

        sidenav.addEventListener('animationend', handleAnimationEnd);
        sidenav.style.animation = 'sidenavout 0.5s forwards';
    }

    function toggleTranslate() {
        const { translateMenu } = getElements();
        if (!translateMenu) {
            return;
        }

        if (!state.translateOpen) {
            loadGoogleTranslate();
            state.translateOpen = true;
            translateMenu.style.visibility = 'visible';
            translateMenu.style.opacity = '1';
            translateMenu.style.animation = 'translatemenuin 0.5s';
            return;
        }

        state.translateOpen = false;
        hideMenu(translateMenu, 'translatemenuout 0.5s');
    }

    function toggleFilter() {
        const { filterMenu } = getElements();
        if (!filterMenu) {
            return;
        }

        if (!state.filterOpen) {
            state.filterOpen = true;
            filterMenu.style.visibility = 'visible';
            filterMenu.style.opacity = '1';
            filterMenu.style.animation = 'filterwin 0.5s';
            return;
        }

        state.filterOpen = false;
        hideMenu(filterMenu, 'filterwout 0.5s');
    }

    function init() {
        if (state.initialized) {
            return;
        }

        state.initialized = true;

        if (window.autoTranslate && typeof window.autoTranslate.isAutoTranslateEnabled === 'function') {
            if (window.autoTranslate.isAutoTranslateEnabled()) {
                loadGoogleTranslate();
            }
        }
    }

    window.ToggleSideNav = toggleSideNav;
    window.ToggleTranslate = toggleTranslate;
    window.ToggleFilter = toggleFilter;
    window.loadGoogleTranslate = loadGoogleTranslate;
    window.QZHomeUI = {
        init,
        toggleSideNav,
        toggleTranslate,
        toggleFilter
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
