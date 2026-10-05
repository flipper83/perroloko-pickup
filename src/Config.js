/**
 * Configuration constants for the Pickup check-in system.
 *
 * Values live in Script Properties (per-instance, set via the "Configurar Pickup" menu
 * added by SetupWizard.js) so the same code can be reused across companies/years without
 * editing this file. Defaults below match the original Perroloko Pickup event, so an
 * instance that has never run the setup wizard keeps working exactly as before.
 */

// ScriptApp.getService().getUrl() is only reliable when called from inside an actual web
// app request (doGet/doPost). Called from a menu item or trigger — as it is here — it can
// silently return a stale or wrong deployment URL even with a single deployment. So the
// confirmed URL (pasted by the user via the setup wizard after deploying) always wins.
function getWebAppUrl() {
  var override = PropertiesService.getScriptProperties().getProperty('WEB_APP_URL_OVERRIDE');
  return override || ScriptApp.getService().getUrl() || '';
}

function getConfig() {
  var props = PropertiesService.getScriptProperties();

  return {
    // ── Event ────────────────────────────────────────────────────
    EVENT_NAME: props.getProperty('EVENT_NAME') || 'Perroloko Pickup',
    EMAIL_SUBJECT: props.getProperty('EMAIL_SUBJECT') || 'Your ticket for Perroloko Pickup - Access QR code',

    // ── Sheet ────────────────────────────────────────────────────
    SHEET_NAME: props.getProperty('SHEET_NAME') || 'Form Responses 1',

    // Timestamp is always the sheet's first column for any Form-linked response sheet —
    // that position is guaranteed by Forms regardless of anything else (including whether
    // Forms also inserts its own verified-email column, see EMAIL_HEADER below).
    COL_TIMESTAMP: 1,

    // Every other form column is looked up by its header text (see resolveFormColumns in
    // SheetService.js) rather than by fixed position. Fixed positions broke the moment
    // setLimitOneResponsePerUser (below) is on: that setting makes Forms require sign-in and
    // insert its own required email question into the sheet (right after Timestamp), shifting
    // every column that follows. That's also why there's no separate "our own Email question"
    // header here — SetupWizard.js deliberately doesn't add one anymore, since Forms' own email
    // collection already covers it and a second question would just be a redundant duplicate
    // box asking the same thing (see the comment in createEventForm). EMAIL_HEADER points at
    // Forms' column instead. The rest of these constants are the exact question titles the
    // setup wizard gives each Form field — they must keep matching if those titles are ever
    // hand-edited in the Form. The marketing consent checkbox (if MARKETING_CONSENT_ENABLED)
    // isn't read by any script code; its own question text is the Sheet column header, so it's
    // found by eye.
    EMAIL_HEADER: 'Email Address',
    NAME_HEADER: 'Nombre',
    PICKUP_DAY_HEADER: 'Día de recogida',

    MARKETING_CONSENT_ENABLED: props.getProperty('MARKETING_CONSENT_ENABLED') === 'true',

    // Max units of a product one person can order, across all their submissions combined
    // (map productName -> limit; missing/0 = unlimited). Frozen at Form-creation time, same
    // as MARKETING_CONSENT_ENABLED — see SetupWizard.js.
    PRODUCT_LIMITS: JSON.parse(props.getProperty('PRODUCT_LIMITS') || '{}'),

    // Script columns headers (appended after form columns)
    TOKEN_COL_HEADER: 'Token',
    QR_SENT_COL_HEADER: 'QR Sent',
    CHECKED_IN_COL_HEADER: 'Checked In',

    // ── Products & Pickup Days ─────────────────────────────────
    PRODUCTS: JSON.parse(props.getProperty('PRODUCTS') || '["Ashes","Nijar","Orloj"]'),
    PICKUP_DAYS: JSON.parse(props.getProperty('PICKUP_DAYS') || '["jueves","viernes","sabado"]'),

    // ── QR API ───────────────────────────────────────────────────
    QR_API_BASE: 'https://api.qrserver.com/v1/create-qr-code/',
    QR_SIZE: props.getProperty('QR_SIZE') || '300x300',

    // ── Web App ──────────────────────────────────────────────────
    // Computed from the current deployment - no manual paste-and-redeploy step needed.
    WEB_APP_URL: getWebAppUrl()
  };
}

var CONFIG = getConfig();
