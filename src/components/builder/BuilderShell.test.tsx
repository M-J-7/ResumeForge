// @vitest-environment jsdom

/**
 * M0-T8 acceptance, exercised through the real components: a resume can be
 * built with the keyboard alone, fields report useful validation messages,
 * and every section is reachable.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BuilderShell } from "./BuilderShell";
import { configurePersistence } from "@/store/resume";
import { createMemoryBackend } from "@/store/persistence";
import { useResumeStore } from "@/store/resume";
import { createHistory } from "@/store/history";
import { createEmptyResume } from "@/lib/resume/factory";

beforeEach(() => {
  configurePersistence(createMemoryBackend(), { debounceMs: 0 });
  useResumeStore.setState({
    history: createHistory(createEmptyResume()),
    hydrated: false,
    externalRevision: 0,
    loadError: null,
  });
});

async function renderBuilder() {
  const user = userEvent.setup();
  render(<BuilderShell />);
  // The shell hydrates from storage on mount; wait for the real UI.
  expect(await screen.findByRole("heading", { level: 1, name: "Contact" })).toBeInTheDocument();
  return user;
}

const doc = () => useResumeStore.getState().history.present;

describe("navigation", () => {
  it("renders every section as a freely reachable step, not a locked wizard", async () => {
    const user = await renderBuilder();
    const nav = screen.getByRole("navigation", { name: /resume sections/i });

    for (const label of [
      "Contact",
      "Summary",
      "Experience",
      "Education",
      "Skills",
      "Projects",
      "Certifications",
      "Custom",
    ]) {
      expect(within(nav).getByRole("button", { name: new RegExp(label, "i") })).toBeEnabled();
    }

    // Jump straight to the last step without touching the ones before it.
    await user.click(within(nav).getByRole("button", { name: /custom/i }));
    expect(screen.getByRole("heading", { level: 1, name: "Custom" })).toBeInTheDocument();
  });

  it("opens the command palette with Ctrl+K and jumps to a section", async () => {
    const user = await renderBuilder();

    await user.keyboard("{Control>}k{/Control}");
    const search = await screen.findByRole("textbox", { name: /search commands/i });

    await user.type(search, "projects");
    await user.keyboard("{Enter}");

    expect(screen.getByRole("heading", { level: 1, name: "Projects" })).toBeInTheDocument();
  });

  it("reports progress as sections are completed", async () => {
    await renderBuilder();
    const bar = screen.getByRole("progressbar", { name: /sections complete/i });
    expect(bar).toHaveAttribute("aria-valuenow", "0");

    await userEvent.setup().type(screen.getByLabelText(/full name/i), "Ada Lovelace");
    await userEvent.setup().type(screen.getByLabelText(/^email$/i), "ada@example.com");

    expect(screen.getByRole("progressbar", { name: /sections complete/i })).toHaveAttribute(
      "aria-valuenow",
      "1",
    );
  });
});

describe("editing", () => {
  it("writes typed contact details into the document", async () => {
    const user = await renderBuilder();
    await user.type(screen.getByLabelText(/full name/i), "Ada Lovelace");
    expect(doc().contact.fullName).toBe("Ada Lovelace");
  });

  it("shows a useful message for a malformed email without discarding what was typed", async () => {
    const user = await renderBuilder();
    await user.type(screen.getByLabelText(/^email$/i), "not-an-email");

    expect(await screen.findByRole("alert")).toHaveTextContent(/does not look like an email/i);
    // The text is still stored — losing it on refresh is the failure mode
    // this deliberately avoids.
    expect(doc().contact.email).toBe("not-an-email");
  });

  it("adds a role and records its title", async () => {
    const user = await renderBuilder();
    await user.click(screen.getByRole("button", { name: /^experience/i }));
    await user.click(screen.getByRole("button", { name: /add a role/i }));

    await user.type(screen.getByLabelText(/job title/i), "Engineer");

    const experience = doc().sections.find((s) => s.type === "experience");
    expect(experience?.type === "experience" && experience.entries[0]?.title).toBe("Engineer");
  });

  it("adds the next bullet with Ctrl+Enter and moves focus into it", async () => {
    const user = await renderBuilder();
    await user.click(screen.getByRole("button", { name: /^experience/i }));
    await user.click(screen.getByRole("button", { name: /add a role/i }));

    const firstBullet = screen.getByRole("textbox", { name: /bullet 1/i });
    await user.click(firstBullet);
    await user.keyboard("Shipped the thing");
    await user.keyboard("{Control>}{Enter}{/Control}");

    const secondBullet = await screen.findByRole("textbox", { name: /bullet 2/i });
    expect(secondBullet).toHaveFocus();

    await user.keyboard("And the next thing");
    const experience = doc().sections.find((s) => s.type === "experience");
    expect(experience?.type === "experience" && experience.entries[0]?.bullets).toEqual([
      "Shipped the thing",
      "And the next thing",
    ]);
  });
});

describe("empty states", () => {
  it("shows the projects empty state with what counts as a project", async () => {
    const user = await renderBuilder();
    await user.click(screen.getByRole("button", { name: /^projects/i }));

    expect(screen.getByText(/how you show capability without a job title/i)).toBeInTheDocument();
    expect(screen.getByText(/hackathon entries/i)).toBeInTheDocument();
    // A worked example, not "No items yet".
    expect(screen.getByText(/campus placement portal/i)).toBeInTheDocument();
  });

  it("replaces the empty state once an entry exists", async () => {
    const user = await renderBuilder();
    await user.click(screen.getByRole("button", { name: /^projects/i }));
    await user.click(screen.getByRole("button", { name: /add a project/i }));

    expect(
      screen.queryByText(/how you show capability without a job title/i),
    ).not.toBeInTheDocument();
  });
});

describe("undo and redo", () => {
  it("undoes a typed value and restores it on redo", async () => {
    const user = await renderBuilder();
    await user.type(screen.getByLabelText(/full name/i), "Ada");
    expect(doc().contact.fullName).toBe("Ada");

    await user.click(screen.getByRole("button", { name: /^undo$/i }));
    expect(doc().contact.fullName).toBe("");

    await user.click(screen.getByRole("button", { name: /^redo$/i }));
    expect(doc().contact.fullName).toBe("Ada");
  });

  it("re-syncs the visible input after an undo", async () => {
    const user = await renderBuilder();
    await user.type(screen.getByLabelText(/full name/i), "Ada");
    await user.click(screen.getByRole("button", { name: /^undo$/i }));

    expect(screen.getByLabelText(/full name/i)).toHaveValue("");
  });

  it("disables undo when there is nothing to undo", async () => {
    await renderBuilder();
    expect(screen.getByRole("button", { name: /^undo$/i })).toBeDisabled();
  });
});

describe("section visibility", () => {
  it("hides a section without discarding its content", async () => {
    const user = await renderBuilder();
    await user.click(screen.getByRole("button", { name: /^summary/i }));
    await user.type(screen.getByLabelText(/professional summary/i), "A summary.");

    const summaryId = doc().sections.find((s) => s.type === "summary")?.id;
    useResumeStore.getState().setSectionVisible(summaryId!, false);

    const section = doc().sections.find((s) => s.id === summaryId);
    expect(section?.visible).toBe(false);
    expect(section?.type === "summary" && section.content).toBe("A summary.");
  });
});

describe("clear all data", () => {
  it("requires a confirmation before deleting the draft", async () => {
    const user = await renderBuilder();
    await user.type(screen.getByLabelText(/full name/i), "Ada");

    await user.click(screen.getByRole("button", { name: /clear all data/i }));
    expect(screen.getByText(/delete this draft permanently/i)).toBeInTheDocument();
    // Still intact until the user confirms.
    expect(doc().contact.fullName).toBe("Ada");

    await user.click(screen.getByRole("button", { name: /^delete$/i }));
    expect(doc().contact.fullName).toBe("");
  });
});
