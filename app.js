/**
 * PAGASKA DOWNLOADER — app.js
 * Download media using anabot.my.id specific APIs
 * Supports: YouTube (MP3/MP4), TikTok, Instagram
 */

// ============================
// CONFIG
// ============================
const CONFIG = {
  API_BASE: 'https://anabot.my.id/api/download',
  API_KEY: 'freeApikey',
  DEFAULT_VIDEO_QUALITY: '480', // 360, 480, 720, 1080
  MAX_HISTORY: 20,
  HISTORY_KEY: 'pagaska_history',
};

// ============================
// STATE
// ============================
const state = {
  isLoading: false,
};

// ============================
// DOM HELPERS
// ============================
const $ = (id) => document.getElementById(id);

function show(id) { $(id).style.display = ''; }
function hide(id) { $(id).style.display = 'none'; }

function showSection(name) {
  ['loadingSection', 'errorSection', 'resultSection'].forEach(s => hide(s));
  if (name) show(name);
}

// ============================
// INPUT HANDLING
// ============================
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

// ============================
// PLATFORM DETECTION & API ROUTING
// ============================
function detectPlatform(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    
    if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
      return 'youtube';
    }
    if (hostname.includes('tiktok.com') || hostname.includes('vt.tiktok.com')) {
      return 'tiktok';
    }
    if (hostname.includes('instagram.com') || hostname.includes('instagr.am')) {
      return 'instagram';
    }
    if (hostname.includes('facebook.com') || hostname.includes('fb.com') || hostname.includes('fb.watch')) {
      return 'facebook';
    }
    if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
      return 'twitter';
    }
    
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

function getApiEndpoint(platform, url, format = 'mp4') {
  const encodedUrl = encodeURIComponent(url);
  
  switch (platform) {
    case 'youtube':
      // YouTube: ytmp3 untuk audio, ytmp4 untuk video
      if (format === 'mp3') {
        return `${CONFIG.API_BASE}/ytmp3?url=${encodedUrl}&apikey=${CONFIG.API_KEY}`;
      } else {
        return `${CONFIG.API_BASE}/ytmp4?url=${encodedUrl}&quality=${CONFIG.DEFAULT_VIDEO_QUALITY}&apikey=${CONFIG.API_KEY}`;
      }
    
    case 'tiktok':
      return `${CONFIG.API_BASE}/tiktok?url=${encodedUrl}&apikey=${CONFIG.API_KEY}`;
    
    case 'instagram':
      return `${CONFIG.API_BASE}/instagram?url=${encodedUrl}&apikey=${CONFIG.API_KEY}`;
    
    default:
      // Fallback: coba pakai endpoint yang tersedia
      return `${CONFIG.API_BASE}/tiktok?url=${encodedUrl}&apikey=${CONFIG.API_KEY}`;
  }
}

// ============================
// API FETCHING
// ============================
async function fetchMedia(url, platform, format = 'mp4') {
  const endpoint = getApiEndpoint(platform, url, format);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: { 
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errorText}`);
    }

    const data = await res.json();
    return data;
    
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Request timeout - server terlalu lama merespons');
    }
    throw err;
  }
}

// ============================
// RESPONSE PARSER (anabot format)
// ============================
function parseAnabotResponse(data, platform, format) {
  // Format response anabot:
  // {
  //   "status": true,
  //   "result": {
  //     "title": "...",
  //     "thumbnail": "...",
  //     "download_url": "...",
  //     "quality": "...",
  //     "duration": "...",
  //     ...
  //   }
  // }

  if (!data || !data.status) {
    throw new Error(data?.message || 'API mengembalikan status gagal');
  }

  const result = data.result || data.data || data;
  
  if (!result) {
    throw new Error('Data tidak ditemukan dalam response');
  }

  const parsed = {
    title: result.title || result.name || 'Unknown Title',
    thumbnail: result.thumbnail || result.cover || result.image || '',
    medias: [],
  };

  // Handle YouTube MP3 (audio only)
  if (platform === 'youtube' && format === 'mp3') {
    if (result.download_url || result.url) {
      parsed.medias.push({
        type: 'audio',
        label: 'Audio MP3',
        url: result.download_url || result.url,
        ext: 'mp3',
        quality: result.quality || '128kbps',
      });
    }
  }
  // Handle YouTube MP4 (video)
  else if (platform === 'youtube' && format === 'mp4') {
    if (result.download_url || result.url) {
      parsed.medias.push({
        type: 'video',
        label: `Video ${result.quality || CONFIG.DEFAULT_VIDEO_QUALITY}p`,
        url: result.download_url || result.url,
        ext: 'mp4',
        quality: result.quality || CONFIG.DEFAULT_VIDEO_QUALITY,
      });
    }
    // Jika ada audio juga
    if (result.audio_url || result.audio) {
      parsed.medias.push({
        type: 'audio',
        label: 'Audio Only',
        url: result.audio_url || result.audio,
        ext: 'mp3',
      });
    }
  }
  // Handle TikTok
  else if (platform === 'tiktok') {
    // Video tanpa watermark
    if (result.download_url || result.nowm || result.video) {
      parsed.medias.push({
        type: 'video',
        label: 'Video (No WM)',
        url: result.download_url || result.nowm || result.video,
        ext: 'mp4',
      });
    }
    // Audio
    if (result.audio || result.music || result.audio_url) {
      parsed.medias.push({
        type: 'audio',
        label: 'Audio Original',
        url: result.audio || result.music || result.audio_url,
        ext: 'mp3',
      });
    }
    // Cover/thumbnail as image
    if (result.cover || result.thumbnail) {
      parsed.medias.push({
        type: 'image',
        label: 'Cover',
        url: result.cover || result.thumbnail,
        ext: 'jpg',
      });
    }
  }
  // Handle Instagram
  else if (platform === 'instagram') {
    // Instagram bisa return array of images/videos
    if (Array.isArray(result.downloads)) {
      result.downloads.forEach((item, idx) => {
        const isVideo = item.type === 'video' || item.url?.includes('.mp4');
        parsed.medias.push({
          type: isVideo ? 'video' : 'image',
          label: isVideo ? `Video ${idx + 1}` : `Gambar ${idx + 1}`,
          url: item.url || item.download_url,
          ext: isVideo ? 'mp4' : 'jpg',
        });
      });
    } else if (Array.isArray(result.url)) {
      result.url.forEach((url, idx) => {
        const isVideo = url.includes('.mp4');
        parsed.medias.push({
          type: isVideo ? 'video' : 'image',
          label: isVideo ? `Video ${idx + 1}` : `Gambar ${idx + 1}`,
          url: url,
          ext: isVideo ? 'mp4' : 'jpg',
        });
      });
    } else {
      // Single item
      const url = result.download_url || result.url || result.video || result.image;
      if (url) {
        const isVideo = url.includes('.mp4');
        parsed.medias.push({
          type: isVideo ? 'video' : 'image',
          label: isVideo ? 'Video' : 'Gambar',
          url: url,
          ext: isVideo ? 'mp4' : 'jpg',
        });
      }
    }
  }

  return parsed;
}

// ============================
// RENDER RESULT
// ============================
function renderResult(parsed, url, platform) {
  // Platform label
  const platformNames = {
    youtube: 'YouTube',
    tiktok: 'TikTok',
    instagram: 'Instagram',
    facebook: 'Facebook',
    twitter: 'Twitter/X',
  };
  $('mediaSource').textContent = platformNames[platform] || 'Media';

  // Title
  $('mediaTitle').textContent = parsed.title || `Media dari ${platformNames[platform] || 'Unknown'}`;

  // Preview
  const previewEl = $('mediaPreview');
  previewEl.innerHTML = '';

  const videoMedias = parsed.medias.filter(m => m.type === 'video');
  const imageMedias = parsed.medias.filter(m => m.type === 'image');

  if (videoMedias.length > 0 && videoMedias[0].url) {
    // Video preview
    const video = document.createElement('video');
    video.src = videoMedias[0].url;
    video.controls = true;
    video.preload = 'metadata';
    video.poster = parsed.thumbnail || '';
    video.setAttribute('playsinline', '');
    video.style.width = '100%';
    video.style.borderRadius = '12px';
    previewEl.appendChild(video);
  } else if (parsed.thumbnail) {
    // Thumbnail image
    const img = document.createElement('img');
    img.src = parsed.thumbnail;
    img.alt = 'Thumbnail';
    img.loading = 'lazy';
    img.style.width = '100%';
    img.style.borderRadius = '12px';
    img.onerror = () => { previewEl.style.display = 'none'; };
    previewEl.appendChild(img);
  }

  // Download options
  const grid = $('optionsGrid');
  grid.innerHTML = '';

  if (parsed.medias.length === 0) {
    grid.innerHTML = '<p style="color:var(--text-muted);font-size:14px;">Tidak ada link download yang ditemukan.</p>';
    return;
  }

  parsed.medias.forEach((media) => {
    const item = document.createElement('div');
    item.className = 'option-item';

    const iconHtml = {
      video: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`,
      audio: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
      image: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
    }[media.type];

    item.innerHTML = `
      <div class="option-info">
        <div class="option-type-icon ${media.type}">${iconHtml}</div>
        <div class="option-details">
          <span class="option-name">${escHtml(media.label)}</span>
          <span class="option-meta">${media.type.toUpperCase()} • .${media.ext}</span>
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

// ============================
// MAIN DOWNLOAD HANDLER
// ============================
async function handleDownload(format = 'mp4') {
  if (state.isLoading) return;

  const url = urlInput.value.trim();

  // Validate
  if (!url) {
    showToast('Masukkan URL terlebih dahulu.', 'error');
    urlInput.focus();
    return;
  }

  // Detect platform
  const platform = detectPlatform(url);
  
  if (platform === 'unknown') {
    showToast('Platform tidak didukung. Gunakan: YouTube, TikTok, Instagram', 'error');
    return;
  }

  if (platform === 'youtube' && format === 'mp3') {
    $('loadingApi').textContent = 'Mengambil audio YouTube...';
  } else if (platform === 'youtube') {
    $('loadingApi').textContent = 'Mengambil video YouTube...';
  } else {
    $('loadingApi').textContent = `Mengambil dari ${platform}...`;
  }

  // Set loading state
  state.isLoading = true;
  $('downloadBtn').disabled = true;
  showSection('loadingSection');

  try {
    const data = await fetchMedia(url, platform, format);
    const parsed = parseAnabotResponse(data, platform, format);

    if (!parsed.medias || parsed.medias.length === 0) {
      throw new Error('Tidak ada media yang dapat diunduh dari URL ini.');
    }

    // Save to history
    saveHistory(url, parsed, platform);

    // Render
    renderResult(parsed, url, platform);

    showToast('Berhasil!', 'success');

  } catch (err) {
    console.error('[Pagaska] Error:', err);
    $('errorMsg').textContent = err.message || 'Terjadi kesalahan. Coba lagi.';
    showSection('errorSection');
  } finally {
    state.isLoading = false;
    $('downloadBtn').disabled = false;
  }
}

// ============================
// FORMAT SELECTOR (for YouTube)
// ============================
function showFormatSelector() {
  const url = urlInput.value.trim();
  const platform = detectPlatform(url);
  
  if (platform !== 'youtube') {
    // Non-YouTube langsung download
    handleDownload('mp4');
    return;
  }

  // YouTube: tampilkan pilihan MP3 atau MP4
  const existing = document.querySelector('.format-selector');
  if (existing) existing.remove();

  const selector = document.createElement('div');
  selector.className = 'format-selector';
  selector.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: var(--bg-card, #1a1a1a);
    padding: 24px;
    border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    z-index: 1000;
    text-align: center;
    min-width: 280px;
  `;
  
  selector.innerHTML = `
    <h3 style="margin:0 0 16px 0;color:var(--text-main,#fff);">Pilih Format</h3>
    <div style="display:flex;gap:12px;justify-content:center;">
      <button onclick="closeFormatSelector();handleDownload('mp3')" style="
        padding: 12px 24px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border: none;
        border-radius: 8px;
        color: white;
        cursor: pointer;
        font-weight: 600;
      ">🎵 Audio (MP3)</button>
      <button onclick="closeFormatSelector();handleDownload('mp4')" style="
        padding: 12px 24px;
        background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        border: none;
        border-radius: 8px;
        color: white;
        cursor: pointer;
        font-weight: 600;
      ">🎬 Video (MP4)</button>
    </div>
    <button onclick="closeFormatSelector()" style="
      margin-top: 16px;
      background: transparent;
      border: none;
      color: var(--text-muted, #888);
      cursor: pointer;
    ">Batal</button>
  `;

  const overlay = document.createElement('div');
  overlay.className = 'format-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.7);
    z-index: 999;
  `;
  overlay.onclick = closeFormatSelector;

  document.body.appendChild(overlay);
  document.body.appendChild(selector);
}

function closeFormatSelector() {
  const selector = document.querySelector('.format-selector');
  const overlay = document.querySelector('.format-overlay');
  if (selector) selector.remove();
  if (overlay) overlay.remove();
}

// ============================
// COPY LINK
// ============================
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

// ============================
// HISTORY
// ============================
function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(CONFIG.HISTORY_KEY) || '[]');
  } catch { return []; }
}

function saveHistoryData(items) {
  localStorage.setItem(CONFIG.HISTORY_KEY, JSON.stringify(items));
}

function saveHistory(url, parsed, platform) {
  const items = loadHistory();
  const filtered = items.filter(h => h.url !== url);
  filtered.unshift({
    url,
    title: parsed.title || url,
    thumbnail: parsed.thumbnail || '',
    platform: platform,
    time: Date.now(),
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
  setTimeout(() => showFormatSelector(), 300);
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
    const platformIcon = {
      youtube: '▶️',
      tiktok: '🎵',
      instagram: '📷',
      facebook: '👍',
      twitter: '🐦',
    }[item.platform] || '📎';

    el.innerHTML = `
      ${item.thumbnail
        ? `<img class="history-thumb" src="${escAttr(item.thumbnail)}" alt="thumb" loading="lazy" onerror="this.outerHTML='<div class=\'history-thumb-placeholder\'>${platformIcon}</div>'">`
        : `<div class="history-thumb-placeholder">${platformIcon}</div>`
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

// ============================
// TOAST NOTIFICATION
// ============================
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

// ============================
// UTILITIES
// ============================
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

// ============================
// INIT
// ============================
document.addEventListener('DOMContentLoaded', () => {
  renderHistory();
  urlInput.focus();

  // Paste handler
  urlInput.addEventListener('paste', () => {
    setTimeout(() => {
      clearBtn.classList.toggle('visible', urlInput.value.length > 0);
    }, 50);
  });

  // Update download button to show format selector
  const dlBtn = $('downloadBtn');
  if (dlBtn) {
    dlBtn.onclick = (e) => {
      e.preventDefault();
      showFormatSelector();
    };
  }
});
