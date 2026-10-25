// MyVideoPlayer: clicking a thumbnail plays its video in the hero player

const hero = document.getElementById('hero-video');
const nowPlaying = document.getElementById('now-playing');
const thumbs = document.querySelectorAll('.thumb');

// Viewers who ask for reduced motion start paused instead of autoplaying
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  hero.removeAttribute('autoplay');
  hero.pause();
}

function setActive(activeThumb, announce) {
  thumbs.forEach((thumb) => {
    if (thumb === activeThumb) {
      thumb.setAttribute('aria-current', 'true');
    } else {
      thumb.removeAttribute('aria-current');
    }
  });

  // Tell screen reader users which video is now playing
  if (announce) {
    nowPlaying.textContent = `Now playing: ${activeThumb.dataset.title}`;
  }
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

  setActive(thumb, true);
}

thumbs.forEach((thumb) => {
  thumb.addEventListener('click', () => playFrom(thumb));
});

setActive(thumbs[0], false);

// Warm the cache with each video's poster frame once the page has loaded,
// so switching shows the new frame instantly instead of a blank player
window.addEventListener('load', () => {
  thumbs.forEach((thumb) => {
    new Image().src = thumb.dataset.poster;
  });
});

// Phone-width hamburger menu

const menuToggle = document.querySelector('.menu-toggle');
const siteNav = document.getElementById('site-nav');

function setMenuOpen(open) {
  menuToggle.setAttribute('aria-expanded', String(open));
  siteNav.classList.toggle('is-open', open);
}

menuToggle.addEventListener('click', () => {
  setMenuOpen(menuToggle.getAttribute('aria-expanded') !== 'true');
});

// Close after choosing a link
siteNav.addEventListener('click', (event) => {
  if (event.target.closest('a')) {
    setMenuOpen(false);
  }
});

// Escape closes the menu and returns focus to the button
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && siteNav.classList.contains('is-open')) {
    setMenuOpen(false);
    menuToggle.focus();
  }
});
