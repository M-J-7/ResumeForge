import type { ReactNode } from "react";
import { SiteHeader } from "@/components/shell/SiteHeader";

/**
 * The content pages: prerendered once, served to everyone as the same file.
 *
 * Nothing in this group may read the session, cookies or headers on the
 * server — one such call makes the route per-request again, and on this
 * instance that is the difference between surviving a shared link and not.
 * `SiteHeader` learns who is signed in from the browser instead.
 */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      {children}
    </>
  );
}
