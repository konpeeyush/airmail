/**
 * Mirrors the backend defaults (backend/.env.example and
 * backend/src/validators/email.schema.js). The client checks these for fast
 * feedback; the server enforces them regardless, so if the two ever drift the
 * API's error message is what the user sees.
 */
export const LIMITS = {
  MAX_RECIPIENTS: 50,
  MAX_SUBJECT_LENGTH: 255,
  MAX_BODY_LENGTH: 100_000,
  MAX_FILES: 5,
  MAX_FILE_SIZE: 5 * 1024 * 1024,
  MAX_TOTAL_SIZE: 15 * 1024 * 1024,
} as const;

export const ALLOWED_EXTENSIONS = [
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".txt",
  ".csv",
  ".docx",
  ".xlsx",
  ".zip",
] as const;

/** For the file picker's `accept` attribute. */
export const ACCEPT = ALLOWED_EXTENSIONS.join(",");
