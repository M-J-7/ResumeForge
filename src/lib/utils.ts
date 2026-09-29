import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * The type scale's names, as `tailwind-merge` has to be told them.
 *
 * `twMerge` resolves a conflict by deciding which *group* a class belongs to,
 * and it does that from Tailwind's own default scale plus a set of validators.
 * `text-sm` is a size because "sm" is a known size; `text-muted` is a colour
 * because "muted" is not. Both heuristics are correct until a project adds a
 * font size called `title` — at which point `cn("text-small", "text-title")`
 * classifies the two into *different* groups, keeps both, and leaves the
 * winner to whichever the stylesheet happens to emit last.
 *
 * That is not a hypothetical: it shipped for about an hour on the landing
 * page's refusals, where a `text-title` override was silently losing to the
 * component's own `text-small`. The failure mode is the worst kind — no error,
 * no warning, and a component prop that simply does not work.
 *
 * So the scale is declared here, once, next to the `@theme` block that creates
 * it. Adding a size to `globals.css` and not to this list is a bug; the list
 * is short precisely so that staying in step is easy.
 */
const TYPE_SCALE = [
  "display-1",
  "display-2",
  "display-3",
  "title",
  "body-l",
  "body",
  "small",
  "micro",
] as const;

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: [...TYPE_SCALE] }],
    },
  },
});

/** Merges Tailwind classes so a caller's override wins over a component default. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
