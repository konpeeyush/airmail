/**
 * An expected, client-facing error. Anything thrown as an AppError is safe to
 * show to the user: its message and status code go straight into the response.
 * Any other error is treated as a bug and reported as a generic 500.
 */
export class AppError extends Error {
  /**
   * @param {number} statusCode HTTP status to respond with
   * @param {string} message    Human-readable summary
   * @param {Array<{ field: string, message: string }>} [errors] Per-field details
   */
  constructor(statusCode, message, errors) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errors = errors;
  }
}
