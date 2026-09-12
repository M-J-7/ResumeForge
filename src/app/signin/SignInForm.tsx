"use client";

/**
 * The sign-in form (M2-T2).
 *
 * Two passwordless routes and nothing else. There is no password field to
 * add later, because there is no password column to put one in (D7).
 *
 * The email check is duplicated here and in the action on purpose: this one
 * exists so the user is told before a round trip, the one in the action
 * exists because a Server Action is reachable by direct POST. Both call
 * `isValidEmail`, so there is one definition of valid — the same predicate
 * the builder and the lint engine use.
 */

import { useActionState, useState } from "react";
import { Button, Field, Input } from "@/components/ui/control";
import { GoogleButton } from "@/components/ui/GoogleButton";
import { isValidEmail } from "@/lib/resume/schema";
import { requestMagicLinkAction, signInWithGoogleAction } from "./actions";
import { EMPTY_SIGN_IN_STATE, type SignInState } from "./state";

export interface SignInFormProps {
  /**
   * False when the deployment has no Google credentials; the button is then
   * hidden rather than rendered dead. A button that redirects to Google and
   * fails there is worse than no button, so this stays a hard gate — but the
   * *reason* it is hidden is no longer silent: `signin/page.tsx` says so in
   * development, where a missing `AUTH_GOOGLE_ID` looks exactly like a bug.
   */
  googleEnabled: boolean;
  /** An error Auth.js put on the query string before we ever rendered. */
  initialError?: string | undefined;
}

export function SignInForm({ googleEnabled, initialError }: SignInFormProps) {
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);

  const [linkState, requestLink, linkPending] = useActionState<SignInState, FormData>(
    requestMagicLinkAction,
    EMPTY_SIGN_IN_STATE,
  );
  const [googleState, startGoogle, googlePending] = useActionState<SignInState>(
    signInWithGoogleAction,
    EMPTY_SIGN_IN_STATE,
  );

  const formatError =
    touched && email.trim().length > 0 && !isValidEmail(email)
      ? "That does not look like an email address yet."
      : undefined;

  const error = linkState.error ?? googleState.error ?? initialError;

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <p
          role="alert"
          className="border-warn/40 bg-warn-weak text-warn rounded-md border px-3 py-2 text-sm"
        >
          {error}
        </p>
      ) : null}

      <form action={requestLink} className="flex flex-col gap-4">
        <Field
          label="Email address"
          hint="We send a link that signs you in. There is no password to remember or lose."
          error={formatError}
        >
          {({ id, describedBy }) => (
            <Input
              id={id}
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              aria-describedby={describedBy}
              aria-invalid={formatError ? true : undefined}
              onChange={(event) => setEmail(event.target.value)}
              onBlur={() => setTouched(true)}
              placeholder="you@example.com"
            />
          )}
        </Field>
        <Button type="submit" variant="primary" disabled={linkPending}>
          {linkPending ? "Sending…" : "Email me a sign-in link"}
        </Button>
      </form>

      {/*
        Google sits *below* the link form, not above it.

        Google's guidelines require the button to be at least as prominent as
        the other options on the page, and it is: same card, same width, same
        height, nothing between it and the fold. What they do not require is
        that it come first, and the email link is this product's own route —
        it is the one that works with no third party involved at all, which is
        the position D6 takes everywhere else.
      */}
      {googleEnabled ? (
        <>
          <div className="flex items-center gap-3">
            <span className="bg-line h-px flex-1" />
            <span className="text-muted text-xs">or</span>
            <span className="bg-line h-px flex-1" />
          </div>
          <form action={startGoogle}>
            <GoogleButton pending={googlePending} />
          </form>
        </>
      ) : null}
    </div>
  );
}
