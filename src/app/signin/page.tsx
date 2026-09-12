/**
 * Sign-in (M2-T2).
 *
 * Also the error page: `pages.error` points here, so an Auth.js failure
 * lands on the screen that can fix it rather than on a dead end that only
 * names the problem. `?error=` is translated by `describeAuthError`.
 *
 * Signing in is optional and the page says so. Per D6 the builder works
 * fully without an account, and an account only adds sync across devices —
 * overstating that would be the kind of claim §9 and D14 rule out.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { googleCredentials } from "@/server/auth/config";
import { describeAuthError } from "@/server/auth/errors";
import { resolveMailTransport } from "@/server/auth/mail";
import { Card } from "@/components/ui/card";
import { AppFooter } from "@/components/shell/AppFooter";
import { SignInForm } from "./SignInForm";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in with an email link or Google. There is no password, by design.",
};

/** Reads the session, so the page cannot be prerendered. */
export const dynamic = "force-dynamic";

/**
 * True when magic links are being written to disk instead of sent.
 *
 * Shown only outside production, and the transport refuses to run there
 * anyway — but a developer who does not know where the link went assumes
 * sign-in is broken, and this is cheaper than that debugging session.
 */
function developmentOutboxPath(): string | null {
  if (process.env.NODE_ENV === "production") return null;
  try {
    return resolveMailTransport().id === "outbox" ? (process.env.AUTH_DEV_OUTBOX ?? null) : null;
  } catch {
    return null;
  }
}

/**
 * True when Google sign-in is off *and* we are in a position to say why.
 *
 * The button is hidden without credentials on purpose — half-configured, it
 * redirects the user off the site and fails there, which is worse than not
 * offering it. But "hidden" and "broken" look identical from the browser,
 * and the person most likely to be confused by that is whoever is running
 * the app locally and has not set the pair yet. Same reasoning as the outbox
 * notice below it, and the same production guard: never rendered in a real
 * deployment, where a missing optional provider is a decision, not a mistake.
 */
function developmentGoogleHint(googleEnabled: boolean): boolean {
  return !googleEnabled && process.env.NODE_ENV !== "production";
}

export default async function SignInPage({ searchParams }: PageProps<"/signin">) {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  const params = await searchParams;
  const raw = params.error;
  const initialError = describeAuthError(Array.isArray(raw) ? raw[0] : raw) ?? undefined;
  const outbox = developmentOutboxPath();
  const googleEnabled = googleCredentials() !== null;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-16">
      <div>
        <h1 className="font-display text-text text-[2rem] leading-[1.1] font-semibold tracking-tight">
          Sign in
        </h1>
        <p className="text-muted mt-2 text-sm leading-relaxed">
          An account keeps your resumes on our server so they follow you between devices. You do not
          need one &mdash;{" "}
          <Link href="/builder" className="text-accent rule-grow rounded-sm">
            the builder works without signing in
          </Link>{" "}
          and always will.
        </p>
      </div>

      <Card className="p-5">
        <SignInForm googleEnabled={googleEnabled} initialError={initialError} />
      </Card>

      <p className="text-muted text-xs leading-relaxed">
        There is no password on this account, ever. Nothing to reuse, nothing to breach, nothing to
        reset. See the{" "}
        <Link href="/privacy" className="underline underline-offset-2">
          privacy policy
        </Link>{" "}
        for what an account stores.
      </p>

      {outbox ? (
        <p className="border-line text-muted rounded-md border border-dashed px-3 py-2 text-xs">
          Development build: sign-in emails are written to <code>{outbox}</code> instead of being
          sent.
        </p>
      ) : null}

      {developmentGoogleHint(googleEnabled) ? (
        <p className="border-line text-muted rounded-md border border-dashed px-3 py-2 text-xs leading-relaxed">
          Development build: the &ldquo;Continue with Google&rdquo; button is hidden because{" "}
          <code>AUTH_GOOGLE_ID</code> and <code>AUTH_GOOGLE_SECRET</code> are not set. Set both in{" "}
          <code>.env</code> and restart. The authorized redirect URI to register with Google is{" "}
          <code>&lt;origin&gt;/api/auth/callback/google</code>.
        </p>
      ) : null}

      <AppFooter className="border-0 px-0 py-0" />
    </main>
  );
}
