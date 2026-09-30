// @vitest-environment jsdom
/**
 * The reminder that a guest's resume exists only in this browser (R2):
 * shown to guests with work to lose, never to someone signed in, put away
 * for a month by any answer, and the backup it offers is a JSON Resume file
 * this builder can open again.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BackupNudge, BACKUP_NUDGE_KEY } from "./BackupNudge";
import { useResumeStore } from "@/store/resume";
import { createHistory } from "@/store/history";
import { createEmptyResume, createExperienceEntry } from "@/lib/resume/factory";
import type { ResumeDocument } from "@/lib/resume/schema";

function draft(worthKeeping: boolean): ResumeDocument {
  const document = createEmptyResume();
  if (!worthKeeping) return document;
  document.contact.fullName = "Asha Varma";
  const experience = document.sections.find((section) => section.type === "experience");
  if (experience?.type === "experience") experience.entries.push(createExperienceEntry());
  return document;
}

function load(document: ResumeDocument) {
  useResumeStore.setState({ history: createHistory(document), hydrated: true });
}

const HEADING = { name: "Keep a copy of this resume" };

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("BackupNudge", () => {
  it("offers a guest with work to lose both ways to keep it", async () => {
    load(draft(true));
    render(<BackupNudge signedIn={false} />);
    expect(await screen.findByRole("heading", HEADING)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download a backup" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Keep it in an account" })).toHaveAttribute(
      "href",
      "/signin",
    );
  });

  it("says nothing to someone signed in, or over an empty form", () => {
    load(draft(true));
    const { unmount } = render(<BackupNudge signedIn />);
    expect(screen.queryByRole("heading", HEADING)).toBeNull();
    unmount();

    load(draft(false));
    render(<BackupNudge signedIn={false} />);
    expect(screen.queryByRole("heading", HEADING)).toBeNull();
  });

  it("stays away for a month once put away, and comes back after", async () => {
    load(draft(true));
    const user = userEvent.setup();
    const { unmount } = render(<BackupNudge signedIn={false} />);
    await user.click(await screen.findByRole("button", { name: "Remind me in a month" }));
    expect(screen.queryByRole("heading", HEADING)).toBeNull();
    const stored = Number(localStorage.getItem(BACKUP_NUDGE_KEY));
    expect(Date.now() - stored).toBeLessThan(5_000);
    unmount();

    // A remount inside the month: still quiet.
    const again = render(<BackupNudge signedIn={false} />);
    expect(screen.queryByRole("heading", HEADING)).toBeNull();
    again.unmount();

    // Thirty-one days on: asked again.
    localStorage.setItem(BACKUP_NUDGE_KEY, String(Date.now() - 31 * 24 * 60 * 60 * 1000));
    render(<BackupNudge signedIn={false} />);
    expect(await screen.findByRole("heading", HEADING)).toBeInTheDocument();
  });

  it("downloads the draft as a JSON Resume file, then puts itself away", async () => {
    load(draft(true));
    const made: Blob[] = [];
    vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
      made.push(blob as Blob);
      return "blob:backup";
    });
    const clicked = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const user = userEvent.setup();
    render(<BackupNudge signedIn={false} />);

    await user.click(await screen.findByRole("button", { name: "Download a backup" }));

    expect(clicked).toHaveBeenCalledTimes(1);
    const file = JSON.parse(await made[0]!.text()) as { basics: { name: string } };
    expect(file.basics.name).toBe("Asha Varma");
    expect(screen.queryByRole("heading", HEADING)).toBeNull();
    expect(localStorage.getItem(BACKUP_NUDGE_KEY)).not.toBeNull();
  });
});
