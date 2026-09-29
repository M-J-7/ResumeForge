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
import { PAGE_TITLE_CLASS } from "@/components/marketing/Band";
import { appPageMetadata } from "@/lib/seo";
import { MAGIC_LINK_MAX_AGE_SECONDS } from "@/server/auth/config";

export const metadata: Metadata = appPageMetadata({
  title: "Check your email",
  description: "A sign-in link is on its way.",
  path: "/signin/check-email",
});

export default async function CheckEmailPage({ searchParams }: PageProps<"/signin/check-email">) {
  const params = await searchParams;
  const raw = params.email;
  const email = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  const minutes = Math.round(MAGIC_LINK_MAX_AGE_SECONDS / 60);

  return (
    <main id="main-content" tabIndex={-1} className="flex flex-1 flex-col">
      {/* Centred, for the reason set out in `signin/page.tsx`: a page that is
          one sentence and a link is not a page with a masthead. */}
      <div className="py-band-tight mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6">
        <h1 className={PAGE_TITLE_CLASS}>Check your email</h1>
        <p className="text-muted text-body-l leading-relaxed">
          {email ? (
            <>
              A sign-in link is on its way to <strong className="font-medium">{email}</strong>.
            </>
          ) : (
            <>A sign-in link is on its way.</>
          )}{" "}
          It works once and expires in {minutes} minutes.
        </p>
        <p className="text-muted text-body leading-relaxed">
          Nothing arrived? Check the spam folder, then{" "}
          <Link href="/signin" className="text-accent rule-grow rounded-sm">
            request another link
          </Link>
          . An earlier link stays valid until it expires, so either one will work.
        </p>
        <p className="text-faint text-small">
          You can keep working meanwhile —{" "}
          <Link href="/builder" className="text-accent rule-grow rounded-sm">
            the builder does not need an account
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
