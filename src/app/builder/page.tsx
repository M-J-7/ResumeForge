/**
 * The builder (M0-T8), now able to open a resume from an account (M2-T4).
 *
 * `?resume=<id>` loads that resume server-side and hands it to the shell.
 * Without the parameter — and for everyone who is not signed in — nothing
 * changes: the builder opens the local draft and never touches the server.
 * That is the point of D6, and it survives accounts existing.
 *
 * An id that does not belong to the signed-in user simply loads no resume,
 * rather than erroring. There is nothing useful to tell someone about a
 * resume they cannot see, and a distinct "not yours" response would confirm
 * that the id exists.
 */

import type { Metadata } from "next";
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

  if (!requestedId) return <BuilderShell />;

  const user = await getSessionUser();
  if (!user) return <BuilderShell />;

  const loaded = await loadResume(user.id, requestedId);
  if (!loaded) return <BuilderShell />;

  return (
    <BuilderShell
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
