/**
 * Handles GET requests to the web app.
 * If a token parameter is present, shows the check-in result page.
 * Otherwise, serves the QR scanner UI.
 *
 * @param {Object} e - Event object with query parameters
 * @returns {HtmlOutput}
 */
function doGet(e) {
  var template = HtmlService.createTemplateFromFile('CheckinPage');

  // If a token was passed via QR scan (direct URL), auto-process it
  template.autoToken = (e && e.parameter && e.parameter.token) ? e.parameter.token : '';

  return template.evaluate()
    .setTitle(CONFIG.EVENT_NAME + ' - Check-in')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Server-side function called from the client via google.script.run.
 *
 * @param {string} token - UUID token to check in
 * @returns {{ status: string, message: string, name: string|null }}
 */
function processCheckin(token) {
  if (!token || typeof token !== 'string' || token.trim() === '') {
    return { status: 'not_found', message: 'Token vacio o invalido', name: null };
  }
  return checkInByToken(token.trim());
}
