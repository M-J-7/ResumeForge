/**
 * A `<script type="application/ld+json">`, once (§10.4b).
 *
 * A server component with no client cost: this renders to a script tag with a
 * non-executable type, so nothing here reaches the browser as JavaScript and
 * nothing hydrates.
 *
 * `dangerouslySetInnerHTML` is unavoidable — React escapes text children, and
 * an escaped `&quot;` inside a JSON-LD block makes it unparseable. The
 * escaping that actually matters is done in `jsonLdScript`, which neutralises
 * `<` so a string in the payload cannot close the block early.
 *
 * The CSP is `script-src 'self' 'unsafe-inline'`, so this is allowed for the
 * same reason Next's own inline bootstrap is. It would still be allowed under
 * a stricter policy: a `type` the browser does not execute is not a script.
 */

import { jsonLdScript, type JsonLd } from "@/lib/structured-data";

export function JsonLdScript({ data }: { data: JsonLd | null }) {
  if (!data) return null;
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(data) }} />
  );
}
