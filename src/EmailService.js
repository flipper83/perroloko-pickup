/**
 * Sends an email with the QR code attached inline.
 *
 * @param {string} email - Recipient email address
 * @param {string} name  - Attendee name (for personalization)
 * @param {string} token - UUID token
 * @param {Blob}   qrBlob - QR code PNG blob
 */
function sendQrEmail(email, name, token, qrBlob) {
  var template = HtmlService.createTemplateFromFile('EmailTemplate');
  template.name = name;
  template.eventName = CONFIG.EVENT_NAME;
  template.token = token;

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
