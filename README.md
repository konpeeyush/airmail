# Email Composer

An email sending system with two parts:

- **Backend:** a REST API (Node.js + Express) that sends email over SMTP to one or more recipients, with CC/BCC, HTML or plain-text bodies, and file attachments. It validates every input, handles provider failures safely, and never crashes on bad requests.
- **Frontend:** a Next.js app that lets you write an email, attach files, send it, and see a clear success or error message.

It runs with **no setup**. If no SMTP server is configured, the API creates a throwaway [Ethereal](https://ethereal.email) inbox, which accepts mail without delivering it. Every send then returns a link where you can view the email exactly as it would arrive.

---

## Contents

- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [How it works](#how-it-works)
- [API reference](#api-reference)
- [Testing](#testing)
- [Project structure](#project-structure)
- [Assumptions and trade-offs](#assumptions-and-trade-offs)

---

## Quick start

**Requirements:** Node.js 20.9 or newer. pnpm is set up through Corepack, which ships with Node.

```bash
git clone <repo-url> email-composer
cd email-composer

corepack enable      # installs the pnpm version pinned in package.json
pnpm install         # installs backend and frontend (one workspace)
pnpm dev             # starts both apps
```

| App | URL |
|---|---|
| Frontend | http://localhost:3000 |
| API | http://localhost:4000 (health check: `/api/health`) |

Open the frontend, fill in the form, and click **Send email**. With the default setup, the success toast has a **View** button that opens the email in the Ethereal test inbox.

Other commands (run from the repo root):

```bash
pnpm test                         # backend test suite (42 tests)
pnpm --filter backend start       # API only, without auto-restart
pnpm --filter frontend build      # production build of the frontend
```

### Sending real email

Copy `backend/.env.example` to `backend/.env` and fill in the SMTP settings. For Gmail:

1. Turn on 2-Step Verification for the Google account.
2. Create an **App Password** (Google Account → Security → App passwords).
3. Set:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=you@gmail.com
   SMTP_PASS=<the 16-character app password>
   MAIL_FROM="Email Composer <you@gmail.com>"
   ```

Any SMTP provider works the same way (Brevo, SendGrid, Mailgun, Amazon SES).

---

## Environment variables

Both apps work without any `.env` file. Every variable has a development default.

### Backend: `backend/.env`

Settings are validated with zod when the server starts. A missing or malformed value stops the server with a readable message, rather than failing later in the middle of a request.

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | `development`, `production` or `test` |
| `PORT` | `4000` | API port. Not 5000, because macOS AirPlay Receiver uses that port. |
| `CORS_ORIGIN` | `http://localhost:3000` | The frontend origin allowed to call the API |
| `SMTP_HOST` | *(empty)* | SMTP server. **Empty in development = Ethereal test inbox. Required in production.** |
| `SMTP_PORT` | `587` | SMTP port |
| `SMTP_SECURE` | `true` only if port is 465 | Use TLS from the start of the connection (implicit TLS) |
| `SMTP_USER` | none | SMTP username. Required when `SMTP_HOST` is set. |
| `SMTP_PASS` | none | SMTP password or app password. Required when `SMTP_HOST` is set. |
| `MAIL_FROM` | `SMTP_USER` | Sender shown to recipients, e.g. `"Name <you@example.com>"` |
| `MAX_FILE_SIZE_MB` | `5` | Maximum size of each attachment |
| `MAX_FILES` | `5` | Maximum number of attachments |
| `MAX_TOTAL_SIZE_MB` | `15` | Maximum size of all attachments together |
| `RATE_LIMIT_MAX` | `20` | Emails one IP address can send per window |
| `RATE_LIMIT_WINDOW_MINUTES` | `15` | Length of the rate-limit window |

### Frontend: `frontend/.env.local`

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | Where the API runs. This value is built into the browser code, so never put a secret here. |

`.env` files are ignored by git. Only the `.env.example` files are committed.

---

## How it works

```
┌───────────────────────────┐   multipart/form-data    ┌──────────────────────────────────────────┐
│ Frontend (Next.js)        │  POST /api/emails        │ API (Express)                            │
│                           │ ───────────────────────▶ │                                          │
│ compose form              │                          │ helmet · cors · request log (morgan)     │
│  └ client-side validation │                          │ rate limit ─────────────▶ 429            │
│    (same rules as the API)│                          │ upload (multer, memory) ▶ 413/415/400    │
│                           │                          │ validate (zod) ─────────▶ 400 + fields   │
│ shows success / error,    │ ◀─────────────────────── │ controller: builds the email             │
│ maps field errors back    │  { success, message,     │ service: nodemailer ────▶ 502 on failure │
│ onto the inputs           │    data | errors }       │ central error handler (one JSON shape)   │
└───────────────────────────┘                          └──────────────────┬───────────────────────┘
                                                                          │ SMTP
                                                                          ▼
                                                       Ethereal (dev) or any SMTP provider
```

**What happens on each request**

1. **Rate limit.** Each IP address gets a limited number of sends. This runs first, so a blocked client's files are never read.
2. **Upload.** multer reads the form data into memory and checks each file's size, the number of files, and the file type. Both the extension and the MIME type must be on the allowlist. It then checks the total size of all files.
3. **Validate.** A zod schema cleans up and checks the text fields:
   - recipients are split on `,` or `;`, trimmed, lowercased and deduplicated, including across To, Cc and Bcc
   - every address must be valid, and there must be at least one recipient
   - subject and body must not be empty, and the subject can't contain line breaks (which blocks header injection)
   - there are limits on subject length, body length and the total number of recipients
4. **Controller.** Turns the cleaned input into an email. HTML bodies also get a plain-text version generated from the HTML.
5. **Service.** Sends the email through one reused nodemailer connection setup, with connection timeouts. Any provider error becomes a **502** with a safe message; the real cause is only written to the server log.
6. **Error handler.** Every error, expected or not, becomes `{ success: false, message, errors? }` with the right status code. In production, unexpected errors return a generic message.

**Crash safety.** Express 5 passes errors from async route handlers to the error handler automatically. An unhandled promise rejection is logged and the server keeps running. An uncaught exception is logged and triggers a graceful shutdown, because the process state can no longer be trusted. The server also shuts down cleanly on `SIGINT`/`SIGTERM`.

**Frontend.** The form checks the same rules as the API, so problems show up instantly: files are checked as soon as they're picked, a field's error appears when you leave a field you've edited, and from then on it updates as you type. **Send** stays disabled until To, Subject and Message have content, with a hint saying what's missing. The server still has the final say. When the API returns a 400, each error is shown under its field and focus moves to the first one. While an email is sending, every control is disabled, which also prevents double submits. After a successful send, the form clears and a success toast appears, with a **View** button for the Ethereal preview. Errors stay inline under the form, because they need to stay visible while the user fixes things.

**Sound.** Small interface sounds give feedback on actions, using the same `@web-kits/audio` set as konpeeyush.me. They're synthesised with the Web Audio API, so there are no audio files, and they only play in response to something the user did:

| Action | Sound |
|---|---|
| Clicking into a field | a soft tick (not on keyboard focus, and not when clicking inside the field you're already typing in) |
| Plain text ↔ HTML | tab switch |
| Showing / removing Cc or Bcc | expand / collapse |
| Attach files, files added, file removed | click, select, deselect |
| Send | send, then success or error when the API answers |
| An inline error appearing when you leave a field | error (once per new error, never while typing) |
| Send with remaining problems, or a refused file | warning |

---

## API reference

### `POST /api/emails`

Accepts **`multipart/form-data`** (needed for attachments) or **`application/json`** (no attachments).

| Field | Type | Required | Notes |
|---|---|---|---|
| `to` | string or string[] | yes | Comma- or semicolon-separated, or repeated fields |
| `cc` | string or string[] | no | Same format as `to` |
| `bcc` | string or string[] | no | Same format as `to` |
| `subject` | string | yes | 1–255 characters, no line breaks |
| `body` | string | yes | 1–100,000 characters |
| `isHtml` | boolean or `"true"`/`"false"` | no | Default `false`. HTML bodies are sent with a plain-text copy. |
| `attachments` | file(s) | no | Multipart only. Allowed types: pdf, png, jpg, jpeg, gif, webp, txt, csv, docx, xlsx, zip. |

```bash
curl -X POST http://localhost:4000/api/emails \
  -F to="alice@example.com, bob@example.com" \
  -F cc=carol@example.com \
  -F subject="Quarterly report" \
  --form-string 'body=<h1>Hello</h1><p>Report attached.</p>' \
  -F isHtml=true \
  -F "attachments=@report.pdf;type=application/pdf"
```

> Use `--form-string` for HTML bodies. `curl -F` treats a value starting with `<` as a file to read.

**200 OK**

```json
{
  "success": true,
  "message": "Email sent to 3 recipient(s)",
  "data": {
    "messageId": "<…@ethereal.email>",
    "accepted": ["alice@example.com", "bob@example.com", "carol@example.com"],
    "rejected": [],
    "attachments": 1,
    "previewUrl": "https://ethereal.email/message/…"
  }
}
```

`previewUrl` is only included when the API is using Ethereal. If the provider accepts the email but refuses some addresses, those addresses are listed in `rejected` and the message says so.

**Errors** all use one shape:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    { "field": "to", "message": "\"bob@\" is not a valid email address" },
    { "field": "subject", "message": "Subject is required" }
  ]
}
```

| Status | When |
|---|---|
| `400` | Validation failed (`errors` lists each field), malformed JSON, too many files, an empty file, or files sent in the wrong field |
| `404` | Unknown route |
| `413` | One file is over `MAX_FILE_SIZE_MB`, or all files together are over `MAX_TOTAL_SIZE_MB` |
| `415` | A file's type isn't allowed |
| `429` | Rate limit reached. `RateLimit-*` headers say when to retry. |
| `502` | The SMTP provider failed (bad credentials, timeout, rejected message) |
| `500` | An unexpected error. Details are logged; production returns a generic message. |

### `GET /api/health`

`200 { "success": true, "message": "ok" }`

`backend/requests.http` has a ready-made request for every case above. You can run them from VS Code (REST Client extension) or a JetBrains IDE.

---

## Testing

```bash
pnpm test
```

There are 42 backend tests (vitest + supertest), in three files:

- **`tests/emails.test.js`** sends real HTTP requests to the app and covers:
  - successful sends: plain text, HTML with the generated text part, recipient cleanup, attachments, partially rejected recipients
  - every 400 validation case
  - attachment errors: 413 (file and total), 415 (type and MIME mismatch), 400 (count, empty file, wrong field)
  - a provider failure returning a 502 that doesn't leak the provider's error, with the API still working afterwards
- **`tests/email.schema.test.js`** tests the validation schema on its own.
- **`tests/rateLimit.test.js`** checks the 429 response.

The tests fake **nodemailer**, not the app's own email service, so the service's real code runs in every test. They set tiny file limits and never touch the network, so they don't depend on anyone's `.env`.

The frontend was tested by hand in a browser: a successful send with attachments (checked in the delivered Ethereal message), server field errors, a real 429, and the API being down.

---

## Project structure

```
backend/
  src/
    server.js                   starts the server, shutdown, process-level errors
    app.js                      builds the Express app (importable by tests)
    config/env.js               env loading + zod validation at startup
    routes/                     /api/health, /api/emails
    middleware/
      rateLimit.js              per-IP limit on sending
      upload.js                 multer: limits, type allowlist, error mapping
      validate.js               generic zod validation → 400
      errorHandler.js           404 + central error → JSON
    validators/email.schema.js  request schema (recipients, subject, body, isHtml)
    controllers/                HTTP ↔ email, HTML → text fallback
    services/email.service.js   nodemailer transport, Ethereal fallback, 502 mapping
    utils/AppError.js           error class for client-facing errors
  tests/                        vitest + supertest
  requests.http                 manual API requests
frontend/
  app/                          layout, page, theme (globals.css)
  components/
    email-composer.tsx          send lifecycle: sending → sent / failed
    compose-form.tsx            fields, client-side validation, attachments
    attachment-list.tsx
    ui/                         shadcn/ui components (Base UI)
  .web-kits/                    generated sound definitions (@web-kits/audio)
  lib/
    sound.ts                    interface sound hooks
    api.ts                      POST /api/emails, error normalisation
    email-schema.ts             client-side rules (mirror the API)
    limits.ts                   limits and allowed types (mirror the API)
```

---

## Assumptions and trade-offs

**Assumptions**

- **There's no login.** Anyone who can reach the API can send email. The rate limit and CORS are the only protections, which is fine for this assignment but not for the open internet.
- **Addresses are plain, like `alice@example.com`.** Display-name formats like `"Alice" <alice@example.com>` aren't accepted.
- **Addresses are lowercased.** Technically the part before the `@` can be case-sensitive, but in practice no provider treats it that way, and lowercasing makes deduplication reliable.
- **If an address appears in more than one field**, it's kept only in the most visible one (To, then Cc, then Bcc), so nobody receives the email twice.
- **The HTML body is sent as written.** The sender writes it and mail apps sanitise HTML themselves, so the API doesn't clean it.

**Trade-offs**

| Decision | Why | What production would add |
|---|---|---|
| **Sending waits for the SMTP server** (the request is open until the provider answers) | Simple, and the user sees the real outcome. Ethereal takes 5–7 seconds. | A job queue (e.g. BullMQ + Redis) with retries and an immediate `202 Accepted`, plus delivery status from provider webhooks |
| **Files are held in memory**, not on disk | No temp files to clean up. The size and count limits cap memory use per request. | Streaming uploads to object storage for large files |
| **File types are checked by extension and MIME type** | Catches renamed files and unexpected types cheaply | Checking the file's actual bytes (magic-byte sniffing) and virus scanning |
| **The rate-limit counters live in memory** | No extra services needed | A shared store such as Redis when running several instances, plus `trust proxy` behind a load balancer |
| **Ethereal is used automatically in development** | The project runs straight after cloning, with no credentials | Production requires a real `SMTP_HOST`; the config check enforces this |
| **The frontend repeats the API's limits** in `lib/limits.ts` | Instant feedback without an extra request | A `GET /api/config` endpoint or a shared package, so the rules can't drift apart. The server still enforces them either way. |
| **Every send opens a new SMTP connection** | Simplest, and fine at this volume | `pool: true` in nodemailer to reuse connections |
| **The frontend has no automated tests** | Time; it was tested by hand end to end | Component tests (Testing Library) and a Playwright end-to-end test |
