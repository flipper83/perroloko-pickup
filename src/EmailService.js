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
  var htmlBody = renderQrEmailBody(name, token, products, pickupDay, false);

  MailApp.sendEmail({
    to: email,
    subject: CONFIG.EMAIL_SUBJECT,
    htmlBody: htmlBody,
    inlineImages: {
      qrCodeImage: qrBlob
    }
  });
}

/**
 * Sends an "order updated" email for a resubmission from someone who already had an order
 * (see findExistingOrderRow/mergeSubmissionIntoRow in SheetService.js). Uses the SAME token
 * (and therefore the same QR code image) as their original order — only the order details
 * shown in the email reflect the new submission — so a QR the person already saved or printed
 * keeps working.
 *
 * @param {string} email - Recipient email address
 * @param {string} name  - Attendee name (for personalization)
 * @param {string} token - UUID token (unchanged from the original order)
 * @param {Blob}   qrBlob - QR code PNG blob, regenerated from the same token
 * @param {Array}  products - Array of {name, qty}, the updated order
 * @param {string} pickupDay - Updated pickup day string
 */
function sendQrUpdateEmail(email, name, token, qrBlob, products, pickupDay) {
  var htmlBody = renderQrEmailBody(name, token, products, pickupDay, true);

  MailApp.sendEmail({
    to: email,
    subject: 'Updated: ' + CONFIG.EMAIL_SUBJECT,
    htmlBody: htmlBody,
    inlineImages: {
      qrCodeImage: qrBlob
    }
  });
}

/**
 * Renders the shared QR email body for both the original and the "updated" order emails.
 *
 * @param {string} name
 * @param {string} token
 * @param {Array} products
 * @param {string} pickupDay
 * @param {boolean} isUpdate
 * @returns {string} HTML body
 */
function renderQrEmailBody(name, token, products, pickupDay, isUpdate) {
  var template = HtmlService.createTemplateFromFile('EmailTemplate');
  template.name = name;
  template.eventName = CONFIG.EVENT_NAME;
  template.token = token;
  template.products = products || [];
  template.pickupDay = pickupDay || '';
  template.isUpdate = !!isUpdate;

  return template.evaluate().getContent();
}

/**
 * Notifies the person who submitted the order that it exceeds their per-product limit and
 * won't get an automatic QR — the organizer will review it manually. Sent alongside (not
 * instead of) notifyOrganizerOfLimitExceeded, so the person isn't left thinking their
 * submission silently succeeded.
 *
 * @param {string} email
 * @param {string} name
 * @param {Array<string>} overLimitProducts
 */
function notifyUserOfLimitExceeded(email, name, overLimitProducts) {
  var subject = 'We need to review your order - ' + CONFIG.EVENT_NAME;
  var body = 'Hi ' + (name || 'there') + ',\n\n' +
    'Your order at ' + CONFIG.EVENT_NAME + ' exceeds the maximum allowed per person for: ' +
    overLimitProducts.join(', ') + '.\n\n' +
    'We have not sent your QR code automatically — our team will review your order and get ' +
    'in touch with you shortly.';

  MailApp.sendEmail(email, subject, body);
}

/**
 * Notifies the organizer (the account that owns/deployed this script) that a submission
 * was flagged for manual review instead of getting its QR sent automatically, because it
 * pushed that person's combined orders over a per-product limit.
 *
 * @param {string} name
 * @param {string} email
 * @param {Array<string>} overLimitProducts
 */
function notifyOrganizerOfLimitExceeded(name, email, overLimitProducts) {
  var organizerEmail = Session.getEffectiveUser().getEmail();
  if (!organizerEmail) return;

  var subject = '⚠ Pedido pendiente de revisión - ' + CONFIG.EVENT_NAME;
  var body = 'Un pedido de ' + (name || 'un cliente') + ' (' + email + ') supera el límite ' +
    'permitido por persona en: ' + overLimitProducts.join(', ') + '.\n\n' +
    'No se le ha enviado el QR automáticamente. Revisa la pestaña de respuestas (columna ' +
    '"QR Sent" marcada como REVISAR) y decide cómo gestionarlo — contactar al cliente, ' +
    'aprobarlo a mano, etc.';

  MailApp.sendEmail(organizerEmail, subject, body);
}
