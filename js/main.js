// MyVideoPlayer: clicking a thumbnail plays its video in the hero player

const hero = document.getElementById('hero-video');
const thumbs = document.querySelectorAll('.thumb');

function setActive(activeThumb) {
  thumbs.forEach((thumb) => {
    thumb.setAttribute('aria-pressed', String(thumb === activeThumb));
  });
}

function playFrom(thumb) {
  // Same video: restart it rather than reloading the file
  if (hero.getAttribute('src') !== thumb.dataset.video) {
    hero.poster = thumb.dataset.poster;
    hero.src = thumb.dataset.video;
  } else {
    hero.currentTime = 0;
  }

  // Call play() directly inside the click so Safari treats it as user-initiated
  hero.play().catch(() => {
    // Playback was blocked; the controls still let the viewer start it
  });

  setActive(thumb);
}

thumbs.forEach((thumb) => {
  thumb.addEventListener('click', () => playFrom(thumb));
});

setActive(thumbs[0]);
