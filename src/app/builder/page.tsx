/**
 * The builder (M0-T8), now able to open a resume from an account (M2-T4).
 *
 * `?resume=<id>` loads that resume server-side and hands it to the shell.
 * Without the parameter — and for everyone who is not signed in — nothing
 * changes: the builder opens the local draft and never touches the server.
 * That is the point of D6, and it survives accounts existing.
 *
 * An id that does not belong to the signed-in user gets the 404, exactly as
 * an id that does not exist does. There is nothing useful to tell someone
 * about a resume they cannot see, and one response for both cases is what
 * stops the page confirming that the id exists.
 *
 * It used to fall through to `<BuilderShell signedIn />` instead — which,
 * before local storage was namespaced per user (§10.1), silently rendered
 * whatever draft happened to be in this browser. Somebody following a link
 * to a colleague's resume was shown a resume; it simply was not the one in
 * the URL, and nothing on the page said so.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BuilderShell } from "@/components/builder/BuilderShell";
import { getSessionUser } from "@/server/auth/session";
import { loadResume } from "@/server/resumes";

export const metadata: Metadata = {
  title: "Build your resume",
  description: "Build an ATS-safe resume in your browser. Nothing is uploaded unless you save it.",
};

/** Reads the session and possibly the database; nothing here is prerenderable. */
export const dynamic = "force-dynamic";

export default async function BuilderPage({ searchParams }: PageProps<"/builder">) {
  const params = await searchParams;
  const raw = params.resume;
  const requestedId = (Array.isArray(raw) ? raw[0] : raw)?.trim();

  // Read once regardless of whether a specific resume was requested: P24's
  // "Save as new resume" is available to any signed-in visitor, including
  // one editing the local guest draft with no `?resume=` in the URL at all.
  const user = await getSessionUser();

  if (!requestedId || !user) return <BuilderShell signedIn={!!user} />;

  const loaded = await loadResume(user.id, requestedId);
  if (!loaded) notFound();

  return (
    <BuilderShell
      signedIn
      remote={{
        id: loaded.summary.id,
        title: loaded.summary.title,
        // Serialized rather than passed as an object: it crosses the
        // server/client boundary, and this is the same JSON the store
        // persists, so there is one representation in play.
        document: JSON.stringify(loaded.document),
      }}
    />
  );
}
