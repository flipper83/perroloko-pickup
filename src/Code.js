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

  // Read submitted data
  var email = e.namedValues['Email']
    ? e.namedValues['Email'][0]
    : e.values[1]; // Column B fallback
  var name = e.namedValues['Name']
    ? e.namedValues['Name'][0]
    : e.values[2]; // Column C fallback

  var token = generateToken();

  try {
    var qrBlob = generateQrCode(token);
    sendQrEmail(email, name, token, qrBlob);
    writeTokenToSheet(row, token, 'YES');
    Logger.log('QR sent successfully to ' + email + ' (token: ' + token + ')');
  } catch (error) {
    Logger.log('Error processing submission for ' + email + ': ' + error.message);
    writeTokenToSheet(row, token, 'ERROR: ' + error.message);
  }
}
