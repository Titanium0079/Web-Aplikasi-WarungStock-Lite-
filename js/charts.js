/**
 * SmartBiz Insight — charts.js
 * Chart.js wrappers. Semua chart di-destroy & re-create saat data berubah.
 */

'use strict';

const Charts = (() => {

  const PALETTE = [
    '#10b981', '#3b82f6', '#f59e0b', '#8b5cf6',
    '#ef4444', '#06b6d4', '#ec4899', '#84cc16',
    '#f97316', '#6366f1',
  ];

  const instances = {};

  function destroy(id) {
    if (instances[id]) {
      instances[id].destroy();
      delete instances[id];
    }
  }

  function defaultOptions(extraScales) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { font: { size: 11 }, boxWidth: 12, padding: 12 },
        },
        tooltip: {
          callbacks: {
            label: ctx => ` Rp ${Math.round(ctx.parsed.y ?? ctx.parsed).toLocaleString('id-ID')}`,
          },
        },
      },
      scales: extraScales || {},
    };
  }

  // ── Revenue by Date (Line) ──────────────────────────────────
  function renderRevenueLine(canvasId, { labels, values }) {
    destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    instances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Revenue',
          data: values,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16,185,129,0.08)',
          tension: 0.4,
          fill: true,
          pointRadius: 3,
          pointHoverRadius: 6,
          pointBackgroundColor: '#10b981',
        }],
      },
      options: {
        ...defaultOptions({
          x: {
            grid: { display: false },
            ticks: { font: { size: 10 }, maxTicksLimit: 12 },
          },
          y: {
            beginAtZero: true,
            grid: { color: '#f3f4f6' },
            ticks: {
              font: { size: 10 },
              callback: v => 'Rp ' + (v / 1000).toFixed(0) + 'K',
            },
          },
        }),
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` Rp ${Math.round(ctx.parsed.y).toLocaleString('id-ID')}`,
            },
          },
        },
      },
    });
  }

  // ── Revenue by Category (Doughnut) ──────────────────────────
  function renderCategoryDoughnut(canvasId, { labels, values }) {
    destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    instances[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: PALETTE.slice(0, labels.length),
          borderWidth: 2,
          borderColor: '#fff',
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
              label: ctx => ` ${ctx.label}: Rp ${Math.round(ctx.parsed).toLocaleString('id-ID')}`,
            },
          },
        },
      },
    });
  }

  // ── Top Products (Horizontal Bar) ───────────────────────────
  function renderTopProductsBar(canvasId, products) {
    destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const labels = products.map(p => p.product.length > 20 ? p.product.slice(0, 20) + '…' : p.product);
    const values = products.map(p => p.revenue);

    instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Revenue',
          data: values,
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
          tooltip: {
            callbacks: {
              label: ctx => ` Rp ${Math.round(ctx.parsed.x).toLocaleString('id-ID')}`,
            },
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: '#f3f4f6' },
            ticks: {
              font: { size: 10 },
              callback: v => 'Rp ' + (v / 1000).toFixed(0) + 'K',
            },
          },
          y: {
            grid: { display: false },
            ticks: { font: { size: 10 } },
          },
        },
      },
    });
  }

  // ── Category Revenue (Bar) ──────────────────────────────────
  function renderCategoryBar(canvasId, { labels, values }) {
    destroy(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Revenue per Kategori',
          data: values,
          backgroundColor: PALETTE.slice(0, labels.length).map(c => c + 'cc'),
          borderColor: PALETTE.slice(0, labels.length),
          borderWidth: 1,
          borderRadius: 5,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` Rp ${Math.round(ctx.parsed.y).toLocaleString('id-ID')}`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { size: 10 } },
          },
          y: {
            beginAtZero: true,
            grid: { color: '#f3f4f6' },
            ticks: {
              font: { size: 10 },
              callback: v => 'Rp ' + (v / 1000000).toFixed(1) + 'M',
            },
          },
        },
      },
    });
  }

  return {
    renderRevenueLine,
    renderCategoryDoughnut,
    renderTopProductsBar,
    renderCategoryBar,
    destroy,
  };

})();
