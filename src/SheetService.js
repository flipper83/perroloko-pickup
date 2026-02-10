/**
 * Returns the first sheet of the active spreadsheet (form responses).
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getResponseSheet() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME)
    || SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
}

/**
 * Ensures the script columns (Token, QR Sent, Checked In) exist as headers.
 * Returns the 1-based column indices for each.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @returns {{ tokenCol: number, qrSentCol: number, checkedInCol: number }}
 */
function ensureScriptColumns(sheet) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  var tokenCol = headers.indexOf(CONFIG.TOKEN_COL_HEADER) + 1;
  var qrSentCol = headers.indexOf(CONFIG.QR_SENT_COL_HEADER) + 1;
  var checkedInCol = headers.indexOf(CONFIG.CHECKED_IN_COL_HEADER) + 1;

  // If columns don't exist yet, append them after the last column
  if (!tokenCol) {
    tokenCol = headers.length + 1;
    sheet.getRange(1, tokenCol).setValue(CONFIG.TOKEN_COL_HEADER);
  }
  if (!qrSentCol) {
    qrSentCol = tokenCol + 1;
    sheet.getRange(1, qrSentCol).setValue(CONFIG.QR_SENT_COL_HEADER);
  }
  if (!checkedInCol) {
    checkedInCol = qrSentCol + 1;
    sheet.getRange(1, checkedInCol).setValue(CONFIG.CHECKED_IN_COL_HEADER);
  }

  return { tokenCol: tokenCol, qrSentCol: qrSentCol, checkedInCol: checkedInCol };
}

/**
 * Writes a token and QR status to the given row.
 *
 * @param {number} row - 1-based row number
 * @param {string} token - UUID token
 * @param {string} qrStatus - 'YES' or 'ERROR: ...'
 */
function writeTokenToSheet(row, token, qrStatus) {
  var sheet = getResponseSheet();
  var cols = ensureScriptColumns(sheet);

  sheet.getRange(row, cols.tokenCol).setValue(token);
  sheet.getRange(row, cols.qrSentCol).setValue(qrStatus);
}

/**
 * Finds the row number for a given token.
 *
 * @param {string} token - UUID to search for
 * @returns {number|null} 1-based row number, or null if not found
 */
function findRowByToken(token) {
  var sheet = getResponseSheet();
  var cols = ensureScriptColumns(sheet);
  var lastRow = sheet.getLastRow();

  if (lastRow < 2) return null;

  var tokenRange = sheet.getRange(2, cols.tokenCol, lastRow - 1, 1).getValues();

  for (var i = 0; i < tokenRange.length; i++) {
    if (tokenRange[i][0] === token) {
      return i + 2; // +2 because array is 0-based and data starts at row 2
    }
  }

  return null;
}

/**
 * Reads all orders from the sheet in a single getValues() call.
 *
 * @returns {{ orders: Array, serverTime: string }}
 */
function getAllOrders() {
  var sheet = getResponseSheet();
  var cols = ensureScriptColumns(sheet);
  var lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return { orders: [], serverTime: new Date().toISOString() };
  }

  var data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  var orders = [];

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var products = {};
    for (var p = 0; p < CONFIG.PRODUCTS.length; p++) {
      var colIndex = CONFIG.PRODUCT_START_COL - 1 + p; // 0-based in the row array
      products[CONFIG.PRODUCTS[p]] = parseInt(row[colIndex], 10) || 0;
    }

    orders.push({
      rowIndex: i + 2,
      timestamp: row[CONFIG.COL_TIMESTAMP - 1] ? new Date(row[CONFIG.COL_TIMESTAMP - 1]).toISOString() : '',
      email: row[CONFIG.COL_EMAIL - 1] || '',
      name: row[CONFIG.COL_NAME - 1] || '',
      pickupDay: (row[CONFIG.COL_PICKUP_DAY - 1] || '').toString().toLowerCase(),
      products: products,
      token: row[cols.tokenCol - 1] || '',
      qrSent: row[cols.qrSentCol - 1] || '',
      deliveredAt: row[cols.checkedInCol - 1] ? new Date(row[cols.checkedInCol - 1]).toISOString() : null
    });
  }

  return { orders: orders, serverTime: new Date().toISOString() };
}

/**
 * Marks an order as delivered by token. Returns richer data than checkInByToken.
 *
 * @param {string} token - UUID token from QR code
 * @returns {{ status: string, message: string, order: Object|null }}
 *   status: 'success' | 'already_delivered' | 'not_found'
 */
function markDeliveredByToken(token) {
  var sheet = getResponseSheet();
  var cols = ensureScriptColumns(sheet);
  var row = findRowByToken(token);

  if (!row) {
    return { status: 'not_found', message: 'Token no encontrado', order: null };
  }

  var rowData = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];

  var products = {};
  for (var p = 0; p < CONFIG.PRODUCTS.length; p++) {
    var colIndex = CONFIG.PRODUCT_START_COL - 1 + p;
    products[CONFIG.PRODUCTS[p]] = parseInt(rowData[colIndex], 10) || 0;
  }

  var order = {
    rowIndex: row,
    timestamp: rowData[CONFIG.COL_TIMESTAMP - 1] ? new Date(rowData[CONFIG.COL_TIMESTAMP - 1]).toISOString() : '',
    email: rowData[CONFIG.COL_EMAIL - 1] || '',
    name: rowData[CONFIG.COL_NAME - 1] || '',
    pickupDay: (rowData[CONFIG.COL_PICKUP_DAY - 1] || '').toString().toLowerCase(),
    products: products,
    token: rowData[cols.tokenCol - 1] || '',
    qrSent: rowData[cols.qrSentCol - 1] || '',
    deliveredAt: null
  };

  // Check if already delivered
  var checkedInValue = rowData[cols.checkedInCol - 1];
  if (checkedInValue) {
    order.deliveredAt = new Date(checkedInValue).toISOString();
    return {
      status: 'already_delivered',
      message: 'Ya entregado el ' + order.deliveredAt,
      order: order
    };
  }

  // Mark as delivered
  var now = new Date().toISOString();
  sheet.getRange(row, cols.checkedInCol).setValue(now);
  order.deliveredAt = now;

  return {
    status: 'success',
    message: 'Entrega completada',
    order: order
  };
}

/**
 * Batch processes pending deliveries and returns full order state.
 *
 * @param {Array} pendingDeliveries - Array of {token, localTimestamp}
 * @returns {{ results: Array, orders: Array, serverTime: string }}
 */
function syncDeliveries(pendingDeliveries) {
  var results = [];

  if (pendingDeliveries && pendingDeliveries.length > 0) {
    for (var i = 0; i < pendingDeliveries.length; i++) {
      var result = markDeliveredByToken(pendingDeliveries[i].token);
      result.localTimestamp = pendingDeliveries[i].localTimestamp;
      results.push(result);
    }
  }

  var allOrders = getAllOrders();

  return {
    results: results,
    orders: allOrders.orders,
    serverTime: allOrders.serverTime
  };
}

/**
 * Backward-compatible check-in wrapper over markDeliveredByToken.
 *
 * @param {string} token - UUID token from QR code
 * @returns {{ status: string, message: string, name: string|null }}
 */
function checkInByToken(token) {
  var result = markDeliveredByToken(token);

  // Map new statuses to old format
  var status = result.status === 'already_delivered' ? 'already' : result.status;
  var name = result.order ? result.order.name : null;

  return { status: status, message: result.message, name: name };
}
