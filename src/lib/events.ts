/**
 * What the usage counter counts — a closed list, shared by the page and the
 * server so neither can say anything the other does not know.
 *
 * ## Why there is a counter at all
 *
 * `docs/MONETISATION.md` Phase 1 and `docs/ROADMAP.md` Phase 6: the content
 * and SEO work is steered by what people land on and what they do next, and
 * without a count that is guessing. Search Console says who arrived from
 * Google; it cannot say whether anyone who arrived opened the builder, or
 * whether the Reddit thread sent anyone at all.
 *
 * ## What it can say, and why that is all
 *
 * An event is a name from this file and nothing else — no properties, no
 * identifier, no URL beyond a public page's path. The server stores one
 * number per name per day (`EventCount`), and a name it does not recognise is
 * refused. So the most anyone could learn from the table is that on a given
 * day some number of visits did a given thing; not who, not in what order,
 * and never with what text.
 *
 * `privacy/page.tsx` lists these in words. Adding a name here means adding it
 * there; `events.test.ts` holds the two lists together.
 */

/**
 * Things a visit does. Named `area:what`, and grouped the way the funnel is
 * read: arrive, try a tool, build, get a file out, keep it.
 */
export const ACTION_EVENTS = [
  // The free tools, used rather than merely viewed.
  "check:read",
  "check:handoff",
  "scanner:compare",
  "scanner:handoff",
  "bullets:check",
  // The builder.
  "import:pdf",
  "import:docx",
  "import:json",
  "template:apply",
  "template:word",
  "template:pdf",
  "six-seconds:open",
  "xray:open",
  "interview:open",
  "match:run",
  "letter:compose",
  // A file leaving the builder, by format — the thing the product is for.
  "export:pdf",
  "export:docx",
  "export:txt",
  "export:json",
  // An account: asked for, by method, and granted (counted by the server).
  "signin:email",
  "signin:google",
  "signin:complete",
  "resume:save",
  // A guest keeping a copy, from the reminder that there is only one.
  "backup:download",
] as const;

/**
 * Where a visit came from, from the host of `document.referrer` alone and
 * coarsened to a name on this list. Nothing about the referring page — its
 * path, its query, the search terms some engines still put in one — is kept
 * or sent.
 */
export const SOURCES = [
  "direct",
  "google",
  "bing",
  "duckduckgo",
  "yahoo",
  "yandex",
  "ecosia",
  "brave",
  "chatgpt",
  "perplexity",
  "copilot",
  "gemini",
  "reddit",
  "hackernews",
  "linkedin",
  "x",
  "facebook",
  "youtube",
  "github",
  "producthunt",
  "other",
] as const;

/**
 * Every action, in the words the privacy page lists it in. A `Record` over
 * the whole list, so a name added above without a line here does not
 * compile — which is what keeps the page's list complete.
 */
export const ACTION_DESCRIPTIONS: Record<ActionEvent, string> = {
  "check:read": "a file was read by the free ATS check",
  "check:handoff": "the ATS check's result was taken into the builder",
  "scanner:compare": "the keyword scanner compared a posting with a resume",
  "scanner:handoff": "the keyword scanner's resume was taken into the builder",
  "bullets:check": "the bullet checker checked something (once per visit)",
  "import:pdf": "a PDF was imported into the builder",
  "import:docx": "a Word file was imported into the builder",
  "import:json": "a JSON Resume file was imported into the builder",
  "template:apply": "a template was applied",
  "template:word": "a template was downloaded as a Word file",
  "template:pdf": "a template was downloaded as a PDF",
  "six-seconds:open": "the Six seconds tab was opened",
  "xray:open": "the X-Ray tab was opened",
  "interview:open": "the Interview tab was opened",
  "match:run": "a resume was matched against a job description",
  "letter:compose": "a cover letter was composed",
  "export:pdf": "a PDF was downloaded",
  "export:docx": "a Word file was downloaded",
  "export:txt": "a plain-text file was downloaded",
  "export:json": "a JSON Resume file was downloaded",
  "signin:email": "a sign-in link was requested",
  "signin:google": "a Google sign-in was started",
  "signin:complete": "a sign-in completed",
  "resume:save": "a resume made without an account was saved to one",
  "backup:download": "a backup was downloaded from the reminder to keep one",
};

/** Written by the server about itself: events it refused to count because a window's cap was full. */
export const METER_EVENTS = ["meter:dropped"] as const;

export type ActionEvent = (typeof ACTION_EVENTS)[number];
export type Source = (typeof SOURCES)[number];
export type ViewEvent = `view:${string}`;
export type SourceEvent = `src:${Source}`;
export type EventName = ActionEvent | ViewEvent | SourceEvent | (typeof METER_EVENTS)[number];

/** Long enough for any real name; the server refuses anything longer unread. */
export const MAX_EVENT_NAME_LENGTH = 96;

/**
 * The shapes of the pages whose views are counted, for the browser's side.
 *
 * Deliberately loose: the page does not carry the list of example and guide
 * slugs — that list is most of a megabyte of example content — so it sends
 * anything with the right shape and the server checks it against the real
 * routes (`src/server/event-paths.ts`). An account page is counted by its
 * section, never by the id in its URL.
 */
const COUNTED_SHAPES: readonly RegExp[] = [
  /^\/$/,
  /^\/(check|templates|pricing|privacy|terms|changelog|examples|guides|builder|dashboard|letters|match|signin)$/,
  /^\/(resume-action-verbs|bullet-point-checker|resume-keyword-scanner)$/,
  /^\/(examples|guides)\/[a-z0-9-]{1,80}$/,
];

/** The view event for a pathname, or null for a page that is not counted. */
export function viewEvent(pathname: string): ViewEvent | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  // A letter or a check-email page has an id or a state in its URL; the
  // section is the whole of what is worth knowing, and all that is sent.
  if (/^\/letters\/./.test(path)) return "view:/letters";
  return COUNTED_SHAPES.some((shape) => shape.test(path)) ? `view:${path}` : null;
}

/**
 * Which source a referrer names, or null when it is this site — a click from
 * one page here to another is not a visit arriving.
 */
export function sourceOf(referrer: string, ownOrigin: string): Source | null {
  if (!referrer) return "direct";
  let url: URL;
  try {
    url = new URL(referrer);
  } catch {
    return "other";
  }
  if (url.origin === ownOrigin) return null;

  // Android's Google app sends itself as an app referrer, not a host.
  if (url.protocol === "android-app:") {
    return url.hostname.includes("googlequicksearchbox") ? "google" : "other";
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const is = (domain: string) => host === domain || host.endsWith(`.${domain}`);
  // An engine on any of its country domains — `google.co.in`, `yahoo.co.jp` —
  // and on nothing that merely starts with its name: `google.evil.example`
  // is not Google.
  const national = (brand: string) =>
    new RegExp(`(^|\\.)${brand}\\.(com|[a-z]{2}|co\\.[a-z]{2}|com\\.[a-z]{2})$`).test(host);
  // Specific before general: Gemini is on a google host.
  if (is("gemini.google.com")) return "gemini";
  if (national("google")) return "google";
  if (is("bing.com")) return "bing";
  if (is("duckduckgo.com")) return "duckduckgo";
  if (national("yahoo")) return "yahoo";
  if (national("yandex")) return "yandex";
  if (is("ecosia.org")) return "ecosia";
  if (is("search.brave.com")) return "brave";
  if (is("chatgpt.com") || is("chat.openai.com")) return "chatgpt";
  if (is("perplexity.ai")) return "perplexity";
  if (is("copilot.microsoft.com")) return "copilot";
  if (is("reddit.com")) return "reddit";
  if (is("news.ycombinator.com")) return "hackernews";
  if (is("linkedin.com") || is("lnkd.in")) return "linkedin";
  if (is("t.co") || is("x.com") || is("twitter.com")) return "x";
  if (is("facebook.com") || is("fb.com")) return "facebook";
  if (is("youtube.com") || is("youtu.be")) return "youtube";
  if (is("github.com")) return "github";
  if (is("producthunt.com")) return "producthunt";
  return "other";
}

/**
 * Whether a page may send this name, before the server checks a view's path
 * against the real routes. Shared so a page and the server agree on what is
 * even worth sending. The meter's own names are not on it: only the server
 * writes those, about itself.
 */
export function isEventName(name: string): name is EventName {
  if (name.length > MAX_EVENT_NAME_LENGTH) return false;
  if ((ACTION_EVENTS as readonly string[]).includes(name)) return true;
  if (name.startsWith("src:")) return (SOURCES as readonly string[]).includes(name.slice(4));
  if (name.startsWith("view:")) return viewEvent(name.slice(5)) === name;
  return false;
}
