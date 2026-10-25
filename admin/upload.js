// MyVideoPlayer admin: "Add video" form.
// Checks the file, lets the admin pick a thumbnail frame (or their own image),
// builds the thumbnail and poster in the browser, uploads all three files to
// the media bucket and adds the videos row at the end of the order.

import { MEDIA_BUCKET } from '../js/supabase-config.js';

const MAX_VIDEO_BYTES = 50 * 1024 * 1024;     // Supabase free-tier per-file limit
const THUMB_WIDTH = 286;                      // 2x the 143x105 display size, for Retina
const THUMB_HEIGHT = 210;
const POSTER_MAX_WIDTH = 1600;
const POSTER_QUALITY = 0.85;

const addButton = document.getElementById('add-video-button');
const panel = document.getElementById('upload-panel');
const form = document.getElementById('upload-form');
const videoInput = document.getElementById('video-file');
const videoNote = document.getElementById('video-file-note');
const framePicker = document.getElementById('frame-picker');
const preview = document.getElementById('frame-preview');
const frameSlider = document.getElementById('frame-slider');
const frameTime = document.getElementById('frame-time');
const thumbPreview = document.getElementById('thumb-preview');
const thumbSource = document.getElementById('thumb-source');
const customThumbInput = document.getElementById('custom-thumb');
const clearCustomThumb = document.getElementById('clear-custom-thumb');
const titleInput = document.getElementById('video-title-input');
const descriptionInput = document.getElementById('video-description-input');
const descriptionCount = document.getElementById('description-count');
const publishedInput = document.getElementById('video-published');
const uploadError = document.getElementById('upload-error');
const uploadProgress = document.getElementById('upload-progress');
const uploadButton = document.getElementById('upload-button');
const cancelButton = document.getElementById('cancel-upload');
const dashboardMessage = document.getElementById('dashboard-message');

let videoFile = null;          // the chosen, playable MP4
let customThumbBlob = null;    // set when the admin supplies their own thumbnail
let previewUrl = null;         // object URLs to revoke when the form resets
let thumbUrl = null;
let selection = null;          // aborts the previous file's preview listeners

// File checks

function isMp4(file) {
  return file.type === 'video/mp4' || (!file.type && /\.mp4$/i.test(file.name));
}

function formatMB(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// True if the moov atom comes before mdat ("faststart"), so playback can begin
// before the whole file downloads. null if the file can't be read as MP4.
async function isFaststart(file) {
  let offset = 0;
  while (offset + 8 <= file.size) {
    const bytes = await file.slice(offset, offset + 16).arrayBuffer();
    const view = new DataView(bytes);
    let size = view.getUint32(0);
    const type = String.fromCharCode(...new Uint8Array(bytes, 4, 4));
    if (type === 'moov') return true;
    if (type === 'mdat') return false;
    if (size === 1 && bytes.byteLength >= 16) size = Number(view.getBigUint64(8));
    if (size < 8) return null;
    offset += size;
  }
  return null;
}

function showNote(message) {
  videoNote.textContent = message;
  videoNote.hidden = !message;
}

function showError(message) {
  uploadError.textContent = message;
  uploadError.hidden = !message;
}

// Image building

// Draw source into a w x h canvas, scaled to cover it and centre-cropped
function drawCover(source, sourceWidth, sourceHeight, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const context = canvas.getContext('2d');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, width, height);
  context.drawImage(source, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
  return canvas;
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not create image'))), type, quality);
  });
}

function frameThumbBlob() {
  const canvas = drawCover(preview, preview.videoWidth, preview.videoHeight, THUMB_WIDTH, THUMB_HEIGHT);
  return canvasToBlob(canvas, 'image/png');
}

// Poster keeps the video's own shape, capped at POSTER_MAX_WIDTH wide
function framePosterBlob() {
  const scale = Math.min(1, POSTER_MAX_WIDTH / preview.videoWidth);
  const width = Math.round(preview.videoWidth * scale);
  const height = Math.round(preview.videoHeight * scale);
  const canvas = drawCover(preview, preview.videoWidth, preview.videoHeight, width, height);
  return canvasToBlob(canvas, 'image/jpeg', POSTER_QUALITY);
}

function showThumb(blob, sourceLabel) {
  if (thumbUrl) URL.revokeObjectURL(thumbUrl);
  thumbUrl = URL.createObjectURL(blob);
  thumbPreview.src = thumbUrl;
  thumbSource.textContent = sourceLabel;
}

async function updateFrameThumb() {
  if (customThumbBlob || preview.readyState < 2) return;
  showThumb(await frameThumbBlob(), 'From the video frame');
}

// Choosing a video

videoInput.addEventListener('change', async () => {
  resetVideo();
  showError('');
  const file = videoInput.files[0];
  if (!file) return;

  if (!isMp4(file)) {
    showError('Choose an MP4 video file.');
    videoInput.value = '';
    return;
  }
  if (file.size > MAX_VIDEO_BYTES) {
    showError(`This video is ${formatMB(file.size)}. The limit is 50 MB, so compress it first.`);
    videoInput.value = '';
    return;
  }

  const faststart = await isFaststart(file);
  if (faststart === false) {
    showNote('This video may be slow to start online. To fix it, re-save it with: '
      + 'ffmpeg -i in.mp4 -c copy -movflags +faststart out.mp4');
  }

  selection = new AbortController();
  const { signal } = selection;
  previewUrl = URL.createObjectURL(file);
  preview.addEventListener('loadeddata', () => {
    videoFile = file;
    frameSlider.max = String(Math.max(0, preview.duration - 0.05).toFixed(2));
    frameSlider.value = '0';
    frameTime.textContent = '0.0 s';
    framePicker.hidden = false;
    updateFrameThumb();
  }, { once: true, signal });
  preview.addEventListener('error', () => {
    showError('This browser can\'t play this video, so visitors may not be able to either. '
      + 'Export it as an H.264 MP4 and try again.');
    resetVideo();
    videoInput.value = '';
  }, { once: true, signal });
  preview.src = previewUrl;

  if (!titleInput.value.trim()) {
    titleInput.value = file.name.replace(/\.mp4$/i, '').replace(/[-_]+/g, ' ').trim();
  }
});

// Dropping a video file on the drop zone works the same as choosing it

const dropZone = document.getElementById('video-drop-zone');

function isFileDrag(event) {
  return [...(event.dataTransfer?.types || [])].includes('Files');
}

dropZone.addEventListener('dragover', (event) => {
  if (!isFileDrag(event) || videoInput.disabled) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'copy';
  dropZone.classList.add('is-dragover');
});

dropZone.addEventListener('dragleave', (event) => {
  // Ignore leaving into a child element of the zone
  if (!dropZone.contains(event.relatedTarget)) {
    dropZone.classList.remove('is-dragover');
  }
});

dropZone.addEventListener('drop', (event) => {
  if (!isFileDrag(event)) return;
  event.preventDefault();
  dropZone.classList.remove('is-dragover');
  const file = event.dataTransfer.files[0];
  if (!file || videoInput.disabled) return;

  // Put the file in the input so the normal "change" checks run on it
  const transfer = new DataTransfer();
  transfer.items.add(file);
  videoInput.files = transfer.files;
  videoInput.dispatchEvent(new Event('change'));
});

// A file dropped anywhere else would make the browser open it and leave
// the admin page, so swallow those drops
window.addEventListener('dragover', (event) => {
  if (isFileDrag(event) && !dropZone.contains(event.target)) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'none';
  }
});

window.addEventListener('drop', (event) => {
  if (isFileDrag(event) && !dropZone.contains(event.target)) {
    event.preventDefault();
  }
});

frameSlider.addEventListener('input', () => {
  preview.currentTime = Number(frameSlider.value);
  frameTime.textContent = `${Number(frameSlider.value).toFixed(1)} s`;
});

preview.addEventListener('seeked', updateFrameThumb);

// Custom thumbnail

customThumbInput.addEventListener('change', async () => {
  showError('');
  const file = customThumbInput.files[0];
  if (!file) return;
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    showError('Choose a PNG, JPG or WebP image for the thumbnail.');
    customThumbInput.value = '';
    return;
  }

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = drawCover(image, image.naturalWidth, image.naturalHeight, THUMB_WIDTH, THUMB_HEIGHT);
    customThumbBlob = await canvasToBlob(canvas, 'image/png');
    showThumb(customThumbBlob, 'Your image');
    clearCustomThumb.hidden = false;
  } catch {
    showError('That image could not be read. Try a different file.');
    customThumbInput.value = '';
  } finally {
    URL.revokeObjectURL(url);
  }
});

clearCustomThumb.addEventListener('click', () => {
  customThumbBlob = null;
  customThumbInput.value = '';
  clearCustomThumb.hidden = true;
  updateFrameThumb();
});

descriptionInput.addEventListener('input', () => {
  descriptionCount.textContent = `${descriptionInput.value.length} / 500`;
});

// Opening, closing and resetting

function resetVideo() {
  selection?.abort();
  selection = null;
  videoFile = null;
  framePicker.hidden = true;
  showNote('');
  preview.removeAttribute('src');
  preview.load();
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null;
}

function resetForm() {
  form.reset();
  resetVideo();
  customThumbBlob = null;
  clearCustomThumb.hidden = true;
  if (thumbUrl) URL.revokeObjectURL(thumbUrl);
  thumbUrl = null;
  thumbPreview.removeAttribute('src');
  descriptionCount.textContent = '0 / 500';
  showError('');
  uploadProgress.textContent = '';
}

function setPanelOpen(open) {
  panel.hidden = !open;
  addButton.setAttribute('aria-expanded', String(open));
  if (open) {
    dashboardMessage.textContent = '';
    videoInput.focus();
  } else {
    resetForm();
  }
}

function setBusy(busy) {
  uploadButton.disabled = busy;
  cancelButton.disabled = busy;
  form.querySelectorAll('input, textarea').forEach((input) => { input.disabled = busy; });
  uploadButton.textContent = busy ? 'Uploading…' : 'Upload';
}

// Upload

async function uploadVideo(supabase) {
  const id = crypto.randomUUID();
  const paths = {
    video: `videos/${id}.mp4`,
    thumb: `thumbs/${id}.png`,
    poster: `posters/${id}.jpg`,
  };
  const storage = supabase.storage.from(MEDIA_BUCKET);
  const uploaded = [];

  async function put(path, body, contentType) {
    // Names are unique per upload, so files can be cached for a year
    const { error } = await storage.upload(path, body, { contentType, cacheControl: '31536000', upsert: false });
    if (error) throw error;
    uploaded.push(path);
  }

  try {
    // The preview is already showing the chosen frame (the slider seeks it)
    uploadProgress.textContent = 'Making the thumbnail and poster…';
    const thumbBlob = customThumbBlob || await frameThumbBlob();
    const posterBlob = await framePosterBlob();

    uploadProgress.textContent = `Uploading video (${formatMB(videoFile.size)})…`;
    await put(paths.video, videoFile, 'video/mp4');

    uploadProgress.textContent = 'Uploading thumbnail and poster…';
    await put(paths.thumb, thumbBlob, 'image/png');
    await put(paths.poster, posterBlob, 'image/jpeg');

    uploadProgress.textContent = 'Saving…';
    const { data: last, error: positionError } = await supabase
      .from('videos')
      .select('position')
      .order('position', { ascending: false })
      .limit(1);
    if (positionError) throw positionError;

    const { error: insertError } = await supabase.from('videos').insert({
      title: titleInput.value.trim(),
      description: descriptionInput.value.trim(),
      video_path: paths.video,
      thumb_path: paths.thumb,
      poster_path: paths.poster,
      position: (last[0]?.position ?? 0) + 1,
      published: publishedInput.checked,
    });
    if (insertError) throw insertError;
  } catch (error) {
    // Don't leave orphaned files behind if any step failed
    if (uploaded.length) {
      await storage.remove(uploaded);
    }
    throw error;
  }
}

export function initUpload({ supabase, onUploaded }) {
  addButton.addEventListener('click', () => setPanelOpen(panel.hidden));
  cancelButton.addEventListener('click', () => {
    setPanelOpen(false);
    addButton.focus();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    showError('');

    if (!videoFile) {
      showError('Choose a video file first.');
      videoInput.focus();
      return;
    }
    const title = titleInput.value.trim();
    if (!title) {
      showError('Give the video a title.');
      titleInput.focus();
      return;
    }

    setBusy(true);
    try {
      await uploadVideo(supabase);
      setBusy(false);
      setPanelOpen(false);
      dashboardMessage.textContent = `Added “${title}”.`;
      addButton.focus();
      onUploaded();
    } catch (error) {
      setBusy(false);
      uploadProgress.textContent = '';
      showError(`Upload failed: ${error.message || 'unknown error'}. Nothing was saved.`);
    }
  });
}
