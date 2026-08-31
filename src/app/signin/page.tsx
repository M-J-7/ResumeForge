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

export default async function SignInPage({ searchParams }: PageProps<"/signin">) {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  const params = await searchParams;
  const raw = params.error;
  const initialError = describeAuthError(Array.isArray(raw) ? raw[0] : raw) ?? undefined;
  const outbox = developmentOutboxPath();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Sign in</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          An account keeps your resumes on our server so they follow you between devices. You do not
          need one —{" "}
          <Link href="/builder" className="underline underline-offset-2">
            the builder works without signing in
          </Link>{" "}
          and always will.
        </p>
      </div>

      <SignInForm googleEnabled={googleCredentials() !== null} initialError={initialError} />

      <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
        There is no password on this account, ever. Nothing to reuse, nothing to breach, nothing to
        reset. See the{" "}
        <Link href="/privacy" className="underline underline-offset-2">
          privacy policy
        </Link>{" "}
        for what an account stores.
      </p>

      {outbox ? (
        <p className="rounded-md border border-dashed border-zinc-300 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          Development build: sign-in emails are written to <code>{outbox}</code> instead of being
          sent.
        </p>
      ) : null}
    </main>
  );
}
