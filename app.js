/**
 * PAGASKA DOWNLOADER — app.js
 * Download media from social platforms via REST API
 * Primary API: api-faa.my.id | Fallback: api.theresav.biz.id
 */

// ============================================================
// CONFIG
// ============================================================
const CONFIG = {
  APIs: [
    'https://api-faa.my.id/faa/aio?url=',
    'https://api.theresav.biz.id/download/aio?url='
  ],
  MAX_HISTORY:   20,      // Max history entries stored
  HISTORY_KEY:   'pagaska_history',
};

// ============================================================
// STATE
// ============================================================
const state = {
  isLoading:   false,
};

// ============================================================
// DOM HELPERS
// ============================================================
const $ = (id) => document.getElementById(id);

function show(id) { $(id).style.display = ''; }
function hide(id) { $(id).style.display = 'none'; }

function showSection(name) {
  ['loadingSection', 'errorSection', 'resultSection'].forEach(s => hide(s));
  if (name) show(name);
}

// ============================================================
// INPUT HANDLING
// ============================================================
const urlInput = $('urlInput');
const clearBtn = $('clearBtn');

urlInput.addEventListener('input', () => {
  clearBtn.classList.toggle('visible', urlInput.value.length > 0);
});

urlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleDownload();
});

function clearInput() {
  urlInput.value = '';
  clearBtn.classList.remove('visible');
  urlInput.focus();
}

function clearResult() {
  showSection(null);
  urlInput.focus();
}

function scrollToHistory() {
  $('historySection').scrollIntoView({ behavior: 'smooth' });
}

// ============================================================
// URL VALIDATION
// ============================================================
const SUPPORTED_DOMAINS = [
  'tiktok.com', 'vt.tiktok.com',
  'instagram.com', 'instagr.am',
  'facebook.com', 'fb.com', 'fb.watch',
  'twitter.com', 'x.com', 't.co',
  'youtube.com', 'youtu.be',
  'pinterest.com', 'pin.it',
  'snapchat.com',
  'reddit.com', 'redd.it',
  'dailymotion.com',
  'vimeo.com',
  'capcut.com',
  'likee.video',
  'douyin.com',
  'weibo.com',
  'telegram.me', 't.me',
];

function isValidUrl(url) {
  try {
    const parsed = new URL(url.trim());
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    return true; // Accept any valid URL, API will validate support
  } catch {
    return false;
  }
}

function detectPlatform(url) {
  try {
    const host = new URL(url).hostname.replace('www.', '');
    for (const domain of SUPPORTED_DOMAINS) {
      if (host === domain || host.endsWith('.' + domain)) {
        return domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);
      }
    }
    return 'Media';
  } catch {
    return 'Media';
  }
}

// ============================================================
// API FETCHING — with fallback
// ============================================================
async function fetchWithFallback(url) {
  let lastError = null;

  for (let i = 0; i < CONFIG.APIs.length; i++) {
    const apiBase = CONFIG.APIs[i];
    const apiLabel = i === 0 ? 'API Utama' : 'API Cadangan';
    $('loadingApi').textContent = `Menghubungi ${apiLabel}...`;

    try {
      const res = await fetch(apiBase + encodeURIComponent(url), {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      if (!data) throw new Error('Respons kosong');

      return { data, apiIndex: i };
    } catch (err) {
      console.warn(`[Pagaska] ${apiLabel} gagal:`, err.message);
      lastError = err;
      // Continue to next API
    }
  }

  throw lastError || new Error('Semua API gagal merespons.');
}

// ============================================================
// RESPONSE PARSER — handles different API response structures
// ============================================================
function parseResponse(data) {
  // Normalize: handle various API response shapes
  // Shape 1: { status, result: { title, thumbnail, medias: [...] } }
  // Shape 2: { status, data: { title, thumbnail, images/videos/audio } }
  // Shape 3: { success, result: [...] }  (flat array)
  // Shape 4: { status, result: { url, quality, ... } }  (single item)

  let result = {
    title:     '',
    thumbnail: '',
    medias:    [],
  };

  const raw = data?.result || data?.data || data;

  if (!raw) return null;

  // Title
  result.title = raw.title || raw.caption || raw.description || data.title || '';

  // Thumbnail
  result.thumbnail =
    raw.thumbnail || raw.cover || raw.image || raw.thumb ||
    (Array.isArray(raw.images) ? raw.images[0] : '') ||
    data.thumbnail || '';

  // ---- Collect medias ----

  // Pattern A: medias array
  if (Array.isArray(raw.medias) && raw.medias.length > 0) {
    result.medias = raw.medias.map(m => ({
      type:    normalizeType(m.type || m.quality || ''),
      label:   m.quality || m.type || m.label || 'Download',
      url:     m.url || m.download_url || m.link || '',
      ext:     m.ext || guessExt(m.url || '', m.type || ''),
    })).filter(m => m.url);
    return result;
  }

  // Pattern B: videos / audio / images as separate keys
  if (raw.videos || raw.video) {
    const vids = raw.videos || (raw.video ? [raw.video] : []);
    const list = Array.isArray(vids) ? vids : [vids];
    list.forEach((v, i) => {
      const url = typeof v === 'string' ? v : (v.url || v.download_url || v.link || '');
      if (url) {
        result.medias.push({
          type:  'video',
          label: v.quality || v.type || `Video ${i + 1}`,
          url,
          ext:   'mp4',
        });
      }
    });
  }

  if (raw.audio || raw.music) {
    const url = typeof raw.audio === 'string' ? raw.audio :
                typeof raw.music === 'string' ? raw.music :
                (raw.audio?.url || raw.music?.url || '');
    if (url) {
      result.medias.push({
        type:  'audio',
        label: 'Audio / Musik',
        url,
        ext:   'mp3',
      });
    }
  }

  if (Array.isArray(raw.images) && raw.images.length > 0) {
    raw.images.forEach((img, i) => {
      const url = typeof img === 'string' ? img : (img.url || '');
      if (url) {
        result.medias.push({
          type:  'image',
          label: `Gambar ${i + 1}`,
          url,
          ext:   'jpg',
        });
      }
    });
  }

  // Pattern C: top-level url field (single download)
  if (result.medias.length === 0 && (raw.url || raw.download_url || raw.link)) {
    const url = raw.url || raw.download_url || raw.link;
    result.medias.push({
      type:  normalizeType(raw.type || raw.format || ''),
      label: raw.quality || raw.type || 'Download',
      url,
      ext:   guessExt(url, raw.type || ''),
    });
  }

  // Pattern D: flat array result (api returns array directly)
  if (result.medias.length === 0 && Array.isArray(data.result)) {
    data.result.forEach((item, i) => {
      const url = item.url || item.download_url || item.link || '';
      if (url) {
        result.medias.push({
          type:  normalizeType(item.type || item.quality || ''),
          label: item.quality || item.type || `Item ${i + 1}`,
          url,
          ext:   guessExt(url, item.type || ''),
        });
      }
    });
  }

  return result.medias.length > 0 ? result : null;
}

function normalizeType(type) {
  const t = String(type).toLowerCase();
  if (t.includes('audio') || t.includes('mp3') || t.includes('music')) return 'audio';
  if (t.includes('image') || t.includes('photo') || t.includes('img') || t.includes('jpg') || t.includes('png')) return 'image';
  return 'video';
}

function guessExt(url, type) {
  const t = normalizeType(type);
  if (t === 'audio') return 'mp3';
  if (t === 'image') return 'jpg';
  // Try from URL
  try {
    const path = new URL(url).pathname;
    const ext = path.split('.').pop().toLowerCase();
    if (['mp4','mp3','jpg','jpeg','png','gif','webm','mov','m4a'].includes(ext)) return ext;
  } catch {}
  return 'mp4';
}

// ============================================================
// RENDER RESULT
// ============================================================
function renderResult(parsed, url) {
  const platform = detectPlatform(url);

  // Source label
  $('mediaSource').textContent = platform;

  // Title
  $('mediaTitle').textContent = parsed.title || `Media dari ${platform}`;

  // Preview
  const previewEl = $('mediaPreview');
  previewEl.innerHTML = '';

  const imageMedias = parsed.medias.filter(m => m.type === 'image');
  const videoMedias = parsed.medias.filter(m => m.type === 'video');

  if (imageMedias.length > 1) {
    // Image grid
    const grid = document.createElement('div');
    grid.className = 'preview-images-grid';
    imageMedias.slice(0, 6).forEach(m => {
      const img = document.createElement('img');
      img.src = parsed.thumbnail || m.url;
      img.alt = 'Preview';
      img.loading = 'lazy';
      img.onerror = () => { img.style.display = 'none'; };
      grid.appendChild(img);
    });
    previewEl.appendChild(grid);
  } else if (videoMedias.length > 0 && videoMedias[0].url) {
    // Video preview
    const video = document.createElement('video');
    video.src = videoMedias[0].url;
    video.controls = true;
    video.preload = 'metadata';
    video.poster = parsed.thumbnail || '';
    video.setAttribute('playsinline', '');
    previewEl.appendChild(video);
  } else if (parsed.thumbnail) {
    // Thumbnail image
    const img = document.createElement('img');
    img.src = parsed.thumbnail;
    img.alt = 'Thumbnail';
    img.loading = 'lazy';
    img.onerror = () => { previewEl.style.display = 'none'; };
    previewEl.appendChild(img);
  } else {
    previewEl.style.minHeight = '0';
  }

  // Download options
  const grid = $('optionsGrid');
  grid.innerHTML = '';

  if (parsed.medias.length === 0) {
    grid.innerHTML = '<p style="color:var(--text-muted);font-size:14px;">Tidak ada link download yang ditemukan.</p>';
    return;
  }

  parsed.medias.forEach((media, idx) => {
    const item = document.createElement('div');
    item.className = 'option-item';

    const iconHtml = {
      video: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`,
      audio: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
      image: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
    }[media.type] || iconHtml.video;

    item.innerHTML = `
      <div class="option-info">
        <div class="option-type-icon ${media.type}">${iconHtml}</div>
        <div class="option-details">
          <span class="option-name">${escHtml(media.label)}</span>
          <span class="option-meta">${media.type.toUpperCase()} · .${media.ext}</span>
        </div>
      </div>
      <div class="option-actions">
        <button class="btn-copy-link" title="Salin link" onclick="copyLink('${escAttr(media.url)}', this)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
        </button>
        <a class="btn-dl" href="${escAttr(media.url)}" target="_blank" rel="noopener noreferrer" download>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M12 5v14M5 12l7 7 7-7"/>
          </svg>
          Download
        </a>
      </div>
    `;
    grid.appendChild(item);
  });

  showSection('resultSection');
}

// ============================================================
// MAIN DOWNLOAD HANDLER
// ============================================================
async function handleDownload() {
  if (state.isLoading) return;

  const url = urlInput.value.trim();

  // Validate
  if (!url) {
    showToast('Masukkan URL terlebih dahulu.', 'error');
    urlInput.focus();
    return;
  }

  if (!isValidUrl(url)) {
    showToast('URL tidak valid. Pastikan dimulai dengan https://', 'error');
    return;
  }

  // Set loading state
  state.isLoading = true;
  $('downloadBtn').disabled = true;
  showSection('loadingSection');

  try {
    const { data, apiIndex } = await fetchWithFallback(url);

    // Check API-level success
    const isSuccess = data.status === true || data.status === 'success' ||
                      data.success === true || data.ok === true ||
                      (data.result && !data.error);

    if (!isSuccess && (data.message || data.error)) {
      throw new Error(data.message || data.error || 'API mengembalikan status gagal.');
    }

    const parsed = parseResponse(data);

    if (!parsed || parsed.medias.length === 0) {
      throw new Error('Tidak ada media yang dapat diunduh dari URL ini. Coba link lain.');
    }

    // Save to history
    saveHistory(url, parsed);

    // Render
    renderResult(parsed, url);

    const apiName = apiIndex === 0 ? 'API Utama' : 'API Cadangan';
    showToast(`Berhasil! (via ${apiName})`, 'success');

  } catch (err) {
    console.error('[Pagaska] Error:', err);
    $('errorMsg').textContent = err.message || 'Terjadi kesalahan. Coba lagi.';
    showSection('errorSection');
  } finally {
    state.isLoading = false;
    $('downloadBtn').disabled = false;
  }
}

// ============================================================
// COPY LINK
// ============================================================
async function copyLink(url, btn) {
  try {
    await navigator.clipboard.writeText(url);
    btn.classList.add('copied');
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
    showToast('Link disalin!', 'success');
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
    }, 2000);
  } catch {
    showToast('Gagal menyalin link.', 'error');
  }
}

// ============================================================
// HISTORY
// ============================================================
function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(CONFIG.HISTORY_KEY) || '[]');
  } catch { return []; }
}

function saveHistoryData(items) {
  localStorage.setItem(CONFIG.HISTORY_KEY, JSON.stringify(items));
}

function saveHistory(url, parsed) {
  const items = loadHistory();
  // Remove duplicate URL
  const filtered = items.filter(h => h.url !== url);
  filtered.unshift({
    url,
    title:     parsed.title || url,
    thumbnail: parsed.thumbnail || '',
    time:      Date.now(),
  });
  saveHistoryData(filtered.slice(0, CONFIG.MAX_HISTORY));
  renderHistory();
}

function clearHistory() {
  localStorage.removeItem(CONFIG.HISTORY_KEY);
  renderHistory();
  showToast('Riwayat dihapus.', 'info');
}

function reuseHistory(url) {
  urlInput.value = url;
  clearBtn.classList.add('visible');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(() => handleDownload(), 300);
}

function renderHistory() {
  const items = loadHistory();
  const section = $('historySection');
  const list = $('historyList');
  const header = section.querySelector('.history-header');

  if (items.length === 0) {
    header.style.display = 'none';
    list.innerHTML = `
      <div class="history-empty">
        <p>Belum ada riwayat download. Mulai download sekarang!</p>
      </div>`;
    return;
  }

  header.style.display = 'flex';
  list.innerHTML = '';
  items.forEach(item => {
    const el = document.createElement('div');
    el.className = 'history-item';
    const timeAgo = formatTimeAgo(item.time);
    const shortUrl = item.url.length > 55 ? item.url.slice(0, 52) + '…' : item.url;

    el.innerHTML = `
      ${item.thumbnail
        ? `<img class="history-thumb" src="${escAttr(item.thumbnail)}" alt="thumb" loading="lazy" onerror="this.outerHTML='<div class=\\'history-thumb-placeholder\\'><svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\'><path d=\\'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\\'/></svg></div>'">`
        : `<div class="history-thumb-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>`
      }
      <div class="history-details">
        <span class="history-url" title="${escAttr(item.url)}">${escHtml(shortUrl)}</span>
        <span class="history-time">${timeAgo}</span>
      </div>
      <button class="history-reuse" onclick="reuseHistory('${escAttr(item.url)}')">Download lagi</button>
    `;
    list.appendChild(el);
  });
}

function formatTimeAgo(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Baru saja';
  if (m < 60) return `${m} menit lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const d = Math.floor(h / 24);
  return `${d} hari lalu`;
}

// ============================================================
// TOAST NOTIFICATION
// ============================================================
let toastTimeout;

function showToast(msg, type = 'info') {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }

  toast.className = `toast ${type}`;
  toast.innerHTML = `<div class="toast-dot"></div>${escHtml(msg)}`;

  clearTimeout(toastTimeout);
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// ============================================================
// UTILITIES
// ============================================================
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escAttr(str) {
  return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  renderHistory();
  urlInput.focus();

  // Paste shortcut hint
  urlInput.addEventListener('paste', () => {
    setTimeout(() => {
      clearBtn.classList.toggle('visible', urlInput.value.length > 0);
    }, 50);
  });
});
