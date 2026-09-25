import { z } from "zod";

import { formatBytes, shorten } from "@/lib/format";
import { ALLOWED_EXTENSIONS, LIMITS } from "@/lib/limits";

export type ComposeValues = {
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
  isHtml: boolean;
  attachments: File[];
};

export type FieldName = "to" | "cc" | "bcc" | "subject" | "body" | "attachments";
export type FieldErrors = Partial<Record<FieldName, string>>;

/** Same rules as the API: split on , or ; → trim → lowercase → drop blanks → dedupe. */
export function splitAddresses(value: string): string[] {
  const list = value
    .split(/[,;]/)
    .map((address) => address.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(list)];
}

/** Why a file can't be attached, or null if it's fine. */
export function checkFile(file: File): string | null {
  const name = shorten(file.name);
  const dot = file.name.lastIndexOf(".");
  const extension = dot === -1 ? "" : file.name.slice(dot).toLowerCase();

  if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(extension)) {
    return `"${name}" is not an allowed file type`;
  }
  if (file.size === 0) {
    return `"${name}" is empty`;
  }
  if (file.size > LIMITS.MAX_FILE_SIZE) {
    return `"${name}" is larger than ${formatBytes(LIMITS.MAX_FILE_SIZE)}`;
  }
  return null;
}

const addressList = z
  .string()
  .transform(splitAddresses)
  .pipe(z.array(z.email({ error: (issue) => `"${shorten(String(issue.input))}" is not a valid email address` })));

const composeSchema = z
  .object({
    to: addressList.refine((list) => list.length > 0, "Add at least one recipient"),
    cc: addressList,
    bcc: addressList,
    subject: z
      .string()
      .trim()
      .min(1, "Subject is required")
      .max(LIMITS.MAX_SUBJECT_LENGTH, `Subject must be at most ${LIMITS.MAX_SUBJECT_LENGTH} characters`),
    body: z
      .string()
      .trim()
      .min(1, "Message is required")
      .max(LIMITS.MAX_BODY_LENGTH, `Message must be at most ${LIMITS.MAX_BODY_LENGTH.toLocaleString()} characters`),
    isHtml: z.boolean(),
    attachments: z
      .array(z.instanceof(File))
      .max(LIMITS.MAX_FILES, `You can attach at most ${LIMITS.MAX_FILES} files`)
      .superRefine((files, ctx) => {
        for (const file of files) {
          const problem = checkFile(file);
          if (problem) ctx.addIssue({ code: "custom", message: problem });
        }
        const total = files.reduce((sum, file) => sum + file.size, 0);
        if (total > LIMITS.MAX_TOTAL_SIZE) {
          ctx.addIssue({
            code: "custom",
            message: `Attachments add up to more than ${formatBytes(LIMITS.MAX_TOTAL_SIZE)}`,
          });
        }
      }),
  })
  .superRefine(({ to, cc, bcc }, ctx) => {
    if (new Set([...to, ...cc, ...bcc]).size > LIMITS.MAX_RECIPIENTS) {
      ctx.addIssue({
        code: "custom",
        path: ["to"],
        message: `No more than ${LIMITS.MAX_RECIPIENTS} recipients in total (To, Cc and Bcc)`,
      });
    }
  });

/** Client-side check. Returns the first problem for each field (empty object = valid). */
export function validateCompose(values: ComposeValues): FieldErrors {
  const result = composeSchema.safeParse(values);
  if (result.success) return {};

  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as FieldName;
    errors[field] ??= issue.message;
  }
  return errors;
}
