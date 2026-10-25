// MyVideoPlayer admin: the video list and everything you can do to a video
// once it exists: reorder (drag, or Move up/down buttons), edit title and
// description, publish/hide, and delete (row first, then its files).

import { MEDIA_BUCKET, mediaUrl } from '../js/supabase-config.js';

const list = document.getElementById('video-list');
const videosStatus = document.getElementById('videos-status');
const message = document.getElementById('dashboard-message');

let supabase = null;
let videos = [];          // rows in display order
let editingId = null;     // row showing the edit form
let confirmingId = null;  // row asking "Delete?"
let busy = false;         // a save is in progress; actions are disabled

export function initManage(client) {
  supabase = client;
}

function announce(text, isError = false) {
  message.textContent = text;
  message.classList.toggle('is-error', isError);
}

// Loading and rendering

export async function loadVideos() {
  videosStatus.textContent = 'Loading videos…';
  editingId = null;
  confirmingId = null;

  const { data, error } = await supabase
    .from('videos')
    .select('id, title, description, video_path, thumb_path, poster_path, position, published')
    .order('position', { ascending: true });

  if (error) {
    videosStatus.textContent = 'Could not load the videos. Refresh to try again.';
    list.replaceChildren();
    return;
  }

  videos = data;
  render();
}

function render() {
  videosStatus.textContent = videos.length === 0 ? 'No videos yet.' : '';
  list.replaceChildren(...videos.map((video, index) => {
    if (video.id === editingId) return renderEditRow(video, index);
    if (video.id === confirmingId) return renderConfirmRow(video, index);
    return renderRow(video, index);
  }));
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(className, text, label, onClick) {
  const node = el('button', className, text);
  node.type = 'button';
  if (label) node.setAttribute('aria-label', label);
  node.disabled = busy;
  node.addEventListener('click', onClick);
  return node;
}

function rowShell(video, index) {
  const row = el('li', 'video-row');
  row.dataset.id = video.id;

  const thumb = el('img');
  thumb.src = mediaUrl(video.thumb_path);
  thumb.alt = '';
  thumb.width = 96;
  thumb.height = 70;

  row.append(el('span', 'video-position', String(index + 1)), thumb);
  return row;
}

function renderRow(video, index) {
  const row = rowShell(video, index);

  const handle = el('span', 'drag-handle', '⠿');
  handle.setAttribute('aria-hidden', 'true');
  handle.title = 'Drag to reorder';
  handle.addEventListener('pointerdown', (event) => startDrag(event, row));
  row.prepend(handle);

  const text = el('div', 'video-text');
  text.append(el('h2', '', video.title), el('p', '', video.description || 'No description'));

  const publish = button(
    video.published ? 'status-toggle is-published' : 'status-toggle',
    video.published ? 'Published' : 'Hidden',
    null,
    () => togglePublished(video),
  );
  // A switch: screen readers hear "Published: <title>, switch, on/off"
  publish.setAttribute('role', 'switch');
  publish.setAttribute('aria-checked', String(video.published));
  publish.setAttribute('aria-label', `Published: ${video.title}`);
  publish.title = video.published ? 'Visible on the site. Click to hide.' : 'Hidden from the site. Click to publish.';

  const up = button('icon-button move-up', '↑', `Move ${video.title} up`, () => move(index, -1));
  up.disabled = busy || index === 0;
  const down = button('icon-button move-down', '↓', `Move ${video.title} down`, () => move(index, 1));
  down.disabled = busy || index === videos.length - 1;

  const edit = button('link-button edit', 'Edit', `Edit ${video.title}`, () => {
    editingId = video.id;
    confirmingId = null;
    announce('');
    render();
    list.querySelector(`[data-id="${video.id}"] input`).focus();
  });

  const remove = button('link-button danger delete', 'Delete', `Delete ${video.title}`, () => {
    confirmingId = video.id;
    editingId = null;
    announce('');
    render();
    list.querySelector(`[data-id="${video.id}"] .cancel`).focus();
  });

  const actions = el('div', 'row-actions');
  actions.append(publish, up, down, edit, remove);
  row.append(text, actions);
  return row;
}

// Edit title + description

function renderEditRow(video, index) {
  const row = rowShell(video, index);
  row.classList.add('is-editing');

  const form = el('form', 'edit-form');
  form.noValidate = true;

  const titleId = `title-${video.id}`;
  const titleLabel = el('label', '', 'Title');
  titleLabel.htmlFor = titleId;
  const titleInput = el('input');
  titleInput.id = titleId;
  titleInput.type = 'text';
  titleInput.maxLength = 100;
  titleInput.value = video.title;

  const descriptionId = `description-${video.id}`;
  const descriptionLabel = el('label', '', 'Description');
  descriptionLabel.htmlFor = descriptionId;
  const descriptionInput = el('textarea');
  descriptionInput.id = descriptionId;
  descriptionInput.rows = 2;
  descriptionInput.maxLength = 500;
  descriptionInput.value = video.description;

  const error = el('p', 'form-error');
  error.setAttribute('role', 'alert');
  error.hidden = true;

  const save = el('button', 'primary-button', 'Save');
  save.type = 'submit';
  const cancel = button('secondary-button cancel', 'Cancel', null, () => {
    editingId = null;
    render();
    list.querySelector(`[data-id="${video.id}"] .edit`).focus();
  });

  const buttons = el('div', 'form-buttons');
  buttons.append(save, cancel);
  form.append(titleLabel, titleInput, descriptionLabel, descriptionInput, error, buttons);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const title = titleInput.value.trim();
    if (!title) {
      error.textContent = 'The title can\'t be empty.';
      error.hidden = false;
      titleInput.focus();
      return;
    }
    const ok = await saveRow(video, { title, description: descriptionInput.value.trim() }, 'Saving…');
    if (ok) {
      editingId = null;
      render();
      announce(`Saved “${title}”.`);
      list.querySelector(`[data-id="${video.id}"] .edit`).focus();
    }
  });

  row.append(form);
  return row;
}

// Delete, with an inline confirmation

function renderConfirmRow(video, index) {
  const row = rowShell(video, index);
  row.classList.add('is-confirming');

  const text = el('div', 'video-text');
  text.append(
    el('h2', '', `Delete “${video.title}”?`),
    el('p', 'confirm-note', 'This permanently removes the video, its thumbnail and its poster.'),
  );

  const yes = button('danger-button', 'Delete', null, () => deleteVideo(video));
  const no = button('secondary-button cancel', 'Cancel', null, () => {
    confirmingId = null;
    render();
    list.querySelector(`[data-id="${video.id}"] .delete`).focus();
  });

  const actions = el('div', 'row-actions');
  actions.append(yes, no);
  row.append(text, actions);
  return row;
}

async function deleteVideo(video) {
  setBusy(true, `Deleting “${video.title}”…`);
  const { data, error } = await supabase.from('videos').delete().eq('id', video.id).select('id');
  if (error || data.length !== 1) {
    setBusy(false);
    announce(`Could not delete “${video.title}”. Nothing was changed.`, true);
    confirmingId = null;
    render();
    return;
  }

  // The row is gone, so the site no longer shows it; now tidy up its files
  const { error: fileError } = await supabase.storage
    .from(MEDIA_BUCKET)
    .remove([video.video_path, video.thumb_path, video.poster_path]);

  const index = videos.indexOf(video);
  videos.splice(index, 1);
  confirmingId = null;
  setBusy(false);
  render();
  announce(fileError
    ? `Deleted “${video.title}”, but its files could not be removed from storage.`
    : `Deleted “${video.title}”.`, Boolean(fileError));

  // Keep keyboard focus in the list
  const next = list.children[Math.min(index, list.children.length - 1)];
  (next?.querySelector('.edit') || document.getElementById('add-video-button')).focus();
}

// Publish / hide

async function togglePublished(video) {
  const published = !video.published;
  const ok = await saveRow(video, { published }, published ? 'Publishing…' : 'Hiding…');
  if (ok) {
    render();
    announce(published ? `“${video.title}” is now on the site.` : `“${video.title}” is now hidden.`);
    list.querySelector(`[data-id="${video.id}"] .status-toggle`).focus();
  }
}

// Update one row and confirm the database actually changed it. RLS turns a
// forbidden update into "0 rows", not an error, so check the count too.
async function saveRow(video, changes, progress) {
  setBusy(true, progress);
  const { data, error } = await supabase.from('videos').update(changes).eq('id', video.id).select('id');
  setBusy(false);
  if (error || data.length !== 1) {
    announce('That change could not be saved. Refresh and try again.', true);
    render();
    return false;
  }
  Object.assign(video, changes);
  return true;
}

function setBusy(value, progress = '') {
  busy = value;
  if (progress) announce(progress);
  list.querySelectorAll('button, input, textarea').forEach((control) => {
    control.disabled = value;
  });
}

// Reordering

function move(index, step) {
  const target = index + step;
  if (target < 0 || target >= videos.length) return;
  const [video] = videos.splice(index, 1);
  videos.splice(target, 0, video);
  saveOrder(video, step < 0 ? '.move-up' : '.move-down');
}

// Write position = 1..N for every row whose position changed
async function saveOrder(movedVideo, focusSelector) {
  const changes = videos
    .map((video, i) => ({ video, position: i + 1 }))
    .filter(({ video, position }) => video.position !== position);

  render();
  if (changes.length === 0) return;

  setBusy(true, 'Saving the new order…');
  const results = await Promise.all(changes.map(({ video, position }) => supabase
    .from('videos')
    .update({ position })
    .eq('id', video.id)
    .select('id')));
  setBusy(false);

  if (results.some(({ data, error }) => error || data.length !== 1)) {
    announce('The new order could not be saved. Showing the saved order.', true);
    await loadVideos();
    return;
  }

  changes.forEach(({ video, position }) => { video.position = position; });
  const newPosition = videos.indexOf(movedVideo) + 1;
  announce(`Moved “${movedVideo.title}” to position ${newPosition}.`);

  // Keep focus on the control that was used, or its neighbour at the ends
  const row = list.querySelector(`[data-id="${movedVideo.id}"]`);
  if (row && focusSelector) {
    const control = row.querySelector(focusSelector);
    (control.disabled ? row.querySelector(focusSelector === '.move-up' ? '.move-down' : '.move-up') : control)?.focus();
  }
}

// Drag and drop with pointer events, so it works with a mouse, a trackpad
// and touch. Keyboard users have the Move up/down buttons.
function startDrag(event, row) {
  if (busy || event.button > 0) return;
  event.preventDefault();

  // Listen on window rather than capturing on the handle: moving the row in
  // the DOM mid-drag would release a pointer capture
  const pointerId = event.pointerId;
  row.classList.add('is-dragging');
  const startOrder = videos.map((video) => video.id);

  const onMove = (moveEvent) => {
    if (moveEvent.pointerId !== pointerId) return;
    const others = [...list.children].filter((child) => child !== row);
    const before = others.find((child) => {
      const box = child.getBoundingClientRect();
      return moveEvent.clientY < box.top + box.height / 2;
    });
    if (before !== row.nextElementSibling) {
      list.insertBefore(row, before || null);
    }
  };

  const onEnd = (endEvent) => {
    if (endEvent.pointerId !== pointerId) return;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onEnd);
    window.removeEventListener('pointercancel', onEnd);
    row.classList.remove('is-dragging');

    const newOrder = [...list.children].map((child) => child.dataset.id);
    if (newOrder.join() === startOrder.join()) {
      render();
      return;
    }
    const byId = new Map(videos.map((video) => [video.id, video]));
    videos = newOrder.map((id) => byId.get(id));
    saveOrder(byId.get(row.dataset.id));
  };

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onEnd);
  window.addEventListener('pointercancel', onEnd);
}
