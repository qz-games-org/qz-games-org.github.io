(function() {
    const state = {
        refs: null,
        queue: [],
        busy: false,
        cookieNote: false,
        initialized: false,
        currentType: null,
        closing: false
    };

    function getRefs() {
        if (state.refs) {
            return state.refs;
        }

        const noteContainer = document.getElementById('notafication');
        if (!noteContainer) {
            return null;
        }

        state.refs = {
            noteContainer,
            noteTitle: document.getElementById('titlenote'),
            noteDescription: document.getElementById('descnote'),
            cookieImage: document.getElementById('cookiepic'),
            noteClose: document.getElementById('closenote'),
            noteBottom: document.getElementById('notification-bottom'),
            noteSpinner: document.getElementById('notification-spinner')
        };

        return state.refs;
    }

    function setDisplay(element, value) {
        if (element) {
            element.style.display = value;
        }
    }

    function resetNoteStyle(refs) {
        refs.noteContainer.classList.remove('theme-loading-note');
        refs.noteContainer.dataset.noteStyle = '';
        if (refs.noteSpinner) {
            refs.noteSpinner.style.display = 'none';
        }
    }

    function showNextNote() {
        const refs = getRefs();
        if (!refs) {
            state.busy = false;
            state.currentType = null;
            state.closing = false;
            return;
        }

        if (state.queue.length === 0) {
            state.busy = false;
            state.currentType = null;
            state.closing = false;
            return;
        }

        state.busy = true;
        const { title, desc, close, type, showLearnMore, options } = state.queue.shift();
        state.currentType = type || 'note';
        state.closing = false;

        resetNoteStyle(refs);

        if (type === 'cookie') {
            state.cookieNote = true;
            if (refs.noteTitle) {
                refs.noteTitle.textContent = 'We Use Cookies';
            }
            if (refs.noteDescription) {
                refs.noteDescription.textContent = 'By using our site you agree to cookies for analytics and personalization.';
            }
            setDisplay(refs.cookieImage, 'block');
            setDisplay(refs.noteClose, 'block');
            setDisplay(refs.noteBottom, 'block');
        } else if (type === 'theme-loading') {
            state.cookieNote = false;
            if (refs.noteTitle) {
                refs.noteTitle.textContent = title;
            }
            if (refs.noteDescription) {
                refs.noteDescription.textContent = desc;
            }
            refs.noteContainer.classList.add('theme-loading-note');
            refs.noteContainer.dataset.noteStyle = 'theme-loading';
            setDisplay(refs.cookieImage, 'none');
            setDisplay(refs.noteSpinner, 'block');
            setDisplay(refs.noteClose, 'none');
            setDisplay(refs.noteBottom, 'none');
        } else {
            state.cookieNote = false;
            if (refs.noteTitle) {
                refs.noteTitle.textContent = title;
            }
            if (refs.noteDescription) {
                refs.noteDescription.textContent = desc;
            }
            setDisplay(refs.cookieImage, 'none');
            setDisplay(refs.noteClose, close === false ? 'none' : 'block');
            setDisplay(refs.noteBottom, showLearnMore ? 'block' : 'none');
        }

        if (refs.noteClose) {
            refs.noteClose.onclick = () => closeNote({ userInitiated: true });
        }

        refs.noteContainer.style.display = 'block';
        refs.noteContainer.style.animation = 'noteshow 0.5s';

        if (options && typeof options.onShow === 'function') {
            try {
                options.onShow();
            } catch (error) {
                console.error('Notification onShow callback failed.', error);
            }
        }
    }

    function issueNote(title, desc, close, type, showLearnMore, options) {
        state.queue.push({ title, desc, close, type, showLearnMore, options });
        if (!state.busy) {
            showNextNote();
        }
    }

    function closeNote(options = {}) {
        const refs = getRefs();
        if (!refs) {
            state.busy = false;
            return;
        }

        if (options && options.type && options.type !== state.currentType) {
            return false;
        }

        if (state.closing) {
            return false;
        }

        state.closing = true;

        if (state.cookieNote && options.confirmCookie !== false && typeof setCookie === 'function') {
            setCookie('confirmedcookie', 'true');
            state.cookieNote = false;
        }

        refs.noteContainer.style.animation = 'notehide 0.5s';

        function handleAnimationEnd() {
            resetNoteStyle(refs);
            refs.noteContainer.style.display = 'none';
            refs.noteContainer.removeEventListener('animationend', handleAnimationEnd);
            state.currentType = null;
            state.cookieNote = false;
            state.closing = false;
            showNextNote();
        }

        refs.noteContainer.addEventListener('animationend', handleAnimationEnd);
        return true;
    }

    function closeNoteType(type) {
        return closeNote({ type, confirmCookie: false });
    }

    function isShowing(type) {
        if (type) {
            return state.currentType === type && state.busy && !state.closing;
        }

        return state.busy && !state.closing;
    }

    function checkConfirmedCookie() {
        if (typeof getCookie !== 'function') {
            return;
        }

        const confirmedCookie = getCookie('confirmedcookie');
        if (!confirmedCookie || confirmedCookie === 'false') {
            issueNote('cookie', 'cookie', true, 'cookie');
        }
    }

    function init() {
        if (state.initialized) {
            return;
        }

        state.initialized = true;
        getRefs();
        checkConfirmedCookie();

        if (state.queue.length && !state.busy) {
            showNextNote();
        }
    }

    window.issuenote = issueNote;
    window.closeNote = closeNote;
    window.checkConfirmedCookie = checkConfirmedCookie;
    window.QZNote = {
        init,
        issue: issueNote,
        close: closeNote,
        closeType: closeNoteType,
        isShowing
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
