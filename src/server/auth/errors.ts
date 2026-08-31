/**
 * Turning Auth.js error codes into something a person can act on (M2-T2).
 *
 * Auth.js surfaces failures as a short machine code on the query string —
 * `?error=OAuthAccountNotLinked` and friends. Shown raw, they read as a
 * crash. Each message below says what happened *and what to do next*, which
 * for a passwordless system is almost always "use the other flow", because
 * there is no password to reset.
 */

/** Codes Auth.js can put on `pages.error`. Unknown values fall back. */
export type AuthErrorCode =
  | "Configuration"
  | "AccessDenied"
  | "Verification"
  | "OAuthAccountNotLinked"
  | "OAuthSignin"
  | "OAuthCallback"
  | "EmailSignInError"
  | "SessionRequired";

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
  OAuthSignin: "Google could not be reached. Try again, or use an email link instead.",
  OAuthCallback:
    "Google sent back something we could not use. Try again, or use an email link instead.",
  EmailSignInError: "The sign-in email could not be sent. Try again in a moment.",
  SessionRequired: "Sign in to see that page.",
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
