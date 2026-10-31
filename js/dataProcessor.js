/**
 * SmartBiz Insight — dataProcessor.js
 * Semua kalkulasi bisnis dilakukan di sini, bukan oleh LLM.
 * Revenue = quantity × price
 */

'use strict';

const DataProcessor = (() => {

  // ── CSV Parser ──────────────────────────────────────────────
  const REQUIRED_COLUMNS = ['date', 'product', 'category', 'quantity', 'price'];

  function parseCSV(text) {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) {
      return { ok: false, errors: ['File CSV tidak memiliki data (minimum 2 baris: header + 1 data).'] };
    }

    // Parse header
    const rawHeader = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/["']/g, ''));
    const errors = [];

    // Check required columns
    const missing = REQUIRED_COLUMNS.filter(col => !rawHeader.includes(col));
    if (missing.length > 0) {
      errors.push(`Kolom wajib tidak ditemukan: ${missing.join(', ')}`);
      errors.push(`Kolom yang ditemukan: ${rawHeader.join(', ')}`);
      errors.push(`Kolom yang dibutuhkan: ${REQUIRED_COLUMNS.join(', ')}`);
      return { ok: false, errors };
    }

    const colIdx = {};
    REQUIRED_COLUMNS.forEach(col => { colIdx[col] = rawHeader.indexOf(col); });

    const records = [];
    const rowErrors = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cols = parseCSVLine(line);
      const rowNum = i + 1;

      const dateStr = (cols[colIdx.date] || '').trim().replace(/["']/g, '');
      const product = (cols[colIdx.product] || '').trim().replace(/["']/g, '');
      const category = (cols[colIdx.category] || '').trim().replace(/["']/g, '');
      const qtyRaw = (cols[colIdx.quantity] || '').trim().replace(/["']/g, '');
      const priceRaw = (cols[colIdx.price] || '').trim().replace(/["']/g, '');

      // Validate row
      if (!dateStr) { rowErrors.push(`Baris ${rowNum}: kolom 'date' kosong.`); continue; }
      if (!product)  { rowErrors.push(`Baris ${rowNum}: kolom 'product' kosong.`); continue; }
      if (!category) { rowErrors.push(`Baris ${rowNum}: kolom 'category' kosong.`); continue; }

      // Validate date
      const dateObj = new Date(dateStr);
      if (isNaN(dateObj.getTime())) {
        rowErrors.push(`Baris ${rowNum}: format tanggal tidak valid ("${dateStr}"). Gunakan format YYYY-MM-DD.`);
        continue;
      }

      // Validate quantity
      const qty = parseFloat(qtyRaw);
      if (isNaN(qty) || qty <= 0) {
        rowErrors.push(`Baris ${rowNum}: quantity tidak valid ("${qtyRaw}"). Harus angka positif.`);
        continue;
      }

      // Validate price
      const price = parseFloat(priceRaw);
      if (isNaN(price) || price < 0) {
        rowErrors.push(`Baris ${rowNum}: price tidak valid ("${priceRaw}"). Harus angka non-negatif.`);
        continue;
      }

      records.push({
        date: dateStr,
        product,
        category,
        quantity: qty,
        price,
        revenue: qty * price,
      });
    }

    if (records.length === 0) {
      const allErrors = rowErrors.length > 0
        ? ['Tidak ada baris data yang valid:', ...rowErrors]
        : ['File CSV tidak memiliki baris data yang dapat dibaca.'];
      return { ok: false, errors: allErrors };
    }

    const result = { ok: true, records };
    if (rowErrors.length > 0) {
      result.warnings = rowErrors;
    }
    return result;
  }

  // Handle CSV lines with possible quoted fields
  function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current);
    return result;
  }

  // ── KPI Calculations ────────────────────────────────────────
  function calculateKPIs(records) {
    const totalRevenue      = records.reduce((s, r) => s + r.revenue, 0);
    const totalTransactions = records.length;
    const uniqueProducts    = new Set(records.map(r => r.product)).size;
    const avgTransaction    = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

    return { totalRevenue, totalTransactions, uniqueProducts, avgTransaction };
  }

  // ── Revenue by Date ─────────────────────────────────────────
  function revenueByDate(records) {
    const map = {};
    records.forEach(r => {
      map[r.date] = (map[r.date] || 0) + r.revenue;
    });
    // Sort by date ascending
    const sorted = Object.entries(map).sort((a, b) => new Date(a[0]) - new Date(b[0]));
    return {
      labels: sorted.map(([d]) => formatDateShort(d)),
      values: sorted.map(([, v]) => v),
      raw:    sorted.map(([d, v]) => ({ date: d, revenue: v })),
    };
  }

  // ── Revenue by Category ─────────────────────────────────────
  function revenueByCategory(records) {
    const map = {};
    records.forEach(r => {
      map[r.category] = (map[r.category] || 0) + r.revenue;
    });
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
    return {
      labels: sorted.map(([c]) => c),
      values: sorted.map(([, v]) => v),
    };
  }

  // ── Top Products ────────────────────────────────────────────
  function topProducts(records, limit = 10) {
    const map = {};
    records.forEach(r => {
      if (!map[r.product]) {
        map[r.product] = { product: r.product, category: r.category, revenue: 0, quantity: 0, transactions: 0 };
      }
      map[r.product].revenue      += r.revenue;
      map[r.product].quantity     += r.quantity;
      map[r.product].transactions += 1;
    });
    return Object.values(map)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);
  }

  // ── Bottom Products ─────────────────────────────────────────
  function bottomProducts(records, limit = 5) {
    const map = {};
    records.forEach(r => {
      if (!map[r.product]) {
        map[r.product] = { product: r.product, category: r.category, revenue: 0, quantity: 0 };
      }
      map[r.product].revenue  += r.revenue;
      map[r.product].quantity += r.quantity;
    });
    return Object.values(map)
      .sort((a, b) => a.revenue - b.revenue)
      .slice(0, limit);
  }

  // ── Recent Activity ─────────────────────────────────────────
  function recentActivity(records, limit = 8) {
    return [...records]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, limit);
  }

  // ── Full Summary (for AI) ───────────────────────────────────
  function buildAISummary(records) {
    const kpi     = calculateKPIs(records);
    const byCat   = revenueByCategory(records);
    const byDate  = revenueByDate(records);
    const topProds = topProducts(records, 5);
    const botProds = bottomProducts(records, 3);

    const dateRange = byDate.raw.length > 0
      ? `${byDate.raw[0].date} s/d ${byDate.raw[byDate.raw.length - 1].date}`
      : '-';

    const topCat  = byCat.labels[0] || '-';
    const topCatRevenue = byCat.values[0] || 0;

    const summary = [
      `=== RINGKASAN DATA PENJUALAN ===`,
      `Periode data: ${dateRange}`,
      `Total Revenue: Rp ${formatNumber(kpi.totalRevenue)}`,
      `Total Transaksi: ${kpi.totalTransactions}`,
      `Jumlah Produk Unik: ${kpi.uniqueProducts}`,
      `Rata-rata per Transaksi: Rp ${formatNumber(Math.round(kpi.avgTransaction))}`,
      ``,
      `=== REVENUE PER KATEGORI ===`,
      ...byCat.labels.map((cat, i) =>
        `${cat}: Rp ${formatNumber(byCat.values[i])} (${pct(byCat.values[i], kpi.totalRevenue)}%)`
      ),
      ``,
      `=== TOP 5 PRODUK TERLARIS ===`,
      ...topProds.map((p, i) =>
        `${i + 1}. ${p.product} [${p.category}] — Revenue: Rp ${formatNumber(p.revenue)}, Qty: ${p.quantity}`
      ),
      ``,
      `=== 3 PRODUK TERENDAH ===`,
      ...botProds.map((p, i) =>
        `${i + 1}. ${p.product} [${p.category}] — Revenue: Rp ${formatNumber(p.revenue)}, Qty: ${p.quantity}`
      ),
      ``,
      `=== TREN HARIAN (5 HARI TERAKHIR) ===`,
      ...byDate.raw.slice(-5).map(r =>
        `${r.date}: Rp ${formatNumber(r.revenue)}`
      ),
    ].join('\n');

    return {
      summary,
      kpi,
      topCategory: { name: topCat, revenue: topCatRevenue },
      dateRange,
    };
  }

  // ── Helpers ─────────────────────────────────────────────────
  function formatNumber(n) {
    return Math.round(n).toLocaleString('id-ID');
  }

  function formatDateShort(dateStr) {
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}`;
  }

  function pct(part, total) {
    if (!total) return '0';
    return ((part / total) * 100).toFixed(1);
  }

  // ── Public API ───────────────────────────────────────────────
  return {
    parseCSV,
    calculateKPIs,
    revenueByDate,
    revenueByCategory,
    topProducts,
    bottomProducts,
    recentActivity,
    buildAISummary,
    formatNumber,
    formatDateShort,
  };

})();
