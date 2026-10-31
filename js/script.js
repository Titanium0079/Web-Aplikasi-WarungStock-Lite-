/* =============================================================
   WarungStock Lite — script.js
   Vanilla JavaScript | LocalStorage | Chart.js
   ============================================================= */

'use strict';

// ──────────────────────────────────────────────────────────────
// CONSTANTS & STATE
// ──────────────────────────────────────────────────────────────
const LS_PRODUCTS     = 'warungstock_products';
const LS_TRANSACTIONS = 'warungstock_transactions';
const JSON_PATH       = 'data/products.json';

let products     = [];
let transactions = [];
let currentPage  = 'dashboard';
let deleteTargetId = null;

// Chart instances (kept to allow destroy/re-create)
let chartStockMovement = null;
let chartCategory      = null;
let chartTop5          = null;

// ──────────────────────────────────────────────────────────────
// INITIALISATION
// ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  setHeaderDate();
  navigateTo('dashboard');
  populateProductSelects();
  populateCategoryFilter();
  setDefaultDates();
});

async function loadData() {
  const storedProducts     = localStorage.getItem(LS_PRODUCTS);
  const storedTransactions = localStorage.getItem(LS_TRANSACTIONS);

  if (storedProducts && storedTransactions) {
    products     = JSON.parse(storedProducts);
    transactions = JSON.parse(storedTransactions);
  } else {
    // First load: fetch from JSON file
    try {
      const resp = await fetch(JSON_PATH);
      const data = await resp.json();
      products     = data.products || [];
      transactions = data.transactions || [];
      saveToStorage();
    } catch (e) {
      products     = [];
      transactions = [];
    }
  }
}

function saveToStorage() {
  localStorage.setItem(LS_PRODUCTS,     JSON.stringify(products));
  localStorage.setItem(LS_TRANSACTIONS, JSON.stringify(transactions));
}

async function resetToDefaultData() {
  if (!confirm('Reset semua data ke kondisi awal? Semua perubahan akan hilang.')) return;
  localStorage.removeItem(LS_PRODUCTS);
  localStorage.removeItem(LS_TRANSACTIONS);
  await loadData();
  populateProductSelects();
  populateCategoryFilter();
  refreshCurrentPage();
  showToast('Data berhasil direset ke kondisi awal.', 'info');
}

// ──────────────────────────────────────────────────────────────
// NAVIGATION
// ──────────────────────────────────────────────────────────────
const PAGE_TITLES = {
  dashboard : ['Dashboard',          'Ringkasan inventaris terkini'],
  products  : ['Manajemen Produk',   'Kelola daftar produk'],
  stockin   : ['Barang Masuk',       'Catat penerimaan stok'],
  stockout  : ['Barang Keluar',      'Catat pengeluaran stok'],
  lowstock  : ['Stok Menipis',       'Produk yang perlu restock'],
  history   : ['Riwayat Transaksi',  'Semua catatan transaksi'],
};

function navigateTo(page) {
  currentPage = page;

  // Hide all pages
  document.querySelectorAll('.page-content').forEach(el => el.classList.add('hidden'));

  // Show target page
  const target = document.getElementById('page-' + page);
  if (target) target.classList.remove('hidden');

  // Update nav active state
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === page);
  });

  // Update header title
  const [title, subtitle] = PAGE_TITLES[page] || ['', ''];
  document.getElementById('pageTitle').textContent   = title;
  document.getElementById('pageSubtitle').textContent = subtitle;

  // Close mobile sidebar
  closeSidebar();

  // Render page content
  refreshCurrentPage();
}

function refreshCurrentPage() {
  switch (currentPage) {
    case 'dashboard': renderDashboard(); break;
    case 'products':  renderProductTable(); break;
    case 'stockin':   renderStockInTable(); break;
    case 'stockout':  renderStockOutTable(); break;
    case 'lowstock':  renderLowStockPage(); break;
    case 'history':   renderHistoryTable(); break;
  }
  updateLowStockBadge();
}

// ──────────────────────────────────────────────────────────────
// SIDEBAR (MOBILE)
// ──────────────────────────────────────────────────────────────
function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebarOverlay').classList.remove('hidden');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.add('hidden');
}

// ──────────────────────────────────────────────────────────────
// UTILITIES
// ──────────────────────────────────────────────────────────────
function formatRupiah(amount) {
  return 'Rp ' + Math.round(amount).toLocaleString('id-ID');
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const [y, m, d] = dateStr.split('-');
  const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y}`;
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function setHeaderDate() {
  const now = new Date();
  const opts = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  document.getElementById('headerDate').textContent = now.toLocaleDateString('id-ID', opts);
}

function setDefaultDates() {
  const today = todayString();
  const els = ['siDate', 'soDate'];
  els.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = today;
  });
}

function generateTrxId() {
  const existing = transactions.map(t => parseInt(t.id.replace('TRX-', '') || '0'));
  const max = existing.length ? Math.max(...existing) : 0;
  return 'TRX-' + String(max + 1).padStart(3, '0');
}

function generateProductId() {
  const existing = products.map(p => parseInt(p.id.replace('P', '') || '0'));
  const max = existing.length ? Math.max(...existing) : 0;
  return 'P' + String(max + 1).padStart(3, '0');
}

function getStockStatus(product) {
  if (product.stock === 0) return 'danger';
  if (product.stock <= product.minStock) return 'danger';
  if (product.stock <= product.minStock * 1.5) return 'warning';
  return 'safe';
}

function getStatusBadge(product) {
  const status = getStockStatus(product);
  const labels = { safe: 'Aman', warning: 'Menipis', danger: 'Kritis' };
  return `<span class="badge badge-${status}">${labels[status]}</span>`;
}

function updateLowStockBadge() {
  const count = products.filter(p => getStockStatus(p) !== 'safe').length;
  const badge = document.getElementById('lowStockBadge');
  if (count > 0) {
    badge.textContent = count;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

// ──────────────────────────────────────────────────────────────
// DASHBOARD
// ──────────────────────────────────────────────────────────────
function renderDashboard() {
  renderKPIs();
  renderCharts();
  renderRecentTransactions();
}

function renderKPIs() {
  const totalProducts = products.length;
  const totalStock    = products.reduce((s, p) => s + p.stock, 0);
  const lowStockCount = products.filter(p => getStockStatus(p) !== 'safe').length;
  const inventoryVal  = products.reduce((s, p) => s + p.purchasePrice * p.stock, 0);

  document.getElementById('kpiTotalProducts').textContent  = totalProducts;
  document.getElementById('kpiTotalStock').textContent     = totalStock.toLocaleString('id-ID');
  document.getElementById('kpiLowStock').textContent       = lowStockCount;
  document.getElementById('kpiInventoryValue').textContent = formatRupiah(inventoryVal);
}

function renderCharts() {
  renderStockMovementChart();
  renderCategoryChart();
  renderTop5Chart();
}

function renderStockMovementChart() {
  const ctx = document.getElementById('chartStockMovement');
  if (!ctx) return;

  // Build daily in/out for last 30 days
  const today = new Date();
  const labels = [];
  const dataIn  = [];
  const dataOut = [];

  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const label   = `${d.getDate()}/${d.getMonth() + 1}`;
    labels.push(label);

    const inQty  = transactions.filter(t => t.type === 'in'  && t.date === dateStr).reduce((s, t) => s + t.quantity, 0);
    const outQty = transactions.filter(t => t.type === 'out' && t.date === dateStr).reduce((s, t) => s + t.quantity, 0);
    dataIn.push(inQty);
    dataOut.push(outQty);
  }

  if (chartStockMovement) chartStockMovement.destroy();
  chartStockMovement = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Masuk',
          data: dataIn,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16,185,129,0.08)',
          tension: 0.4,
          fill: true,
          pointRadius: 2,
          pointHoverRadius: 5,
        },
        {
          label: 'Keluar',
          data: dataOut,
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239,68,68,0.06)',
          tension: 0.4,
          fill: true,
          pointRadius: 2,
          pointHoverRadius: 5,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top', labels: { font: { size: 11 }, boxWidth: 12 } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y} unit` } },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 10 }, maxTicksLimit: 10 },
        },
        y: {
          beginAtZero: true,
          grid: { color: '#f3f4f6' },
          ticks: { font: { size: 10 }, precision: 0 },
        },
      },
    },
  });
}

function renderCategoryChart() {
  const ctx = document.getElementById('chartCategory');
  if (!ctx) return;

  const catMap = {};
  products.forEach(p => {
    catMap[p.category] = (catMap[p.category] || 0) + p.stock;
  });

  const labels = Object.keys(catMap);
  const data   = Object.values(catMap);
  const COLORS  = ['#10b981','#3b82f6','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#ec4899','#84cc16'];

  if (chartCategory) chartCategory.destroy();
  chartCategory = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: COLORS.slice(0, labels.length),
        borderWidth: 2,
        borderColor: '#ffffff',
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font: { size: 11 }, boxWidth: 12, padding: 8 },
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${ctx.parsed} unit`,
          },
        },
      },
    },
  });
}

function renderTop5Chart() {
  const ctx = document.getElementById('chartTop5');
  if (!ctx) return;

  const sorted = [...products].sort((a, b) => b.stock - a.stock).slice(0, 5);
  const labels = sorted.map(p => p.name.length > 18 ? p.name.slice(0, 18) + '…' : p.name);
  const data   = sorted.map(p => p.stock);

  if (chartTop5) chartTop5.destroy();
  chartTop5 = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Stok',
        data,
        backgroundColor: 'rgba(16,185,129,0.75)',
        borderColor: '#059669',
        borderWidth: 1,
        borderRadius: 5,
        borderSkipped: false,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` Stok: ${ctx.parsed.x} unit` } },
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: '#f3f4f6' },
          ticks: { font: { size: 10 }, precision: 0 },
        },
        y: {
          grid: { display: false },
          ticks: { font: { size: 10 } },
        },
      },
    },
  });
}

function renderRecentTransactions() {
  const el = document.getElementById('recentTransactions');
  if (!el) return;

  const recent = [...transactions]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 8);

  if (recent.length === 0) {
    el.innerHTML = '<p class="text-xs text-gray-400 text-center py-4">Belum ada transaksi</p>';
    return;
  }

  el.innerHTML = recent.map(t => {
    const isIn     = t.type === 'in';
    const label    = isIn ? 'Masuk' : 'Keluar';
    const dotClass = isIn ? 'trx-dot-in' : 'trx-dot-out';
    const qtyColor = isIn ? 'text-emerald-600' : 'text-red-500';

    return `
      <div class="trx-item">
        <span class="trx-dot ${dotClass}"></span>
        <div class="flex-1 min-w-0">
          <p class="text-xs font-medium text-gray-800 truncate">${escHtml(t.productName)}</p>
          <p class="text-xs text-gray-400">${formatDate(t.date)} · ${label}</p>
        </div>
        <span class="text-xs font-bold ${qtyColor} flex-shrink-0">${isIn ? '+' : '-'}${t.quantity}</span>
      </div>`;
  }).join('');
}

// ──────────────────────────────────────────────────────────────
// PRODUCT MANAGEMENT
// ──────────────────────────────────────────────────────────────
function renderProductTable() {
  const search   = (document.getElementById('productSearch')?.value || '').toLowerCase();
  const category = document.getElementById('categoryFilter')?.value || '';
  const sort     = document.getElementById('sortFilter')?.value || 'name-asc';

  let filtered = products.filter(p => {
    const matchSearch   = p.name.toLowerCase().includes(search) || p.sku.toLowerCase().includes(search);
    const matchCategory = !category || p.category === category;
    return matchSearch && matchCategory;
  });

  filtered.sort((a, b) => {
    switch (sort) {
      case 'name-asc':   return a.name.localeCompare(b.name);
      case 'name-desc':  return b.name.localeCompare(a.name);
      case 'stock-asc':  return a.stock - b.stock;
      case 'stock-desc': return b.stock - a.stock;
      case 'price-asc':  return a.sellingPrice - b.sellingPrice;
      case 'price-desc': return b.sellingPrice - a.sellingPrice;
      default:           return 0;
    }
  });

  const tbody = document.getElementById('productTableBody');
  const empty = document.getElementById('productEmpty');

  if (filtered.length === 0) {
    tbody.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  tbody.innerHTML = filtered.map(p => `
    <tr>
      <td class="px-4 py-3 text-xs text-gray-500 font-mono">${escHtml(p.sku)}</td>
      <td class="px-4 py-3">
        <p class="font-medium text-gray-900 leading-tight">${escHtml(p.name)}</p>
        <p class="text-xs text-gray-400 mt-0.5 truncate max-w-xs">${escHtml(p.description || '')}</p>
      </td>
      <td class="px-4 py-3 hidden md:table-cell">
        <span class="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-md">${escHtml(p.category)}</span>
      </td>
      <td class="px-4 py-3 text-right text-sm text-gray-600 hidden lg:table-cell">${formatRupiah(p.purchasePrice)}</td>
      <td class="px-4 py-3 text-right text-sm font-medium text-gray-900">${formatRupiah(p.sellingPrice)}</td>
      <td class="px-4 py-3 text-center">
        <span class="text-sm font-semibold ${p.stock <= p.minStock ? 'text-red-600' : 'text-gray-800'}">${p.stock}</span>
        <span class="text-xs text-gray-400"> / min ${p.minStock}</span>
      </td>
      <td class="px-4 py-3 text-center">${getStatusBadge(p)}</td>
      <td class="px-4 py-3 text-center">
        <div class="flex items-center justify-center gap-1">
          <button onclick="openProductModal('${p.id}')" class="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 transition-colors" title="Edit">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
          </button>
          <button onclick="openDeleteModal('${p.id}')" class="p-1.5 rounded-lg text-red-400 hover:bg-red-50 transition-colors" title="Hapus">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>
        </div>
      </td>
    </tr>`).join('');
}

function populateCategoryFilter() {
  const categories = [...new Set(products.map(p => p.category))].sort();

  const filterEl = document.getElementById('categoryFilter');
  if (filterEl) {
    const current = filterEl.value;
    filterEl.innerHTML = '<option value="">Semua Kategori</option>' +
      categories.map(c => `<option value="${escHtml(c)}" ${c === current ? 'selected' : ''}>${escHtml(c)}</option>`).join('');
  }

  const datalist = document.getElementById('categoryList');
  if (datalist) {
    datalist.innerHTML = categories.map(c => `<option value="${escHtml(c)}"></option>`).join('');
  }
}

// ── Product Modal ─────────────────────────────────────────────
function openProductModal(id) {
  const modal = document.getElementById('productModal');
  const form  = document.getElementById('productForm');
  form.reset();
  document.getElementById('productId').value = '';

  if (id) {
    const p = products.find(x => x.id === id);
    if (!p) return;
    document.getElementById('modalTitle').textContent          = 'Edit Produk';
    document.getElementById('productId').value                 = p.id;
    document.getElementById('productName').value               = p.name;
    document.getElementById('productSku').value                = p.sku;
    document.getElementById('productCategory').value           = p.category;
    document.getElementById('productPurchasePrice').value      = p.purchasePrice;
    document.getElementById('productSellingPrice').value       = p.sellingPrice;
    document.getElementById('productStock').value              = p.stock;
    document.getElementById('productMinStock').value           = p.minStock;
    document.getElementById('productDescription').value        = p.description || '';
  } else {
    document.getElementById('modalTitle').textContent = 'Tambah Produk';
  }

  populateCategoryFilter();
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeProductModal() {
  document.getElementById('productModal').classList.add('hidden');
  document.body.style.overflow = '';
}

function saveProduct(e) {
  e.preventDefault();

  const id       = document.getElementById('productId').value;
  const name     = document.getElementById('productName').value.trim();
  const sku      = document.getElementById('productSku').value.trim().toUpperCase();
  const category = document.getElementById('productCategory').value.trim();
  const purchase = parseFloat(document.getElementById('productPurchasePrice').value);
  const selling  = parseFloat(document.getElementById('productSellingPrice').value);
  const stock    = parseInt(document.getElementById('productStock').value);
  const minStock = parseInt(document.getElementById('productMinStock').value);
  const desc     = document.getElementById('productDescription').value.trim();

  // Validation
  if (!name || !sku || !category) {
    showToast('Nama, SKU, dan Kategori wajib diisi.', 'error');
    return;
  }
  if (isNaN(purchase) || purchase < 0) {
    showToast('Harga beli tidak valid.', 'error');
    return;
  }
  if (isNaN(selling) || selling < 0) {
    showToast('Harga jual tidak valid.', 'error');
    return;
  }
  if (selling < purchase) {
    showToast('Harga jual tidak boleh lebih rendah dari harga beli.', 'error');
    return;
  }

  // Check duplicate SKU
  const skuDuplicate = products.find(p => p.sku === sku && p.id !== id);
  if (skuDuplicate) {
    showToast(`SKU "${sku}" sudah digunakan oleh produk lain.`, 'error');
    return;
  }

  if (id) {
    // Edit
    const idx = products.findIndex(p => p.id === id);
    if (idx !== -1) {
      products[idx] = { ...products[idx], name, sku, category, purchasePrice: purchase, sellingPrice: selling, stock, minStock, description: desc };
    }
    showToast(`Produk "${name}" berhasil diperbarui.`, 'success');
  } else {
    // Add
    products.push({
      id: generateProductId(),
      sku, name, category,
      purchasePrice: purchase,
      sellingPrice: selling,
      stock, minStock,
      description: desc,
    });
    showToast(`Produk "${name}" berhasil ditambahkan.`, 'success');
  }

  saveToStorage();
  closeProductModal();
  populateCategoryFilter();
  populateProductSelects();
  renderProductTable();
  updateLowStockBadge();
}

// ── Delete Modal ──────────────────────────────────────────────
function openDeleteModal(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  deleteTargetId = id;
  document.getElementById('deleteProductName').textContent = p.name;
  document.getElementById('deleteModal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeDeleteModal() {
  deleteTargetId = null;
  document.getElementById('deleteModal').classList.add('hidden');
  document.body.style.overflow = '';
}

function confirmDelete() {
  if (!deleteTargetId) return;
  const p = products.find(x => x.id === deleteTargetId);
  products     = products.filter(x => x.id !== deleteTargetId);
  transactions = transactions.filter(t => t.productId !== deleteTargetId);

  saveToStorage();
  closeDeleteModal();
  populateCategoryFilter();
  populateProductSelects();
  renderProductTable();
  updateLowStockBadge();
  if (p) showToast(`Produk "${p.name}" berhasil dihapus.`, 'info');
}

// ──────────────────────────────────────────────────────────────
// STOCK IN
// ──────────────────────────────────────────────────────────────
function submitStockIn(e) {
  e.preventDefault();

  const productId = document.getElementById('siProduct').value;
  const qty       = parseInt(document.getElementById('siQty').value);
  const date      = document.getElementById('siDate').value;
  const supplier  = document.getElementById('siSupplier').value.trim();
  const notes     = document.getElementById('siNotes').value.trim();

  if (!productId) { showToast('Pilih produk terlebih dahulu.', 'error'); return; }
  if (isNaN(qty) || qty <= 0) { showToast('Jumlah harus lebih dari 0.', 'error'); return; }
  if (!date) { showToast('Tanggal wajib diisi.', 'error'); return; }

  const product = products.find(p => p.id === productId);
  if (!product) { showToast('Produk tidak ditemukan.', 'error'); return; }

  // Update stock
  product.stock += qty;

  // Record transaction
  transactions.push({
    id: generateTrxId(),
    type: 'in',
    productId,
    productName: product.name,
    quantity: qty,
    date,
    supplier: supplier || '-',
    notes: notes || '-',
  });

  saveToStorage();
  document.getElementById('stockInForm').reset();
  document.getElementById('siDate').value = todayString();
  renderStockInTable();
  updateLowStockBadge();
  showToast(`+${qty} unit "${product.name}" berhasil dicatat sebagai barang masuk.`, 'success');
}

function renderStockInTable() {
  const inTrx  = transactions.filter(t => t.type === 'in')
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  const tbody  = document.getElementById('stockInTableBody');
  const empty  = document.getElementById('stockInEmpty');

  if (inTrx.length === 0) {
    tbody.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  tbody.innerHTML = inTrx.map(t => `
    <tr>
      <td class="px-4 py-3 text-xs font-mono text-gray-500">${escHtml(t.id)}</td>
      <td class="px-4 py-3">
        <p class="font-medium text-gray-900 text-sm">${escHtml(t.productName)}</p>
      </td>
      <td class="px-4 py-3 text-center">
        <span class="text-sm font-bold text-emerald-600">+${t.quantity}</span>
      </td>
      <td class="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">${formatDate(t.date)}</td>
      <td class="px-4 py-3 text-sm text-gray-500 hidden md:table-cell">${escHtml(t.supplier || '-')}</td>
    </tr>`).join('');
}

// ──────────────────────────────────────────────────────────────
// STOCK OUT
// ──────────────────────────────────────────────────────────────
function populateProductSelects() {
  const options = products.map(p =>
    `<option value="${p.id}">${escHtml(p.name)} (Stok: ${p.stock})</option>`
  ).join('');

  ['siProduct', 'soProduct'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = `<option value="">-- Pilih Produk --</option>` + options;
  });
}

function updateStockOutInfo() {
  const productId = document.getElementById('soProduct').value;
  const info = document.getElementById('soCurrentStock');
  if (!productId) { info.textContent = ''; return; }
  const p = products.find(x => x.id === productId);
  if (p) {
    const status = getStockStatus(p);
    const color = status === 'danger' ? 'text-red-500' : status === 'warning' ? 'text-amber-500' : 'text-emerald-600';
    info.innerHTML = `Stok tersedia: <span class="font-semibold ${color}">${p.stock} unit</span>`;
  }
}

function submitStockOut(e) {
  e.preventDefault();

  const productId = document.getElementById('soProduct').value;
  const qty       = parseInt(document.getElementById('soQty').value);
  const date      = document.getElementById('soDate').value;
  const dest      = document.getElementById('soDestination').value.trim();
  const notes     = document.getElementById('soNotes').value.trim();

  if (!productId) { showToast('Pilih produk terlebih dahulu.', 'error'); return; }
  if (isNaN(qty) || qty <= 0) { showToast('Jumlah harus lebih dari 0.', 'error'); return; }
  if (!date) { showToast('Tanggal wajib diisi.', 'error'); return; }

  const product = products.find(p => p.id === productId);
  if (!product) { showToast('Produk tidak ditemukan.', 'error'); return; }

  if (qty > product.stock) {
    showToast(`Stok tidak mencukupi! Stok tersedia: ${product.stock} unit, diminta: ${qty} unit.`, 'error');
    return;
  }

  // Update stock
  product.stock -= qty;

  // Record transaction
  transactions.push({
    id: generateTrxId(),
    type: 'out',
    productId,
    productName: product.name,
    quantity: qty,
    date,
    destination: dest || '-',
    notes: notes || '-',
  });

  saveToStorage();
  document.getElementById('stockOutForm').reset();
  document.getElementById('soDate').value = todayString();
  document.getElementById('soCurrentStock').textContent = '';

  // Refresh product selects with updated stock
  populateProductSelects();

  renderStockOutTable();
  updateLowStockBadge();
  showToast(`-${qty} unit "${product.name}" berhasil dicatat sebagai barang keluar.`, 'success');

  // Warn if now low stock
  if (getStockStatus(product) !== 'safe') {
    setTimeout(() => showToast(`Perhatian: Stok "${product.name}" sekarang menipis (${product.stock} unit).`, 'info'), 600);
  }
}

function renderStockOutTable() {
  const outTrx = transactions.filter(t => t.type === 'out')
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  const tbody  = document.getElementById('stockOutTableBody');
  const empty  = document.getElementById('stockOutEmpty');

  if (outTrx.length === 0) {
    tbody.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  tbody.innerHTML = outTrx.map(t => `
    <tr>
      <td class="px-4 py-3 text-xs font-mono text-gray-500">${escHtml(t.id)}</td>
      <td class="px-4 py-3">
        <p class="font-medium text-gray-900 text-sm">${escHtml(t.productName)}</p>
      </td>
      <td class="px-4 py-3 text-center">
        <span class="text-sm font-bold text-red-500">-${t.quantity}</span>
      </td>
      <td class="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">${formatDate(t.date)}</td>
      <td class="px-4 py-3 text-sm text-gray-500 hidden md:table-cell">${escHtml(t.destination || '-')}</td>
    </tr>`).join('');
}

// ──────────────────────────────────────────────────────────────
// LOW STOCK
// ──────────────────────────────────────────────────────────────
function renderLowStockPage() {
  const lowItems = products
    .filter(p => getStockStatus(p) !== 'safe')
    .sort((a, b) => a.stock - b.stock);

  const grid  = document.getElementById('lowStockGrid');
  const empty = document.getElementById('lowStockEmpty');

  if (lowItems.length === 0) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  grid.innerHTML = lowItems.map(p => {
    const status  = getStockStatus(p);
    const pct     = p.minStock > 0 ? Math.min(100, Math.round((p.stock / (p.minStock * 2)) * 100)) : 50;
    const fillColor = status === 'danger' ? '#ef4444' : '#f59e0b';
    const borderColor = status === 'danger' ? 'border-red-200' : 'border-amber-200';
    const bgColor = status === 'danger' ? 'bg-red-50' : 'bg-amber-50';
    const label   = status === 'danger' ? 'Kritis' : 'Menipis';
    const labelClass = status === 'danger' ? 'badge-danger' : 'badge-warning';

    return `
      <div class="low-stock-card bg-white border ${borderColor} p-4 shadow-sm">
        <div class="flex items-start justify-between mb-3">
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-gray-900 truncate">${escHtml(p.name)}</p>
            <p class="text-xs text-gray-400 mt-0.5">${escHtml(p.sku)} · ${escHtml(p.category)}</p>
          </div>
          <span class="badge ${labelClass} ml-2 flex-shrink-0">${label}</span>
        </div>

        <div class="flex items-end justify-between mb-2">
          <div>
            <p class="text-xs text-gray-500">Stok Saat Ini</p>
            <p class="text-2xl font-bold ${status === 'danger' ? 'text-red-600' : 'text-amber-600'}">${p.stock}</p>
          </div>
          <div class="text-right">
            <p class="text-xs text-gray-500">Min. Stok</p>
            <p class="text-sm font-semibold text-gray-700">${p.minStock} unit</p>
          </div>
        </div>

        <div class="progress-bar mb-3">
          <div class="progress-fill" style="width:${pct}%; background-color:${fillColor}"></div>
        </div>

        <button onclick="navigateTo('stockin')" class="w-full text-xs font-medium py-2 ${bgColor} ${status === 'danger' ? 'text-red-700 border-red-200' : 'text-amber-700 border-amber-200'} border rounded-lg hover:opacity-80 transition-opacity">
          + Restock Sekarang
        </button>
      </div>`;
  }).join('');
}

// ──────────────────────────────────────────────────────────────
// HISTORY
// ──────────────────────────────────────────────────────────────
function renderHistoryTable() {
  const typeFilter = document.getElementById('historyTypeFilter')?.value || '';
  const dateFrom   = document.getElementById('historyDateFrom')?.value || '';
  const dateTo     = document.getElementById('historyDateTo')?.value || '';

  let filtered = [...transactions];

  if (typeFilter) filtered = filtered.filter(t => t.type === typeFilter);
  if (dateFrom)   filtered = filtered.filter(t => t.date >= dateFrom);
  if (dateTo)     filtered = filtered.filter(t => t.date <= dateTo);

  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

  const tbody = document.getElementById('historyTableBody');
  const empty = document.getElementById('historyEmpty');

  if (filtered.length === 0) {
    tbody.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  tbody.innerHTML = filtered.map(t => {
    const isIn     = t.type === 'in';
    const typeBadge = isIn
      ? '<span class="badge badge-safe">Masuk</span>'
      : '<span class="badge badge-danger">Keluar</span>';
    const qtyClass = isIn ? 'text-emerald-600 font-bold' : 'text-red-500 font-bold';
    const keterangan = isIn ? (t.supplier || '-') : (t.destination || '-');

    return `
      <tr>
        <td class="px-4 py-3 text-xs font-mono text-gray-500">${escHtml(t.id)}</td>
        <td class="px-4 py-3">
          <p class="font-medium text-gray-900 text-sm">${escHtml(t.productName)}</p>
          <p class="text-xs text-gray-400">${escHtml(t.notes && t.notes !== '-' ? t.notes : '')}</p>
        </td>
        <td class="px-4 py-3 text-center">${typeBadge}</td>
        <td class="px-4 py-3 text-center text-sm ${qtyClass}">${isIn ? '+' : '-'}${t.quantity}</td>
        <td class="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">${formatDate(t.date)}</td>
        <td class="px-4 py-3 text-sm text-gray-500 hidden md:table-cell">${escHtml(keterangan)}</td>
      </tr>`;
  }).join('');
}

function clearHistoryFilter() {
  document.getElementById('historyTypeFilter').value = '';
  document.getElementById('historyDateFrom').value   = '';
  document.getElementById('historyDateTo').value     = '';
  renderHistoryTable();
}

// ──────────────────────────────────────────────────────────────
// TOAST NOTIFICATIONS
// ──────────────────────────────────────────────────────────────
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const icons = {
    success: `<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>`,
    error:   `<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>`,
    info:    `<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
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
// SECURITY: HTML ESCAPE
// ──────────────────────────────────────────────────────────────
function escHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
