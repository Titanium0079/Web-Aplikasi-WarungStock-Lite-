/**
 * SmartBiz Insight — app.js
 * Entry point & orchestrator. Mengkoordinasikan DataProcessor, Charts, LangflowClient.
 */

'use strict';

// ──────────────────────────────────────────────────────────────
// STATE
// ──────────────────────────────────────────────────────────────
const LS_KEY = 'smartbiz_sales_data';

let currentRecords = [];    // Array of parsed sale records
let lastAIInsights = null;  // Last AI response text (for export)

// ──────────────────────────────────────────────────────────────
// INIT
// ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  setupNavigation();
  setupUpload();
  setupDarkMode();
  checkLangflowStatus();

  // Init inventory module
  await Inventory.init();
  Inventory.updateLowStockBadge();

  // Load from LocalStorage or fetch sample CSV
  const stored = localStorage.getItem(LS_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        currentRecords = parsed;
        renderAll();
        showToast('Data dimuat dari penyimpanan lokal.', 'info');
        return;
      }
    } catch (_) {}
  }

  await loadSampleData();
});

// ──────────────────────────────────────────────────────────────
// SAMPLE DATA
// ──────────────────────────────────────────────────────────────
async function loadSampleData() {
  try {
    const resp = await fetch('data/sample-sales.csv');
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const text = await resp.text();
    const result = DataProcessor.parseCSV(text);
    if (result.ok) {
      currentRecords = result.records;
      saveToStorage();
      renderAll();
    } else {
      showValidationMessage('upload-validation', result.errors, 'error');
    }
  } catch (e) {
    showToast('Gagal memuat data contoh. Pastikan file data/sample-sales.csv tersedia.', 'error');
  }
}

function saveToStorage() {
  localStorage.setItem(LS_KEY, JSON.stringify(currentRecords));
}

// ──────────────────────────────────────────────────────────────
// NAVIGATION
// ──────────────────────────────────────────────────────────────
const NAV_CONFIG = {
  dashboard:    { title: 'Dashboard',             subtitle: 'Ringkasan performa bisnis' },
  upload:       { title: 'Upload Data',           subtitle: 'Unggah file CSV penjualan' },
  insights:     { title: 'AI Business Insights',  subtitle: 'Analisis berbasis kecerdasan buatan' },
  export:       { title: 'Export Laporan',        subtitle: 'Unduh laporan analisis' },
  // Inventory sections
  'inv-products': { title: 'Manajemen Produk',   subtitle: 'Kelola daftar produk & harga' },
  'inv-stockin':  { title: 'Barang Masuk',        subtitle: 'Catat penerimaan stok' },
  'inv-stockout': { title: 'Barang Keluar',       subtitle: 'Catat pengeluaran stok' },
  'inv-lowstock': { title: 'Stok Menipis',        subtitle: 'Produk yang perlu restock segera' },
  'inv-history':  { title: 'Riwayat Transaksi',   subtitle: 'Semua catatan mutasi stok' },
};

function setupNavigation() {
  document.querySelectorAll('.nav-item[data-section]').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.section));
  });

  document.getElementById('menuToggle').addEventListener('click', toggleSidebar);

  // Mobile overlay close
  document.getElementById('sidebarOverlay').addEventListener('click', closeSidebarMobile);

  navigateTo('dashboard');
}

function navigateTo(section) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  const target = document.getElementById('section-' + section);
  if (target) target.classList.add('active');

  document.querySelectorAll('.nav-item[data-section]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.section === section);
  });

  const cfg = NAV_CONFIG[section] || {};
  document.getElementById('pageTitle').textContent    = cfg.title || section;
  document.getElementById('pageSubtitle').textContent = cfg.subtitle || '';

  closeSidebarMobile();

  // Lazy render on nav
  if (section === 'insights') renderInsightsSection();
  if (section === 'export')   renderExportSection();

  // Inventory sections
  if (section.startsWith('inv-')) Inventory.onSectionEnter(section);
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const content = document.getElementById('mainContent');
  const overlay = document.getElementById('sidebarOverlay');

  if (window.innerWidth <= 768) {
    sidebar.classList.toggle('mobile-open');
    overlay.classList.toggle('show');
  } else {
    sidebar.classList.toggle('collapsed');
    content.classList.toggle('expanded');
  }
}

function closeSidebarMobile() {
  document.getElementById('sidebar').classList.remove('mobile-open');
  document.getElementById('sidebarOverlay').classList.remove('show');
}

// ──────────────────────────────────────────────────────────────
// DARK MODE
// ──────────────────────────────────────────────────────────────
function setupDarkMode() {
  const btn = document.getElementById('darkModeToggle');
  if (!btn) return;
  const saved = localStorage.getItem('smartbiz_dark');
  if (saved === '1') document.body.classList.add('dark');
  btn.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    localStorage.setItem('smartbiz_dark', document.body.classList.contains('dark') ? '1' : '0');
  });
}

// ──────────────────────────────────────────────────────────────
// RENDER ALL
// ──────────────────────────────────────────────────────────────
function renderAll() {
  if (currentRecords.length === 0) return;
  renderKPIs();
  renderCharts();
  renderTopProductsTable();
  renderActivityList();
}

// ──────────────────────────────────────────────────────────────
// KPIs
// ──────────────────────────────────────────────────────────────
function renderKPIs() {
  const kpi = DataProcessor.calculateKPIs(currentRecords);
  setText('kpiRevenue',       'Rp ' + DataProcessor.formatNumber(kpi.totalRevenue));
  setText('kpiTransactions',  kpi.totalTransactions.toLocaleString('id-ID'));
  setText('kpiProducts',      kpi.uniqueProducts.toString());
  setText('kpiAvgTransaction','Rp ' + DataProcessor.formatNumber(Math.round(kpi.avgTransaction)));
}

// ──────────────────────────────────────────────────────────────
// CHARTS
// ──────────────────────────────────────────────────────────────
function renderCharts() {
  const byDate     = DataProcessor.revenueByDate(currentRecords);
  const byCat      = DataProcessor.revenueByCategory(currentRecords);
  const topProds   = DataProcessor.topProducts(currentRecords, 7);

  Charts.renderRevenueLine('chartRevenueLine', byDate);
  Charts.renderCategoryDoughnut('chartCategoryDoughnut', byCat);
  Charts.renderTopProductsBar('chartTopProducts', topProds);
  Charts.renderCategoryBar('chartCategoryBar', byCat);
}

// ──────────────────────────────────────────────────────────────
// TOP PRODUCTS TABLE
// ──────────────────────────────────────────────────────────────
function renderTopProductsTable() {
  const top = DataProcessor.topProducts(currentRecords, 8);
  const el  = document.getElementById('topProductsList');
  if (!el) return;

  const rankClass = ['gold', 'silver', 'bronze'];

  el.innerHTML = top.map((p, i) => `
    <div class="top-product-row">
      <div class="top-product-rank ${rankClass[i] || ''}">${i + 1}</div>
      <div class="top-product-info">
        <p>${escHtml(p.product)}</p>
        <span>${escHtml(p.category)} · ${p.transactions} transaksi</span>
      </div>
      <div class="top-product-revenue">Rp ${DataProcessor.formatNumber(p.revenue)}</div>
    </div>`).join('');
}

// ──────────────────────────────────────────────────────────────
// ACTIVITY LIST
// ──────────────────────────────────────────────────────────────
function renderActivityList() {
  const recent = DataProcessor.recentActivity(currentRecords, 8);
  const el     = document.getElementById('activityList');
  if (!el) return;

  const dotColors = ['green', 'blue', 'purple', 'green', 'blue', 'purple', 'green', 'blue'];

  el.innerHTML = recent.map((r, i) => `
    <div class="activity-item">
      <div class="activity-dot ${dotColors[i % 3]}"></div>
      <div class="activity-text">
        <p>${escHtml(r.product)}</p>
        <span>${DataProcessor.formatDateShort(r.date)} · ${escHtml(r.category)}</span>
      </div>
      <div class="activity-value">Rp ${DataProcessor.formatNumber(r.revenue)}</div>
    </div>`).join('');
}

// ──────────────────────────────────────────────────────────────
// CSV UPLOAD
// ──────────────────────────────────────────────────────────────
function setupUpload() {
  const fileInput  = document.getElementById('csvFileInput');
  const dropZone   = document.getElementById('dropZone');
  const browseBtn  = document.getElementById('browseBtn');
  const sampleBtn  = document.getElementById('loadSampleBtn');
  const clearBtn   = document.getElementById('clearDataBtn');
  const applyBtn   = document.getElementById('applyUploadBtn');

  browseBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) handleFileSelect(file);
    fileInput.value = '';
  });

  // Drag & drop
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  });

  sampleBtn.addEventListener('click', async () => {
    clearUploadState();
    await loadSampleData();
    showToast('Data contoh berhasil dimuat.', 'success');
    navigateTo('dashboard');
  });

  clearBtn.addEventListener('click', () => {
    if (!confirm('Hapus semua data? Dashboard akan kosong.')) return;
    currentRecords = [];
    lastAIInsights = null;
    localStorage.removeItem(LS_KEY);
    clearUploadState();
    renderEmptyDashboard();
    showToast('Data berhasil dihapus.', 'info');
  });

  if (applyBtn) {
    applyBtn.addEventListener('click', applyPendingUpload);
  }
}

let pendingRecords = null;

function handleFileSelect(file) {
  clearUploadState();

  // Validate file type
  if (!file.name.endsWith('.csv') && file.type !== 'text/csv' && file.type !== 'text/plain') {
    showValidationMessage('upload-validation', ['File harus berformat .csv'], 'error');
    return;
  }

  // Validate file size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    showValidationMessage('upload-validation', ['Ukuran file maksimal 5MB.'], 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = e => processUploadedCSV(e.target.result, file.name);
  reader.onerror = () => showValidationMessage('upload-validation', ['Gagal membaca file.'], 'error');
  reader.readAsText(file, 'UTF-8');
}

function processUploadedCSV(text, fileName) {
  const result = DataProcessor.parseCSV(text);

  if (!result.ok) {
    showValidationMessage('upload-validation', result.errors, 'error');
    pendingRecords = null;
    hideEl('applyUploadBtn');
    return;
  }

  pendingRecords = result.records;

  const msgs = [`File "${escHtml(fileName)}" berhasil divalidasi.`, `${result.records.length} baris data siap digunakan.`];
  if (result.warnings && result.warnings.length > 0) {
    msgs.push('', `Peringatan (${result.warnings.length} baris dilewati):`, ...result.warnings.slice(0, 5));
    if (result.warnings.length > 5) msgs.push(`... dan ${result.warnings.length - 5} peringatan lainnya.`);
  }
  showValidationMessage('upload-validation', msgs, result.warnings ? 'warning' : 'success');

  // Show preview (first 5 rows)
  renderPreviewTable(result.records.slice(0, 5));

  // Show apply button
  showEl('applyUploadBtn');
}

function applyPendingUpload() {
  if (!pendingRecords || pendingRecords.length === 0) return;
  currentRecords = pendingRecords;
  pendingRecords = null;
  lastAIInsights = null;
  saveToStorage();
  renderAll();
  hideEl('applyUploadBtn');
  showToast(`${currentRecords.length} data berhasil diterapkan ke dashboard.`, 'success');
  navigateTo('dashboard');
}

function renderPreviewTable(rows) {
  const wrap = document.getElementById('previewTableWrap');
  if (!wrap) return;
  showEl('previewTableWrap');

  wrap.innerHTML = `
    <div class="preview-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Tanggal</th><th>Produk</th><th>Kategori</th><th>Qty</th><th>Harga</th><th>Revenue</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td>${escHtml(r.date)}</td>
              <td>${escHtml(r.product)}</td>
              <td>${escHtml(r.category)}</td>
              <td>${r.quantity}</td>
              <td>Rp ${DataProcessor.formatNumber(r.price)}</td>
              <td class="text-emerald" style="font-weight:600">Rp ${DataProcessor.formatNumber(r.revenue)}</td>
            </tr>`).join('')}
        </tbody>
      </table>
      <p class="text-muted" style="padding:8px 14px">Menampilkan ${rows.length} baris pertama sebagai pratinjau.</p>
    </div>`;
}

function clearUploadState() {
  pendingRecords = null;
  const el = document.getElementById('upload-validation');
  if (el) el.innerHTML = '';
  const pw = document.getElementById('previewTableWrap');
  if (pw) { pw.innerHTML = ''; hideEl('previewTableWrap'); }
  hideEl('applyUploadBtn');
}

function renderEmptyDashboard() {
  setText('kpiRevenue', 'Rp 0');
  setText('kpiTransactions', '0');
  setText('kpiProducts', '0');
  setText('kpiAvgTransaction', 'Rp 0');
  const lists = ['topProductsList', 'activityList'];
  lists.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '<p class="text-muted" style="padding:12px 0">Tidak ada data.</p>';
  });
}

function showValidationMessage(containerId, messages, type) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const cssClass = type === 'error' ? 'validation-error' : 'validation-success';
  el.innerHTML = `
    <div class="validation-box ${cssClass}">
      <ul>${messages.map(m => `<li>${escHtml(m)}</li>`).join('')}</ul>
    </div>`;
}

// ──────────────────────────────────────────────────────────────
// AI INSIGHTS
// ──────────────────────────────────────────────────────────────
function checkLangflowStatus() {
  const statusEl = document.getElementById('langflowStatus');
  if (!statusEl) return;
  if (LangflowClient.isConfigured()) {
    statusEl.className = 'ai-status-badge ready';
    statusEl.innerHTML = `<svg width="7" height="7" viewBox="0 0 7 7"><circle cx="3.5" cy="3.5" r="3.5" fill="#10b981"/></svg> Langflow Terhubung`;
  } else {
    statusEl.className = 'ai-status-badge unconfigured';
    statusEl.innerHTML = `<svg width="7" height="7" viewBox="0 0 7 7"><circle cx="3.5" cy="3.5" r="3.5" fill="#d97706"/></svg> Belum Dikonfigurasi`;
  }
}

function renderInsightsSection() {
  checkLangflowStatus();
  if (!LangflowClient.isConfigured()) {
    showEl('configBanner');
  } else {
    hideEl('configBanner');
  }

  // If we already have insights, show them
  if (lastAIInsights) {
    displayInsights(lastAIInsights);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('generateInsightsBtn');
  if (btn) btn.addEventListener('click', handleGenerateInsights);

  const retryBtn = document.getElementById('retryInsightsBtn');
  if (retryBtn) retryBtn.addEventListener('click', handleGenerateInsights);
});

async function handleGenerateInsights() {
  if (currentRecords.length === 0) {
    showToast('Tidak ada data untuk dianalisis. Upload CSV terlebih dahulu.', 'error');
    return;
  }

  if (!LangflowClient.isConfigured()) {
    showToast('Langflow belum dikonfigurasi. Lihat panduan di bawah.', 'error');
    return;
  }

  // Show loading
  const btn = document.getElementById('generateInsightsBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Menganalisis...'; }
  showEl('insightsLoading');
  hideEl('insightsContent');
  hideEl('insightsError');
  hideEl('insightsPlaceholder');

  try {
    const { summary } = DataProcessor.buildAISummary(currentRecords);
    const result = await LangflowClient.generateInsights(summary);

    if (result.ok) {
      lastAIInsights = result.text;
      saveInsightsToStorage(result.text);
      displayInsights(result.text);
      showToast('AI Insights berhasil dibuat!', 'success');
    } else {
      showInsightsError(result.message);
    }
  } catch (err) {
    showInsightsError('Terjadi kesalahan tak terduga: ' + err.message);
  } finally {
    hideEl('insightsLoading');
    if (btn) { btn.disabled = false; btn.textContent = 'Generate AI Insights'; }
  }
}

function displayInsights(text) {
  const parsed = LangflowClient.parseInsightsText(text);
  const el = document.getElementById('insightsContent');
  if (!el) return;

  el.innerHTML = `
    ${buildAICard('green', iconChart(), 'Ringkasan Performa Bisnis',
      `<p>${escHtml(parsed.summary)}</p>`)}
    ${buildAICard('blue', iconBulb(), 'Temuan Utama',
      parsed.findings.length > 0
        ? `<ul>${parsed.findings.map(f => `<li>${escHtml(f)}</li>`).join('')}</ul>`
        : '<p class="text-muted">Tidak ada temuan yang teridentifikasi.</p>')}
    ${buildAICard('red', iconWarning(), 'Potensi Masalah Bisnis',
      parsed.issues.length > 0
        ? `<ul>${parsed.issues.map(f => `<li>${escHtml(f)}</li>`).join('')}</ul>`
        : '<p class="text-muted">Tidak ada masalah yang teridentifikasi.</p>')}
    ${buildAICard('purple', iconStar(), 'Tiga Rekomendasi Bisnis',
      parsed.recommendations.length > 0
        ? `<ol style="padding-left:18px">${parsed.recommendations.map(r => `<li style="margin-bottom:8px">${escHtml(r)}</li>`).join('')}</ol>`
        : '<p class="text-muted">Tidak ada rekomendasi yang tersedia.</p>')}
  `;

  showEl('insightsContent');
  hideEl('insightsPlaceholder');
  hideEl('insightsError');
}

function buildAICard(iconColor, iconSvg, title, bodyHtml) {
  return `
    <div class="ai-card">
      <div class="ai-card-header">
        <div class="ai-card-icon ${iconColor}">${iconSvg}</div>
        <span class="ai-card-title">${escHtml(title)}</span>
      </div>
      <div class="ai-card-body">${bodyHtml}</div>
    </div>`;
}

function showInsightsError(message) {
  const el = document.getElementById('insightsError');
  if (!el) return;
  el.innerHTML = `
    <div class="validation-box validation-error">
      <p style="font-weight:600;margin-bottom:4px">Gagal menghubungi Langflow</p>
      <p>${escHtml(message)}</p>
    </div>`;
  showEl('insightsError');
  hideEl('insightsContent');
}

function saveInsightsToStorage(text) {
  localStorage.setItem('smartbiz_last_insights', text);
}

// ──────────────────────────────────────────────────────────────
// EXPORT
// ──────────────────────────────────────────────────────────────
function renderExportSection() {
  // Auto-populate last AI insights from storage if not in memory
  if (!lastAIInsights) {
    const stored = localStorage.getItem('smartbiz_last_insights');
    if (stored) lastAIInsights = stored;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('exportCSVBtn')?.addEventListener('click', exportCSV);
  document.getElementById('exportTXTBtn')?.addEventListener('click', exportTXT);
});

function exportCSV() {
  if (currentRecords.length === 0) { showToast('Tidak ada data untuk diekspor.', 'error'); return; }
  const kpi     = DataProcessor.calculateKPIs(currentRecords);
  const byCat   = DataProcessor.revenueByCategory(currentRecords);
  const topProds = DataProcessor.topProducts(currentRecords, 10);

  const rows = [
    ['=== LAPORAN SMARTBIZ INSIGHT ==='],
    ['Diekspor pada', new Date().toLocaleString('id-ID')],
    [],
    ['=== KPI UTAMA ==='],
    ['Metrik', 'Nilai'],
    ['Total Revenue', 'Rp ' + DataProcessor.formatNumber(kpi.totalRevenue)],
    ['Total Transaksi', kpi.totalTransactions],
    ['Total Produk Unik', kpi.uniqueProducts],
    ['Rata-rata per Transaksi', 'Rp ' + DataProcessor.formatNumber(Math.round(kpi.avgTransaction))],
    [],
    ['=== REVENUE PER KATEGORI ==='],
    ['Kategori', 'Revenue'],
    ...byCat.labels.map((c, i) => [c, 'Rp ' + DataProcessor.formatNumber(byCat.values[i])]),
    [],
    ['=== TOP 10 PRODUK ==='],
    ['Rank', 'Produk', 'Kategori', 'Revenue', 'Qty', 'Transaksi'],
    ...topProds.map((p, i) => [i + 1, p.product, p.category, 'Rp ' + DataProcessor.formatNumber(p.revenue), p.quantity, p.transactions]),
    [],
    ['=== DATA TRANSAKSI ==='],
    ['Tanggal', 'Produk', 'Kategori', 'Qty', 'Harga', 'Revenue'],
    ...currentRecords.map(r => [r.date, r.product, r.category, r.quantity, r.price, r.revenue]),
  ];

  const csvContent = rows.map(row =>
    Array.isArray(row) ? row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',') : String(row)
  ).join('\n');

  downloadFile('smartbiz-report.csv', csvContent, 'text/csv;charset=utf-8;');
  showToast('Laporan CSV berhasil diunduh.', 'success');
}

function exportTXT() {
  if (currentRecords.length === 0) { showToast('Tidak ada data untuk diekspor.', 'error'); return; }
  const kpi     = DataProcessor.calculateKPIs(currentRecords);
  const byCat   = DataProcessor.revenueByCategory(currentRecords);
  const topProds = DataProcessor.topProducts(currentRecords, 10);

  const lines = [
    '============================================================',
    '  LAPORAN ANALISIS BISNIS — SMARTBIZ INSIGHT',
    '============================================================',
    `Diekspor: ${new Date().toLocaleString('id-ID')}`,
    '',
    '[ KPI UTAMA ]',
    `Total Revenue       : Rp ${DataProcessor.formatNumber(kpi.totalRevenue)}`,
    `Total Transaksi     : ${kpi.totalTransactions}`,
    `Total Produk Unik   : ${kpi.uniqueProducts}`,
    `Rata-rata Transaksi : Rp ${DataProcessor.formatNumber(Math.round(kpi.avgTransaction))}`,
    '',
    '[ REVENUE PER KATEGORI ]',
    ...byCat.labels.map((c, i) => `  ${c.padEnd(25)} : Rp ${DataProcessor.formatNumber(byCat.values[i])}`),
    '',
    '[ TOP 10 PRODUK TERLARIS ]',
    ...topProds.map((p, i) =>
      `  ${String(i + 1).padStart(2)}. ${p.product.padEnd(30)} Rp ${DataProcessor.formatNumber(p.revenue)} (${p.quantity} unit)`
    ),
    '',
  ];

  if (lastAIInsights) {
    lines.push('[ AI BUSINESS INSIGHTS ]', '', lastAIInsights, '');
  }

  lines.push('============================================================');

  downloadFile('smartbiz-report.txt', lines.join('\n'), 'text/plain;charset=utf-8;');
  showToast('Laporan TXT berhasil diunduh.', 'success');
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ──────────────────────────────────────────────────────────────
// TOAST
// ──────────────────────────────────────────────────────────────
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const icons = {
    success: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>`,
    error:   `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>`,
    info:    `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `${icons[type] || icons.info}<span>${escHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    toast.style.transition = 'opacity 0.3s, transform 0.3s';
    setTimeout(() => toast.remove(), 320);
  }, 3500);
}

// ──────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function showEl(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}

function hideEl(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}

function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── SVG Icon Helpers ─────────────────────────────────────────
function iconChart() {
  return `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>`;
}
function iconBulb() {
  return `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>`;
}
function iconWarning() {
  return `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`;
}
function iconStar() {
  return `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>`;
}
