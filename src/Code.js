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
 * Orchestrates: read data -> merge into existing order if this email already has one (else
 * generate a new token) -> fetch QR -> send email (new or "updated") -> write to sheet.
 *
 * @param {Object} e - Form submit event object
 */
function onFormSubmit(e) {
  var newRow = e.range.getRow();
  var sheet = getResponseSheet();

  // Read the appended row straight from the sheet, by header-resolved column (see
  // resolveFormColumns in SheetService.js), rather than from e.values by fixed position.
  // Form.setLimitOneResponsePerUser(true) (see SetupWizard.js) makes Forms require sign-in and
  // insert its own verified-email column into the sheet — and it isn't documented whether that
  // also shifts e.values the same way, so e.values isn't trustworthy here anymore. Reading the
  // row directly means we only ever depend on one source of truth for column positions.
  var rowValues = sheet.getRange(newRow, 1, 1, sheet.getLastColumn()).getValues()[0];
  var formCols = resolveFormColumns(sheet);

  var email = rowValues[formCols.emailCol - 1] || '';
  var name = rowValues[formCols.nameCol - 1] || '';
  var pickupDay = (rowValues[formCols.pickupDayCol - 1] || '').toString().toLowerCase();

  // Read product quantities
  var products = [];
  for (var i = 0; i < CONFIG.PRODUCTS.length; i++) {
    var product = CONFIG.PRODUCTS[i];
    var qty = parseInt(rowValues[formCols.productCols[product] - 1], 10) || 0;
    products.push({ name: product, qty: qty });
  }

  // One entry per email: if this address already has an order, this submission is an edit of
  // it, not a new one. Merge the new answers into the existing row (keeping its token, so the
  // QR the person may already have stays valid) and drop the duplicate row Forms just appended.
  var existingRow = findExistingOrderRow(email, newRow);
  var isEdit = existingRow !== null;
  var row = isEdit ? existingRow : newRow;
  var token = isEdit ? mergeSubmissionIntoRow(existingRow, newRow) : generateToken();

  // Google Forms can only validate a single submission's own field values (that's what
  // caps a single order at CONFIG.PRODUCT_LIMITS via the Form's own question validation,
  // see SetupWizard.js createEventForm) — it can't see this person's prior submissions. Now
  // that every email collapses to a single row, this mainly guards against someone bypassing
  // the Form's own validation (e.g. a limit lowered after their row already existed) rather
  // than the multi-submission split this originally targeted — hence checking it on edits too.
  var overLimitProducts = findOverLimitProducts(email);
  if (overLimitProducts.length > 0) {
    writeTokenToSheet(row, token, 'REVISAR: supera límite de ' + overLimitProducts.join(', '));
    notifyOrganizerOfLimitExceeded(name, email, overLimitProducts);
    notifyUserOfLimitExceeded(email, name, overLimitProducts);
    Logger.log('Submission flagged for review (over limit: ' + overLimitProducts.join(', ') + '): ' + email);
    return;
  }

  try {
    var qrBlob = generateQrCode(token);
    if (isEdit) {
      sendQrUpdateEmail(email, name, token, qrBlob, products, pickupDay);
    } else {
      sendQrEmail(email, name, token, qrBlob, products, pickupDay);
    }
    writeTokenToSheet(row, token, 'YES');
    Logger.log((isEdit ? 'Updated QR' : 'QR') + ' sent successfully to ' + email + ' (token: ' + token + ')');
  } catch (error) {
    Logger.log('Error processing submission for ' + email + ': ' + error.message);
    writeTokenToSheet(row, token, 'ERROR: ' + error.message);
  }
}
