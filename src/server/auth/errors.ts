/**
 * Turning Auth.js error codes into something a person can act on (M2-T2).
 *
 * Auth.js surfaces failures as a short machine code on the query string —
 * `?error=OAuthAccountNotLinked` and friends. Shown raw, they read as a
 * crash. Each message below says what happened *and what to do next*, which
 * for a passwordless system is almost always "use the other flow", because
 * there is no password to reset.
 */

/**
 * Codes Auth.js can put on `pages.error`. Unknown values fall back.
 *
 * The set is smaller than it looks and worth pinning down, because the two
 * that matter most for Google were named differently in NextAuth v4 and are
 * easy to write from memory. Only the types in `@auth/core`'s
 * `clientErrors` set reach the query string as themselves — everything else
 * is flattened to `Configuration` — and for OAuth that means
 * `OAuthAccountNotLinked`, `OAuthCallbackError`, `AccessDenied`,
 * `Verification`, and `MissingCSRF`.
 *
 * `OAuthSignInError` is *not* in that set: a failure while building the
 * authorization URL (Google unreachable, discovery refused, credentials the
 * provider rejects outright) arrives as a thrown `AuthError` in our own
 * sign-in action instead, which reads its `type` directly. Both routes land
 * here, so both are listed.
 *
 * `SessionRequired` is ours, not Auth.js's — `requireSessionUser` redirects
 * with it.
 */
export type AuthErrorCode =
  | "Configuration"
  | "AccessDenied"
  | "Verification"
  | "OAuthAccountNotLinked"
  | "OAuthCallbackError"
  | "OAuthSignInError"
  | "MissingCSRF"
  | "EmailSignInError"
  | "SessionRequired"
  // v4 spellings. Kept because the code travels on a URL — a bookmarked or
  // pasted error link outlives the version that produced it — and because
  // they are what a search for "next-auth OAuthCallback" still returns.
  | "OAuthSignin"
  | "OAuthCallback";

/**
 * The single most common Google outcome after "it worked": the consent screen
 * was closed or declined. Auth.js reports that and a genuinely broken
 * provider response with the same code, so the message has to be true of both
 * — and has to lead with the one that is nearly always what happened, rather
 * than telling someone who pressed Cancel that something went wrong.
 */
const GOOGLE_DID_NOT_FINISH =
  "Google did not finish signing you in — that is what happens if the consent screen " +
  "was closed or declined. Try again, or use an email link instead.";

/** Nothing was redirected anywhere: the provider could not be reached at all. */
const GOOGLE_UNREACHABLE = "Google could not be reached. Try again, or use an email link instead.";

const MESSAGES: Record<AuthErrorCode, string> = {
  Configuration:
    "Sign-in is not configured correctly on the server, so nothing was sent. This is our problem, not yours.",
  AccessDenied: "That account is not allowed to sign in.",
  Verification:
    "That sign-in link has already been used or has expired. Links work once and last 15 minutes — request a new one below.",
  // The single most likely error in a two-provider passwordless setup, and
  // the one most likely to read as "my account is broken" if left as a code.
  OAuthAccountNotLinked:
    "You already sign in to this address with an email link, so Google was not connected to it. Request a link below and you are in.",
  OAuthCallbackError: GOOGLE_DID_NOT_FINISH,
  OAuthSignInError: GOOGLE_UNREACHABLE,
  MissingCSRF:
    "That sign-in could not be verified, usually because the page had been open a long time. Reload this page and try again.",
  EmailSignInError: "The sign-in email could not be sent. Try again in a moment.",
  SessionRequired: "Sign in to see that page.",
  OAuthSignin: GOOGLE_UNREACHABLE,
  OAuthCallback: GOOGLE_DID_NOT_FINISH,
};

export const FALLBACK_AUTH_ERROR =
  "Something went wrong signing in. Try again, or request a new email link.";

export function describeAuthError(code: string | null | undefined): string | null {
  if (!code) return null;
  return MESSAGES[code as AuthErrorCode] ?? FALLBACK_AUTH_ERROR;
}

/**
 * Reads an error out of a URL Auth.js handed back.
 *
 * In a Server Action, `signIn(..., { redirect: false })` returns the URL it
 * *would* have sent the browser to. A failure that Auth.js already converted
 * into a redirect therefore arrives as a normal return value, not as a
 * thrown error — so the action has to look, or a mail-transport failure
 * would be reported to the user as success.
 */
export function errorFromRedirectUrl(url: string): string | null {
  try {
    return describeAuthError(new URL(url, "http://localhost").searchParams.get("error"));
  } catch {
    return null;
  }
}
