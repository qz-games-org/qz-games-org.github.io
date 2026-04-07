/*
var notecont = document.getElementById('notafication')
var notetitle = document.getElementById('titlenote')
var notedesc = document.getElementById('descnote')
var cookiepicnote = document.getElementById('cookiepic')
var noteclose = document.getElementById('closenote')

function issuenote(title, desc, close, type) {
    if (type === "cookie") {
        notetitle.innerHTML = "We Use Cookies"
        notedesc.innerHTML = "By using our site you agree to cookies."
        noteclose.style.display = "block"
        cookiepicnote.style.display = "block"

    } else {
        notetitle.innerHTML = title
        notedesc.innerHTML = desc
        if(close === false) {
            noteclose.style.display = 'none'
        } else {
            noteclose.style.display = 'block'
        }
        cookiepicnote.style.display = "none"
    }

    notecont.style.display = 'block'
    notecont.style.animation = ""
    notecont.style.animation = "noteshow 0.5s"

}
*/

const notecont      = document.getElementById('notafication');
const notetitle     = document.getElementById('titlenote');
const notedesc      = document.getElementById('descnote');
const cookiepicnote = document.getElementById('cookiepic');
const noteclose     = document.getElementById('closenote');
const notebottom    = document.getElementById('notification-bottom');
const noteSpinner   = document.getElementById('notification-spinner');

const noteQueue = [];
let noteBusy = false;
let cookienote = false;

function issuenote(title, desc, close, type, showLearnMore) {
  noteQueue.push({ title, desc, close, type, showLearnMore });
  if (!noteBusy) showNextNote();
}

function closeNote() {
    console.log('close.')

  if(cookienote === true) {
    setCookie('confirmedcookie', 'true');
    cookienote = false
    console.log('closed cookie')
  }

    notecont.style.animation = "notehide 0.5s";
  const onEnd = () => {
    notecont.classList.remove('theme-loading-note');
    notecont.dataset.noteStyle = '';
    notecont.style.display = "none";
    notecont.removeEventListener("animationend", onEnd);
    showNextNote();
  };
  notecont.addEventListener("animationend", onEnd);
}

function showNextNote() {
    console.log('showing next...')
  if (noteQueue.length === 0) {
    noteBusy = false;
    console.log('not busy...')
    return;
  }
  noteBusy = true;
  console.log('busy...')

  const { title, desc, close, type, showLearnMore } = noteQueue.shift();

  notecont.classList.remove('theme-loading-note');
  if (noteSpinner) {
    noteSpinner.style.display = 'none';
  }

  if (type === "cookie") {
    cookienote = true
    notetitle.textContent = "We Use Cookies";
    notedesc.textContent  = "By using our site you agree to cookies for analytics and personalization.";
    cookiepicnote.style.display = "block";
    noteclose.style.display     = "block";
    notebottom.style.display    = "block";
  } else if (type === "theme-loading") {
    cookienote = false
    notetitle.textContent = title;
    notedesc.textContent = desc;
    notecont.classList.add('theme-loading-note');
    if (cookiepicnote) {
      cookiepicnote.style.display = "none";
    }
    if (noteSpinner) {
      noteSpinner.style.display = "block";
    }
    noteclose.style.display = "none";
    notebottom.style.display = "none";
  } else {
    cookienote = false
    notetitle.textContent      = title;
    notedesc.textContent       = desc;
    cookiepicnote.style.display = "none";
    noteclose.style.display     = close === false ? "none" : "block";
    notebottom.style.display    = showLearnMore ? "block" : "none";
  }

  noteclose.onclick = closeNote;
  console.log('showing...')

  notecont.style.display   = "block";
  notecont.style.animation = "noteshow 0.5s";
}

function checkConfirmedCookie() {
    const val = getCookie('confirmedcookie');
    if (!val || val === 'false') {
      console.log('no cookie found');
        issuenote('cookie', 'cookie', true, 'cookie')
    }
}
document.addEventListener('DOMContentLoaded', checkConfirmedCookie);
  
