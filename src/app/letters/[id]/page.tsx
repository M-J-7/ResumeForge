/**
 * One cover letter (P29-J2).
 *
 * `/letters/new` composes a fresh one; `/letters/<id>` opens a saved one.
 * The literal segment is handled here rather than in a sibling `new/`
 * directory because the two states share every prop the editor takes — the
 * only difference is whether `initial` is null — and a second route file
 * would be a copy of this one with four lines removed.
 *
 * ## Guests get the same page
 *
 * An id that is not a letter on this account renders the editor with nothing
 * loaded rather than a 404, because a signed-out visitor's letters live in
 * IndexedDB and the server cannot see them. `LetterEditor` then looks the id
 * up locally. Reporting "not found" from the server would be wrong for
 * exactly the users D6 exists to protect.
 *
 * ## Prefill from the Match tab
 *
 * `?job=<id>` and `?resume=<id>` are how "Write a cover letter" arrives from
 * the Match tab with the posting already chosen.
 */

import type { Metadata } from "next";
import { getSessionUser } from "@/server/auth/session";
import { listResumes } from "@/server/resumes";
import { listJobTargets } from "@/server/job-targets";
import { loadCoverLetter } from "@/server/cover-letters";
import { LetterEditor, type InitialLetter } from "@/components/letters/LetterEditor";

export const metadata: Metadata = {
  title: "Cover letter",
  description: "A cover letter assembled from your own resume. Nothing invented, all editable.",
};

/** Reads the session and possibly the database; nothing here is prerenderable. */
export const dynamic = "force-dynamic";

function first(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : null;
}

export default async function LetterPage({ params, searchParams }: PageProps<"/letters/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  const user = await getSessionUser();

  const preselectedJobTargetId = first(query.job);
  const preselectedResumeId = first(query.resume);

  if (!user) {
    return (
      <main className="flex min-h-0 flex-1 flex-col">
        <LetterEditor
          signedIn={false}
          letterId={id === "new" ? null : id}
          preselectedJobTargetId={preselectedJobTargetId}
          preselectedResumeId={preselectedResumeId}
        />
      </main>
    );
  }

  const [resumes, jobTargets] = await Promise.all([
    listResumes(user.id),
    listJobTargets(user.id),
  ]);

  let initial: InitialLetter | null = null;
  if (id !== "new") {
    const loaded = await loadCoverLetter(user.id, id);
    if (loaded) {
      initial = {
        id: loaded.record.id,
        title: loaded.record.title,
        // Serialized rather than passed as an object: it crosses the
        // server/client boundary, and this is the same JSON the store keeps.
        content: loaded.record.content,
        resumeId: loaded.record.resumeId,
        jobTargetId: loaded.record.jobTargetId,
        // Carried since §10.2: the editor was reading these only on the guest
        // load path, so a signed-in user reopening a letter got both blank.
        company: loaded.record.company,
        roleTitle: loaded.record.roleTitle,
      };
    }
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <LetterEditor
        signedIn
        letterId={id === "new" ? null : id}
        initial={initial}
        resumes={resumes.map((resume) => ({ id: resume.id, title: resume.title }))}
        jobTargets={jobTargets.map((target) => ({
          id: target.id,
          title: target.title,
          company: target.company,
          roleTitle: target.roleTitle,
        }))}
        preselectedJobTargetId={preselectedJobTargetId}
        preselectedResumeId={preselectedResumeId}
      />
    </main>
  );
}
