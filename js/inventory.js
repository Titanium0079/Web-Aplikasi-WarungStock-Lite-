/**
 * SmartBiz Insight — inventory.js
 * Modul manajemen inventaris: Produk CRUD, Barang Masuk/Keluar,
 * Stok Menipis, Riwayat Transaksi.
 * Semua data disimpan di LocalStorage, terpisah dari data sales CSV.
 */

'use strict';

const Inventory = (() => {

  // ── LocalStorage Keys ────────────────────────────────────────
  const LS_INV_PRODUCTS = 'smartbiz_inv_products';
  const LS_INV_TRX      = 'smartbiz_inv_transactions';

  // ── State ────────────────────────────────────────────────────
  let products     = [];
  let transactions = [];
  let deleteTarget = null;

  // ── Inisialisasi ─────────────────────────────────────────────
  async function init() {
    const storedP = localStorage.getItem(LS_INV_PRODUCTS);
    const storedT = localStorage.getItem(LS_INV_TRX);
    if (storedP && storedT) {
      products     = JSON.parse(storedP);
      transactions = JSON.parse(storedT);
    } else {
      await loadFromJSON();
    }
  }

  async function loadFromJSON() {
    try {
      const resp = await fetch('data/products.json');
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const data = await resp.json();
      products     = data.products     || [];
      transactions = data.transactions || [];
      save();
    } catch (_) {
      products     = [];
      transactions = [];
    }
  }

  function save() {
    localStorage.setItem(LS_INV_PRODUCTS, JSON.stringify(products));
    localStorage.setItem(LS_INV_TRX,      JSON.stringify(transactions));
  }

  // ── Helpers ──────────────────────────────────────────────────
  function fmtRp(n) {
    return 'Rp\u00a0' + Math.round(n).toLocaleString('id-ID');
  }

  function fmtDate(s) {
    if (!s) return '–';
    const [y, m, d] = s.split('-');
    const mn = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    return `${parseInt(d)} ${mn[parseInt(m) - 1]} ${y}`;
  }

  function today() { return new Date().toISOString().slice(0, 10); }

  function nextProductId() {
    const nums = products.map(p => parseInt(p.id.replace('P','')) || 0);
    return 'P' + String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, '0');
  }

  function nextTrxId() {
    const nums = transactions.map(t => parseInt(t.id.replace('TRX-','')) || 0);
    return 'TRX-' + String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, '0');
  }

  function stockStatus(p) {
    if (p.stock === 0 || p.stock <= p.minStock)            return 'danger';
    if (p.stock <= p.minStock * 1.5)                       return 'warning';
    return 'safe';
  }

  function statusBadge(p) {
    const s = stockStatus(p);
    const lbl = { safe: 'Aman', warning: 'Menipis', danger: 'Kritis' };
    return `<span class="badge badge-${s}">${lbl[s]}</span>`;
  }

  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  // ── Render helpers ────────────────────────────────────────────
  function setHtml(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  }

  function showEl(id)  { document.getElementById(id)?.classList.remove('hidden'); }
  function hideEl(id)  { document.getElementById(id)?.classList.add('hidden');    }
  function setVal(id, v) {
    const el = document.getElementById(id);
    if (el) el.value = v;
  }

  // ── Low-stock badge in sidebar ────────────────────────────────
  function updateLowStockBadge() {
    const count = products.filter(p => stockStatus(p) !== 'safe').length;
    const badge = document.getElementById('invLowStockBadge');
    if (!badge) return;
    if (count > 0) { badge.textContent = count; showEl('invLowStockBadge'); }
    else hideEl('invLowStockBadge');
  }

  // ══════════════════════════════════════════════════════════════
  // PRODUCTS
  // ══════════════════════════════════════════════════════════════
  function renderProducts() {
    const search   = (document.getElementById('invSearch')?.value  || '').toLowerCase();
    const catVal   = document.getElementById('invCatFilter')?.value || '';
    const sortVal  = document.getElementById('invSort')?.value     || 'name-asc';

    let list = products.filter(p => {
      const ok1 = p.name.toLowerCase().includes(search) || p.sku.toLowerCase().includes(search);
      const ok2 = !catVal || p.category === catVal;
      return ok1 && ok2;
    });

    list.sort((a, b) => {
      switch (sortVal) {
        case 'name-asc':   return a.name.localeCompare(b.name);
        case 'name-desc':  return b.name.localeCompare(a.name);
        case 'stock-asc':  return a.stock - b.stock;
        case 'stock-desc': return b.stock - a.stock;
        case 'price-asc':  return a.sellingPrice - b.sellingPrice;
        case 'price-desc': return b.sellingPrice - a.sellingPrice;
        default: return 0;
      }
    });

    const tbody = document.getElementById('invProductTbody');
    const empty = document.getElementById('invProductEmpty');
    if (!tbody) return;

    if (list.length === 0) {
      tbody.innerHTML = '';
      showEl('invProductEmpty');
      return;
    }
    hideEl('invProductEmpty');

    tbody.innerHTML = list.map(p => `
      <tr>
        <td style="padding:10px 14px;font-family:monospace;font-size:11px;color:var(--gray-500)">${esc(p.sku)}</td>
        <td style="padding:10px 14px">
          <p style="font-weight:600;color:var(--gray-900);font-size:13px">${esc(p.name)}</p>
          <p style="font-size:11px;color:var(--gray-400);margin-top:2px">${esc(p.description||'')}</p>
        </td>
        <td style="padding:10px 14px" class="hidden-sm">
          <span style="background:var(--gray-100);color:var(--gray-600);padding:2px 8px;border-radius:6px;font-size:11px">${esc(p.category)}</span>
        </td>
        <td style="padding:10px 14px;text-align:right;font-size:12px;color:var(--gray-600)" class="hidden-md">${fmtRp(p.purchasePrice)}</td>
        <td style="padding:10px 14px;text-align:right;font-size:13px;font-weight:600;color:var(--gray-900)">${fmtRp(p.sellingPrice)}</td>
        <td style="padding:10px 14px;text-align:center">
          <span style="font-weight:700;font-size:13px;color:${p.stock <= p.minStock ? '#dc2626' : 'var(--gray-800)'}">${p.stock}</span>
          <span style="font-size:11px;color:var(--gray-400)"> / min ${p.minStock}</span>
        </td>
        <td style="padding:10px 14px;text-align:center">${statusBadge(p)}</td>
        <td style="padding:10px 14px;text-align:center">
          <div style="display:flex;gap:4px;justify-content:center">
            <button onclick="Inventory.openProductModal('${p.id}')" style="padding:5px 7px;border:none;background:#eff6ff;color:#3b82f6;border-radius:7px;cursor:pointer" title="Edit">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            </button>
            <button onclick="Inventory.openDeleteModal('${p.id}')" style="padding:5px 7px;border:none;background:#fef2f2;color:#ef4444;border-radius:7px;cursor:pointer" title="Hapus">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
        </td>
      </tr>`).join('');
  }

  function refreshCategoryFilter() {
    const cats = [...new Set(products.map(p => p.category))].sort();
    const el = document.getElementById('invCatFilter');
    if (!el) return;
    const cur = el.value;
    el.innerHTML = `<option value="">Semua Kategori</option>` +
      cats.map(c => `<option value="${esc(c)}" ${c === cur ? 'selected' : ''}>${esc(c)}</option>`).join('');

    const dl = document.getElementById('invCategoryDatalist');
    if (dl) dl.innerHTML = cats.map(c => `<option value="${esc(c)}"></option>`).join('');
  }

  function refreshProductSelects() {
    const opts = products.map(p =>
      `<option value="${p.id}">${esc(p.name)} (Stok: ${p.stock})</option>`
    ).join('');
    ['invSiProduct','invSoProduct'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = `<option value="">-- Pilih Produk --</option>` + opts;
    });
  }

  // ── Product Modal ─────────────────────────────────────────────
  function openProductModal(id) {
    const form = document.getElementById('invProductForm');
    if (form) form.reset();
    setVal('invProductId', '');

    if (id) {
      const p = products.find(x => x.id === id);
      if (!p) return;
      document.getElementById('invModalTitle').textContent = 'Edit Produk';
      setVal('invProductId',        p.id);
      setVal('invProductName',      p.name);
      setVal('invProductSku',       p.sku);
      setVal('invProductCategory',  p.category);
      setVal('invProductPurchase',  p.purchasePrice);
      setVal('invProductSelling',   p.sellingPrice);
      setVal('invProductStock',     p.stock);
      setVal('invProductMinStock',  p.minStock);
      setVal('invProductDesc',      p.description || '');
    } else {
      document.getElementById('invModalTitle').textContent = 'Tambah Produk';
    }

    refreshCategoryFilter();
    showEl('invProductModal');
    document.body.style.overflow = 'hidden';
  }

  function closeProductModal() {
    hideEl('invProductModal');
    document.body.style.overflow = '';
  }

  function saveProduct(e) {
    e.preventDefault();
    const id       = document.getElementById('invProductId').value;
    const name     = document.getElementById('invProductName').value.trim();
    const sku      = document.getElementById('invProductSku').value.trim().toUpperCase();
    const category = document.getElementById('invProductCategory').value.trim();
    const purchase = parseFloat(document.getElementById('invProductPurchase').value);
    const selling  = parseFloat(document.getElementById('invProductSelling').value);
    const stock    = parseInt(document.getElementById('invProductStock').value);
    const minStock = parseInt(document.getElementById('invProductMinStock').value);
    const desc     = document.getElementById('invProductDesc').value.trim();

    if (!name || !sku || !category) { showInvToast('Nama, SKU, dan Kategori wajib diisi.', 'error'); return; }
    if (isNaN(purchase) || purchase < 0) { showInvToast('Harga beli tidak valid.', 'error'); return; }
    if (isNaN(selling)  || selling  < 0) { showInvToast('Harga jual tidak valid.', 'error'); return; }
    if (selling < purchase) { showInvToast('Harga jual tidak boleh lebih rendah dari harga beli.', 'error'); return; }

    const dupSku = products.find(p => p.sku === sku && p.id !== id);
    if (dupSku) { showInvToast(`SKU "${sku}" sudah digunakan produk lain.`, 'error'); return; }

    if (id) {
      const idx = products.findIndex(p => p.id === id);
      if (idx !== -1) products[idx] = { ...products[idx], name, sku, category, purchasePrice: purchase, sellingPrice: selling, stock, minStock, description: desc };
      showInvToast(`Produk "${name}" berhasil diperbarui.`, 'success');
    } else {
      products.push({ id: nextProductId(), sku, name, category, purchasePrice: purchase, sellingPrice: selling, stock, minStock, description: desc });
      showInvToast(`Produk "${name}" berhasil ditambahkan.`, 'success');
    }

    save();
    closeProductModal();
    refreshCategoryFilter();
    refreshProductSelects();
    renderProducts();
    updateLowStockBadge();
  }

  // ── Delete Modal ──────────────────────────────────────────────
  function openDeleteModal(id) {
    const p = products.find(x => x.id === id);
    if (!p) return;
    deleteTarget = id;
    document.getElementById('invDeleteName').textContent = p.name;
    showEl('invDeleteModal');
    document.body.style.overflow = 'hidden';
  }

  function closeDeleteModal() {
    deleteTarget = null;
    hideEl('invDeleteModal');
    document.body.style.overflow = '';
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    const p = products.find(x => x.id === deleteTarget);
    products     = products.filter(x => x.id !== deleteTarget);
    transactions = transactions.filter(t => t.productId !== deleteTarget);
    save();
    closeDeleteModal();
    refreshCategoryFilter();
    refreshProductSelects();
    renderProducts();
    updateLowStockBadge();
    if (p) showInvToast(`Produk "${p.name}" berhasil dihapus.`, 'info');
  }

  // ══════════════════════════════════════════════════════════════
  // STOCK IN
  // ══════════════════════════════════════════════════════════════
  function submitStockIn(e) {
    e.preventDefault();
    const productId = document.getElementById('invSiProduct').value;
    const qty       = parseInt(document.getElementById('invSiQty').value);
    const date      = document.getElementById('invSiDate').value;
    const supplier  = document.getElementById('invSiSupplier').value.trim();
    const notes     = document.getElementById('invSiNotes').value.trim();

    if (!productId)          { showInvToast('Pilih produk terlebih dahulu.', 'error'); return; }
    if (isNaN(qty) || qty <= 0) { showInvToast('Jumlah harus lebih dari 0.', 'error'); return; }
    if (!date)               { showInvToast('Tanggal wajib diisi.', 'error'); return; }

    const product = products.find(p => p.id === productId);
    if (!product) { showInvToast('Produk tidak ditemukan.', 'error'); return; }

    product.stock += qty;
    transactions.push({ id: nextTrxId(), type: 'in', productId, productName: product.name, quantity: qty, date, supplier: supplier || '–', notes: notes || '–' });

    save();
    document.getElementById('invStockInForm').reset();
    setVal('invSiDate', today());
    refreshProductSelects();
    renderStockInTable();
    updateLowStockBadge();
    showInvToast(`+${qty} unit "${product.name}" dicatat sebagai barang masuk.`, 'success');
  }

  function renderStockInTable() {
    const list  = transactions.filter(t => t.type === 'in').sort((a,b) => new Date(b.date)-new Date(a.date));
    const tbody = document.getElementById('invSiTbody');
    const empty = document.getElementById('invSiEmpty');
    if (!tbody) return;
    if (list.length === 0) { tbody.innerHTML = ''; showEl('invSiEmpty'); return; }
    hideEl('invSiEmpty');
    tbody.innerHTML = list.map(t => `
      <tr>
        <td style="padding:9px 14px;font-size:11px;font-family:monospace;color:var(--gray-500)">${esc(t.id)}</td>
        <td style="padding:9px 14px;font-size:13px;font-weight:500;color:var(--gray-800)">${esc(t.productName)}</td>
        <td style="padding:9px 14px;text-align:center;font-weight:700;color:#059669;font-size:13px">+${t.quantity}</td>
        <td style="padding:9px 14px;font-size:12px;color:var(--gray-600)" class="hidden-sm">${fmtDate(t.date)}</td>
        <td style="padding:9px 14px;font-size:12px;color:var(--gray-500)" class="hidden-md">${esc(t.supplier||'–')}</td>
        <td style="padding:9px 14px;font-size:12px;color:var(--gray-400)" class="hidden-lg">${esc(t.notes||'–')}</td>
      </tr>`).join('');
  }

  // ══════════════════════════════════════════════════════════════
  // STOCK OUT
  // ══════════════════════════════════════════════════════════════
  function updateStockInfo() {
    const id = document.getElementById('invSoProduct').value;
    const el = document.getElementById('invSoStockInfo');
    if (!el) return;
    if (!id) { el.textContent = ''; return; }
    const p = products.find(x => x.id === id);
    if (!p) return;
    const s = stockStatus(p);
    const color = s === 'danger' ? '#dc2626' : s === 'warning' ? '#d97706' : '#059669';
    el.innerHTML = `Stok tersedia: <strong style="color:${color}">${p.stock} unit</strong>`;
  }

  function submitStockOut(e) {
    e.preventDefault();
    const productId = document.getElementById('invSoProduct').value;
    const qty       = parseInt(document.getElementById('invSoQty').value);
    const date      = document.getElementById('invSoDate').value;
    const dest      = document.getElementById('invSoDest').value.trim();
    const notes     = document.getElementById('invSoNotes').value.trim();

    if (!productId)             { showInvToast('Pilih produk terlebih dahulu.', 'error'); return; }
    if (isNaN(qty) || qty <= 0) { showInvToast('Jumlah harus lebih dari 0.', 'error'); return; }
    if (!date)                  { showInvToast('Tanggal wajib diisi.', 'error'); return; }

    const product = products.find(p => p.id === productId);
    if (!product) { showInvToast('Produk tidak ditemukan.', 'error'); return; }

    if (qty > product.stock) {
      showInvToast(`Stok tidak mencukupi! Tersedia: ${product.stock} unit, diminta: ${qty} unit.`, 'error');
      return;
    }

    product.stock -= qty;
    transactions.push({ id: nextTrxId(), type: 'out', productId, productName: product.name, quantity: qty, date, destination: dest || '–', notes: notes || '–' });

    save();
    document.getElementById('invStockOutForm').reset();
    setVal('invSoDate', today());
    document.getElementById('invSoStockInfo').textContent = '';
    refreshProductSelects();
    renderStockOutTable();
    updateLowStockBadge();
    showInvToast(`–${qty} unit "${product.name}" dicatat sebagai barang keluar.`, 'success');
    if (stockStatus(product) !== 'safe') {
      setTimeout(() => showInvToast(`Perhatian: Stok "${product.name}" sekarang ${stockStatus(product) === 'danger' ? 'kritis' : 'menipis'} (${product.stock} unit).`, 'info'), 700);
    }
  }

  function renderStockOutTable() {
    const list  = transactions.filter(t => t.type === 'out').sort((a,b) => new Date(b.date)-new Date(a.date));
    const tbody = document.getElementById('invSoTbody');
    const empty = document.getElementById('invSoEmpty');
    if (!tbody) return;
    if (list.length === 0) { tbody.innerHTML = ''; showEl('invSoEmpty'); return; }
    hideEl('invSoEmpty');
    tbody.innerHTML = list.map(t => `
      <tr>
        <td style="padding:9px 14px;font-size:11px;font-family:monospace;color:var(--gray-500)">${esc(t.id)}</td>
        <td style="padding:9px 14px;font-size:13px;font-weight:500;color:var(--gray-800)">${esc(t.productName)}</td>
        <td style="padding:9px 14px;text-align:center;font-weight:700;color:#dc2626;font-size:13px">–${t.quantity}</td>
        <td style="padding:9px 14px;font-size:12px;color:var(--gray-600)" class="hidden-sm">${fmtDate(t.date)}</td>
        <td style="padding:9px 14px;font-size:12px;color:var(--gray-500)" class="hidden-md">${esc(t.destination||'–')}</td>
      </tr>`).join('');
  }

  // ══════════════════════════════════════════════════════════════
  // LOW STOCK
  // ══════════════════════════════════════════════════════════════
  function renderLowStock() {
    const lowItems = products.filter(p => stockStatus(p) !== 'safe').sort((a,b) => a.stock - b.stock);
    const grid  = document.getElementById('invLowStockGrid');
    const empty = document.getElementById('invLowStockEmpty');
    if (!grid) return;

    if (lowItems.length === 0) { grid.innerHTML = ''; showEl('invLowStockEmpty'); return; }
    hideEl('invLowStockEmpty');

    grid.innerHTML = lowItems.map(p => {
      const s    = stockStatus(p);
      const pct  = p.minStock > 0 ? Math.min(100, Math.round((p.stock / (p.minStock * 2)) * 100)) : 50;
      const fill = s === 'danger' ? '#ef4444' : '#f59e0b';
      return `
        <div class="low-stock-card is-${s}">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px">
            <div style="min-width:0;flex:1">
              <p style="font-size:13px;font-weight:600;color:var(--gray-900);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.name)}</p>
              <p style="font-size:11px;color:var(--gray-400);margin-top:2px">${esc(p.sku)} · ${esc(p.category)}</p>
            </div>
            <span class="badge badge-${s}" style="margin-left:8px;flex-shrink:0">${s === 'danger' ? 'Kritis' : 'Menipis'}</span>
          </div>
          <div style="display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:8px">
            <div>
              <p style="font-size:11px;color:var(--gray-400)">Stok Saat Ini</p>
              <p style="font-size:22px;font-weight:700;color:${s === 'danger' ? '#dc2626' : '#d97706'}">${p.stock}</p>
            </div>
            <div style="text-align:right">
              <p style="font-size:11px;color:var(--gray-400)">Min. Stok</p>
              <p style="font-size:13px;font-weight:600;color:var(--gray-700)">${p.minStock} unit</p>
            </div>
          </div>
          <div class="stock-progress">
            <div class="stock-progress-fill" style="width:${pct}%;background:${fill}"></div>
          </div>
          <button onclick="Inventory.goToStockIn('${p.id}')" style="margin-top:10px;width:100%;padding:7px;font-size:12px;font-weight:600;background:${s==='danger'?'#fef2f2':'#fffbeb'};color:${s==='danger'?'#991b1b':'#92400e'};border:1px solid ${s==='danger'?'#fecaca':'#fde68a'};border-radius:8px;cursor:pointer">
            + Restock Sekarang
          </button>
        </div>`;
    }).join('');
  }

  function goToStockIn(productId) {
    // Navigate to stock-in section and pre-select the product
    if (typeof navigateTo === 'function') navigateTo('inv-stockin');
    setTimeout(() => {
      const el = document.getElementById('invSiProduct');
      if (el) { el.value = productId; }
    }, 100);
  }

  // ══════════════════════════════════════════════════════════════
  // HISTORY
  // ══════════════════════════════════════════════════════════════
  function renderHistory() {
    const typeF  = document.getElementById('invHistTypeFilter')?.value  || '';
    const dateF  = document.getElementById('invHistDateFrom')?.value    || '';
    const dateT  = document.getElementById('invHistDateTo')?.value      || '';

    let list = [...transactions];
    if (typeF) list = list.filter(t => t.type === typeF);
    if (dateF) list = list.filter(t => t.date >= dateF);
    if (dateT) list = list.filter(t => t.date <= dateT);
    list.sort((a, b) => new Date(b.date) - new Date(a.date));

    const tbody = document.getElementById('invHistTbody');
    const empty = document.getElementById('invHistEmpty');
    if (!tbody) return;

    if (list.length === 0) { tbody.innerHTML = ''; showEl('invHistEmpty'); return; }
    hideEl('invHistEmpty');

    tbody.innerHTML = list.map(t => {
      const isIn = t.type === 'in';
      const badge = isIn
        ? '<span class="badge badge-safe">Masuk</span>'
        : '<span class="badge badge-danger">Keluar</span>';
      const keterangan = isIn ? (t.supplier||'–') : (t.destination||'–');
      return `
        <tr>
          <td style="padding:9px 14px;font-size:11px;font-family:monospace;color:var(--gray-500)">${esc(t.id)}</td>
          <td style="padding:9px 14px">
            <p style="font-size:13px;font-weight:500;color:var(--gray-800)">${esc(t.productName)}</p>
            ${t.notes && t.notes !== '–' ? `<p style="font-size:11px;color:var(--gray-400)">${esc(t.notes)}</p>` : ''}
          </td>
          <td style="padding:9px 14px;text-align:center">${badge}</td>
          <td style="padding:9px 14px;text-align:center;font-size:13px;font-weight:700;color:${isIn ? '#059669' : '#dc2626'}">${isIn ? '+' : '–'}${t.quantity}</td>
          <td style="padding:9px 14px;font-size:12px;color:var(--gray-600)" class="hidden-sm">${fmtDate(t.date)}</td>
          <td style="padding:9px 14px;font-size:12px;color:var(--gray-500)" class="hidden-md">${esc(keterangan)}</td>
        </tr>`;
    }).join('');
  }

  function clearHistoryFilter() {
    setVal('invHistTypeFilter', '');
    setVal('invHistDateFrom', '');
    setVal('invHistDateTo', '');
    renderHistory();
  }

  // ══════════════════════════════════════════════════════════════
  // TOAST (scoped to avoid conflict with app.js)
  // ══════════════════════════════════════════════════════════════
  function showInvToast(msg, type) {
    // Delegate to app.js showToast if available
    if (typeof showToast === 'function') { showToast(msg, type); return; }
    const c = document.getElementById('toastContainer');
    if (!c) return;
    const icons = {
      success: `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>`,
      error:   `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>`,
      info:    `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
    };
    const t = document.createElement('div');
    t.className = `toast toast-${type||'info'}`;
    t.innerHTML = (icons[type]||icons.info) + `<span>${esc(msg)}</span>`;
    c.appendChild(t);
    setTimeout(() => { t.style.opacity='0'; t.style.transform='translateX(20px)'; t.style.transition='opacity .3s,transform .3s'; setTimeout(()=>t.remove(),320); }, 3500);
  }

  // ══════════════════════════════════════════════════════════════
  // SECTION RENDERER (called by app.js navigateTo)
  // ══════════════════════════════════════════════════════════════
  function onSectionEnter(section) {
    switch (section) {
      case 'inv-products':
        refreshCategoryFilter();
        renderProducts();
        break;
      case 'inv-stockin':
        refreshProductSelects();
        setVal('invSiDate', today());
        renderStockInTable();
        break;
      case 'inv-stockout':
        refreshProductSelects();
        setVal('invSoDate', today());
        renderStockOutTable();
        break;
      case 'inv-lowstock':
        renderLowStock();
        break;
      case 'inv-history':
        renderHistory();
        break;
    }
    updateLowStockBadge();
  }

  // ══════════════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════════════
  return {
    init,
    onSectionEnter,
    updateLowStockBadge,
    // Product
    openProductModal,
    closeProductModal,
    saveProduct,
    openDeleteModal,
    closeDeleteModal,
    confirmDelete,
    renderProducts,
    // Stock
    submitStockIn,
    submitStockOut,
    updateStockInfo,
    // Low stock
    renderLowStock,
    goToStockIn,
    // History
    renderHistory,
    clearHistoryFilter,
  };

})();
