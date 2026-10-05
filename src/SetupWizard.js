/**
 * Menu-driven setup wizard so a new copy of this template can configure itself
 * (event name, products, pickup days, Form creation, trigger install) without
 * anyone touching code, clasp, or the Apps Script editor.
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🐕 Configurar Pickup')
    .addItem('Configurar evento', 'showSetupDialog')
    .addItem('Ver enlaces', 'showLinks')
    .addToUi();
}

/**
 * One-off migration for Forms created BEFORE this project stopped adding its own "Email"
 * question (see createEventForm below) — those Forms still have the old redundant question
 * alongside Forms' own required email box, so people got asked for their email twice. Run this
 * ONCE from the Apps Script editor (function dropdown → removeDuplicateEmailQuestion → Run) for
 * each existing event that needs it; new events created after this fix never need it.
 *
 * Refuses to run if the Form doesn't already collect email itself (form.collectsEmail()) —
 * deleting our own question in that case would leave the Form with no way to capture email at
 * all, since CONFIG.EMAIL_HEADER now points at Forms' own "Email Address" column instead.
 */
function removeDuplicateEmailQuestion() {
  var ui = SpreadsheetApp.getUi();
  var formId = PropertiesService.getScriptProperties().getProperty('FORM_ID');

  if (!formId) {
    ui.alert('No se encontró el Form de este evento (falta FORM_ID). Usa "Configurar evento" primero.');
    return;
  }

  var form = FormApp.openById(formId);

  if (!form.collectsEmail()) {
    ui.alert('Este Form no tiene activada la recogida de email de Google todavía (setCollectEmail). ' +
      'Actívala a mano en el Form (Configuración → Respuestas → "Recopilar direcciones de correo ' +
      'electrónico") antes de ejecutar esto — si no, os quedaríais sin ninguna forma de capturar ' +
      'el email.');
    return;
  }

  var items = form.getItems(FormApp.ItemType.TEXT);
  var toRemove = [];
  for (var i = 0; i < items.length; i++) {
    if (items[i].getTitle() === 'Email') toRemove.push(items[i]);
  }

  if (toRemove.length === 0) {
    ui.alert('No se encontró ninguna pregunta "Email" propia que quitar — puede que ya se haya eliminado.');
    return;
  }

  for (var j = 0; j < toRemove.length; j++) {
    form.deleteItem(toRemove[j]);
  }

  ui.alert('Listo — se ha eliminado ' + toRemove.length + ' pregunta(s) "Email" duplicada(s). ' +
    'A partir de ahora el Form solo pide el email una vez (la caja que añade Google al exigir ' +
    'inicio de sesión).');
}

function showSetupDialog() {
  var html = HtmlService.createHtmlOutputFromFile('SetupWizardDialog')
    .setWidth(480)
    .setHeight(600);
  SpreadsheetApp.getUi().showModalDialog(html, 'Configurar evento');
}

var DEPLOY_STEPS =
  'Cómo desplegar la web app (una vez por copia):\n' +
  '1. Extensions → Apps Script\n' +
  '2. Botón azul "Deploy" (arriba a la derecha) → "New deployment"\n' +
  '3. Icono de engranaje junto a "Select type" → elige "Web app"\n' +
  '4. Execute as: Me   |   Who has access: Anyone\n' +
  '5. Deploy → acepta los permisos si te los vuelve a pedir\n' +
  '6. Copia la URL que te muestra el diálogo (termina en /exec)\n' +
  '7. Vuelve a "Configurar Pickup" → "Configurar evento" y pégala en el campo\n' +
  '   "Web app URL" para confirmarla — la app NO puede detectarla sola de forma fiable.';

function showLinks() {
  var ui = SpreadsheetApp.getUi();
  var props = PropertiesService.getScriptProperties();
  var formEditUrl = props.getProperty('FORM_EDIT_URL');
  var formPublishedUrl = props.getProperty('FORM_PUBLISHED_URL');
  var webAppUrl = getWebAppUrl();

  var lines = [];
  lines.push('Web app (para el personal, escáner): ' + (webAppUrl || '(aún no desplegada)'));
  lines.push('');
  lines.push('Formulario (para compartir con clientes): ' + (formPublishedUrl || 'Aún no creado — usa "Configurar evento"'));
  lines.push('');
  lines.push('Formulario (editar preguntas): ' + (formEditUrl || '—'));
  lines.push('');
  lines.push('─────────────────────────');
  lines.push(DEPLOY_STEPS);

  ui.alert('Enlaces', lines.join('\n'), ui.ButtonSet.OK);
}

/**
 * Saves (or clears, if url is empty) the manually-confirmed web app URL. This is the
 * authoritative source for CONFIG.WEB_APP_URL — see the comment on getWebAppUrl() in
 * Config.js for why we don't trust ScriptApp.getService().getUrl() alone here.
 *
 * @param {string} url
 * @returns {string} the resulting webAppUrl (post-save)
 */
function saveWebAppUrlOverride(url) {
  url = (url || '').trim();
  if (url && !/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(url)) {
    throw new Error('Esa URL no parece la de un "Web app" de Apps Script (debe empezar por ' +
      'https://script.google.com/macros/s/ y terminar en /exec).');
  }

  var props = PropertiesService.getScriptProperties();
  if (url) {
    props.setProperty('WEB_APP_URL_OVERRIDE', url);
  } else {
    props.deleteProperty('WEB_APP_URL_OVERRIDE');
  }

  return getWebAppUrl();
}

/**
 * Returns the current configuration + status, used to pre-fill the dialog
 * and to decide whether Form creation should be offered or is already done.
 */
function getCurrentSetupState() {
  var props = PropertiesService.getScriptProperties();
  var sheet = getResponseSheet();

  return {
    eventName: CONFIG.EVENT_NAME,
    products: CONFIG.PRODUCTS,
    pickupDays: CONFIG.PICKUP_DAYS,
    hasForm: !!props.getProperty('FORM_ID'),
    formEditUrl: props.getProperty('FORM_EDIT_URL') || '',
    formPublishedUrl: props.getProperty('FORM_PUBLISHED_URL') || '',
    webAppUrl: getWebAppUrl(),
    sheetHasData: sheet.getLastRow() > 1,
    marketingConsentEnabled: CONFIG.MARKETING_CONSENT_ENABLED,
    productLimits: CONFIG.PRODUCT_LIMITS
  };
}

/**
 * Saves event configuration and, on first run, creates the Google Form wired to this
 * spreadsheet plus the form-submit trigger. Safe to call again later to update the event
 * name / products / pickup days — it will NOT create a second Form if one already exists.
 *
 * @param {string} configJson - JSON string of { eventName, products, pickupDays,
 *   addMarketingConsent, productLimits }
 * @returns {{ formEditUrl: string, formPublishedUrl: string, webAppUrl: string, createdForm: boolean, marketingConsentEnabled: boolean, productLimits: Object }}
 */
function runSetup(configJson) {
  var input = JSON.parse(configJson);
  var eventName = (input.eventName || '').trim() || 'Pickup';
  var products = (input.products || []).map(function(p) { return p.trim(); }).filter(String);
  var pickupDays = (input.pickupDays || []).map(function(d) { return d.trim(); }).filter(String);

  if (products.length === 0) throw new Error('Añade al menos un producto.');
  if (pickupDays.length === 0) throw new Error('Añade al menos un día de recogida.');

  var props = PropertiesService.getScriptProperties();
  props.setProperties({
    EVENT_NAME: eventName,
    EMAIL_SUBJECT: 'Your order confirmation - ' + eventName,
    PRODUCTS: JSON.stringify(products),
    PICKUP_DAYS: JSON.stringify(pickupDays)
  });
  CONFIG = getConfig(); // refresh in-memory config for the rest of this execution

  var createdForm = false;
  var existingFormId = props.getProperty('FORM_ID');

  if (!existingFormId) {
    // Only decided here, at Form-creation time — once the Form exists this is locked in,
    // same as the rest of the Form's questions (edit by hand in Google Forms if it needs
    // to change later). Per-product limits work the same way: the number typed here becomes
    // the Form question's own validation ceiling, which can't be retroactively updated
    // through this wizard once the Form is live.
    var addMarketingConsent = !!input.addMarketingConsent;
    var productLimits = input.productLimits || {};
    props.setProperty('MARKETING_CONSENT_ENABLED', addMarketingConsent ? 'true' : 'false');
    props.setProperty('PRODUCT_LIMITS', JSON.stringify(productLimits));
    var form = createEventForm(eventName, products, pickupDays, addMarketingConsent, productLimits);
    createdForm = true;
    CONFIG = getConfig(); // refresh again so the returned/reported state reflects it
  }

  installTrigger();

  return {
    formEditUrl: props.getProperty('FORM_EDIT_URL') || '',
    formPublishedUrl: props.getProperty('FORM_PUBLISHED_URL') || '',
    webAppUrl: getWebAppUrl(),
    createdForm: createdForm,
    marketingConsentEnabled: CONFIG.MARKETING_CONSENT_ENABLED,
    productLimits: CONFIG.PRODUCT_LIMITS
  };
}

/**
 * Builds the Google Form matching the fixed column contract (Email, Name, Pickup day,
 * then one item per product, then optionally the marketing consent checkbox) and links it
 * to this spreadsheet as the response destination.
 *
 * @param {boolean} addMarketingConsent - whether to append the opt-in consent checkbox
 * @param {Object} productLimits - { productName: maxPerPerson }, 0/missing = unlimited
 * @returns {GoogleAppsScript.Forms.Form}
 */
function createEventForm(eventName, products, pickupDays, addMarketingConsent, productLimits) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var form = FormApp.create(eventName + ' - Pedido');

  // Shows a "edit your response" link after submitting, so people have an obvious way back
  // into their own answers instead of just resubmitting the form from scratch (which also
  // works — see findExistingOrderRow/mergeSubmissionIntoRow in SheetService.js, our own
  // one-entry-per-email logic that doesn't depend on either of these two settings).
  form.setAllowResponseEdits(true);

  // Limits each signed-in respondent to a single response — Forms enforces this by requiring
  // sign-in and collecting the respondent's email itself, which it does by inserting its OWN
  // required "Email" question into the Form (landing in the Sheet as a column literally named
  // "Email Address", confirmed empirically — Apps Script has no API to make this a passive
  // verified capture instead of a fill-in box; setEmailCollectionType/EmailCollectionType don't
  // exist on FormApp, this free-text box is the only outcome setCollectEmail(true) can produce).
  // We deliberately do NOT also add our own "Email" question below (that used to exist here) —
  // it would just be a second, redundant email box asking the same thing. Every sheet read in
  // this project resolves columns by HEADER TEXT rather than fixed position (see
  // resolveFormColumns in SheetService.js) precisely so pointing CONFIG.EMAIL_HEADER at Forms'
  // own "Email Address" column, instead of shifting our own fixed-position reads, is safe.
  form.setCollectEmail(true);
  form.setLimitOneResponsePerUser(true);

  form.addTextItem()
    .setTitle('Nombre')
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('Día de recogida')
    .setChoiceValues(pickupDays)
    .setRequired(true);

  for (var i = 0; i < products.length; i++) {
    var limit = (productLimits && productLimits[products[i]]) || 0;
    var validation = limit > 0
      ? FormApp.createTextValidation().requireNumberBetween(0, limit).build()
      : FormApp.createTextValidation().requireNumberGreaterThanOrEqualTo(0).build();
    var helpText = limit > 0
      ? 'Cantidad — máximo ' + limit + ' por persona (deja en blanco o pon 0 si no quieres este producto)'
      : 'Cantidad (deja en blanco o pon 0 si no quieres este producto)';

    form.addTextItem()
      .setTitle(products[i])
      .setHelpText(helpText)
      .setValidation(validation);
  }

  // Optional, unchecked-by-default opt-in — never required, since consent for marketing
  // emails must be freely given and can't be bundled with getting the order picked up.
  if (addMarketingConsent) {
    var consentText = 'Quiero recibir comunicaciones y novedades de ' + eventName + ' por email';
    form.addCheckboxItem()
      .setTitle(consentText)
      .setChoiceValues([consentText])
      .setRequired(false);
  }

  var sheetNamesBefore = ss.getSheets().map(function(s) { return s.getName(); });
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  SpreadsheetApp.flush();

  // Linking the Form to the Sheet happens through a different service (Forms), so the new
  // tab isn't always visible yet via a cached SpreadsheetApp reference. Re-open fresh and
  // retry briefly - this is a known cross-service consistency gap in Apps Script.
  var newSheet = null;
  for (var attempt = 0; attempt < 5 && !newSheet; attempt++) {
    if (attempt > 0) Utilities.sleep(500);
    var freshSheets = SpreadsheetApp.openById(ss.getId()).getSheets();
    for (var j = 0; j < freshSheets.length; j++) {
      if (sheetNamesBefore.indexOf(freshSheets[j].getName()) === -1) {
        newSheet = freshSheets[j];
        break;
      }
    }
  }

  // Default to CONFIG.SHEET_NAME, but if that name is already taken by another sheet
  // (e.g. testing on a copy that still has old response data under that name), keep
  // whichever name Forms auto-generated instead of crashing on a duplicate-name rename.
  var finalSheetName = CONFIG.SHEET_NAME;
  if (newSheet) {
    var nameTaken = sheetNamesBefore.indexOf(CONFIG.SHEET_NAME) !== -1;
    if (nameTaken) {
      finalSheetName = newSheet.getName();
    } else {
      newSheet.setName(CONFIG.SHEET_NAME);
    }
  }

  PropertiesService.getScriptProperties().setProperties({
    FORM_ID: form.getId(),
    FORM_EDIT_URL: form.getEditUrl(),
    FORM_PUBLISHED_URL: form.getPublishedUrl(),
    SHEET_NAME: finalSheetName
  });

  return form;
}
