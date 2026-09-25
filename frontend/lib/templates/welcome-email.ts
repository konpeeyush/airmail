import { APP_NAME, SITE_URL } from "@/lib/brand";
import { LIMITS } from "@/lib/limits";

/**
 * Images in an email are fetched by the recipient's mail app, so they need a
 * public URL. When the app runs on localhost, fall back to the public GitHub repo.
 */
const REPO_URL = "https://github.com/konpeeyush/airmail";
const isPublicSite = !/localhost|127\.0\.0\.1/.test(SITE_URL);
const ASSETS = isPublicSite ? SITE_URL : "https://raw.githubusercontent.com/konpeeyush/airmail/master/frontend/public";
const CTA_URL = isPublicSite ? SITE_URL : REPO_URL;

const COLORS = {
  page: "#f3f3ef",
  card: "#ffffff",
  line: "#ebebe4",
  ink: "#16172b",
  body: "#4a4b63",
  muted: "#8a8ba0",
  brand: "#4346f2",
  lime: "#a6f06a",
  limeInk: "#1d3508",
};

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Helvetica, Arial, sans-serif";

/** Alternating blue / lime / white blocks, like the striped edge of an airmail envelope. */
function stripeBand(): string {
  const pattern = [COLORS.brand, COLORS.card, COLORS.lime, COLORS.card];
  const count = 24;
  const cells = Array.from({ length: count }, (_, i) => {
    // Rounded ends, so the band sits neatly inside the card in every client.
    const radius = i === 0 ? "border-radius:3px 0 0 3px;" : i === count - 1 ? "border-radius:0 3px 3px 0;" : "";
    return `<td width="24" height="6" style="background:${pattern[i % 4]};${radius}font-size:0;line-height:0;">&nbsp;</td>`;
  }).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${cells}</tr></table>`;
}

function ticketColumn(label: string, value: string, align: "left" | "center" | "right"): string {
  return `<td width="33%" align="${align}" valign="top" style="padding:0 4px;">
                      <p style="margin:0;font-size:11px;line-height:16px;letter-spacing:0.1em;text-transform:uppercase;color:${COLORS.muted};font-weight:600;">${label}</p>
                      <p style="margin:4px 0 0;font-size:15px;line-height:22px;color:${COLORS.ink};font-weight:600;">${value}</p>
                    </td>`;
}

function step(number: number, title: string, text: string): string {
  return `<tr>
                <td width="40" valign="top" style="padding:0 0 20px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                    <td width="28" height="28" align="center" valign="middle" style="width:28px;height:28px;border-radius:14px;background:${COLORS.lime};color:${COLORS.limeInk};font-size:13px;font-weight:700;">${number}</td>
                  </tr></table>
                </td>
                <td valign="top" style="padding:3px 0 20px;">
                  <p style="margin:0;font-size:15px;line-height:22px;color:${COLORS.ink};font-weight:600;">${title}</p>
                  <p style="margin:4px 0 0;font-size:14px;line-height:22px;color:${COLORS.body};">${text}</p>
                </td>
              </tr>`;
}

const SUBJECT = `Welcome to ${APP_NAME}: your outbox is cleared for takeoff`;

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light only">
  <title>Welcome to ${APP_NAME}</title>
  <style>
    @media (max-width: 620px) {
      .container { width: 100% !important; }
      .pad { padding-left: 24px !important; padding-right: 24px !important; }
      .headline { font-size: 26px !important; line-height: 32px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:${COLORS.page};font-family:${FONT};-webkit-font-smoothing:antialiased;">
  <!-- Preview text shown next to the subject in the inbox -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your outbox is ready. Here's how to send your first email in under a minute.</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.page};">
    <tr>
      <td align="center" style="padding:32px 12px;">
        <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">

          <!-- Brand bar -->
          <tr>
            <td style="padding:0 8px 16px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                <td valign="middle">
                  <img src="${ASSETS}/icon-192.png" width="28" height="28" alt="" style="display:inline-block;vertical-align:middle;border:0;border-radius:7px;">
                  <span style="display:inline-block;vertical-align:middle;margin-left:8px;font-size:17px;font-weight:700;color:${COLORS.ink};letter-spacing:-0.01em;">${APP_NAME}</span>
                </td>
                <td align="right" valign="middle" style="font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:${COLORS.muted};font-weight:600;">Flight AM-001</td>
              </tr></table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:${COLORS.card};border:1px solid ${COLORS.line};border-radius:20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:12px 12px 0;">${stripeBand()}</td>
                </tr>
                <tr>
                  <td style="padding:10px 12px 0;">
                    <img src="${ASSETS}/email/cover.jpg" width="574" alt="The ${APP_NAME} mascot, a small robot in a green cap, holding an envelope" style="display:block;width:100%;max-width:574px;height:auto;border:0;border-radius:12px;">
                  </td>
                </tr>

                <tr>
                  <td class="pad" style="padding:36px 44px 0;">
                    <p style="margin:0;font-size:12px;line-height:16px;letter-spacing:0.12em;text-transform:uppercase;color:${COLORS.brand};font-weight:700;">Welcome aboard</p>
                    <h1 class="headline" style="margin:12px 0 0;font-size:30px;line-height:36px;letter-spacing:-0.02em;color:${COLORS.ink};font-weight:700;">Your outbox is cleared for takeoff.</h1>
                    <p style="margin:16px 0 0;font-size:16px;line-height:26px;color:${COLORS.body};">Hi there, thanks for trying ${APP_NAME}. It's a small, fast place to write an email, add the people and files that go with it, and send it on its way. Here's everything you need for your first flight.</p>
                  </td>
                </tr>

                <!-- Boarding pass -->
                <tr>
                  <td class="pad" style="padding:28px 44px 0;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${COLORS.line};border-radius:14px;background:#fafaf7;">
                      <tr>
                        <td style="padding:18px 16px 16px;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                    ${ticketColumn("From", "You", "left")}
                    ${ticketColumn("To", `Up to ${LIMITS.MAX_RECIPIENTS}`, "center")}
                    ${ticketColumn("Cargo", `${LIMITS.MAX_FILES} files`, "right")}
                          </tr></table>
                        </td>
                      </tr>
                      <tr>
                        <td style="border-top:1px dashed #d9d9d0;padding:10px 20px;font-size:11px;line-height:16px;letter-spacing:0.1em;text-transform:uppercase;color:${COLORS.muted};font-weight:600;">
                          Plain text or HTML &middot; Cc &amp; Bcc &middot; <span style="color:${COLORS.brand};">Boarding now</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Steps -->
                <tr>
                  <td class="pad" style="padding:32px 44px 4px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              ${step(1, "Add your recipients", "Separate addresses with commas. Cc and Bcc are one click away.")}
              ${step(2, "Write it your way", "Plain text for a quick note, HTML when you want it to look like this one.")}
              ${step(3, "Attach and send", "Drop in PDFs, images or spreadsheets, then hit Send. That's the whole trip.")}
                    </table>
                  </td>
                </tr>

                <!-- Call to action -->
                <tr>
                  <td class="pad" style="padding:4px 44px 0;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                      <td align="center" style="border-radius:12px;background:${COLORS.brand};">
                        <a href="${CTA_URL}" target="_blank" style="display:inline-block;padding:14px 24px;font-size:15px;line-height:20px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:12px;">Write your first email &rarr;</a>
                      </td>
                    </tr></table>
                  </td>
                </tr>

                <tr>
                  <td class="pad" style="padding:32px 44px 40px;">
                    <p style="margin:0;font-size:15px;line-height:24px;color:${COLORS.body};">Happy sending,<br><span style="color:${COLORS.ink};font-weight:600;">The ${APP_NAME} crew</span></p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:24px 24px 0;font-size:12px;line-height:18px;color:${COLORS.muted};">
              Sent with <a href="${CTA_URL}" target="_blank" style="color:${COLORS.muted};text-decoration:underline;">${APP_NAME}</a>. You're getting this because someone sent you the welcome example.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

/** The "Import example" template: a welcome email, sent as HTML. */
export const WELCOME_EMAIL = { subject: SUBJECT, html: HTML } as const;
