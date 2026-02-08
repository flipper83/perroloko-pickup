/**
 * Generates a QR code image for the given token.
 * The QR encodes the full check-in URL so any phone camera can open it.
 *
 * @param {string} token - UUID token
 * @returns {Blob} PNG image blob of the QR code
 */
function generateQrCode(token) {
  var checkinUrl = CONFIG.WEB_APP_URL + '?token=' + token;
  var qrUrl = CONFIG.QR_API_BASE
    + '?size=' + CONFIG.QR_SIZE
    + '&data=' + encodeURIComponent(checkinUrl);

  var response = UrlFetchApp.fetch(qrUrl);
  return response.getBlob().setName('qr-' + token + '.png');
}
