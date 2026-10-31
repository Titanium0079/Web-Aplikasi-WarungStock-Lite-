/**
 * SmartBiz Insight — langflow.js
 * Integrasi dengan Langflow v1 API.
 * Aplikasi tetap berfungsi penuh jika Langflow belum dikonfigurasi.
 */

'use strict';

const LangflowClient = (() => {

  // Cek apakah config.js sudah dimuat dan valid
  function getConfig() {
    if (typeof SMARTBIZ_CONFIG === 'undefined') return null;
    const c = SMARTBIZ_CONFIG;
    if (!c.LANGFLOW_BASE_URL || !c.FLOW_ID) return null;
    if (c.FLOW_ID === 'your-flow-id-here') return null;
    return c;
  }

  function isConfigured() {
    return getConfig() !== null;
  }

  /**
   * Kirim data ringkasan ke Langflow dan terima hasil AI Insights.
   * @param {string} summaryText — ringkasan teks dari DataProcessor.buildAISummary
   * @returns {Promise<{ok: boolean, text?: string, error?: string}>}
   */
  async function generateInsights(summaryText) {
    const config = getConfig();

    if (!config) {
      return {
        ok: false,
        error: 'UNCONFIGURED',
        message: 'Langflow belum dikonfigurasi. Salin config.example.js menjadi config.js dan isi LANGFLOW_BASE_URL serta FLOW_ID.',
      };
    }

    const url = `${config.LANGFLOW_BASE_URL.replace(/\/$/, '')}/api/v1/run/${config.FLOW_ID}`;
    const timeout = config.REQUEST_TIMEOUT || 30000;

    const prompt = buildPrompt(summaryText);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input_value: prompt,
          input_type: 'chat',
          output_type: 'chat',
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        return {
          ok: false,
          error: 'HTTP_ERROR',
          message: `Langflow mengembalikan status ${response.status}. ${errText ? 'Detail: ' + errText.slice(0, 200) : ''}`,
        };
      }

      const data = await response.json();
      const text = extractOutputText(data);

      if (!text) {
        return {
          ok: false,
          error: 'EMPTY_RESPONSE',
          message: 'Langflow merespons tapi tidak menghasilkan teks. Periksa konfigurasi flow Anda.',
        };
      }

      return { ok: true, text };

    } catch (err) {
      clearTimeout(timer);

      if (err.name === 'AbortError') {
        return {
          ok: false,
          error: 'TIMEOUT',
          message: `Request ke Langflow timeout setelah ${timeout / 1000} detik. Periksa koneksi atau setting timeout di config.js.`,
        };
      }

      // Network error (server not running, CORS, dll)
      return {
        ok: false,
        error: 'NETWORK_ERROR',
        message: `Tidak dapat terhubung ke Langflow di ${config.LANGFLOW_BASE_URL}. Pastikan Langflow sedang berjalan dan URL sudah benar. Detail: ${err.message}`,
      };
    }
  }

  // Bangun prompt yang dikirim ke Langflow
  function buildPrompt(summaryText) {
    return `Anda adalah konsultan bisnis UMKM profesional yang memberikan analisis bisnis berdasarkan data penjualan aktual.

Berikut adalah ringkasan data penjualan yang telah dihitung secara akurat oleh sistem:

${summaryText}

Berdasarkan data di atas, berikan analisis bisnis dalam format berikut (gunakan bahasa Indonesia yang profesional dan mudah dipahami pemilik warung/UMKM):

## Ringkasan Performa Bisnis
[Tulis 2-3 kalimat ringkasan umum performa bisnis berdasarkan angka di atas]

## Temuan Utama
- [Temuan 1 berdasarkan data]
- [Temuan 2 berdasarkan data]
- [Temuan 3 berdasarkan data]

## Potensi Masalah Bisnis
- [Masalah atau risiko 1 yang terlihat dari data]
- [Masalah atau risiko 2 jika ada]

## Tiga Rekomendasi Bisnis
1. [Rekomendasi konkret dan spesifik berdasarkan data]
2. [Rekomendasi konkret dan spesifik berdasarkan data]
3. [Rekomendasi konkret dan spesifik berdasarkan data]

PENTING: Jangan mengarang angka atau tren yang tidak ada dalam data. Semua analisis harus berdasarkan data yang diberikan.`;
  }

  // Ekstrak teks output dari berbagai format respons Langflow
  function extractOutputText(data) {
    try {
      // Format standar Langflow v1
      if (data.outputs) {
        for (const output of data.outputs) {
          if (output.outputs) {
            for (const out of output.outputs) {
              const msg = out?.results?.message?.data?.text
                || out?.results?.message?.text
                || out?.outputs?.message?.message?.text
                || out?.artifacts?.message;
              if (msg) return String(msg);
            }
          }
        }
      }
      // Fallback formats
      if (data.result)  return String(data.result);
      if (data.message) return String(data.message);
      if (data.text)    return String(data.text);
      if (data.output)  return String(data.output);

      // Try JSON string search
      const str = JSON.stringify(data);
      const match = str.match(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      if (match) return match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
    } catch (_) {}
    return null;
  }

  /**
   * Parse teks respons AI menjadi bagian-bagian terstruktur.
   * Menangani respons plain text maupun markdown-formatted.
   */
  function parseInsightsText(text) {
    const sections = {
      summary:         '',
      findings:        [],
      issues:          [],
      recommendations: [],
    };

    if (!text) return sections;

    const lines = text.split('\n');
    let currentSection = null;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      const lower = line.toLowerCase().replace(/[#*_]/g, '').trim();

      if (lower.includes('ringkasan performa') || lower.includes('ringkasan bisnis') || lower.includes('business performance')) {
        currentSection = 'summary';
        continue;
      }
      if (lower.includes('temuan utama') || lower.includes('key finding') || lower.includes('temuan penting')) {
        currentSection = 'findings';
        continue;
      }
      if (lower.includes('potensi masalah') || lower.includes('potential issue') || lower.includes('masalah bisnis')) {
        currentSection = 'issues';
        continue;
      }
      if (lower.includes('rekomendasi') || lower.includes('recommendation')) {
        currentSection = 'recommendations';
        continue;
      }

      if (!currentSection) continue;

      const cleanLine = line.replace(/^[-*•#]+\s*/, '').replace(/^\d+\.\s*/, '').replace(/\*\*/g, '').trim();
      if (!cleanLine) continue;

      if (currentSection === 'summary') {
        sections.summary += (sections.summary ? ' ' : '') + cleanLine;
      } else {
        sections[currentSection].push(cleanLine);
      }
    }

    // Fallback: jika parsing gagal, tampilkan teks mentah di summary
    if (!sections.summary && sections.findings.length === 0) {
      sections.summary = text.replace(/\*\*/g, '').trim();
    }

    return sections;
  }

  return {
    isConfigured,
    generateInsights,
    parseInsightsText,
  };

})();
