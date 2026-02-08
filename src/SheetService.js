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
 * Processes a check-in for the given token.
 *
 * @param {string} token - UUID token from QR code
 * @returns {{ status: string, message: string, name: string|null }}
 *   status: 'success' | 'already' | 'not_found'
 */
function checkInByToken(token) {
  var sheet = getResponseSheet();
  var cols = ensureScriptColumns(sheet);
  var row = findRowByToken(token);

  if (!row) {
    return { status: 'not_found', message: 'Token no encontrado', name: null };
  }

  // Check if already checked in
  var checkedInValue = sheet.getRange(row, cols.checkedInCol).getValue();
  if (checkedInValue) {
    var name = sheet.getRange(row, 3).getValue(); // Column C = Name
    return {
      status: 'already',
      message: 'Ya se hizo check-in el ' + checkedInValue,
      name: name
    };
  }

  // Mark as checked in
  var timestamp = new Date().toISOString();
  sheet.getRange(row, cols.checkedInCol).setValue(timestamp);

  var name = sheet.getRange(row, 3).getValue(); // Column C = Name
  return {
    status: 'success',
    message: 'Check-in completado',
    name: name
  };
}
