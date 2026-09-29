import type { ReactNode } from "react";
import { AppHeader } from "@/components/shell/AppHeader";

/**
 * An application route: rendered per request, with the header that reads the
 * session on the server. See `AppHeader` for why these routes need that and
 * the content pages must not have it.
 */
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <AppHeader />
      {children}
    </>
  );
}
