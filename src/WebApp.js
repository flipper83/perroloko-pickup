/**
 * Handles GET requests to the web app.
 * Serves the PickupApp SPA with config and optional auto-token.
 *
 * @param {Object} e - Event object with query parameters
 * @returns {HtmlOutput}
 */
function doGet(e) {
  var template = HtmlService.createTemplateFromFile('PickupApp');

  // If a token was passed via QR scan (direct URL), auto-process it
  template.autoToken = (e && e.parameter && e.parameter.token) ? e.parameter.token : '';

  // Inject config for client-side use
  template.configJson = JSON.stringify({
    eventName: CONFIG.EVENT_NAME,
    products: CONFIG.PRODUCTS,
    pickupDays: CONFIG.PICKUP_DAYS
  });

  return template.evaluate()
    .setTitle(CONFIG.EVENT_NAME + ' - Gestión de Pedidos')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Fetches all orders from the sheet.
 * Called from client via google.script.run.
 *
 * @returns {{ orders: Array, serverTime: string }}
 */
function fetchAllOrders() {
  return getAllOrders();
}

/**
 * Processes a single delivery by token.
 * Called from client via google.script.run.
 *
 * @param {string} token - UUID token
 * @returns {{ status: string, message: string, order: Object|null }}
 */
function processDelivery(token) {
  if (!token || typeof token !== 'string' || token.trim() === '') {
    return { status: 'not_found', message: 'Token vacío o inválido', order: null };
  }
  return markDeliveredByToken(token.trim());
}

/**
 * Syncs pending deliveries from client and returns full order state.
 * Called from client via google.script.run.
 *
 * @param {string} pendingJson - JSON string of [{token, localTimestamp}]
 * @returns {{ results: Array, orders: Array, serverTime: string }}
 */
function syncData(pendingJson) {
  var pending = [];
  if (pendingJson) {
    try {
      pending = JSON.parse(pendingJson);
    } catch (e) {
      // ignore parse errors, sync with empty pending
    }
  }
  return syncDeliveries(pending);
}

/**
 * Backward-compatible check-in endpoint.
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
