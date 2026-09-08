/**
 * Server error text is not automatically user-facing. A Laravel environment
 * with debug on answers a failed write with the exception — the therapist
 * accepting an appointment was shown a raw `SQLSTATE[42S02] ... select score
 * from therapist_ratings ...` in a sheet titled "Not updated".
 *
 * Everything the UI renders goes through here, so a message only reaches a
 * person when it reads like one written for them. The original text is kept
 * on `ApiError.detail` for logs and bug reports.
 */

const GENERIC = 'Something went wrong. Please try again.';
const GENERIC_SERVER = 'Something went wrong on our side. Nothing has been changed — please try again.';

/** Longer than any sentence written for a user, and a strong smell of a dump. */
const MAX_LENGTH = 200;

const TECHNICAL_PATTERNS = [
  /SQLSTATE/i,
  /\bexception\b/i,
  /stack trace/i,
  /\b(select|insert into|update|delete from|alter table)\b.+\b(from|into|table|where|set)\b/i,
  /\b(Illuminate|Symfony|Doctrine|PDO)\\/,
  /\bCall to (a member function|undefined)\b/i,
  /\bUndefined (variable|index|property|array key)\b/i,
  /\.(php|ts|js|vue)\b.*\bline\b/i,
  /^[A-Za-z]:\\|(^|\s)\/(var|usr|home|app)\//,
  /\b(127\.0\.0\.1|localhost)\b.*\b(port|database|connection)\b/i,
];

function looksTechnical(message: string): boolean {
  if (message.length > MAX_LENGTH) return true;
  if (/[\n\r]/.test(message)) return true;
  return TECHNICAL_PATTERNS.some((pattern) => pattern.test(message));
}

/**
 * What to show for a failed request. 5xx is never explained to the user in the
 * server's own words: those messages are written for whoever reads the logs.
 */
export function presentableMessage(status: number, message: string | undefined): string {
  const serverFailure = status >= 500;
  const fallback = serverFailure ? GENERIC_SERVER : GENERIC;

  const trimmed = message?.trim();
  if (!trimmed) return fallback;
  if (serverFailure) return fallback;
  return looksTechnical(trimmed) ? fallback : trimmed;
}
