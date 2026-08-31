/**
 * Keeping resume content out of the logs (§9).
 *
 * ## The leak this closes
 *
 * §9 says error reporting is scrubbed of resume content, and the obvious
 * reading — "do not log the document" — misses where it actually escapes. A
 * failing database write is reported by the driver with the statement *and
 * its parameters*, and the parameter to `saveResume` is the entire resume.
 * Nobody wrote `console.log(document)`; the content still ends up in a log
 * file, on a host, in whatever ships those logs onward.
 *
 * So two things happen. `createPrismaClient` asks Prisma for its minimal
 * error format, which drops the statement and its parameters, and everything
 * this codebase logs goes through `scrubForLog`, which removes what a message
 * can still carry: email addresses, connection strings, magic-link tokens,
 * and any long blob that might be a serialized document.
 *
 * ## Why redact rather than refuse to log
 *
 * A server that logs nothing is a server nobody can fix. The aim is a log
 * that says what broke and where, and never says what the user wrote.
 */

/** Longer than this and a message is a payload, not a description. */
const MAX_MESSAGE_LENGTH = 500;

/**
 * Order matters. A URL like `?token=abc&email=a@b.co` is matched by the email
 * pattern as one long run, so redacting named credentials first is what keeps
 * the log saying *which* thing was removed instead of collapsing the whole
 * query string into `<email>`.
 */
const REDACTIONS: readonly { pattern: RegExp; replacement: string }[] = [
  // A sign-in token in a log is a working credential for whoever reads it.
  {
    pattern: /\b(token|secret|password|authorization|key)=[^&\s"']+/gi,
    replacement: "$1=<redacted>",
  },
  // Connection strings carry credentials and disclose the volume layout.
  {
    pattern: /\b(file|postgres|postgresql|mysql|smtp|smtps):\/\/\S+/gi,
    replacement: "$1://<redacted>",
  },
  { pattern: /\bfile:[^\s"']+/gi, replacement: "file:<redacted>" },
  // Addresses are the one piece of personal data an account holds. They are
  // legitimately useful in a log and are redacted anyway — the operator can
  // find the user by id, and a log that leaks addresses is a breach waiting
  // for a misconfigured log shipper.
  { pattern: /[^\s"'<>@]+@[^\s"'<>@]+\.[^\s"'<>@,;)]+/g, replacement: "<email>" },
  // Anything long and opaque enough to be a credential we did not name.
  { pattern: /\b[A-Za-z0-9_-]{32,}\b/g, replacement: "<token>" },
];

/** Anything object-shaped and long enough to be a document rather than a hint. */
const BLOB = /[[{][\s\S]{80,}?[\]}]/g;

/**
 * Reduces a value to something safe to write to a log.
 *
 * Blobs go first, so a serialized resume is dropped whole rather than handed
 * back with only its email address redacted.
 */
export function scrubForLog(value: unknown): string {
  const raw =
    value instanceof Error
      ? `${value.name}: ${value.message}`
      : typeof value === "string"
        ? value
        : safeStringify(value);

  let scrubbed = raw.replace(BLOB, "<redacted:object>");
  for (const { pattern, replacement } of REDACTIONS) {
    scrubbed = scrubbed.replace(pattern, replacement);
  }

  return scrubbed.length > MAX_MESSAGE_LENGTH
    ? `${scrubbed.slice(0, MAX_MESSAGE_LENGTH)}… (truncated)`
    : scrubbed;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    // Circular, or a getter that throws. The shape is not worth a crash.
    return String(value);
  }
}

/**
 * Logs an error with context, scrubbed.
 *
 * The context string is written by us and is never interpolated from user
 * input — it names the operation, not its arguments.
 */
export function logError(context: string, error: unknown): void {
  console.error(`[${context}] ${scrubForLog(error)}`);
}

export function logWarning(context: string, message: string): void {
  console.warn(`[${context}] ${scrubForLog(message)}`);
}
