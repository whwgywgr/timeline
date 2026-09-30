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
  fFile: document.getElementById('fFile'),
  fImageUrl: document.getElementById('fImageUrl'),
  imagePreview: document.getElementById('imagePreview'),
  previewImg: document.getElementById('previewImg'),
  removeImage: document.getElementById('removeImage'),
  fDesc: document.getElementById('fDesc'),
  cancelBtn: document.getElementById('cancelBtn'),
  saveBtn: document.getElementById('saveBtn'),
  toast: document.getElementById('toast'),
};

let entries = loadEntries();
let editingId = null;
let pendingImage = null;
let toastTimer = null;

/* ---------- Storage ---------- */

function loadEntries() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(raw) ? raw : [];
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

function fmtDate(iso) {
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
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

function cardHTML(entry, index) {
  const side = index % 2 === 0 ? 'left' : 'right';
  const wasEdited = entry.updatedAt !== entry.createdAt;
  const image = entry.image
    ? `<img class="card-img" src="${esc(entry.image)}" alt="${esc(entry.title)}" loading="lazy">`
    : '';
  const desc = entry.description
    ? `<p class="card-desc">${esc(entry.description)}</p>`
    : '';

  return `
  <article class="tl-item ${side}" data-id="${esc(entry.id)}">
    <div class="card">
      ${image}
      <h3 class="card-title">${esc(entry.title)}</h3>
      ${desc}
      <div class="card-dates">
        <span class="date-chip">Created · ${fmtDate(entry.createdAt)}</span>
        <span class="date-chip${wasEdited ? ' edited' : ''}">Modified · ${fmtDate(entry.updatedAt)}</span>
      </div>
      <div class="card-actions">
        <button class="btn btn-share" data-action="share" type="button">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          Share
        </button>
        <button class="btn btn-ghost" data-action="edit" type="button">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
          Edit
        </button>
        <button class="btn btn-danger-ghost" data-action="delete" type="button">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          Delete
        </button>
      </div>
    </div>
  </article>`;
}

function render() {
  const sorted = [...entries].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  els.timeline.innerHTML = sorted.map(cardHTML).join('');
  els.empty.hidden = sorted.length > 0;
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
    els.imagePreview.hidden = true;
  }
}

function openModal(entry = null) {
  editingId = entry ? entry.id : null;
  pendingImage = entry ? entry.image : null;
  els.fTitle.value = entry ? entry.title : '';
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
  const image = (pendingImage || els.fImageUrl.value.trim() || '');
  const now = new Date().toISOString();

  if (editingId) {
    const entry = entries.find(x => x.id === editingId);
    if (entry) {
      Object.assign(entry, { title, description, image, updatedAt: now });
      showToast('Entry updated ✓');
    }
  } else {
    entries.push({ id: uid(), title, description, image, createdAt: now, updatedAt: now });
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

/* ---------- Events ---------- */

els.addBtn.addEventListener('click', () => openModal());
els.emptyAddBtn.addEventListener('click', () => openModal());
els.closeModal.addEventListener('click', closeModal);
els.cancelBtn.addEventListener('click', closeModal);

els.overlay.addEventListener('click', e => {
  if (e.target === els.overlay) closeModal();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && els.overlay.classList.contains('open')) closeModal();
});

els.fFile.addEventListener('change', async e => {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    showToast('Please choose an image file');
    return;
  }
  try {
    pendingImage = await compressImage(file);
    els.fImageUrl.value = '';
    updatePreview();
  } catch {
    showToast('Could not read that image');
  }
});

els.fImageUrl.addEventListener('input', () => {
  pendingImage = els.fImageUrl.value.trim() || null;
  updatePreview();
});

els.removeImage.addEventListener('click', () => {
  pendingImage = null;
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

/* ---------- Init ---------- */

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
