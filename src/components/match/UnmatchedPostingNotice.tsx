/**
 * "Nothing in this posting matched a skill we recognise" (§10.2, 2.2).
 *
 * Lifted out of `MatchReport` so the letter editor can render the same words.
 * It was already the right copy — it names the posting and our vocabulary as
 * the thing at fault rather than the user's resume, which is the honest
 * reading and the one the product's whole tone depends on — and the editor
 * was silently producing a worse version of the same situation: a bracketed
 * prompt telling the user to add bullets they may well already have.
 *
 * Extracted rather than rewritten, deliberately. Two components explaining
 * the same condition in two different registers is how a product starts
 * contradicting itself about whose fault something is.
 */

export function UnmatchedPostingNotice() {
  return (
    <div className="border-warn/30 bg-warn-weak rounded-lg border p-4">
      <p className="text-warn text-sm font-medium">
        Nothing in this posting matched a skill we recognise.
      </p>
      <p className="text-warn mt-1 text-xs opacity-90">
        That is a statement about the posting and about our vocabulary, not about your resume — so
        no score is shown. It usually means the text pasted was a page of boilerplate rather than
        the requirements, or the role is in a field our skill list does not cover yet. Try pasting
        the requirements section on its own.
      </p>
    </div>
  );
}
