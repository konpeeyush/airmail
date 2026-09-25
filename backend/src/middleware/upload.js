import path from 'node:path';

import multer from 'multer';

import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

const MB = 1024 * 1024;

/**
 * Allowed attachments: extension → MIME types browsers send for it.
 * Both must match, so renaming `virus.exe` to `virus.pdf` isn't enough
 * (the browser still reports the original type) and neither is a spoofed
 * Content-Type on a disallowed extension.
 */
export const ALLOWED_TYPES = Object.freeze({
  '.pdf': ['application/pdf'],
  '.png': ['image/png'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.gif': ['image/gif'],
  '.webp': ['image/webp'],
  '.txt': ['text/plain'],
  // Windows browsers often report CSV as an Excel type.
  '.csv': ['text/csv', 'application/vnd.ms-excel'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  '.zip': ['application/zip', 'application/x-zip-compressed'],
});

export const UPLOAD_LIMITS = Object.freeze({
  FIELD_NAME: 'attachments',
  MAX_FILE_SIZE: env.MAX_FILE_SIZE_MB * MB,
  MAX_FILES: env.MAX_FILES,
  MAX_TOTAL_SIZE: env.MAX_TOTAL_SIZE_MB * MB,
});

const allowedList = Object.keys(ALLOWED_TYPES).join(', ');

function fileFilter(req, file, cb) {
  const extension = path.extname(file.originalname).toLowerCase();
  const mimeTypes = ALLOWED_TYPES[extension];

  if (!mimeTypes || !mimeTypes.includes(file.mimetype)) {
    return cb(new AppError(415, `"${file.originalname}" is not an allowed file type. Allowed: ${allowedList}`));
  }
  cb(null, true);
}

const parseMultipart = multer({
  // Files stay in memory as Buffers: nothing to clean up on disk, and the
  // limits below bound how much memory one request can use.
  storage: multer.memoryStorage(),
  fileFilter,
  // Browsers send UTF-8 filenames; multer's default (latin1) would garble "résumé.pdf".
  defParamCharset: 'utf8',
  limits: {
    fileSize: UPLOAD_LIMITS.MAX_FILE_SIZE,
    files: UPLOAD_LIMITS.MAX_FILES,
    fields: 20,
    fieldSize: 1 * MB, // per text field; the body limit itself is enforced by validation
  },
}).array(UPLOAD_LIMITS.FIELD_NAME, UPLOAD_LIMITS.MAX_FILES);

/** Turns multer's error codes into client-facing AppErrors. */
function toAppError(err) {
  if (err instanceof AppError) return err; // from fileFilter
  if (!(err instanceof multer.MulterError)) return err; // unexpected → 500

  const file = err.filename ? `"${err.filename}"` : 'An attachment';

  switch (err.code) {
    case 'LIMIT_FILE_SIZE':
      return new AppError(413, `${file} is larger than the ${env.MAX_FILE_SIZE_MB} MB limit`);
    case 'LIMIT_FILE_COUNT':
      return new AppError(400, `You can attach at most ${UPLOAD_LIMITS.MAX_FILES} files`);
    case 'LIMIT_UNEXPECTED_FILE':
      return new AppError(400, `Files must be sent in the "${UPLOAD_LIMITS.FIELD_NAME}" field`);
    case 'LIMIT_FIELD_VALUE':
      return new AppError(413, `The "${err.field}" field is too large`);
    default:
      return new AppError(400, `Invalid upload: ${err.message}`);
  }
}

/**
 * Parses multipart/form-data: text fields → req.body, files → req.files.
 * JSON requests pass straight through (req.files stays empty), so the API
 * works both from the browser form and from plain JSON clients.
 */
export function uploadAttachments(req, res, next) {
  parseMultipart(req, res, (err) => {
    if (err) return next(toAppError(err));

    const files = req.files ?? [];

    const empty = files.find((file) => file.size === 0);
    if (empty) {
      return next(new AppError(400, `"${empty.originalname}" is empty`));
    }

    // multer only limits each file; the email as a whole also has to stay
    // under what SMTP providers accept.
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > UPLOAD_LIMITS.MAX_TOTAL_SIZE) {
      return next(new AppError(413, `Attachments add up to more than ${env.MAX_TOTAL_SIZE_MB} MB`));
    }

    req.files = files;
    next();
  });
}
