import { describe, expect, it } from "vitest";
import {
  DATE_RANGE_SEPARATOR,
  compareDates,
  formatDateRange,
  formatPartialDate,
  isValidRange,
} from "./dates";

describe("formatPartialDate", () => {
  it("renders month names rather than numbers", () => {
    expect(formatPartialDate({ year: 2023, month: 1 })).toBe("Jan 2023");
    expect(formatPartialDate({ year: 2023, month: 12 })).toBe("Dec 2023");
  });

  it("renders the year alone when no month is set", () => {
    expect(formatPartialDate({ year: 2023, month: null })).toBe("2023");
  });

  /**
   * The whole reason dates are stored structurally: "03/04/2023" reads as
   * 3 April to most of the world and 4 March in the US. A month name cannot be
   * misread, which matters for a global audience and for ATS date parsing.
   */
  it("never emits an all-numeric date, which would be locale-ambiguous", () => {
    for (let month = 1; month <= 12; month += 1) {
      expect(formatPartialDate({ year: 2023, month })).toMatch(/^[A-Z][a-z]{2} \d{4}$/);
    }
  });
});

describe("formatDateRange", () => {
  it("renders an ongoing range as Present", () => {
    const out = formatDateRange({ start: { year: 2023, month: 1 }, end: null, current: true });
    expect(out).toBe(`Jan 2023 ${DATE_RANGE_SEPARATOR} Present`);
  });

  it("renders a closed range", () => {
    const out = formatDateRange({
      start: { year: 2019, month: 6 },
      end: { year: 2022, month: 2 },
      current: false,
    });
    expect(out).toBe(`Jun 2019 ${DATE_RANGE_SEPARATOR} Feb 2022`);
  });

  it("uses an en dash, not a hyphen", () => {
    const out = formatDateRange({ start: { year: 2020, month: null }, end: null, current: true });
    expect(out).toContain("–");
    expect(out).not.toContain(" - ");
  });
});

describe("compareDates", () => {
  it("orders by year first", () => {
    expect(compareDates({ year: 2020, month: 12 }, { year: 2021, month: 1 })).toBeLessThan(0);
  });

  it("orders by month within a year", () => {
    expect(compareDates({ year: 2021, month: 3 }, { year: 2021, month: 7 })).toBeLessThan(0);
  });

  it("sorts a year-only date before any month in that year", () => {
    expect(compareDates({ year: 2021, month: null }, { year: 2021, month: 1 })).toBeLessThan(0);
  });

  it("returns zero for identical dates", () => {
    expect(compareDates({ year: 2021, month: 5 }, { year: 2021, month: 5 })).toBe(0);
  });
});

describe("isValidRange", () => {
  it("accepts an ongoing range with a null end", () => {
    expect(isValidRange({ start: { year: 2023, month: 1 }, end: null, current: true })).toBe(true);
  });

  it("rejects an ongoing range carrying an end date", () => {
    expect(
      isValidRange({
        start: { year: 2023, month: 1 },
        end: { year: 2024, month: 1 },
        current: true,
      }),
    ).toBe(false);
  });

  it("accepts a range that starts and ends in the same month", () => {
    expect(
      isValidRange({
        start: { year: 2023, month: 4 },
        end: { year: 2023, month: 4 },
        current: false,
      }),
    ).toBe(true);
  });
});
