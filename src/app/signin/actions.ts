"use server";

/**
 * Sign-in and sign-out actions (M2-T2).
 *
 * Every call uses `redirect: false` and then redirects deliberately. Auth.js
 * would otherwise throw Next's redirect signal from inside the `try`, where
 * catching it to report a real failure would swallow the navigation too.
 * Taking the URL back as a value keeps the two apart: errors are returned,
 * navigation happens after.
 */

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/server/auth";
import { EMAIL_PROVIDER_ID, GOOGLE_PROVIDER_ID } from "@/server/auth/config";
import { describeAuthError, errorFromRedirectUrl, FALLBACK_AUTH_ERROR } from "@/server/auth/errors";
import { isValidEmail } from "@/lib/resume/schema";
import type { SignInState } from "./state";

/** Where a successful sign-in lands. */
const AFTER_SIGN_IN = "/dashboard";

export async function requestMagicLinkAction(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();

  // Checked here as well as in the form, because a Server Action is
  // reachable by direct POST and the browser-side check is a convenience,
  // not a boundary.
  if (!isValidEmail(email)) {
    return { error: "That does not look like an email address. Check it and try again." };
  }

  let destination: string;
  try {
    destination = await signIn(EMAIL_PROVIDER_ID, {
      email,
      redirect: false,
      redirectTo: AFTER_SIGN_IN,
    });
  } catch (error) {
    if (error instanceof AuthError)
      return { error: describeAuthError(error.type) ?? FALLBACK_AUTH_ERROR };
    // A transport failure reaches here as a plain Error. The address is
    // deliberately left out of the message: it is already on screen, and
    // repeating it in an error string is how it ends up in a log.
    console.error("Magic link request failed", error);
    return { error: "The sign-in email could not be sent. Try again in a moment." };
  }

  const failure = errorFromRedirectUrl(destination);
  if (failure) return { error: failure };

  redirect(`/signin/check-email?email=${encodeURIComponent(email)}`);
}

export async function signInWithGoogleAction(): Promise<SignInState> {
  let destination: string;
  try {
    destination = await signIn(GOOGLE_PROVIDER_ID, { redirect: false, redirectTo: AFTER_SIGN_IN });
  } catch (error) {
    if (error instanceof AuthError)
      return { error: describeAuthError(error.type) ?? FALLBACK_AUTH_ERROR };
    console.error("Google sign-in failed", error);
    return { error: FALLBACK_AUTH_ERROR };
  }
  redirect(destination);
}

/**
 * Ends the session.
 *
 * With a database session strategy this deletes the row, not just the
 * cookie — which is what makes "sign-out clears everything" true rather
 * than merely apparent.
 */
export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/" });
}
