/**
 * "Keep reading": the sideways links at the end of an example or a guide
 * (ROADMAP Phase 1.7). Which pages appear is decided in `lib/related.ts`;
 * this only draws them.
 *
 * Server-rendered links in the HTML, not a client widget, because the point
 * is partly for a crawler: a link that exists only after hydration is one a
 * crawler that does not run scripts never follows. The cards are the ones the
 * examples index uses — the whole card is the target, it lifts and catches the
 * spotlight — so a reader meets one pattern for "go to another page" across
 * the content surface.
 */

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { SpotlightGroup } from "@/components/ui/Spotlight";

export interface RelatedItem {
  href: string;
  label: string;
  /** One line on what is there, so the reader can choose without clicking. */
  detail: string;
}

export interface RelatedGroup {
  title: string;
  items: readonly RelatedItem[];
}

export function RelatedLinks({
  groups,
  stacked = false,
}: {
  groups: readonly RelatedGroup[];
  /** One column, for a narrow reading measure like a guide's. */
  stacked?: boolean;
}) {
  const visible = groups.filter((group) => group.items.length > 0);
  if (visible.length === 0) return null;

  return (
    <section aria-labelledby="related-heading" className="flex flex-col gap-6">
      <h2 id="related-heading" className="text-text text-title font-semibold">
        Keep reading
      </h2>
      <div className={stacked ? "grid gap-8" : "grid gap-8 lg:grid-cols-2"}>
        {visible.map((group) => (
          <div key={group.title} className="flex flex-col gap-3">
            <h3 className="text-muted text-small font-semibold">{group.title}</h3>
            <SpotlightGroup>
              <ul className="grid gap-3">
                {group.items.map((item) => (
                  <li key={item.href} className="relative">
                    <Card className="spot lift hover:border-line-strong h-full p-4">
                      <p className="text-text text-body font-semibold">
                        <Link
                          href={item.href}
                          // The card is the target; the words say which part
                          // is the link. Same arrangement as `/examples`.
                          className="hover:text-accent rounded-sm after:absolute after:inset-0"
                        >
                          {item.label}
                        </Link>
                      </p>
                      <p className="text-muted text-small mt-1 leading-relaxed">{item.detail}</p>
                    </Card>
                  </li>
                ))}
              </ul>
            </SpotlightGroup>
          </div>
        ))}
      </div>
    </section>
  );
}
