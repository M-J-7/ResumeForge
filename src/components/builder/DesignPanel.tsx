"use client";

/**
 * The settings surface `resume.settings` never had a UI for (P23-F3).
 *
 * `fontPair`, `fontSizePt`, `lineHeight`, `margins`, `density`, `pageSize`
 * and `accent` have all existed in the schema since M0, and `setSettings`
 * has always been able to write every one of them — but nothing in the app
 * called it. `FONT_PAIRS` was imported by exactly one file, `pairs.ts`
 * itself. The product had five font pairs and no way to choose between them,
 * which is most of why it read as having no templates at all.
 *
 * Every control here writes through the existing store `update()` machinery
 * via `setSettings`, so undo/redo, autosave and remote sync all work for
 * free — this panel adds no persistence path of its own.
 */

import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/control";
import { AlertTriangleIcon } from "@/components/ui/icons";
import { useResumeStore } from "@/store/resume";
import { previewFontFamily, useFontPairPreviewsReady } from "@/lib/fonts/useFontPairPreviews";
import { FONT_PAIR_IDS, FONT_PAIRS, type FontPairId } from "@/lib/fonts/pairs";
import {
  DENSITIES,
  HEADER_STYLES,
  HEADING_STYLES,
  PAGE_SIZES,
  type Density,
  type HeaderStyle,
  type HeadingStyle,
  type PageSize,
} from "@/lib/resume/schema";
import { matchTemplate } from "@/lib/resume/templates";
import { TemplateGallery } from "@/components/templates/TemplateGallery";
import { meetsAccentContrast } from "@/lib/resume/contrast";
import { cn } from "@/lib/utils";

/**
 * A curated set, not a free colour picker.
 *
 * Section 9 requires rejecting combinations that fail contrast against
 * white, and an open color input would need that check running on every drag
 * frame. A fixed palette lets the check run once, at module load, and keeps
 * every option a considered one rather than an accident of where the cursor
 * stopped.
 */
const ACCENT_SWATCHES = [
  "#1F2937",
  "#0369A1",
  "#075985",
  "#166534",
  "#92400E",
  "#9D174D",
  "#4C1D95",
  "#B91C1C",
  "#3F3F46",
  "#78716C",
  // Included deliberately, and deliberately disabled: this is the failure
  // mode the contrast check exists to catch, shown rather than hidden so the
  // rule is visible instead of merely enforced.
  "#FDE68A",
] as const;

const HEADER_STYLE_LABELS: Record<HeaderStyle, string> = {
  left: "Left",
  centered: "Centred",
};

const HEADING_STYLE_LABELS: Record<HeadingStyle, string> = {
  rule: "Underlined",
  caps: "Plain caps",
  "accent-bar": "Accent bar",
};

export function DesignPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const settings = useResumeStore((s) => s.history.present.settings);
  const setSettings = useResumeStore((s) => s.setSettings);
  const applyTemplate = useResumeStore((s) => s.applyTemplate);
  const previewsReady = useFontPairPreviewsReady();
  const activeTemplate = matchTemplate(settings);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Design"
      description="Changes apply immediately and can be undone."
      // Wider than the default dialog: a three-column gallery of rendered
      // pages is the content, and at 32rem the thumbnails are too small to
      // tell the templates apart — which is the one job they have.
      className="w-[min(56rem,calc(100vw-2rem))]"
    >
      <div className="flex max-h-[70vh] flex-col gap-6 overflow-y-auto">
        {/*
          Templates first, above the individual controls. Choosing a starting
          point and then adjusting it is the order people actually work in,
          and it is the order that makes the five font pairs legible as
          twelve documents rather than as five dropdown entries.
        */}
        <section className="flex flex-col gap-2">
          <h3 className="text-muted text-xs font-semibold tracking-wide uppercase">Templates</h3>
          <p className="text-muted text-xs">
            Every one is single-column, real text, with standard section headings — the structure
            that reads most reliably. They differ in typography and order, never in that.
          </p>
          {/*
            Mounted only while the dialog is open, and that is not a
            micro-optimisation. A closed `<dialog>` still has its children in
            the DOM, so an unconditional gallery would run twelve PDF renders
            on every single builder page load — against a §2.2 budget of
            three seconds to interactive on throttled 4G, for a panel most
            sessions never open. It also put twelve more controls in the
            accessibility tree of a page they are not part of, which is how
            this was found: `getByLabel("Phone")` on the builder started
            matching a template card whose description ends "…read on a
            phone".
          */}
          {open ? (
            <TemplateGallery
              selectedId={activeTemplate?.id ?? null}
              onSelect={(template) => applyTemplate(template.settings, template.sectionOrder)}
              className="lg:grid-cols-3"
            />
          ) : null}
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-muted text-xs font-semibold tracking-wide uppercase">Font pair</h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {FONT_PAIR_IDS.map((id) => (
              <FontPairSwatch
                key={id}
                id={id}
                selected={settings.fontPair === id}
                ready={previewsReady}
                onSelect={() => setSettings({ fontPair: id })}
              />
            ))}
          </div>
        </section>

        <section className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-text font-medium">Header</span>
            <Select
              value={settings.headerStyle}
              onChange={(e) => setSettings({ headerStyle: e.target.value as HeaderStyle })}
            >
              {HEADER_STYLES.map((style) => (
                <option key={style} value={style}>
                  {HEADER_STYLE_LABELS[style]}
                </option>
              ))}
            </Select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            {/*
              "Heading style", not "Section headings": the Custom step already
              labels an input "Section heading", and `getByLabel` matches on a
              substring — so the two became one ambiguous locator the moment
              this control shipped. The clearer name is also the better one.
            */}
            <span className="text-text font-medium">Heading style</span>
            <Select
              value={settings.headingStyle}
              onChange={(e) => setSettings({ headingStyle: e.target.value as HeadingStyle })}
            >
              {HEADING_STYLES.map((style) => (
                <option key={style} value={style}>
                  {HEADING_STYLE_LABELS[style]}
                </option>
              ))}
            </Select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-text font-medium">Page size</span>
            <Select
              value={settings.pageSize}
              onChange={(e) => setSettings({ pageSize: e.target.value as PageSize })}
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size === "A4" ? "A4" : "US Letter"}
                </option>
              ))}
            </Select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-text font-medium">Density</span>
            <Select
              value={settings.density}
              onChange={(e) => setSettings({ density: e.target.value as Density })}
            >
              {DENSITIES.map((density) => (
                <option key={density} value={density}>
                  {density === "compact" ? "Compact" : "Comfortable"}
                </option>
              ))}
            </Select>
          </label>
        </section>

        <RangeSetting
          label="Font size"
          value={settings.fontSizePt}
          min={9}
          max={12}
          step={0.5}
          formatValue={(v) => `${v}pt`}
          onChange={(fontSizePt) => setSettings({ fontSizePt })}
        />
        <RangeSetting
          label="Line height"
          value={settings.lineHeight}
          min={1}
          max={1.6}
          step={0.05}
          formatValue={(v) => v.toFixed(2)}
          onChange={(lineHeight) => setSettings({ lineHeight })}
        />
        <RangeSetting
          label="Margins"
          value={settings.margins}
          min={0.4}
          max={1}
          step={0.05}
          formatValue={(v) => `${v.toFixed(2)}in`}
          onChange={(margins) => setSettings({ margins })}
        />

        <section className="flex flex-col gap-2">
          <h3 className="text-muted text-xs font-semibold tracking-wide uppercase">
            Accent colour
          </h3>
          <div className="flex flex-wrap gap-2">
            {ACCENT_SWATCHES.map((hex) => (
              <AccentSwatch
                key={hex}
                hex={hex}
                selected={settings.accent.toUpperCase() === hex.toUpperCase()}
                onSelect={() => setSettings({ accent: hex })}
              />
            ))}
          </div>
          <p className="text-muted text-xs">
            Colours that would be too faint to read on the page are shown but disabled. Section 9
            requires every accent to clear WCAG AA contrast against white, the colour of the
            rendered document.
          </p>
        </section>
      </div>
    </Dialog>
  );
}

function FontPairSwatch({
  id,
  selected,
  ready,
  onSelect,
}: {
  id: FontPairId;
  selected: boolean;
  ready: boolean;
  onSelect: () => void;
}) {
  const pair = FONT_PAIRS[id];
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex flex-col gap-1 rounded-md border p-3 text-left transition",
        "focus-visible:ring-accent focus-visible:ring-2 focus-visible:outline-none",
        selected ? "border-accent bg-accent-weak" : "border-line hover:bg-surface-2",
      )}
    >
      <span
        className="text-text truncate text-base"
        style={ready ? { fontFamily: previewFontFamily(id) } : undefined}
      >
        {pair.label}
      </span>
      <span className="text-muted text-xs">
        {pair.description} Exports as {pair.docxName} in DOCX.
      </span>
    </button>
  );
}

function AccentSwatch({
  hex,
  selected,
  onSelect,
}: {
  hex: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const allowed = meetsAccentContrast(hex);
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!allowed}
      aria-pressed={selected}
      aria-label={allowed ? hex : `${hex} fails contrast against white, unavailable`}
      title={allowed ? hex : `${hex} does not meet WCAG AA contrast against a white page`}
      className={cn(
        "relative h-8 w-8 shrink-0 rounded-full ring-2 ring-offset-2 ring-offset-[var(--surface-0)] transition",
        "focus-visible:outline-none",
        selected ? "ring-accent" : "ring-transparent",
        !allowed && "cursor-not-allowed opacity-40",
      )}
      style={{ backgroundColor: hex }}
    >
      {!allowed ? (
        <AlertTriangleIcon className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow" />
      ) : null}
    </button>
  );
}

function RangeSetting({
  label,
  value,
  min,
  max,
  step,
  formatValue,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  formatValue: (value: number) => string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-text flex items-baseline justify-between font-medium">
        {label}
        <span className="text-muted font-normal tabular-nums">{formatValue(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="accent-accent h-1.5 w-full cursor-pointer"
      />
    </label>
  );
}
