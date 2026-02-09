# Perroloko Pickup - QR Check-in System

Automated event check-in system: attendees submit a Google Form, receive an email with a unique QR code, and event staff scan QR codes at the venue using a web-based scanner.

## How It Works

```
Form Submit → Generate UUID → Fetch QR image → Send email with QR → Write token to Sheet
                                                                            ↓
Staff opens Web App → Scans QR → Looks up token in Sheet → Marks checked-in → Shows result
```

- **Green**: Check-in successful (shows attendee name)
- **Yellow**: Already checked in (shows when)
- **Red**: Token not found

## Prerequisites

- A Google account (Gmail or Workspace)
- Node.js 14+ installed
- npm installed

## Setup

### 1. Create the Google Form

1. Go to [Google Forms](https://forms.google.com) and create a new form
2. Add at least these fields (in this order):
   - **Email** (use the built-in "Collect email addresses" setting, or add an email question)
   - **Name** (short answer)
   - Add any other fields you need
3. Go to **Responses** tab → click the Google Sheets icon to create a linked spreadsheet
4. Note: the sheet columns should be: `Timestamp | Email | Name | ...`

### 2. Create the Apps Script project

1. Open the linked Google Sheet
2. Go to **Extensions → Apps Script**
3. This opens the script editor. Copy the **Script ID** from the URL:
   ```
   https://script.google.com/macros/d/SCRIPT_ID_HERE/edit
   ```

### 3. Clone and configure this project

```bash
git clone <this-repo>
cd perroloko-pickup
npm install
```

Copy the example configs:

```bash
cp .clasp.json.example .clasp.json
cp src/Config.js.example src/Config.js
```

Edit `.clasp.json` and replace the `scriptId` with yours:

```json
{
  "scriptId": "YOUR_SCRIPT_ID_HERE",
  "rootDir": "src"
}
```

### 4. Log in to clasp

```bash
npx clasp login
```

This opens a browser for Google OAuth. Authorize with the same account that owns the Sheet.

### 5. Enable the Apps Script API

Go to https://script.google.com/home/usersettings and toggle the **Google Apps Script API** to **ON**.

### 6. First deploy

```bash
npm run push
npx clasp deploy -d "v1"
```

Copy the deployment ID from the output (the long string starting with `AKfycb...`).

Your web app URL is:
```
https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
```

### 7. Set the web app URL

Edit `src/Config.js` and replace the `WEB_APP_URL` value:

```js
WEB_APP_URL: 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec'
```

Push and redeploy with the same deployment ID:

```bash
npm run push
npx clasp deploy -i YOUR_DEPLOYMENT_ID -d "v2 - with web app URL"
```

### 8. Configure the sheet name

If your form responses sheet is not named `Form Responses 1`, update `SHEET_NAME` in `src/Config.js` to match your sheet tab name.

### 9. Install the form trigger

1. Run `npx clasp open` to open the script editor
2. In the function dropdown (top bar), select **`installTrigger`**
3. Click **Run**
4. When prompted, click **Review Permissions** → select your account → **Allow**

This creates the trigger that fires on every form submission.

## Customization

Edit `src/Config.js` to change:

| Setting | Description |
|---------|-------------|
| `EVENT_NAME` | Event name shown in emails and the scanner UI |
| `EMAIL_SUBJECT` | Subject line of the QR email |
| `SHEET_NAME` | Name of the sheet tab with form responses |
| `QR_SIZE` | QR code image size (default `300x300`) |

Edit `src/EmailTemplate.html` to customize the email design and text.

## Verify Everything Works

1. **Submit a test form** → check the Sheet has a `Token` column filled + `QR Sent = YES`
2. **Check your email** → QR code should be visible inline
3. **Open the web app URL on your phone** → tap "Iniciar Camara" to start the scanner
4. **Scan the QR from the email** → green "Check-in completado" + attendee name
5. **Scan the same QR again** → yellow "Ya se hizo check-in" warning
6. **Type a random token** → red "Token no encontrado" error

## Project Structure

```
perroloko-pickup/
├── .clasp.json               # Clasp config (your script ID)
├── .claspignore               # Files excluded from push
├── package.json               # npm project + clasp scripts
└── src/
    ├── appsscript.json        # Apps Script manifest (scopes, webapp config)
    ├── Code.js                # Entry point: installTrigger(), onFormSubmit(e)
    ├── Config.js              # All configuration constants
    ├── TokenService.js        # UUID token generation
    ├── QrService.js           # QR code generation via api.qrserver.com
    ├── EmailService.js        # Email sending with inline QR
    ├── EmailTemplate.html     # HTML email template
    ├── SheetService.js        # Sheet read/write operations
    ├── WebApp.js              # Web app request handler
    └── CheckinPage.html       # Scanner UI (html5-qrcode + manual input)
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

- **MailApp**: 100 emails/day (free Gmail), 1,500/day (Google Workspace)
- **UrlFetchApp**: 20,000 calls/day
- **Script runtime**: 6 minutes per execution (more than enough for single submissions)

## Troubleshooting

- **QR Sent = ERROR in the sheet**: Check the error message in that cell. Common causes: email quota exceeded, invalid email address.
- **Scanner camera not working**: Make sure you're accessing the web app via HTTPS and have granted camera permissions.
- **Trigger not firing**: Run `installTrigger()` again from the script editor. Check **Triggers** in the left sidebar to verify it exists.
- **"Form Responses 1" not found**: Update `SHEET_NAME` in `Config.js` to match your actual sheet tab name.
