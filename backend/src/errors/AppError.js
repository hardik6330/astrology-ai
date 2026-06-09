// Tagged HTTP error. Services and controllers throw this; the global
// errorHandler middleware translates it into a JSON response.
//
// Usage:
//   throw new AppError('No saved reading found', 404, 'NOT_FOUND');
//   throw AppError.notFound('User');
export class AppError extends Error {
  constructor(message, status = 500, code) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    if (code) this.code = code;
  }

  static badRequest(message = 'Bad request', code = 'BAD_REQUEST') {
    return new AppError(message, 400, code);
  }
  static unauthorized(message = 'Unauthorized', code = 'UNAUTHORIZED') {
    return new AppError(message, 401, code);
  }
  static forbidden(message = 'Forbidden', code = 'FORBIDDEN') {
    return new AppError(message, 403, code);
  }
  static notFound(message = 'Not found', code = 'NOT_FOUND') {
    return new AppError(message, 404, code);
  }
  static conflict(message = 'Conflict', code = 'CONFLICT') {
    return new AppError(message, 409, code);
  }
  static tooMany(message = 'Rate limited', code = 'RATE_LIMITED') {
    return new AppError(message, 429, code);
  }
  static internal(message = 'Internal error', code) {
    return new AppError(message, 500, code);
  }

  // Status-first factory for arbitrary codes (402, 5xx, …) that don't have a
  // named helper above. Mirrors the old httpError() signature so call sites read
  // the same: AppError.http(404, 'Not found', 'NOT_FOUND').
  static http(status, message, code) {
    return new AppError(message, status, code);
  }
}
