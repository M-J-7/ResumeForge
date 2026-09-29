// @vitest-environment jsdom
/**
 * Spell checking on the form primitives (ROADMAP F10): prose checked in every
 * browser, identifiers never underlined.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Input, Textarea } from "./control";

function spellcheckOf(label: string): string | null {
  return screen.getByLabelText(label).getAttribute("spellcheck");
}

describe("spell checking", () => {
  it("checks prose in a plain text input and in every textarea", () => {
    render(
      <>
        <Input aria-label="Job title" />
        <Textarea aria-label="Bullet" />
      </>,
    );
    expect(spellcheckOf("Job title")).toBe("true");
    expect(spellcheckOf("Bullet")).toBe("true");
  });

  it("leaves names, addresses, numbers and links alone", () => {
    render(
      <>
        <Input aria-label="Full name" autoComplete="name" />
        <Input aria-label="Email" type="email" />
        <Input aria-label="Phone" type="tel" />
        <Input aria-label="Link" inputMode="url" />
      </>,
    );
    for (const label of ["Full name", "Email", "Phone", "Link"]) {
      expect(spellcheckOf(label), label).toBe("false");
    }
  });

  it("lets a caller decide either way", () => {
    render(
      <>
        <Input aria-label="Skills" spellCheck={false} />
        <Input aria-label="Motto" type="email" spellCheck />
      </>,
    );
    expect(spellcheckOf("Skills")).toBe("false");
    expect(spellcheckOf("Motto")).toBe("true");
  });
});
