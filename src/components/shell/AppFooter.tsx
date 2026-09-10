/**
 * The application footer (P22-E1).
 *
 * Mounted per page rather than in the root layout, and that is deliberate.
 * `/builder` is a full-height three-column application view whose preview pane
 * fills the space beneath the header; a footer in the root layout would take
 * height from it on every render and shrink the resume canvas. Content pages
 * want a footer, application pages do not, and there is no way to express that
 * from a single shared layout without a route group and a page move.
 *
 * The tagline is the landing page's own, moved here rather than reworded. It
 * is the D14 position in one sentence, and it belongs on every page that has
 * room for it.
 *
 * The links are not decoration: `/examples` publishes eight pages and
 * `/guides` four, and internal links from every crawled page are how they get
 * discovered at all. They were underlined by default, which on a row this long
 * made the footer the busiest strip on a quiet page — the underline now
 * arrives on hover and focus, where it is doing a job. It grows from the left
 * rather than appearing all at once (`.rule-grow`), which is the same gesture
 * the section rules on the landing page make.
 */

import Link from "next/link";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/examples", label: "Examples" },
  { href: "/guides", label: "Guides" },
  { href: "/templates", label: "Templates" },
  { href: "/check", label: "Check a resume" },
  { href: "/letters", label: "Cover letters" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

export function AppFooter({ className }: { className?: string }) {
  return (
    <footer className={cn("border-line mt-auto border-t px-6 py-12", className)}>
      <div className="mx-auto flex max-w-5xl flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
        <p className="text-muted max-w-xs text-sm leading-relaxed text-balance">
          Built to be honest about what a resume can and cannot do.
        </p>
        <nav aria-label="Footer">
          <ul className="grid grid-cols-2 gap-x-8 gap-y-2 sm:flex sm:flex-wrap sm:justify-end">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-muted hover:text-text focus-visible:ring-accent rule-grow rounded-sm text-sm transition-colors duration-[var(--dur-fast)] focus-visible:ring-2 focus-visible:outline-none"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
