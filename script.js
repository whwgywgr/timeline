'use strict';

const STORAGE_KEY = 'timeline-entries-v1';

const els = {
  addBtn: document.getElementById('addBtn'),
  emptyAddBtn: document.getElementById('emptyAddBtn'),
  timeline: document.getElementById('timeline'),
  empty: document.getElementById('emptyState'),
  overlay: document.getElementById('modalOverlay'),
  modalTitle: document.getElementById('modalTitle'),
  closeModal: document.getElementById('closeModal'),
  form: document.getElementById('entryForm'),
  fTitle: document.getElementById('fTitle'),
  fEventDate: document.getElementById('fEventDate'),
  fFile: document.getElementById('fFile'),
  fImageUrl: document.getElementById('fImageUrl'),
  imagePreview: document.getElementById('imagePreview'),
  previewImg: document.getElementById('previewImg'),
  imageError: document.getElementById('imageError'),
  removeImage: document.getElementById('removeImage'),
  fDesc: document.getElementById('fDesc'),
  cancelBtn: document.getElementById('cancelBtn'),
  saveBtn: document.getElementById('saveBtn'),
  toast: document.getElementById('toast'),
  exportBtn: document.getElementById('exportBtn'),
  importBtn: document.getElementById('importBtn'),
  importOverlay: document.getElementById('importOverlay'),
  importClose: document.getElementById('importClose'),
  importCancel: document.getElementById('importCancel'),
  importApply: document.getElementById('importApply'),
  importFile: document.getElementById('importFile'),
  importInfo: document.getElementById('importInfo'),
  dateRail: document.getElementById('dateRail'),
  filterChips: document.getElementById('filterChips'),
  moreBtn: document.getElementById('moreBtn'),
  moreMenu: document.getElementById('moreMenu'),
  emptyTitle: document.querySelector('#emptyState h2'),
  emptyText: document.querySelector('#emptyState p'),
};

const CATEGORY_META = {
  games: {
    label: 'Games release',
    icon: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="15" y1="13" x2="15.01" y2="13"/><line x1="18" y1="11" x2="18.01" y2="11"/><rect x="2" y="6" width="20" height="12" rx="6"/></svg>',
  },
  event: {
    label: 'Event',
    icon: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  },
  personal: {
    label: 'Personal',
    icon: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  },
};

let entries = loadEntries();
let editingId = null;
let pendingImage = null;
let imageFailed = false;
let urlDebounce = null;
let toastTimer = null;
let activeFilter = 'all';

/* ---------- Storage ---------- */

function loadEntries() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!Array.isArray(raw)) return [];
    // Entries saved before optional fields existed get sensible defaults.
    return raw.map(e => ({
      ...e,
      eventDate: e.eventDate || e.createdAt,
      category: CATEGORY_META[e.category] ? e.category : 'personal',
    }));
  } catch {
    return [];
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    showToast('Could not save — browser storage may be full. Try a smaller image.');
    throw new Error('storage-full');
  }
}

/* ---------- Helpers ---------- */

function uid() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Format an ISO date for the datetime-local input (local time, minute precision).
function toLocalInputValue(iso) {
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Event dates often have no meaningful time (e.g. release days) — hide a 00:00 time.
function fmtEventDate(iso) {
  const d = new Date(iso);
  const atMidnight = d.getHours() === 0 && d.getMinutes() === 0;
  return d.toLocaleString(undefined, atMidnight
    ? { day: 'numeric', month: 'short', year: 'numeric' }
    : { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function showToast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove('show'), 2400);
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const maxW = 1100;
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ---------- Rendering ---------- */

// "In 21 days" / "Today" / "3 days ago" — helps the closest-first sort make sense.
function countdownText(iso) {
  const now = new Date();
  const d = new Date(iso);
  const dayMs = 86400000;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round((target - today) / dayMs);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  return days > 1 ? `In ${days} days` : `${-days} days ago`;
}

// "Oct 1, 07:33 AM" — short created stamp like the reference design.
function fmtCreatedShort(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
    + ', ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

// Revision stamp: time only when modified on the same day, full stamp otherwise.
function fmtRevText(entry) {
  const sameDay = new Date(entry.createdAt).toDateString() === new Date(entry.updatedAt).toDateString();
  return sameDay
    ? new Date(entry.updatedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : fmtCreatedShort(entry.updatedAt);
}

function cardHTML(entry, index) {
  const side = index % 2 === 0 ? 'left' : 'right';
  const cat = CATEGORY_META[entry.category] || CATEGORY_META.personal;
  const catClass = `card-cat cat-${esc(entry.category || 'personal')}`;
  const catBadge = `<span class="${catClass}">${cat.icon}${esc(cat.label)}</span>`;
  const media = entry.image
    ? `<div class="card-media">
        <img class="card-img" src="${esc(entry.image)}" alt="${esc(entry.title)}" loading="lazy"
          onerror="this.closest('.card') && this.closest('.card').classList.add('img-failed')">
        ${catBadge}
      </div>
      <img class="card-img-echo" src="${esc(entry.image)}" alt="" aria-hidden="true"
        onerror="this.style.display='none'">`
    : '';
  const inlineCat = entry.image ? '' : catBadge.replace('card-cat', 'card-cat static');
  const desc = entry.description
    ? `<p class="card-desc">${esc(entry.description)}</p>`
    : '';

  return `
  <article class="tl-item ${side}" data-id="${esc(entry.id)}">
    <div class="card">
      ${media}
      <div class="card-body">
        ${inlineCat}
        <div class="card-meta-top">
          <span class="card-date">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            ${fmtEventDate(entry.eventDate)}
          </span>
          <span class="card-countdown">${countdownText(entry.eventDate)}</span>
        </div>
        <h3 class="card-title">${esc(entry.title)}</h3>
        ${desc}
        <div class="card-footer-meta">
          <span><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>Created: <b>${fmtCreatedShort(entry.createdAt)}</b></span>
          <span><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>Rev: <b>${fmtRevText(entry)}</b></span>
        </div>
        <div class="card-actions">
          <button class="btn btn-card-share" data-action="share" type="button">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            Share
          </button>
          <button class="btn btn-card-edit" data-action="edit" type="button">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
            Edit
          </button>
          <button class="btn btn-card-delete" data-action="delete" type="button">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            Delete
          </button>
        </div>
      </div>
    </div>
  </article>`;
}

function render() {
  renderFilterChips();
  // Entries closest to today (past or upcoming) appear first.
  const now = Date.now();
  const visible = activeFilter === 'all'
    ? entries
    : entries.filter(e => (e.category || 'personal') === activeFilter);
  const sorted = [...visible].sort((a, b) =>
    Math.abs(new Date(a.eventDate) - now) - Math.abs(new Date(b.eventDate) - now));
  els.timeline.innerHTML = sorted.map(cardHTML).join('');
  els.empty.hidden = sorted.length > 0;
  if (activeFilter !== 'all' && !sorted.length) {
    els.emptyTitle.textContent = 'No entries in this category yet';
    els.emptyText.textContent = 'Try another category, or add one with this filter active.';
  } else {
    els.emptyTitle.textContent = 'No entries yet';
    els.emptyText.textContent = 'Your timeline is waiting for its first moment.';
  }
  renderDateRail(sorted);
}

/* ---------- Actions ---------- */

function deleteEntry(entry) {
  if (!confirm(`Delete "${entry.title}"? This cannot be undone.`)) return;
  entries = entries.filter(e => e.id !== entry.id);
  persist();
  render();
  showToast('Entry deleted');
}

async function shareEntry(entry) {
  const baseUrl = location.href.split('#')[0].split('?')[0];
  const url = `${baseUrl}?entry=${encodeURIComponent(entry.id)}`;
  const shareData = {
    title: entry.title,
    text: entry.title + (entry.description ? '\n\n' + entry.description : ''),
    url,
  };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
      return;
    } catch (err) {
      if (err && err.name === 'AbortError') return; // user closed the share sheet
    }
  }

  const text = `${shareData.title}\n\n${entry.description || ''}\n\n${url}`.trim();
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  showToast('Copied to clipboard ✓');
}

/* ---------- Modal ---------- */

function updatePreview() {
  if (pendingImage) {
    els.previewImg.src = pendingImage;
    els.imagePreview.hidden = false;
  } else {
    els.previewImg.removeAttribute('src');
    els.previewImg.classList.remove('loading', 'failed');
    els.imageError.hidden = true;
    els.imagePreview.hidden = true;
  }
}

function openModal(entry = null) {
  editingId = entry ? entry.id : null;
  pendingImage = entry ? entry.image : null;
  els.fTitle.value = entry ? entry.title : '';
  els.fEventDate.value = entry ? toLocalInputValue(entry.eventDate) : '';
  const cat = (entry && CATEGORY_META[entry.category]) ? entry.category : 'personal';
  const catRadio = els.form.querySelector(`input[name="fCategory"][value="${cat}"]`);
  if (catRadio) catRadio.checked = true;
  els.fDesc.value = entry ? entry.description : '';
  els.fImageUrl.value = '';
  els.fFile.value = '';
  els.modalTitle.textContent = entry ? 'Edit entry' : 'New entry';
  els.saveBtn.textContent = entry ? 'Save changes' : 'Save entry';
  updatePreview();
  els.overlay.classList.add('open');
  document.body.classList.add('modal-open');
  setTimeout(() => els.fTitle.focus(), 80);
}

function closeModal() {
  els.overlay.classList.remove('open');
  document.body.classList.remove('modal-open');
  editingId = null;
  pendingImage = null;
}

function saveEntry(e) {
  e.preventDefault();
  const title = els.fTitle.value.trim();
  if (!title) {
    showToast('Please add a title');
    els.fTitle.focus();
    return;
  }
  const description = els.fDesc.value.trim();
  clearTimeout(urlDebounce);
  const rawUrl = els.fImageUrl.value.trim();
  const image = (pendingImage || (rawUrl ? normalizeImageUrl(rawUrl) : '') || '');
  const categoryRadio = els.form.querySelector('input[name="fCategory"]:checked');
  const category = categoryRadio ? categoryRadio.value : 'personal';
  const now = new Date().toISOString();
  // Leave the picker empty to place the entry at "now" on the timeline.
  const eventDate = els.fEventDate.value
    ? new Date(els.fEventDate.value).toISOString()
    : now;

  if (editingId) {
    const entry = entries.find(x => x.id === editingId);
    if (entry) {
      Object.assign(entry, { title, description, image, eventDate, category, updatedAt: now });
      showToast('Entry updated ✓');
    }
  } else {
    entries.push({ id: uid(), title, description, image, eventDate, category, createdAt: now, updatedAt: now });
    showToast('Entry added ✓');
  }

  try {
    persist();
  } catch {
    return; // keep the modal open so the user can shrink the image
  }
  render();
  closeModal();
}

/* ---------- Backup: export & import ---------- */

function validDateIso(v) {
  const d = new Date(v);
  return isNaN(d) ? null : d.toISOString();
}

function exportBackup() {
  if (!entries.length) {
    showToast('Nothing to export yet — add an entry first');
    return;
  }
  const payload = {
    app: 'my-timeline',
    version: 1,
    exportedAt: new Date().toISOString(),
    entries: [...entries].sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate)),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  a.href = url;
  a.download = `timeline-backup-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast(`Exported ${entries.length} entries ✓`);
}

// Parse & validate a backup file's text into a clean entries array.
function parseBackupText(text) {
  const data = JSON.parse(text);
  const raw = Array.isArray(data) ? data : data && data.entries;
  if (!Array.isArray(raw)) throw new Error('No entries array found in this file');
  const parsed = [];
  let skipped = 0;
  for (const e of raw) {
    if (!e || typeof e !== 'object' || !e.title || !String(e.title).trim()) {
      skipped++;
      continue;
    }
    const eventDate = validDateIso(e.eventDate) || validDateIso(e.createdAt) || new Date().toISOString();
    parsed.push({
      id: typeof e.id === 'string' && e.id ? e.id : uid(),
      title: String(e.title).trim(),
      description: typeof e.description === 'string' ? e.description : '',
      image: typeof e.image === 'string' ? e.image : '',
      eventDate,
      category: CATEGORY_META[e.category] ? e.category : 'personal',
      createdAt: validDateIso(e.createdAt) || eventDate,
      updatedAt: validDateIso(e.updatedAt) || eventDate,
    });
  }
  return { entries: parsed, skipped };
}

let importData = null;

function openImport() {
  importData = null;
  els.importFile.value = '';
  els.importInfo.hidden = true;
  els.importApply.disabled = true;
  const mergeRadio = document.querySelector('input[name="importMode"][value="merge"]');
  if (mergeRadio) mergeRadio.checked = true;
  els.importOverlay.classList.add('open');
  document.body.classList.add('modal-open');
}

function closeImport() {
  els.importOverlay.classList.remove('open');
  document.body.classList.remove('modal-open');
  importData = null;
}

function handleImportFile(e) {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const { entries: parsed, skipped } = parseBackupText(String(reader.result));
      if (!parsed.length) throw new Error('No valid entries in this file');
      importData = parsed;
      const dates = parsed.map(x => new Date(x.eventDate)).sort((a, b) => a - b);
      const range = `${dates[0].toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })} – ${dates[dates.length - 1].toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`;
      els.importInfo.textContent = `${file.name}: ${parsed.length} entries (${range})`
        + (skipped ? ` · ${skipped} invalid skipped` : '');
      els.importInfo.hidden = false;
      els.importApply.disabled = false;
    } catch (err) {
      importData = null;
      els.importInfo.hidden = true;
      els.importApply.disabled = true;
      showToast(`Import failed: ${err.message}`);
    }
  };
  reader.onerror = () => showToast('Could not read that file');
  reader.readAsText(file);
}

function applyImport() {
  if (!importData) return;
  const modeRadio = document.querySelector('input[name="importMode"]:checked');
  const mode = modeRadio ? modeRadio.value : 'merge';

  if (mode === 'replace') {
    const count = importData.length;
    entries = importData;
    persist();
    render();
    showToast(`Timeline replaced with ${count} entries ✓`);
  } else {
    const ids = new Set(entries.map(x => x.id));
    const fresh = importData.filter(x => !ids.has(x.id));
    entries = entries.concat(fresh);
    persist();
    render();
    const skipped = importData.length - fresh.length;
    showToast(`Imported ${fresh.length} new entries ✓`
      + (skipped ? ` (${skipped} already on your timeline)` : ''));
  }
  closeImport();
}

async function useImageFile(file) {
  if (!file.type.startsWith('image/')) {
    showToast('Please choose an image file');
    return;
  }
  try {
    pendingImage = await compressImage(file);
    imageFailed = false;
    els.fImageUrl.value = '';
    els.imageError.hidden = true;
    updatePreview();
  } catch {
    showToast('Could not read that image');
  }
}

function normalizeImageUrl(raw) {
  return /^(https?:\/\/|data:image\/)/i.test(raw) ? raw : 'https://' + raw;
}

function applyUrlPreview() {
  const raw = els.fImageUrl.value.trim();
  imageFailed = false;
  els.previewImg.classList.remove('loading', 'failed');
  if (!raw) {
    pendingImage = null;
    els.imageError.hidden = true;
    updatePreview();
    return;
  }
  pendingImage = normalizeImageUrl(raw);
  els.imageError.hidden = true;
  els.previewImg.classList.add('loading');
  updatePreview();
}

/* ---------- Events ---------- */

els.addBtn.addEventListener('click', () => openModal());
els.emptyAddBtn.addEventListener('click', () => openModal());
els.closeModal.addEventListener('click', closeModal);
els.cancelBtn.addEventListener('click', closeModal);

els.overlay.addEventListener('click', e => {
  if (e.target === els.overlay) closeModal();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (els.overlay.classList.contains('open')) closeModal();
    if (els.importOverlay.classList.contains('open')) closeImport();
    if (!els.moreMenu.hidden) closeMoreMenu();
  }
});

els.exportBtn.addEventListener('click', exportBackup);
els.importBtn.addEventListener('click', openImport);
els.importClose.addEventListener('click', closeImport);
els.importCancel.addEventListener('click', closeImport);
els.importOverlay.addEventListener('click', e => {
  if (e.target === els.importOverlay) closeImport();
});
els.importFile.addEventListener('change', handleImportFile);
els.importApply.addEventListener('click', applyImport);

els.fFile.addEventListener('change', async e => {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (file) useImageFile(file);
});

// Pasting an image (e.g. a screenshot) straight into the URL field also works.
els.fImageUrl.addEventListener('paste', e => {
  const files = e.clipboardData && e.clipboardData.files;
  if (files && files.length && files[0].type.startsWith('image/')) {
    e.preventDefault();
    useImageFile(files[0]);
  }
});

els.fImageUrl.addEventListener('input', () => {
  clearTimeout(urlDebounce);
  urlDebounce = setTimeout(applyUrlPreview, 400);
});

els.previewImg.addEventListener('load', () => {
  els.previewImg.classList.remove('loading', 'failed');
  els.imageError.hidden = true;
});

els.previewImg.addEventListener('error', () => {
  els.previewImg.classList.remove('loading');
  if (!els.previewImg.getAttribute('src')) return;
  imageFailed = true;
  els.previewImg.classList.add('failed');
  els.imageError.textContent = "Couldn't load that image. Use a direct image link — one ending in .jpg, .png, .gif or .webp. Links to pages (Google, Instagram…) won't work.";
  els.imageError.hidden = false;
});

els.removeImage.addEventListener('click', () => {
  pendingImage = null;
  imageFailed = false;
  els.fImageUrl.value = '';
  els.fFile.value = '';
  updatePreview();
});

els.form.addEventListener('submit', saveEntry);

els.timeline.addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const item = btn.closest('.tl-item');
  const entry = entries.find(x => x.id === item.dataset.id);
  if (!entry) return;

  if (btn.dataset.action === 'share') shareEntry(entry);
  if (btn.dataset.action === 'edit') openModal(entry);
  if (btn.dataset.action === 'delete') deleteEntry(entry);
});

/* ---------- Category filter chips ---------- */

function renderFilterChips() {
  const gridIcon = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>';
  const chips = [{ key: 'all', label: 'All', icon: gridIcon }]
    .concat(Object.entries(CATEGORY_META).map(([key, meta]) => ({ key, label: meta.label, icon: meta.icon })));

  els.filterChips.innerHTML = chips.map(c => `
    <button class="chip${activeFilter === c.key ? ' active' : ''}" data-filter="${c.key}"
      type="button" aria-pressed="${activeFilter === c.key}">${c.icon}${esc(c.label)}</button>
  `).join('');
}

/* ---------- Date rail ---------- */

function monthKey(entry) {
  const d = new Date(entry.eventDate);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function renderDateRail(sorted) {
  if (!sorted.length) {
    els.dateRail.hidden = true;
    els.dateRail.innerHTML = '';
    return;
  }
  // Months that actually have entries, in chronological order, grouped by year.
  const months = new Map();
  for (const e of sorted) {
    const key = monthKey(e);
    if (!months.has(key)) {
      const d = new Date(e.eventDate);
      months.set(key, {
        year: d.getFullYear(),
        label: d.toLocaleString(undefined, { month: 'short' }).toUpperCase()
          + ' ' + d.getFullYear(),
      });
    }
  }
  const keys = [...months.keys()].sort();
  const currentYear = new Date().getFullYear();

  let html = '';
  let openGroup = false;
  let lastYear = null;
  for (const key of keys) {
    const m = months.get(key);
    if (m.year !== lastYear) {
      if (openGroup) html += '</div>';
      html += `<div class="rail-year ${m.year === currentYear ? 'current' : 'future'}">`
        + `<span class="rail-bracket">[</span> ${m.year} <span class="rail-bracket">]</span></div>`
        + '<div class="rail-months">';
      openGroup = true;
      lastYear = m.year;
    }
    html += `<button class="rail-month" data-month="${key}" type="button">`
      + '<span class="rail-dot" aria-hidden="true"></span>'
      + `${m.label}</button>`;
  }
  if (openGroup) html += '</div>';

  els.dateRail.innerHTML = html;
  els.dateRail.hidden = false;
  setActiveMonth(keys[0]);
}

function setActiveMonth(key) {
  els.dateRail.querySelectorAll('.rail-month').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.month === key);
  });
}

// Scrollspy: highlight the month of the card currently nearest the top.
function updateActiveMonthFromScroll() {
  const cards = document.querySelectorAll('.tl-item');
  if (!cards.length) return;
  let activeKey = null;
  // At the very bottom, the last card can never reach the top — highlight it instead.
  const atBottom = window.innerHeight + window.scrollY
    >= document.documentElement.scrollHeight - 4;
  if (atBottom) {
    const entry = entries.find(x => x.id === cards[cards.length - 1].dataset.id);
    if (entry) activeKey = monthKey(entry);
  } else {
    for (const card of cards) {
      if (card.getBoundingClientRect().top <= 180) {
        const entry = entries.find(x => x.id === card.dataset.id);
        if (entry) activeKey = monthKey(entry);
      } else break;
    }
    if (!activeKey) {
      const entry = entries.find(x => x.id === cards[0].dataset.id);
      if (entry) activeKey = monthKey(entry);
    }
  }
  if (activeKey) setActiveMonth(activeKey);
}

let railSpyTick = false;
window.addEventListener('scroll', () => {
  if (railSpyTick) return;
  railSpyTick = true;
  requestAnimationFrame(() => {
    railSpyTick = false;
    updateActiveMonthFromScroll();
  });
}, { passive: true });

els.dateRail.addEventListener('click', e => {
  const btn = e.target.closest('.rail-month');
  if (!btn) return;
  const key = btn.dataset.month;
  const card = [...document.querySelectorAll('.tl-item')].find(c => {
    const entry = entries.find(x => x.id === c.dataset.id);
    return entry && monthKey(entry) === key;
  });
  if (!card) return;
  card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  card.classList.add('highlight');
  setTimeout(() => card.classList.remove('highlight'), 2400);
});

els.filterChips.addEventListener('click', e => {
  const chip = e.target.closest('.chip');
  if (!chip || chip.dataset.filter === activeFilter) return;
  activeFilter = chip.dataset.filter;
  render();
  updateActiveMonthFromScroll();
});

/* ---------- Header overflow menu ---------- */

function closeMoreMenu() {
  els.moreMenu.hidden = true;
  els.moreBtn.classList.remove('open');
  els.moreBtn.setAttribute('aria-expanded', 'false');
}

els.moreBtn.addEventListener('click', e => {
  e.stopPropagation();
  const willOpen = els.moreMenu.hidden;
  els.moreMenu.hidden = !willOpen;
  els.moreBtn.classList.toggle('open', willOpen);
  els.moreBtn.setAttribute('aria-expanded', String(willOpen));
});

// Close when a menu action is chosen, when clicking elsewhere, or on Esc.
els.moreMenu.addEventListener('click', e => {
  if (e.target.closest('.menu-item')) closeMoreMenu();
});

document.addEventListener('click', e => {
  if (!els.moreMenu.hidden && !e.target.closest('.more-wrap')) closeMoreMenu();
});

/* ---------- Init ---------- */

renderFilterChips();
render();

// If the page was opened via a shared link (?entry=<id>), jump to that card.
const sharedId = new URLSearchParams(location.search).get('entry');
if (sharedId) {
  requestAnimationFrame(() => {
    const el = document.querySelector(`.tl-item[data-id="${CSS.escape(sharedId)}"]`);
    if (el) {
      el.classList.add('highlight');
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
}
