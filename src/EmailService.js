/**
 * Sends an email with the QR code attached inline and order summary.
 *
 * @param {string} email - Recipient email address
 * @param {string} name  - Attendee name (for personalization)
 * @param {string} token - UUID token
 * @param {Blob}   qrBlob - QR code PNG blob
 * @param {Array}  products - Array of {name, qty} (optional, for order summary)
 * @param {string} pickupDay - Pickup day string (optional)
 */
function sendQrEmail(email, name, token, qrBlob, products, pickupDay) {
  var template = HtmlService.createTemplateFromFile('EmailTemplate');
  template.name = name;
  template.eventName = CONFIG.EVENT_NAME;
  template.token = token;
  template.products = products || [];
  template.pickupDay = pickupDay || '';

  var htmlBody = template.evaluate().getContent();

  MailApp.sendEmail({
    to: email,
    subject: CONFIG.EMAIL_SUBJECT,
    htmlBody: htmlBody,
    inlineImages: {
      qrCodeImage: qrBlob
    }
  });
}
