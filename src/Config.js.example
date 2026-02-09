/**
 * Configuration constants for Perroloko Pickup check-in system.
 *
 * SETUP: After your first deploy, paste the web app URL below.
 * Column offsets (TOKEN_COL, QR_SENT_COL, CHECKED_IN_COL) are calculated
 * dynamically from the last column of data in the sheet.
 */

var CONFIG = {
  // ── Event ────────────────────────────────────────────────────
  EVENT_NAME: 'Perroloko Pickup',
  EMAIL_SUBJECT: 'Tu entrada para Perroloko Pickup - QR de acceso',

  // ── Sheet ────────────────────────────────────────────────────
  SHEET_NAME: 'Form Responses 1',

  // Columns appended by the script (1-based offsets from the end)
  // These will be resolved dynamically by SheetService based on
  // the number of form columns detected on first run.
  TOKEN_COL_HEADER: 'Token',
  QR_SENT_COL_HEADER: 'QR Sent',
  CHECKED_IN_COL_HEADER: 'Checked In',

  // ── QR API ───────────────────────────────────────────────────
  QR_API_BASE: 'https://api.qrserver.com/v1/create-qr-code/',
  QR_SIZE: '300x300',

  // ── Web App ──────────────────────────────────────────────────
  // Paste your deployed web app URL here after first deploy
  WEB_APP_URL: 'YOUR_WEB_APP_URL_HERE'
};
