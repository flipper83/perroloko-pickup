/**
 * Creates an installable trigger for form submissions.
 * Run this function ONCE from the Apps Script editor.
 */
function installTrigger() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Remove existing onFormSubmit triggers to avoid duplicates
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'onFormSubmit') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  ScriptApp.newTrigger('onFormSubmit')
    .forSpreadsheet(ss)
    .onFormSubmit()
    .create();

  Logger.log('Trigger installed successfully for spreadsheet: ' + ss.getName());
}

/**
 * Handles form submission events.
 * Orchestrates: read data -> generate token -> fetch QR -> send email -> write to sheet.
 *
 * @param {Object} e - Form submit event object
 */
function onFormSubmit(e) {
  var sheet = getResponseSheet();
  var row = e.range.getRow();

  // Read submitted data using explicit column indices (0-based for e.values[])
  var email = e.values[CONFIG.COL_EMAIL - 1] || '';
  var name = e.values[CONFIG.COL_NAME - 1] || '';
  var pickupDay = (e.values[CONFIG.COL_PICKUP_DAY - 1] || '').toString().toLowerCase();

  // Read product quantities
  var products = [];
  for (var i = 0; i < CONFIG.PRODUCTS.length; i++) {
    var qty = parseInt(e.values[CONFIG.PRODUCT_START_COL - 1 + i], 10) || 0;
    products.push({ name: CONFIG.PRODUCTS[i], qty: qty });
  }

  var token = generateToken();

  try {
    var qrBlob = generateQrCode(token);
    sendQrEmail(email, name, token, qrBlob, products, pickupDay);
    writeTokenToSheet(row, token, 'YES');
    Logger.log('QR sent successfully to ' + email + ' (token: ' + token + ')');
  } catch (error) {
    Logger.log('Error processing submission for ' + email + ': ' + error.message);
    writeTokenToSheet(row, token, 'ERROR: ' + error.message);
  }
}
