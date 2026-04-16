# 🎯 Pagaska Downloader

Website downloader media modern untuk TikTok, Instagram, Facebook, YouTube, dan 50+ platform lainnya.

## ✨ Fitur

- ⬇️ Download video, audio, dan gambar
- 🔁 Dual API dengan otomatis fallback
- 📱 Responsive (mobile-friendly)
- 🌙 Dark mode default
- 📋 Copy link hasil download
- 🎥 Preview video langsung di browser
- 📝 History download (localStorage)
- 🔒 Rate limiting (anti-spam)
- ⚡ Ringan, tanpa framework besar

## 🌐 Platform yang Didukung

TikTok · Instagram · Facebook · Twitter/X · YouTube · Pinterest · Snapchat · Reddit · Vimeo · Dailymotion · dan banyak lagi

## 🚀 Cara Menjalankan

### Lokal (tanpa server)
```bash
# Cukup buka file index.html di browser
open index.html
# atau double-click file index.html
```

### Dengan live server (opsional)
```bash
# Pakai VS Code Live Server extension
# atau pakai npx
npx serve .
# lalu buka http://localhost:3000
```

## 🔗 Deploy ke Vercel

### Cara 1 — Drag & Drop
1. Buka [vercel.com](https://vercel.com)
2. Login / daftar akun
3. Klik "Add New → Project"
4. Drag folder `pagaska-downloader` ke area upload
5. Klik Deploy → Selesai!

### Cara 2 — Via CLI
```bash
# Install Vercel CLI
npm install -g vercel

# Masuk ke folder project
cd pagaska-downloader

# Deploy
vercel

# Ikuti instruksi di terminal
```

### Cara 3 — GitHub + Vercel
1. Upload project ke GitHub
2. Buka [vercel.com](https://vercel.com) → Import dari GitHub
3. Pilih repository → Deploy otomatis

## 📁 Struktur File

```
pagaska-downloader/
├── index.html       # Struktur HTML utama
├── style.css        # Semua styling (dark mode, animasi)
├── app.js           # Logic utama (API, parsing, UI)
├── vercel.json      # Konfigurasi Vercel (opsional)
└── README.md        # Dokumentasi ini
```

## 🔗 API yang Digunakan

| # | API | Peran |
|---|-----|-------|
| 1 | `https://api-faa.my.id/faa/aio?url=` | Primary |
| 2 | `https://api.theresav.biz.id/download/aio?url=` | Fallback |

## 📦 Contoh Response API

### Response Berhasil (Struktur Umum)
```json
{
  "status": true,
  "result": {
    "title": "Video judul di sini",
    "thumbnail": "https://...",
    "medias": [
      {
        "url": "https://cdn.example.com/video.mp4",
        "quality": "HD",
        "type": "video",
        "ext": "mp4"
      },
      {
        "url": "https://cdn.example.com/audio.mp3",
        "quality": "Audio",
        "type": "audio",
        "ext": "mp3"
      }
    ]
  }
}
```

### Response Gagal
```json
{
  "status": false,
  "message": "URL tidak valid atau tidak didukung"
}
```

## 🛠️ Kustomisasi

### Menambah API baru
Edit `app.js` bagian CONFIG:
```javascript
const CONFIG = {
  APIs: [
    'https://api-faa.my.id/faa/aio?url=',        // Primary
    'https://api.theresav.biz.id/download/aio?url=', // Fallback
    'https://api-baru-anda.com/download?url=',    // Tambahkan di sini
  ],
  ...
};
```

### Mengubah rate limit
```javascript
RATE_LIMIT_MS: 5000,  // 5 detik (ubah sesuai kebutuhan)
```

### Mengubah warna tema
Edit variabel CSS di `style.css`:
```css
:root {
  --accent:   #3b9eff;  /* Warna aksen utama */
  --accent-2: #7c5cfc;  /* Warna aksen sekunder */
  --accent-3: #00e5b0;  /* Warna aksen ketiga */
  --bg-base:  #080c12;  /* Background utama */
}
```

## 📝 Catatan

- Website ini hanya untuk keperluan pribadi
- Hormati hak cipta dan terms of service platform
- Tidak menyimpan atau merekam URL yang didownload
- Rate limit 5 detik diterapkan untuk mengurangi spam ke API

## 📄 Lisensi

MIT License — Bebas digunakan dan dimodifikasi

---

Dibuat dengan ❤️ oleh **Pagaska Team**