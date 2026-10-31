# SmartBiz Insight — AI-Powered Business Data Analyzer

Aplikasi dashboard analisis data bisnis berbasis web untuk UMKM. Unggah data penjualan CSV, lihat visualisasi interaktif, dan dapatkan rekomendasi bisnis dari AI melalui integrasi Langflow.

## Fitur Utama

- **Dashboard** — KPI Revenue, Transaksi, Produk Unik, Rata-rata Transaksi + 4 grafik interaktif
- **Upload CSV** — Drag & drop, validasi format, pratinjau data sebelum diterapkan
- **AI Business Insights** — Integrasi Langflow untuk analisis dan rekomendasi bisnis
- **Export Laporan** — Unduh laporan CSV atau TXT lengkap dengan AI Insights
- **Dark Mode** — Toggle dark/light mode
- **LocalStorage** — Data tersimpan di browser, tidak hilang setelah refresh

## Struktur Proyek

```
smartbiz-insight/
├── index.html              # Entry point aplikasi
├── css/
│   └── style.css           # Stylesheet utama
├── js/
│   ├── app.js              # Logika utama & koordinator
│   ├── dataProcessor.js    # Kalkulasi bisnis (revenue, KPI, dsb)
│   ├── charts.js           # Wrapper Chart.js
│   └── langflow.js         # Integrasi Langflow API
├── data/
│   └── sample-sales.csv    # Data contoh penjualan
├── config.example.js       # Template konfigurasi Langflow
└── README.md
```

## Cara Menjalankan

### Prasyarat
Tidak perlu instalasi apapun. Hanya butuh browser modern dan HTTP server lokal.

### Langkah 1 — Clone / buka folder proyek

```bash
cd path/to/smartbiz-insight
```

### Langkah 2 — Jalankan HTTP Server lokal

**Opsi A — VS Code Live Server** *(Direkomendasikan)*
1. Install extension Live Server di VS Code
2. Klik kanan `index.html` → **Open with Live Server**
3. Browser otomatis terbuka di `http://127.0.0.1:5500`

> Wajib menggunakan HTTP server (bukan buka langsung `file://`) karena `app.js` menggunakan `fetch()` untuk memuat `data/sample-sales.csv`.

**Opsi B — Python**
```bash
python -m http.server 8000
# Buka: http://localhost:8000
```

**Opsi C — Node.js**
```bash
npx serve .
# Ikuti URL yang tampil di terminal
```

### Langkah 3 — Gunakan Aplikasi
- Buka browser, aplikasi langsung menampilkan dashboard dengan data contoh
- Navigasi menggunakan sidebar kiri
- Upload CSV Anda sendiri di menu **Upload Data**

---

## Format CSV yang Didukung

File CSV harus memiliki header baris pertama dengan kolom:

```
date,product,category,quantity,price
2026-10-01,Beras Premium 5kg,Sembako,5,75000
2026-10-01,Minyak Goreng 2L,Sembako,8,36000
```

| Kolom      | Tipe    | Keterangan                        |
|------------|---------|-----------------------------------|
| `date`     | Tanggal | Format `YYYY-MM-DD`               |
| `product`  | Teks    | Nama produk                       |
| `category` | Teks    | Kategori produk                   |
| `quantity` | Angka   | Jumlah terjual (> 0)              |
| `price`    | Angka   | Harga per unit (≥ 0)              |

Revenue dihitung otomatis: `revenue = quantity × price`

---

## Konfigurasi Langflow (AI Insights)

Fitur AI Insights memerlukan Langflow yang berjalan dan sudah memiliki flow yang dikonfigurasi.

### Langkah 1 — Siapkan Langflow
1. Install Langflow: `pip install langflow` atau jalankan via Docker
2. Jalankan: `langflow run` (default port 7860)
3. Buat flow baru di Langflow UI dengan komponen:
   - **Chat Input** → **OpenAI / Groq / LLM pilihan** → **Chat Output**
4. Salin **Flow ID** dari URL browser saat membuka flow tersebut

### Langkah 2 — Buat `config.js`
```bash
cp config.example.js config.js
```

Edit `config.js`:
```javascript
const SMARTBIZ_CONFIG = {
  LANGFLOW_BASE_URL: 'http://localhost:7860',  // URL Langflow Anda
  FLOW_ID: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',  // Flow ID dari Langflow
  REQUEST_TIMEOUT: 30000,
  APP_NAME: 'SmartBiz Insight',
};
```

### Langkah 3 — Tambahkan `config.js` ke `index.html`
Buka `index.html`, cari baris `<!-- config.js (opsional...) -->` dan pastikan:
```html
<script src="config.js" onerror="..."></script>
```
sudah ada (sudah tersedia secara default di `index.html`).

### Langkah 4 — Refresh Browser
Status Langflow akan berubah dari **"Belum Dikonfigurasi"** menjadi **"Langflow Terhubung"** di halaman AI Insights.

### Catatan Keamanan
- **JANGAN** commit `config.js` ke repository publik — sudah otomatis diabaikan via `.gitignore`
- `config.example.js` hanya berisi template kosong — aman untuk di-commit
- Untuk deployment produksi, gunakan environment variable atau backend proxy

---

## Endpoint Langflow yang Digunakan

```
POST {LANGFLOW_BASE_URL}/api/v1/run/{FLOW_ID}

Body:
{
  "input_value": "<ringkasan data penjualan>",
  "input_type": "chat",
  "output_type": "chat"
}
```

---

## Teknologi

| Teknologi | Penggunaan |
|-----------|-----------|
| HTML5 | Struktur halaman |
| CSS3 (Custom) | Styling, dark mode, responsive |
| Vanilla JavaScript | Logika aplikasi, parsing CSV, kalkulasi |
| Chart.js 4.4 | Visualisasi data (line, doughnut, bar) |
| LocalStorage | Persistensi data di browser |
| Langflow v1 API | AI Business Insights |

---

## Pengembangan Lebih Lanjut

- Tambahkan kolom `salesperson` atau `region` di CSV untuk analisis per wilayah
- Integrasikan autentikasi sederhana dengan LocalStorage
- Tambahkan filter tanggal pada dashboard
- Export ke format Excel menggunakan library SheetJS
