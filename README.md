# Pickup - QR Order Check-in System

Automated pre-order pickup system: customers submit a Google Form, receive an email with a
unique QR code, and staff scan QR codes at the venue using a web-based scanner (works offline
once loaded — see `src/PickupApp.html`).

## How It Works

```
Form Submit → Generate UUID → Fetch QR image → Send email with QR → Write token to Sheet
                                                                            ↓
Staff opens Web App → Scans QR → Looks up token in Sheet → Marks delivered → Shows result
```

The whole thing is one Google Sheet with a bound Apps Script project. That's the unit of
reuse: **to run this for a new company or a new year, someone makes their own copy of a
template Sheet** — no code, no clasp, no git needed on their end.

## For a new client / new event (no code required)

1. Open the template's shareable link and choose **"Hacer una copia"** (or, if you only have
   the normal `.../edit` link, replace the end with `/copy` — see below). This creates a fully
   independent Sheet in their own Drive, with its own copy of the bound Apps Script.
2. Open the new Sheet. A menu **"🐕 Configurar Pickup"** appears automatically.
3. **Configurar Pickup → Configurar evento**: set the event name, the list of products, and
   the list of pickup days, then click **Crear evento**. The first time this runs it will ask
   for permission (Google OAuth) — that's expected, accept it. This step:
   - Creates the Google Form (wired to collect responses into this same Sheet)
   - Installs the form-submit trigger
   - Saves the configuration
4. **One manual step that can't be automated**: in the Sheet, go to **Extensions → Apps
   Script → Deploy → New deployment → Web app** (Execute as: *Me*, Who has access: *Anyone*),
   then click Deploy. This is a one-time step per copy.
5. **Configurar Pickup → Ver enlaces** to grab:
   - The **Form** link, to share with customers
   - The **Web app** link, for staff to open/bookmark on their phones and use the scanner

Don't re-run "Configurar evento" expecting a brand new Form on a copy that already has one —
running it again only updates the event name/products/days, it will not create a second Form
(this is intentional, to avoid duplicate Forms). For a genuinely new event, make a fresh copy
of the template instead.

## For the maintainer (this repo)

This repo is the source of truth, developed and pushed via `clasp` as usual:

```bash
npm install
npx clasp login
cp .clasp.json.example .clasp.json   # set scriptId to whichever instance you're targeting
npm run push
```

Keep one clean **template** Sheet (generic name, no real data, sharing set to "Anyone with
the link: Viewer") with this code pushed to its bound script. Hand it out via:

```
https://docs.google.com/spreadsheets/d/TEMPLATE_FILE_ID/copy
```

(swap the trailing `/edit...` for `/copy` on the normal share URL). Anyone who opens that link
gets prompted to make their own independent copy — container-bound scripts, triggers,
properties and deployments are all separate per copy.

To work on a *specific* existing instance (e.g. the live Perroloko deployment, or a
particular client's copy), point `.clasp.json`'s `scriptId` at that instance's script ID
(Extensions → Apps Script → Project Settings, in that Sheet) before pushing.

### The real template (`perroloko-pickup-template/`)

The distributable template already exists. It is a separate Sheet + bound script in
flipper83's Drive, and **not** the live Perroloko production instance:

| | |
|---|---|
| Template Sheet ID | `1a8cXznGcU0RSu4rTkfHtIW52GAU12L1_-Vc_Urf7E3E` |
| Template Script ID | `1yx8S9OHnSecLOLsKMb8TSF3-uae642p0QWdDUjaffywYttiIfx56AYt-` |
| Edit | https://docs.google.com/spreadsheets/d/1a8cXznGcU0RSu4rTkfHtIW52GAU12L1_-Vc_Urf7E3E/edit |
| Share this (copy link) | https://docs.google.com/spreadsheets/d/1a8cXznGcU0RSu4rTkfHtIW52GAU12L1_-Vc_Urf7E3E/copy |

It is intentionally left empty: there's no Form and no Script Properties, and the wizard has
never been run. Each person who copies it runs "🐕 Configurar Pickup" themselves. For the
`/copy` link to work for others, sharing must be set to "Anyone with the link → Viewer".

Locally, it lives in a sibling folder, `../perroloko-pickup-template/`. That folder is **not**
a git repo. Its `src/` is just a mirror of this repo's `src/`, and the only file of its own is
`.clasp.json`, which points at the template script. Keeping it in its own folder means a
push there can never hit the live production script by accident.

**Keeping it in sync** (after each change to production; it only needs `push`, never
`deploy`, because each client deploys their own copy):

```bash
cp src/*.js src/*.html src/appsscript.json ../perroloko-pickup-template/src/
cd ../perroloko-pickup-template && npx -y @google/clasp push --force
```

**If the folder is lost**, recreate it from the template script:

```bash
mkdir ../perroloko-pickup-template && cd ../perroloko-pickup-template
npx -y @google/clasp clone 1yx8S9OHnSecLOLsKMb8TSF3-uae642p0QWdDUjaffywYttiIfx56AYt- --rootDir src
```

(or create `.clasp.json` by hand with that `scriptId` and `"rootDir": "src"`, then copy `src/`
from this repo).

### Config storage

There is no `Config.js` to hand-edit per instance anymore. All per-instance settings
(event name, products, pickup days, web app URL) live in that script's **Script Properties**,
managed through the setup wizard. `src/Config.js` just reads them with sensible defaults, so
`git` only ever tracks the shared code, never instance data.

## Verify Everything Works (after setting up a new instance)

1. **Submit a test entry** on the Form → check the linked response sheet has a `Token` column
   filled + `QR Sent = YES`
2. **Check the email** → QR code should be visible inline, with the right event name
3. **Open the web app URL on a phone** → tap "Iniciar Camara" to start the scanner
4. **Scan the QR from the email** → green "Entrega completada" + name
5. **Scan the same QR again** → yellow "Ya entregado" warning
6. **Type a random token** → red "Token no encontrado" error

## Project Structure

```
perroloko-pickup/
├── .clasp.json                # Clasp config (your script ID) - gitignored
├── .claspignore                # Files excluded from push
├── package.json                # npm project + clasp scripts
└── src/
    ├── appsscript.json         # Apps Script manifest (scopes, webapp config)
    ├── Code.js                 # Form submit handling: installTrigger(), onFormSubmit(e)
    ├── Config.js               # Reads Script Properties into the CONFIG object, with defaults
    ├── SetupWizard.js           # Custom menu + setup dialog server logic (Form creation, etc.)
    ├── SetupWizard.html         # Setup dialog UI
    ├── TokenService.js          # UUID token generation
    ├── QrService.js             # QR code generation via api.qrserver.com
    ├── EmailService.js          # Email sending with inline QR
    ├── EmailTemplate.html       # HTML email template
    ├── SheetService.js          # Sheet read/write operations
    ├── WebApp.js                # Web app request handler (serves PickupApp.html)
    └── PickupApp.html           # Staff SPA: order list, scanner, stock, offline sync
```

## Useful Commands

| Command | Description |
|---------|-------------|
| `npm run push` | Push local files to Apps Script |
| `npm run pull` | Pull remote changes to local |
| `npm run deploy` | Create a new deployment |
| `npm run open` | Open the script editor in browser |
| `npm run logs` | View execution logs |

## Limits

- **MailApp**: 100 emails/day (free Gmail), 1,500/day (Google Workspace) — per instance
- **UrlFetchApp**: 20,000 calls/day — per instance
- **Script runtime**: 6 minutes per execution (more than enough for single submissions)

## Troubleshooting

- **QR Sent = ERROR in the sheet**: Check the error message in that cell. Common causes: email quota exceeded, invalid email address.
- **Scanner camera not working / "Error getting userMedia, NotAllowedError"**: as of 2026-02-23 this is a known, unresolved Google Apps Script platform bug, not something in this project's code — Apps Script's iframe sandbox stopped granting `camera` permission to the web app's content, so `getUserMedia()` (live camera) is blocked for every Apps Script web app, in every browser, regardless of device/site permission settings. Confirmed reproducible across Chrome, Opera and Firefox, on multiple devices, with camera working fine on any non-Apps-Script site (e.g. Google Meet) on the same device — this isolates it to Apps Script's serving, not local settings. Tracked upstream at [issuetracker.google.com/issues/486623612](https://issuetracker.google.com/issues/486623612) (no fix yet). **Workaround already implemented**: the "Escanear" tab has a "Hacer Foto al QR" button that takes a photo with the native camera app and decodes the QR from the still image via `Html5Qrcode.scanFile()`, which doesn't call `getUserMedia()` and isn't affected by this restriction. Use it instead of "Iniciar Camara" until Google fixes the platform bug.
- **Trigger not firing**: Run **Configurar Pickup → Configurar evento** again (it reinstalls the trigger), or run `installTrigger()` manually from the script editor. Check **Triggers** in the left sidebar to verify it exists.
- **Web app link shows "Aún no desplegado"**: you haven't done the one manual Deploy step yet (see step 4 above).
- **"Configurar Pickup" menu doesn't appear**: reload the Sheet tab; the menu is added by an `onOpen` trigger that runs when the Sheet is opened.
- **"No se puede abrir el archivo en estos momentos" / "Sorry, unable to open the file at this time" on mobile, but the same link works fine on PC or for the owner**: this is a known Apps Script limitation, not a bug in this project — web apps don't support multi-login. If the phone has 2+ Google accounts signed into the browser, Google may rewrite the URL to insert `/u/1/` or `/u/2/` while resolving which account to use, and mobile browsers' privacy protections can break that redirect. Confirm by opening the same link in an incognito/private tab — if it loads there, this is it. Fix on the affected phone: sign out of extra Google accounts in that browser, or always open the link in an incognito/private tab.
