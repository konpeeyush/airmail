import path from 'node:path';

import multer from 'multer';

import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { LIMITS } from '../validators/email.schema.js';

const MB = 1024 * 1024;

/**
 * Allowed attachments: extension → MIME types browsers send for it.
 * Both must match. This catches unexpected types, but not a renamed file:
 * browsers pick the MIME type from the file name, so `virus.exe` renamed to
 * `virus.pdf` arrives as application/pdf. The file's first bytes are checked
 * too (see SIGNATURES below).
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

/** True if `buffer` has `signature` (a string or byte array) at `offset`. */
function hasBytes(buffer, signature, offset = 0) {
  const expected = Buffer.from(signature);
  return buffer.subarray(offset, offset + expected.length).equals(expected);
}

// .docx and .xlsx are zip archives too.
const isZip = (buffer) => hasBytes(buffer, 'PK\x03\x04') || hasBytes(buffer, 'PK\x05\x06');
const isJpeg = (buffer) => hasBytes(buffer, [0xff, 0xd8, 0xff]);
// Text has no signature, but real text has no NUL bytes, and programs and other binaries do.
const isText = (buffer) => !buffer.subarray(0, 8192).includes(0);

/** What each allowed type's content must look like, whatever its name says. */
const SIGNATURES = Object.freeze({
  '.pdf': (buffer) => hasBytes(buffer, '%PDF-'),
  '.png': (buffer) => hasBytes(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  '.jpg': isJpeg,
  '.jpeg': isJpeg,
  '.gif': (buffer) => hasBytes(buffer, 'GIF87a') || hasBytes(buffer, 'GIF89a'),
  '.webp': (buffer) => hasBytes(buffer, 'RIFF') && hasBytes(buffer, 'WEBP', 8),
  '.txt': isText,
  '.csv': isText,
  '.docx': isZip,
  '.xlsx': isZip,
  '.zip': isZip,
});

// Sizes can be fractional MB in env (e.g. 2.5); multer needs whole bytes.
export const UPLOAD_LIMITS = Object.freeze({
  FIELD_NAME: 'attachments',
  MAX_FILE_SIZE: Math.floor(env.MAX_FILE_SIZE_MB * MB),
  MAX_FILES: env.MAX_FILES,
  MAX_TOTAL_SIZE: Math.floor(env.MAX_TOTAL_SIZE_MB * MB),
});

const allowedList = Object.keys(ALLOWED_TYPES).join(', ');

const extensionOf = (file) => path.extname(file.originalname).toLowerCase();

function fileFilter(req, file, cb) {
  const extension = extensionOf(file);
  const mimeTypes = ALLOWED_TYPES[extension];

  if (!mimeTypes || !mimeTypes.includes(file.mimetype)) {
    return cb(new AppError(415, `"${file.originalname}" is not an allowed file type. Allowed: ${allowedList}`));
  }
  cb(null, true);
}

// Bytes of attachments read so far, per request.
const receivedBytes = new WeakMap();

/**
 * multer.memoryStorage(), plus a running total across all files in the
 * request. Reading stops as soon as the total passes MAX_TOTAL_SIZE, so an
 * oversized upload is rejected without being held in memory first. (multer's
 * own limits only cover one file at a time.)
 */
const memoryStorageWithTotalLimit = {
  _handleFile(req, file, cb) {
    const chunks = [];
    let failed = false;

    file.stream.on('data', (chunk) => {
      if (failed) return;
      const total = (receivedBytes.get(req) ?? 0) + chunk.length;
      receivedBytes.set(req, total);

      if (total > UPLOAD_LIMITS.MAX_TOTAL_SIZE) {
        failed = true;
        chunks.length = 0;
        return cb(new AppError(413, `Attachments add up to more than ${env.MAX_TOTAL_SIZE_MB} MB`));
      }
      chunks.push(chunk);
    });

    file.stream.on('end', () => {
      if (failed) return;
      const buffer = Buffer.concat(chunks);
      cb(null, { buffer, size: buffer.length });
    });
  },

  _removeFile(req, file, cb) {
    delete file.buffer;
    cb(null);
  },
};

const parseMultipart = multer({
  // Files stay in memory as Buffers: nothing to clean up on disk, and the
  // limits below bound how much memory one request can use.
  storage: memoryStorageWithTotalLimit,
  fileFilter,
  // Browsers send UTF-8 filenames; multer's default (latin1) would garble "résumé.pdf".
  defParamCharset: 'utf8',
  limits: {
    fileSize: UPLOAD_LIMITS.MAX_FILE_SIZE,
    files: UPLOAD_LIMITS.MAX_FILES,
    fields: 20,
    // Per text field: room for a 100,000-character body in UTF-8 (up to 3 bytes
    // a character). The character limit itself is enforced by validation.
    fieldSize: LIMITS.MAX_BODY_LENGTH * 3,
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

    const disguised = files.find((file) => !SIGNATURES[extensionOf(file)](file.buffer));
    if (disguised) {
      return next(
        new AppError(415, `"${disguised.originalname}" isn't a real ${extensionOf(disguised)} file`),
      );
    }

    req.files = files;
    next();
  });
}
