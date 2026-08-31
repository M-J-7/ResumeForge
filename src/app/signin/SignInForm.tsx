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
import { isValidEmail } from "@/lib/resume/schema";
import { requestMagicLinkAction, signInWithGoogleAction } from "./actions";
import { EMPTY_SIGN_IN_STATE, type SignInState } from "./state";

export interface SignInFormProps {
  /** False when the deployment has no Google credentials; the button is then hidden. */
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
          className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
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

      {googleEnabled ? (
        <>
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
            <span className="text-xs text-zinc-500 dark:text-zinc-400">or</span>
            <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          </div>
          <form action={startGoogle}>
            <Button type="submit" className="w-full" disabled={googlePending}>
              {googlePending ? "Redirecting…" : "Continue with Google"}
            </Button>
          </form>
        </>
      ) : null}
    </div>
  );
}
