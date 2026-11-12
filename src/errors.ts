export type GitWrappedErrorCode =
  | 'NO_TOKEN'
  | 'BAD_TOKEN'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'API_ERROR'
  | 'INVALID_INPUT';

/** Error with a stable machine-readable code and a message that is safe to show to users. */
export class GitWrappedError extends Error {
  readonly code: GitWrappedErrorCode;

  constructor(code: GitWrappedErrorCode, message: string) {
    super(message);
    this.name = 'GitWrappedError';
    this.code = code;
  }
}

/** HTTP status that best represents an error code (used by the web server). */
export function httpStatusFor(code: GitWrappedErrorCode): number {
  switch (code) {
    case 'INVALID_INPUT':
      return 400;
    case 'NOT_FOUND':
      return 404;
    case 'RATE_LIMITED':
      return 429;
    case 'NO_TOKEN':
    case 'BAD_TOKEN':
      return 503;
    default:
      return 502;
  }
}
