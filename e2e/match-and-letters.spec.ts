/**
 * The Match tab and the cover letter, end to end (P27, P29).
 *
 * Two things here can only be proved in a real browser, and both are
 * acceptance criteria rather than nice-to-haves:
 *
 * 1. **The match runs at all.** Scoring pulls a ~1.2 MB skill vocabulary
 *    over HTTP through a dynamic `import()`. A unit test injects the index
 *    directly and would keep passing if that chunk 404'd in production.
 * 2. **A guest can compose and download a letter with no account, and
 *    nothing hits the server.** The resume comes out of IndexedDB, the
 *    letter goes back into it, and the PDF is produced in the page. Every
 *    step of that is browser-only.
 */

import { expect, test, type Page } from "@playwright/test";
import { waitForDraftSaved } from "./draft";

const JOB_DESCRIPTION = `Senior Platform Engineer

Requirements
- 5+ years running Kubernetes in production
- Strong Terraform experience
- Proficient in Go

Nice to have
- Prometheus
`;

/** A resume with real bullets, so the letter has something to quote. */
async function buildResume(page: Page) {
  await page.goto("/builder");
  await expect(page.getByRole("heading", { level: 1, name: "Contact" })).toBeVisible();

  await page.getByLabel("Full name").fill("Ada Lovelace");
  await page.getByLabel("Email", { exact: true }).fill("ada@example.com");

  await page
    .getByRole("button", { name: /^Experience/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Add a role" }).click();
  await page.getByLabel("Job title").fill("Platform Engineer");
  await page.getByLabel("Organization").fill("Meridian Health");
  await page
    .getByRole("textbox", { name: /bullet 1/i })
    .fill(
      "Cut median deploy time from 38 minutes to 6 by moving 40 services onto a shared Kubernetes cluster.",
    );

  // The bullet specifically, because it is the thing every test downstream
  // reads back — the match report quotes it and the letter is assembled from
  // it. Waiting on anything less is waiting on the wrong write.
  await waitForDraftSaved(page, "Cut median deploy time from 38 minutes to 6");
}

async function openMatchTab(page: Page) {
  await page.getByRole("tab", { name: "Match" }).click();
  await page.getByLabel("Job description").fill(JOB_DESCRIPTION);
}

test("analyses a pasted posting and traces every finding back to resume text", async ({ page }) => {
  await buildResume(page);
  await openMatchTab(page);

  await page.getByRole("button", { name: "Analyse" }).click();

  // The three gauges, never one number (D12). Exact matches, because the
  // page also explains what each one measures in prose beneath it.
  await expect(page.getByText("Coverage", { exact: true })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("Evidence", { exact: true })).toBeVisible();
  await expect(page.getByText("Formatting", { exact: true })).toBeVisible();

  await expect(
    page.getByRole("heading", { name: "What this posting is really asking for" }),
  ).toBeVisible();

  // Kubernetes is shown in a bullet, so it is demonstrated; Prometheus is
  // nowhere in the resume, so it is missing. Both statuses are text, not
  // just colour.
  await expect(page.getByText("Demonstrated").first()).toBeVisible();
  await expect(page.getByText("Missing").first()).toBeVisible();

  // Expanding a requirement quotes the literal resume text behind it —
  // M3-T5's acceptance criterion.
  await page
    .getByRole("button", { name: /Kubernetes/ })
    .first()
    .click();
  // The quoted copy in the panel, not the textarea it was typed into — hence
  // the curly quote the report wraps evidence in.
  await expect(page.getByText(/“Cut median deploy time from 38 minutes to 6/)).toBeVisible();
});

test("a guest composes and downloads a cover letter without an account", async ({ page }) => {
  await buildResume(page);
  await openMatchTab(page);

  // Saving the posting is what makes it available to the letter editor; for
  // a guest it goes to IndexedDB and nowhere else.
  await page.getByLabel("Company").fill("Acme");
  await page.getByLabel("Role title").fill("Senior Platform Engineer");
  await page.getByRole("button", { name: "Save this posting" }).click();
  await expect(page.getByText("Saved").first()).toBeVisible();

  await page.goto("/letters/new");

  await page.getByLabel("Job description").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Compose draft" }).click();

  // Assembled from the resume: the bullet appears in the letter verbatim.
  const evidence = page.getByRole("textbox", { name: "Evidence paragraph" });
  await expect(evidence).toBeVisible({ timeout: 60_000 });
  await expect(evidence).toHaveValue(
    /Cut median deploy time from 38 minutes to 6|cut median deploy time from 38 minutes to 6/,
  );

  // And it says so, rather than letting the user believe it wrote for them.
  // Twice, in fact — the status line and the standing banner above the
  // paragraphs — so this asserts on the banner specifically.
  await expect(page.getByText(/^This is a draft\./)).toBeVisible();

  // The preview is the artifact the download hands over (D2).
  await expect(page.getByRole("img", { name: "Cover letter page 1" })).toBeVisible({
    timeout: 60_000,
  });

  const download = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download PDF" }).click(),
  ]).then(([event]) => event);

  expect(download.suggestedFilename()).toBe("Ada_Lovelace_Cover_Letter.pdf");
});

test("a saved letter reopens with identical text", async ({ page }) => {
  await buildResume(page);
  await openMatchTab(page);
  await page.getByLabel("Company").fill("Acme");
  await page.getByRole("button", { name: "Save this posting" }).click();
  await expect(page.getByText("Saved").first()).toBeVisible();

  await page.goto("/letters/new");
  await page.getByLabel("Job description").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Compose draft" }).click();

  const evidence = page.getByRole("textbox", { name: "Evidence paragraph" });
  await expect(evidence).toBeVisible({ timeout: 60_000 });

  // The user's own name for it — never derived silently (P29-J4).
  await page.getByLabel("Save this letter as").fill("Acme application");

  // An edit of their own, which must survive the round trip untouched.
  const opening = page.getByRole("textbox", { name: "Opening paragraph" });
  await opening.fill("I am writing about the platform role, in my own words.");
  const composed = await evidence.inputValue();

  await page.getByRole("button", { name: "Save letter" }).click();
  await expect(page.getByText("Saved as “Acme application”.")).toBeVisible();

  await page.goto("/letters");
  await expect(page.getByRole("heading", { name: "Acme application" })).toBeVisible();
  await page.getByRole("link", { name: "Open" }).first().click();

  await expect(page.getByRole("textbox", { name: "Opening paragraph" })).toHaveValue(
    "I am writing about the platform role, in my own words.",
  );
  await expect(page.getByRole("textbox", { name: "Evidence paragraph" })).toHaveValue(composed);
});

/* -------------------------------------------------------------------------- */
/* The intended flow, end to end (§10.2, Tier 1)                               */
/* -------------------------------------------------------------------------- */

test("arriving from the Match tab pre-fills the company and role (§10.2)", async ({ page }) => {
  await buildResume(page);
  await openMatchTab(page);

  await page.getByLabel("Company").fill("Acme");
  await page.getByLabel("Role title").fill("Senior Platform Engineer");
  await page.getByRole("button", { name: "Save this posting" }).click();
  await expect(page.getByText("Saved").first()).toBeVisible();

  // The call to action lives in the report, so the posting has to be analysed
  // before there is a link to follow.
  await page.getByRole("button", { name: "Analyse" }).click();

  // The path the product is designed around, and the one that was broken:
  // "Write a cover letter" hands over `?job=<id>`.
  await page.getByRole("link", { name: "Write a cover letter" }).click({ timeout: 60_000 });
  await expect(page).toHaveURL(/\/letters\/new\?job=/);

  // Both used to arrive blank, because the prefill lived in the select's
  // `onChange` and arriving with one already selected fires no change event.
  await expect(page.getByLabel("Company")).toHaveValue("Acme");
  await expect(page.getByLabel("Role title")).toHaveValue("Senior Platform Engineer");

  await page.getByRole("button", { name: "Compose draft" }).click();
  const opening = page.getByRole("textbox", { name: "Opening paragraph" });
  await expect(opening).toBeVisible({ timeout: 60_000 });

  // The assertion that actually pins it: this is `OPENING_LEAD.full`, which
  // is only chosen when both fields are filled. The old behaviour produced
  // `.neither` — "I am writing about the open role." — which reads exactly
  // like a letter that ignored the posting.
  await expect(opening).toHaveValue(/Senior Platform Engineer role at Acme/);
  await expect(opening).not.toHaveValue(/the open role\./);
});

test("offers the letter before the posting is saved, and saves it on the way (§10.2)", async ({
  page,
}) => {
  await buildResume(page);
  await openMatchTab(page);

  // Analyse without saving — the path the empty state invites, and the one
  // that used to show no route to the cover letter at all.
  await page.getByRole("button", { name: "Analyse" }).click();
  await expect(page.getByText("What this posting is really asking for")).toBeVisible({
    timeout: 60_000,
  });

  const cta = page.getByRole("button", { name: "Save posting and write a cover letter" });
  await expect(cta).toBeVisible();
  await cta.click();

  await expect(page).toHaveURL(/\/letters\/new\?job=/, { timeout: 30_000 });
});

test("a posting pasted in the editor survives a save and reload (§10.2)", async ({ page }) => {
  await buildResume(page);
  await page.goto("/letters/new");

  // Pasted here rather than chosen from the Match tab. This text used to be
  // written nowhere, so Recompose after a reload failed with "Choose a saved
  // job description" — about a posting the user had already supplied.
  await page.getByLabel("Or paste a posting").fill(JOB_DESCRIPTION);
  await page.getByLabel("Company").fill("Acme");
  await page.getByRole("button", { name: "Compose draft" }).click();

  const evidence = page.getByRole("textbox", { name: "Evidence paragraph" });
  await expect(evidence).toBeVisible({ timeout: 60_000 });

  await page.getByRole("button", { name: "Save letter" }).click();
  await expect(page.getByText(/the posting you pasted was saved with it/)).toBeVisible();

  await page.reload();
  await expect(page.getByRole("textbox", { name: "Evidence paragraph" })).toBeVisible({
    timeout: 60_000,
  });

  await page.getByRole("button", { name: "Recompose draft" }).click();
  await expect(page.getByRole("textbox", { name: "Evidence paragraph" })).toHaveValue(
    /deploy time from 38 minutes to 6/,
    { timeout: 60_000 },
  );
  await expect(page.getByText("Choose a saved job description")).toBeHidden();
});

test("shows where each paragraph came from, in words (§10.2)", async ({ page }) => {
  await buildResume(page);
  await page.goto("/letters/new");
  await page.getByLabel("Or paste a posting").fill(JOB_DESCRIPTION);
  await page.getByRole("button", { name: "Compose draft" }).click();
  await expect(page.getByRole("textbox", { name: "Evidence paragraph" })).toBeVisible({
    timeout: 60_000,
  });

  // The chip used to be a count whose tooltip was a pair of UUIDs. It now
  // names the entry, and opens onto the resume text the paragraph drew on.
  const chip = page.getByRole("button", { name: /From Platform Engineer at Meridian Health/ });
  await expect(chip.first()).toBeVisible();
  await expect(chip.first()).toHaveAttribute("aria-expanded", "false");

  await chip.first().click();
  await expect(chip.first()).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.getByText("Cut median deploy time from 38 minutes to 6", { exact: false }).first(),
  ).toBeVisible();
});

test("a per-paragraph recompose uses the tone showing on screen (§10.2)", async ({ page }) => {
  await buildResume(page);
  await page.goto("/letters/new");
  await page.getByLabel("Or paste a posting").fill(JOB_DESCRIPTION);
  await page.getByRole("button", { name: "Compose draft" }).click();

  const opening = page.getByRole("textbox", { name: "Opening paragraph" });
  await expect(opening).toBeVisible({ timeout: 60_000 });
  const direct = await opening.inputValue();

  // The whole setup used to be frozen at Compose time, so changing this and
  // recomposing one paragraph silently reproduced the old tone.
  await page.getByLabel("Tone").selectOption("formal");
  // `exact` matters: "Recompose draft" in the setup column would match a
  // substring search first, and that is the *other* button — the one that
  // rebuilds everything, which is not what this test is about.
  await page.getByRole("button", { name: "Recompose", exact: true }).first().click();

  await expect(opening).not.toHaveValue(direct);
  await expect(opening).toHaveValue(/I am writing to apply for/);
});
