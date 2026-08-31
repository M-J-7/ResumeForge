/**
 * "Check your email" (M2-T2) — Auth.js's `pages.verifyRequest`.
 *
 * Reached two ways: our own redirect after the action succeeds, which
 * carries the address, and Auth.js's internal `verify-request` redirect,
 * which does not. Both render; only the first can name the address, so the
 * copy has to work without it.
 *
 * It says the link expires and that it works once, because a user who tries
 * a used link and gets a bare "Verification" error otherwise concludes the
 * account is broken.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { MAGIC_LINK_MAX_AGE_SECONDS } from "@/server/auth/config";

export const metadata: Metadata = {
  title: "Check your email — ATS Resume Builder",
  description: "A sign-in link is on its way.",
};

export default async function CheckEmailPage({ searchParams }: PageProps<"/signin/check-email">) {
  const params = await searchParams;
  const raw = params.email;
  const email = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  const minutes = Math.round(MAGIC_LINK_MAX_AGE_SECONDS / 60);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-16">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Check your email</h1>
      <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        {email ? (
          <>
            A sign-in link is on its way to <strong className="font-medium">{email}</strong>.
          </>
        ) : (
          <>A sign-in link is on its way.</>
        )}{" "}
        It works once and expires in {minutes} minutes.
      </p>
      <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        Nothing arrived? Check the spam folder, then{" "}
        <Link href="/signin" className="underline underline-offset-2">
          request another link
        </Link>
        . An earlier link stays valid until it expires, so either one will work.
      </p>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        You can keep working meanwhile —{" "}
        <Link href="/builder" className="underline underline-offset-2">
          the builder does not need an account
        </Link>
        .
      </p>
    </main>
  );
}
