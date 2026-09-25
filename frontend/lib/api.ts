import { API_URL } from "@/lib/config";
import type { ComposeValues, FieldErrors, FieldName } from "@/lib/email-schema";

/** `data` of a successful POST /api/emails. */
export type SendResult = {
  messageId: string;
  accepted: string[];
  rejected: string[];
  attachments: number;
  /** Only in development, when the API is using an Ethereal test inbox. */
  previewUrl?: string;
};

type ApiResponse =
  | { success: true; message: string; data: SendResult }
  | { success: false; message: string; errors?: { field: string; message: string }[] };

/** Every way a send can fail, in one shape the UI can render. */
export class SendError extends Error {
  constructor(
    message: string,
    /** HTTP status, or 0 when the server couldn't be reached. */
    readonly status: number,
    /** Server validation errors mapped onto form fields. */
    readonly fieldErrors: FieldErrors = {},
  ) {
    super(message);
    this.name = "SendError";
  }
}

// Longer than the API's own SMTP timeouts (10s connect, 20s socket), so the
// server gets to answer with its 502 before the browser gives up.
const REQUEST_TIMEOUT_MS = 45_000;

const FORM_FIELDS = new Set<FieldName>(["to", "cc", "bcc", "subject", "body", "attachments"]);

// The API reports the recipient cap on "recipients"; the form shows it under To.
const FIELD_ALIASES: Record<string, FieldName> = { recipients: "to", isHtml: "body" };

// Used only if a response has no message of its own (e.g. a proxy error page).
const FALLBACK_MESSAGES: Record<number, string> = {
  400: "Some fields need attention.",
  413: "The attachments are too large.",
  415: "One of the attachments is not an allowed file type.",
  429: "Too many emails sent. Please wait a while and try again.",
  502: "The email provider could not send this message. Please try again later.",
};

function toFieldErrors(errors: { field: string; message: string }[] = []): FieldErrors {
  const result: FieldErrors = {};
  for (const { field, message } of errors) {
    const name = FIELD_ALIASES[field] ?? field;
    if (FORM_FIELDS.has(name as FieldName)) result[name as FieldName] ??= message;
  }
  return result;
}

function toFormData(values: ComposeValues): FormData {
  const form = new FormData();
  form.append("to", values.to);
  form.append("cc", values.cc);
  form.append("bcc", values.bcc);
  form.append("subject", values.subject);
  form.append("body", values.body);
  form.append("isHtml", String(values.isHtml));
  for (const file of values.attachments) {
    form.append("attachments", file, file.name);
  }
  return form;
}

/**
 * POST /api/emails as multipart/form-data.
 * Resolves with the API's message and result; rejects with a SendError.
 */
export async function sendEmail(values: ComposeValues): Promise<{ message: string; data: SendResult }> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/emails`, {
      method: "POST",
      // No Content-Type header: the browser sets multipart/form-data with its boundary.
      body: toFormData(values),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new SendError("The server took too long to respond. Please try again.", 0);
    }
    // fetch rejects (rather than returning a status) when the server is down,
    // the URL is wrong, or CORS blocks the response.
    throw new SendError(`Can't reach the email API at ${API_URL}. Check that it's running.`, 0);
  }

  let body: ApiResponse | null = null;
  try {
    body = (await response.json()) as ApiResponse;
  } catch {
    // Not JSON (e.g. an HTML error page from a proxy); fall through to the status.
  }

  if (response.ok && body?.success) {
    return { message: body.message, data: body.data };
  }

  const message =
    body?.message ?? FALLBACK_MESSAGES[response.status] ?? `Something went wrong (HTTP ${response.status}).`;
  const fieldErrors = body && !body.success ? toFieldErrors(body.errors) : {};
  throw new SendError(message, response.status, fieldErrors);
}
