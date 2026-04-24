(function () {
  if (window.__qzMlgThemeInit) {
    return;
  }
  window.__qzMlgThemeInit = true;

  const imageUrl = './scripts/assets/hitmarker.png';
  const soundUrl = './scripts/assets/hitmarker.mp3';
  const logoUrl = './scripts/assets/mlg.jpg';
  const showDuration = 250;

  const img = document.createElement('img');
  img.src = imageUrl;
  img.classList.add('click-image');
  document.body.appendChild(img);

  const audio = document.createElement('audio');
  audio.src = soundUrl;
  audio.classList.add('click-sound');
  audio.preload = 'auto';
  document.body.appendChild(audio);

  document.addEventListener('click', (event) => {
    img.style.left = `${event.pageX - 20}px`;
    img.style.top = `${event.pageY - 20}px`;
    document.body.style.cursor = 'none';
    img.style.display = 'block';

    audio.currentTime = 0.33;
    audio.play().catch(() => {});

    window.setTimeout(() => {
      document.body.style.cursor = 'default';
      img.style.display = 'none';
    }, showDuration);
  });

  ['headericon', 'navicon', 'naviconside'].forEach((id) => {
    const icon = document.getElementById(id);
    if (icon) {
      icon.src = logoUrl;
    }
  });

  document.querySelectorAll('.brand-logo').forEach((logo) => {
    logo.src = logoUrl;
  });
})();
