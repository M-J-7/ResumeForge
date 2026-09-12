/**
 * Date entry.
 *
 * Dates are captured as `{ year, month }` and never as a typed string, per
 * M0-T1 — a free-text date field produces "03/04/2023", which is March 4th
 * to an American reader and April 3rd to everyone else. Two selects cannot
 * be ambiguous, cannot be mistyped, and need no parsing.
 *
 * Month is optional because plenty of people only remember the year, and
 * forcing a guess produces worse data than allowing the gap.
 */

"use client";

import { Button, Field, Select, Toggle } from "@/components/ui/control";
import { compareDates, type DateRange, type PartialDate } from "@/lib/resume/dates";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const CURRENT_YEAR = new Date().getFullYear();
/** Far enough back for a long career, far enough forward for a planned graduation. */
const YEARS = Array.from({ length: 60 }, (_, i) => CURRENT_YEAR + 5 - i);

function PartialDateFields({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: PartialDate;
  onChange: (next: PartialDate) => void;
  error?: string;
}) {
  return (
    <Field label={label} error={error}>
      {({ id, describedBy }) => (
        <div className="flex gap-2">
          <Select
            id={id}
            aria-describedby={describedBy}
            aria-label={`${label} month`}
            value={value.month ?? ""}
            onChange={(e) =>
              onChange({ ...value, month: e.target.value === "" ? null : Number(e.target.value) })
            }
          >
            <option value="">Month (optional)</option>
            {MONTHS.map((month, i) => (
              <option key={month} value={i + 1}>
                {month}
              </option>
            ))}
          </Select>
          <Select
            aria-label={`${label} year`}
            value={value.year}
            onChange={(e) => onChange({ ...value, year: Number(e.target.value) })}
          >
            {YEARS.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </Select>
        </div>
      )}
    </Field>
  );
}

export function DateRangeFields({
  value,
  onChange,
  currentLabel = "I currently work here",
}: {
  value: DateRange;
  onChange: (next: DateRange) => void;
  currentLabel?: string;
}) {
  const endBeforeStart =
    !value.current && value.end !== null && compareDates(value.start, value.end) > 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <PartialDateFields
          label="Start"
          value={value.start}
          onChange={(start) => onChange({ ...value, start })}
        />
        {value.current ? null : (
          <PartialDateFields
            label="End"
            value={value.end ?? { year: CURRENT_YEAR, month: null }}
            onChange={(end) => onChange({ ...value, end })}
            error={endBeforeStart ? "The end date is before the start date." : undefined}
          />
        )}
      </div>
      <Toggle
        checked={value.current}
        label={currentLabel}
        onChange={(current) =>
          onChange(
            current
              ? { ...value, current: true, end: null }
              : { ...value, current: false, end: { year: CURRENT_YEAR, month: null } },
          )
        }
      />
    </div>
  );
}

/** The same control for an optional range, e.g. a project that may be undated. */
export function OptionalDateRangeFields({
  value,
  onChange,
  currentLabel,
}: {
  value: DateRange | null;
  onChange: (next: DateRange | null) => void;
  currentLabel?: string;
}) {
  if (value === null) {
    return (
      <Button
        className="self-start"
        onClick={() =>
          onChange({ start: { year: CURRENT_YEAR, month: null }, end: null, current: true })
        }
      >
        Add dates
      </Button>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <DateRangeFields value={value} onChange={onChange} currentLabel={currentLabel} />
      <Button variant="ghost" className="self-start" onClick={() => onChange(null)}>
        Remove dates
      </Button>
    </div>
  );
}

export function PartialDateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: PartialDate | null;
  onChange: (next: PartialDate | null) => void;
}) {
  if (value === null) {
    return (
      <Button className="self-start" onClick={() => onChange({ year: CURRENT_YEAR, month: null })}>
        Add a date
      </Button>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <PartialDateFields label={label} value={value} onChange={onChange} />
      <Button variant="ghost" className="self-start" onClick={() => onChange(null)}>
        Remove date
      </Button>
    </div>
  );
}
