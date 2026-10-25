// MyVideoPlayer: loads the video list from Supabase, builds the gallery,
// and plays the clicked thumbnail's video in the hero player

import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, mediaUrl } from './supabase-config.js';

const hero = document.getElementById('hero-video');
const gallery = document.querySelector('.gallery');
const infoTitle = document.getElementById('video-title');
const infoDescription = document.getElementById('video-description');
const nowPlaying = document.getElementById('now-playing');

const FETCH_TIMEOUT_MS = 4000;

// Used when Supabase can't be reached: the three videos bundled with the site
const BUNDLED_VIDEOS = [1, 2, 3].map((n) => ({
  title: `Video ${n}`,
  description: '',
  video: `video/sue-vid${n}.mp4`,
  thumb: `posters/sue-vid${n}-thumb.png`,
  poster: `posters/sue-vid${n}-frame.jpg`,
}));

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Published videos in gallery order. Throws if Supabase is unreachable.
async function fetchVideos() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const query = 'select=title,description,video_path,thumb_path,poster_path'
      + '&published=eq.true&order=position.asc';
    const response = await fetch(`${SUPABASE_URL}/rest/v1/videos?${query}`, {
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Supabase responded ${response.status}`);
    }
    const rows = await response.json();
    return rows.map((row) => ({
      title: row.title,
      description: row.description,
      video: mediaUrl(row.video_path),
      thumb: mediaUrl(row.thumb_path),
      poster: mediaUrl(row.poster_path),
    }));
  } finally {
    clearTimeout(timer);
  }
}

// Gallery

function renderGallery(videos) {
  gallery.replaceChildren(...videos.map((video, index) => {
    const img = document.createElement('img');
    img.src = video.thumb;
    img.alt = '';
    img.width = 143;
    img.height = 105;

    const button = document.createElement('button');
    button.className = 'thumb';
    button.type = 'button';
    button.setAttribute('aria-label', `Play ${video.title}`);
    button.append(img);
    button.addEventListener('click', () => playVideo(videos, index, true));

    const item = document.createElement('li');
    item.append(button);
    return item;
  }));
}

function setActive(index) {
  gallery.querySelectorAll('.thumb').forEach((thumb, i) => {
    if (i === index) {
      thumb.setAttribute('aria-current', 'true');
    } else {
      thumb.removeAttribute('aria-current');
    }
  });
}

function showInfo(video) {
  infoTitle.textContent = video.title;
  infoDescription.textContent = video.description;
  infoDescription.hidden = !video.description;
}

// Hero player

function playVideo(videos, index, fromClick) {
  const video = videos[index];

  // Same video: restart it rather than reloading the file
  if (hero.getAttribute('src') !== video.video) {
    hero.poster = video.poster;
    hero.src = video.video;
  } else {
    hero.currentTime = 0;
  }

  // On a click, play() runs directly in the handler so Safari treats it as
  // user-initiated. On page load it is muted autoplay, skipped for reduced motion.
  if (fromClick || !reduceMotion) {
    hero.play().catch(() => {
      // Playback was blocked; the controls still let the viewer start it
    });
  }

  setActive(index);
  showInfo(video);

  // Tell screen reader users which video is now playing
  if (fromClick) {
    nowPlaying.textContent = `Now playing: ${video.title}`;
  }
}

// Warm the cache with each video's poster frame so switching shows the new
// frame instantly instead of a blank player
function preloadPosters(videos) {
  videos.forEach((video) => {
    new Image().src = video.poster;
  });
}

async function init() {
  let videos;
  try {
    videos = await fetchVideos();
  } catch (error) {
    console.warn('Could not load videos from Supabase, using bundled videos.', error);
    videos = BUNDLED_VIDEOS;
  }

  if (videos.length === 0) {
    gallery.hidden = true;
    showInfo({ title: 'No videos yet', description: 'Check back soon.' });
    return;
  }

  renderGallery(videos);
  playVideo(videos, 0, false);

  if (document.readyState === 'complete') {
    preloadPosters(videos);
  } else {
    window.addEventListener('load', () => preloadPosters(videos));
  }
}

init();

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
