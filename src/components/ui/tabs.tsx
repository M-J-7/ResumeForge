"use client";

/**
 * A tab set, with the keyboard behaviour the pattern actually requires.
 *
 * The app had two hand-rolled tablists — the mobile Edit/Preview switch in
 * `BuilderShell` and Preview/X-Ray in `PreviewPane`. Both got the roles right
 * and the keyboard wrong: every tab was a tab stop, and arrow keys did
 * nothing. This is one implementation of the pattern so that fix lands in
 * both places, and in the Match tab that P27 adds beside them.
 *
 * ## Roving tabindex
 *
 * Only the selected tab is in the tab order; arrow keys move between tabs and
 * change the selection. That is what makes a five-tab set cost one tab stop
 * instead of five, and it is what a screen reader user expects from something
 * announcing itself as a tab list. §9 requires the builder to be keyboard
 * navigable end to end, and "reachable by pressing Tab eleven times" is not
 * the same thing as navigable.
 *
 * ## Accessible names are pinned by tests
 *
 * `e2e/builder.spec.ts` matches `getByRole("tab", { name: "X-Ray" })`. A tab's
 * name is its children, so callers pass plain text and any icon they add must
 * be `aria-hidden`.
 */

import {
  createContext,
  useCallback,
  useContext,
  useId,
  useRef,
  type ComponentProps,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

interface TabsContextValue {
  value: string;
  onValueChange: (next: string) => void;
  baseId: string;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabs(component: string): TabsContextValue {
  const context = useContext(TabsContext);
  if (!context) throw new Error(`<${component}> must be used inside <Tabs>`);
  return context;
}

export function Tabs({
  value,
  onValueChange,
  children,
  className,
}: {
  value: string;
  onValueChange: (next: string) => void;
  children: ReactNode;
  className?: string;
}) {
  const baseId = useId();
  return (
    <TabsContext.Provider value={{ value, onValueChange, baseId }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabList({
  label,
  className,
  children,
  ...props
}: ComponentProps<"div"> & { label: string }) {
  const listRef = useRef<HTMLDivElement>(null);

  /**
   * Navigation reads the DOM rather than a registry of children.
   *
   * A registry means every Tab has to register and deregister on mount, which
   * breaks the moment a tab is conditionally rendered — and the Match tab in
   * `PreviewPane` is exactly that. The DOM already holds the authoritative
   * order.
   */
  const onKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const keys = ["ArrowRight", "ArrowLeft", "Home", "End"];
    if (!keys.includes(event.key)) return;

    const tabs = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])') ?? [],
    );
    if (tabs.length === 0) return;

    const current = tabs.findIndex((tab) => tab === document.activeElement);
    let next: number;
    if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else {
      const delta = event.key === "ArrowRight" ? 1 : -1;
      next = (Math.max(current, 0) + delta + tabs.length) % tabs.length;
    }

    event.preventDefault();
    // Focus, not just select. Moving selection without moving focus leaves a
    // screen reader reading the old tab.
    tabs[next]?.focus();
    tabs[next]?.click();
  }, []);

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn(
        "border-line bg-surface-2 inline-flex gap-0.5 rounded-md border p-0.5",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function Tab({
  value,
  className,
  children,
  /**
   * Pass `true` only when a `TabPanel` with the same `value` is actually
   * rendered somewhere in the tree. It is what wires `aria-controls` to that
   * panel's id.
   *
   * Defaulting to `false` rather than always wiring it is deliberate: both
   * current call sites (the builder's mobile Edit/Preview switch, and
   * Preview/X-Ray in `PreviewPane`) manage which content is visible with
   * their own conditional markup rather than `TabPanel`, so an
   * auto-generated `aria-controls` would point at an id nothing renders.
   * axe's `aria-valid-attr-value` rule catches exactly that — a reference to
   * an element that does not exist — and it is right to.
   */
  hasPanel = false,
  ...props
}: ComponentProps<"button"> & { value: string; hasPanel?: boolean }) {
  const tabs = useTabs("Tab");
  const selected = tabs.value === value;

  return (
    <button
      type="button"
      role="tab"
      id={`${tabs.baseId}-tab-${value}`}
      aria-selected={selected}
      aria-controls={hasPanel ? `${tabs.baseId}-panel-${value}` : undefined}
      tabIndex={selected ? 0 : -1}
      onClick={() => tabs.onValueChange(value)}
      className={cn(
        "focus-visible:ring-accent rounded-[6px] px-3 py-1.5 text-sm font-medium transition focus-visible:ring-2 focus-visible:outline-none",
        selected ? "bg-surface-0 text-text shadow-sm" : "text-muted hover:text-text",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function TabPanel({
  value,
  className,
  children,
  ...props
}: ComponentProps<"div"> & { value: string }) {
  const tabs = useTabs("TabPanel");
  if (tabs.value !== value) return null;

  return (
    <div
      role="tabpanel"
      id={`${tabs.baseId}-panel-${value}`}
      aria-labelledby={`${tabs.baseId}-tab-${value}`}
      // Focusable so that tabbing out of the tab list lands in the panel it
      // controls, rather than skipping past the content the user just chose.
      tabIndex={0}
      className={cn("focus-visible:outline-none", className)}
      {...props}
    >
      {children}
    </div>
  );
}
