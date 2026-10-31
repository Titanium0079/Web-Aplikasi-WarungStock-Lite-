/**
 * SmartBiz Insight — Konfigurasi Langflow
 *
 * CARA PENGGUNAAN:
 * 1. Salin file ini menjadi: config.js
 * 2. Isi nilai LANGFLOW_BASE_URL dan FLOW_ID sesuai deployment Langflow Anda
 * 3. Jangan commit file config.js ke repository (sudah di .gitignore)
 *
 * CATATAN KEAMANAN:
 * - Jangan pernah memasukkan API key atau kredensial asli ke file ini
 * - File config.js bersifat lokal dan tidak boleh di-push ke repo publik
 * - Untuk deployment production, gunakan environment variable di server
 */

const SMARTBIZ_CONFIG = {
  // URL dasar Langflow Anda
  // Contoh lokal  : "http://localhost:7860"
  // Contoh cloud  : "https://your-langflow.example.com"
  LANGFLOW_BASE_URL: 'http://localhost:7860',

  // ID Flow yang sudah dibuat di Langflow
  // Temukan di URL saat membuka flow: /flow/{FLOW_ID}
  FLOW_ID: 'your-flow-id-here',

  // Timeout request ke Langflow (milidetik)
  REQUEST_TIMEOUT: 30000,

  // Nama aplikasi yang dikirim ke Langflow sebagai context
  APP_NAME: 'SmartBiz Insight',
};
