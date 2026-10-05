/**
 * Returns the first sheet of the active spreadsheet (form responses).
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getResponseSheet() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME)
    || SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
}

/**
 * Header used for a product's "delivered quantity" column.
 * @param {string} product
 * @returns {string}
 */
function deliveredQtyHeader(product) {
  return product + ' - Recogido';
}

/**
 * Ensures the script columns (Token, QR Sent, Checked In, and one delivered-quantity column
 * per product) exist as headers, creating any that are missing. Returns their 1-based indices.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @returns {{ tokenCol: number, qrSentCol: number, checkedInCol: number, deliveredCols: Object }}
 */
function ensureScriptColumns(sheet) {
  var lastCol = sheet.getLastColumn();
  var headers = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];

  function ensureCol(headerName) {
    var idx = headers.indexOf(headerName);
    if (idx !== -1) return idx + 1;
    headers.push(headerName);
    var col = headers.length;
    sheet.getRange(1, col).setValue(headerName);
    return col;
  }

  var tokenCol = ensureCol(CONFIG.TOKEN_COL_HEADER);
  var qrSentCol = ensureCol(CONFIG.QR_SENT_COL_HEADER);
  var checkedInCol = ensureCol(CONFIG.CHECKED_IN_COL_HEADER);

  var deliveredCols = {};
  for (var i = 0; i < CONFIG.PRODUCTS.length; i++) {
    var product = CONFIG.PRODUCTS[i];
    deliveredCols[product] = ensureCol(deliveredQtyHeader(product));
  }

  return { tokenCol: tokenCol, qrSentCol: qrSentCol, checkedInCol: checkedInCol, deliveredCols: deliveredCols };
}

/**
 * Resolves the sheet columns Forms generated for our own questions, by header text rather
 * than fixed position — necessary because Form.setLimitOneResponsePerUser(true) makes Forms
 * require sign-in and insert its own verified-email column right after Timestamp, shifting
 * every column that follows. Throws if a header is missing (misconfigured/renamed question)
 * rather than silently reading the wrong column.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @returns {{ timestampCol: number, emailCol: number, nameCol: number, pickupDayCol: number,
 *   productCols: Object }}
 */
function resolveFormColumns(sheet) {
  var lastCol = sheet.getLastColumn();
  var headers = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];

  function findCol(headerName) {
    var idx = headers.indexOf(headerName);
    if (idx === -1) {
      throw new Error('No se encontró la columna "' + headerName + '" en la hoja de respuestas. ' +
        'Revisa que el título de esa pregunta en el Form no se haya cambiado.');
    }
    return idx + 1;
  }

  var productCols = {};
  for (var p = 0; p < CONFIG.PRODUCTS.length; p++) {
    productCols[CONFIG.PRODUCTS[p]] = findCol(CONFIG.PRODUCTS[p]);
  }

  return {
    timestampCol: CONFIG.COL_TIMESTAMP,
    emailCol: findCol(CONFIG.EMAIL_HEADER),
    nameCol: findCol(CONFIG.NAME_HEADER),
    pickupDayCol: findCol(CONFIG.PICKUP_DAY_HEADER),
    productCols: productCols
  };
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
 * Writes the delivered quantity for each product on a row. Caller is responsible for
 * clamping values (0..ordered qty) beforehand.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {number} row - 1-based row number
 * @param {Object} cols - as returned by ensureScriptColumns
 * @param {Object} deliveredProducts - { productName: qty }
 */
function writeDeliveredQuantities(sheet, row, cols, deliveredProducts) {
  for (var p = 0; p < CONFIG.PRODUCTS.length; p++) {
    var product = CONFIG.PRODUCTS[p];
    sheet.getRange(row, cols.deliveredCols[product]).setValue(deliveredProducts[product] || 0);
  }
}

/**
 * Builds an order object from a raw sheet row. Handles the pre-partial-pickup legacy case:
 * if a delivered-quantity cell was never written (blank, not even 0) and the order is already
 * checked in, it predates this feature — assume the old all-or-nothing behavior (full qty
 * delivered) rather than reading it as "0 delivered", which would wrongly free up stock for
 * orders that were, in fact, already handed out in full.
 *
 * @param {Array} rowData - one row from sheet.getValues()
 * @param {number} rowIndex - 1-based row number
 * @param {Object} cols - as returned by ensureScriptColumns
 * @param {Object} formCols - as returned by resolveFormColumns
 * @returns {Object}
 */
function buildOrderFromRow(rowData, rowIndex, cols, formCols) {
  var checkedInRaw = rowData[cols.checkedInCol - 1];
  var deliveredAt = checkedInRaw ? new Date(checkedInRaw).toISOString() : null;

  var products = {};
  var deliveredProducts = {};
  for (var p = 0; p < CONFIG.PRODUCTS.length; p++) {
    var product = CONFIG.PRODUCTS[p];
    var colIndex = formCols.productCols[product] - 1;
    var orderedQty = parseInt(rowData[colIndex], 10) || 0;
    products[product] = orderedQty;

    var rawDelivered = rowData[cols.deliveredCols[product] - 1];
    if (rawDelivered === '' || rawDelivered === null || rawDelivered === undefined) {
      deliveredProducts[product] = deliveredAt ? orderedQty : 0;
    } else {
      deliveredProducts[product] = parseInt(rawDelivered, 10) || 0;
    }
  }

  return {
    rowIndex: rowIndex,
    timestamp: rowData[formCols.timestampCol - 1] ? new Date(rowData[formCols.timestampCol - 1]).toISOString() : '',
    email: rowData[formCols.emailCol - 1] || '',
    name: rowData[formCols.nameCol - 1] || '',
    pickupDay: (rowData[formCols.pickupDayCol - 1] || '').toString().toLowerCase(),
    products: products,
    deliveredProducts: deliveredProducts,
    token: rowData[cols.tokenCol - 1] || '',
    qrSent: rowData[cols.qrSentCol - 1] || '',
    deliveredAt: deliveredAt
  };
}

/**
 * Sums each product's ordered quantity across all sheet rows submitted by the given email
 * (case-insensitive, trimmed match) — used to detect when a new submission pushes the
 * combined total over a per-person limit, since Google Forms can only validate a single
 * submission on its own, not against someone's prior submissions.
 *
 * @param {string} email
 * @returns {Object} { productName: totalQty }
 */
function sumProductQuantitiesForEmail(email) {
  var totals = {};
  for (var p = 0; p < CONFIG.PRODUCTS.length; p++) totals[CONFIG.PRODUCTS[p]] = 0;

  var sheet = getResponseSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return totals;

  var formCols = resolveFormColumns(sheet);
  var normalizedEmail = (email || '').toString().toLowerCase().trim();
  var data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();

  for (var i = 0; i < data.length; i++) {
    var rowEmail = (data[i][formCols.emailCol - 1] || '').toString().toLowerCase().trim();
    if (rowEmail !== normalizedEmail) continue;
    for (var pr = 0; pr < CONFIG.PRODUCTS.length; pr++) {
      var product = CONFIG.PRODUCTS[pr];
      var colIndex = formCols.productCols[product] - 1;
      totals[product] += parseInt(data[i][colIndex], 10) || 0;
    }
  }

  return totals;
}

/**
 * Returns which products (if any) this email's combined submissions now exceed the
 * configured per-person limit for. Assumes the current/new submission is already written
 * to the sheet, since it's called from onFormSubmit after the row was appended.
 *
 * @param {string} email
 * @returns {Array<string>} product names over their limit, empty if none
 */
function findOverLimitProducts(email) {
  var limits = CONFIG.PRODUCT_LIMITS;
  var over = [];
  if (!limits) return over;

  var totals = sumProductQuantitiesForEmail(email);
  for (var p = 0; p < CONFIG.PRODUCTS.length; p++) {
    var product = CONFIG.PRODUCTS[p];
    var limit = limits[product];
    if (limit && totals[product] > limit) over.push(product);
  }
  return over;
}

/**
 * Finds an existing order row for this email, other than the row currently being processed.
 * Used to enforce "one entry per email": a second submission from the same address is treated
 * as an edit of their existing order rather than a brand new entry.
 *
 * @param {string} email
 * @param {number} excludeRow - 1-based row to ignore (the row Forms just appended)
 * @returns {number|null} 1-based row number of the existing order, or null if none
 */
function findExistingOrderRow(email, excludeRow) {
  var normalizedEmail = (email || '').toString().toLowerCase().trim();
  if (!normalizedEmail) return null;

  var sheet = getResponseSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  var formCols = resolveFormColumns(sheet);
  var emailValues = sheet.getRange(2, formCols.emailCol, lastRow - 1, 1).getValues();
  for (var i = 0; i < emailValues.length; i++) {
    var row = i + 2;
    if (row === excludeRow) continue;
    var rowEmail = (emailValues[i][0] || '').toString().toLowerCase().trim();
    if (rowEmail === normalizedEmail) return row;
  }
  return null;
}

/**
 * Merges a duplicate submission into the person's existing order row: copies every form-input
 * column (Timestamp through the last product/consent column) from the newly-appended row onto
 * the existing row, then deletes the duplicate row. The existing row's Token (and therefore its
 * QR code) is left untouched so a re-submission never invalidates a QR the person may already
 * have — only the order details change. Script columns (Checked In, delivered quantities) are
 * also left untouched, so an edit after pickup doesn't erase what the staff already recorded.
 *
 * @param {number} existingRow - 1-based row number of the person's existing order
 * @param {number} newRow - 1-based row number of the just-appended duplicate (always the last row)
 * @returns {string} the existing row's token, unchanged
 */
function mergeSubmissionIntoRow(existingRow, newRow) {
  var sheet = getResponseSheet();
  var cols = ensureScriptColumns(sheet);
  var lastFormCol = cols.tokenCol - 1;

  var newValues = sheet.getRange(newRow, 1, 1, lastFormCol).getValues()[0];
  sheet.getRange(existingRow, 1, 1, lastFormCol).setValues([newValues]);
  sheet.deleteRow(newRow);

  return sheet.getRange(existingRow, cols.tokenCol).getValue();
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

  var formCols = resolveFormColumns(sheet);
  var data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  var orders = [];

  for (var i = 0; i < data.length; i++) {
    orders.push(buildOrderFromRow(data[i], i + 2, cols, formCols));
  }

  return { orders: orders, serverTime: new Date().toISOString() };
}

/**
 * Marks an order as fully delivered by token (all ordered quantities). No-ops with
 * 'already_delivered' if it was already checked in — this is the fast scan/tap path, and
 * must stay safe against accidental double scans. To correct quantities on an order that's
 * already checked in (partial pickup), use setDeliveredQuantities instead.
 *
 * @param {string} token - UUID token from QR code
 * @returns {{ status: string, message: string, order: Object|null }}
 *   status: 'success' | 'already_delivered' | 'not_found'
 */
function markDeliveredByToken(token) {
  var sheet = getResponseSheet();
  var cols = ensureScriptColumns(sheet);
  var formCols = resolveFormColumns(sheet);
  var row = findRowByToken(token);

  if (!row) {
    return { status: 'not_found', message: 'Token no encontrado', order: null };
  }

  var rowData = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
  var order = buildOrderFromRow(rowData, row, cols, formCols);

  if (order.deliveredAt) {
    return {
      status: 'already_delivered',
      message: 'Ya entregado el ' + order.deliveredAt,
      order: order
    };
  }

  writeDeliveredQuantities(sheet, row, cols, order.products);
  var now = new Date().toISOString();
  sheet.getRange(row, cols.checkedInCol).setValue(now);

  var deliveredProducts = {};
  for (var p = 0; p < CONFIG.PRODUCTS.length; p++) {
    deliveredProducts[CONFIG.PRODUCTS[p]] = order.products[CONFIG.PRODUCTS[p]];
  }
  order.deliveredProducts = deliveredProducts;
  order.deliveredAt = now;

  return {
    status: 'success',
    message: 'Entrega completada',
    order: order
  };
}

/**
 * Sets the actual delivered quantity for each product on an order (partial pickup support),
 * clamped to [0, ordered qty]. Unlike markDeliveredByToken, this always applies — it's the
 * explicit "editar cantidades" action, used both to record a partial pickup and to correct
 * an already-checked-in order. Marks the order checked-in on first use if it wasn't already.
 *
 * @param {string} token - UUID token
 * @param {Object} deliveredProducts - { productName: qty }, ideally one entry per product
 * @returns {{ status: string, message: string, order: Object|null }}
 */
function setDeliveredQuantities(token, deliveredProducts) {
  var sheet = getResponseSheet();
  var cols = ensureScriptColumns(sheet);
  var formCols = resolveFormColumns(sheet);
  var row = findRowByToken(token);

  if (!row) {
    return { status: 'not_found', message: 'Token no encontrado', order: null };
  }

  var rowData = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
  var existingOrder = buildOrderFromRow(rowData, row, cols, formCols);

  var clamped = {};
  for (var p = 0; p < CONFIG.PRODUCTS.length; p++) {
    var product = CONFIG.PRODUCTS[p];
    var ordered = existingOrder.products[product] || 0;
    var qty = parseInt((deliveredProducts || {})[product], 10);
    if (isNaN(qty) || qty < 0) qty = 0;
    if (qty > ordered) qty = ordered;
    clamped[product] = qty;
  }

  writeDeliveredQuantities(sheet, row, cols, clamped);

  if (!existingOrder.deliveredAt) {
    sheet.getRange(row, cols.checkedInCol).setValue(new Date().toISOString());
  }

  var updatedRowData = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
  var order = buildOrderFromRow(updatedRowData, row, cols, formCols);

  return {
    status: 'success',
    message: 'Cantidades actualizadas',
    order: order
  };
}

/**
 * Batch processes pending deliveries and returns full order state. Each pending entry is
 * either a plain delivery ('deliver', or no type — legacy pending entries queued before this
 * feature) or an explicit quantity adjustment ('adjust').
 *
 * @param {Array} pendingDeliveries - Array of {token, localTimestamp, type, deliveredProducts}
 * @returns {{ results: Array, orders: Array, serverTime: string }}
 */
function syncDeliveries(pendingDeliveries) {
  var results = [];

  if (pendingDeliveries && pendingDeliveries.length > 0) {
    for (var i = 0; i < pendingDeliveries.length; i++) {
      var pending = pendingDeliveries[i];
      var result = pending.type === 'adjust'
        ? setDeliveredQuantities(pending.token, pending.deliveredProducts || {})
        : markDeliveredByToken(pending.token);
      result.localTimestamp = pending.localTimestamp;
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
