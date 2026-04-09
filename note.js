(function() {
    const state = {
        refs: null,
        queue: [],
        busy: false,
        cookieNote: false,
        initialized: false
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
            return;
        }

        if (state.queue.length === 0) {
            state.busy = false;
            return;
        }

        state.busy = true;
        const { title, desc, close, type, showLearnMore } = state.queue.shift();

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
            refs.noteClose.onclick = closeNote;
        }

        refs.noteContainer.style.display = 'block';
        refs.noteContainer.style.animation = 'noteshow 0.5s';
    }

    function issueNote(title, desc, close, type, showLearnMore) {
        state.queue.push({ title, desc, close, type, showLearnMore });
        if (!state.busy) {
            showNextNote();
        }
    }

    function closeNote() {
        const refs = getRefs();
        if (!refs) {
            state.busy = false;
            return;
        }

        if (state.cookieNote && typeof setCookie === 'function') {
            setCookie('confirmedcookie', 'true');
            state.cookieNote = false;
        }

        refs.noteContainer.style.animation = 'notehide 0.5s';

        function handleAnimationEnd() {
            resetNoteStyle(refs);
            refs.noteContainer.style.display = 'none';
            refs.noteContainer.removeEventListener('animationend', handleAnimationEnd);
            showNextNote();
        }

        refs.noteContainer.addEventListener('animationend', handleAnimationEnd);
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
        close: closeNote
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
