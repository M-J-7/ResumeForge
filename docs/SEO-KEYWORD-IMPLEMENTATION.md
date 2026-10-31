# Keyword implementation — 31 October 2026

Source: [owner's Google Doc](https://docs.google.com/document/d/1wQmH5oe0TuNdncCktFVRuPPvfWwS8APWY2sXGCd0czw/edit).
All five tabs were reviewed through the browser, including the Ahrefs and Semrush screenshots.

## Search intent and page ownership

| Search family from the document                           | Page              | Implementation                                                                                                                              |
| --------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Free online resume builder and download                   | `/`               | Clear search title, main heading and introduction; PDF and Word download offer, no sign-up and no watermark stated accurately               |
| Free ATS-friendly resume template; Word/PDF download      | `/templates`      | Focused search title, description, expanded selection guidance, practical steps and FAQs                                                    |
| Template for freshers, students or experienced applicants | `/templates`      | Four experience-based starting points, links to actual template cards, and guides with deeper advice                                        |
| ATS CV maker / ATS resume builder                         | `/templates`, `/` | Explain readable document structure and the CV terminology; retain the parser checker and job-description comparison as useful next actions |
| Free AI resume builder                                    | Homepage FAQ      | Explain the actual product: templates and coaching, with no generative writing or invented achievements                                     |

The existing gallery owns the template query family. No second landing page with substantially
the same gallery or content was created. The document's draft was adapted to the product's
actual capabilities: Word and PDF downloads are supported, all 24 template choices remain
visible, and the description states exactly what a visitor receives.

## Content and technical changes

- Four recommendations point to existing Campus, Atlas, Plainspoken and Pivot cards through stable fragments.
- The gallery's ItemList markup now points to each template's real fragment rather than repeating the gallery URL.
- Six template FAQs share one content array with the visible disclosure rows and FAQPage JSON-LD.
- The search title describes ATS-friendly templates and Word/PDF downloads; the shorter social sharing title remains unchanged.
- The homepage and template page have accurate sitemap modification dates, recorded as content constants rather than the current build time.
- Added a dated public changelog entry describing the new selection and download guidance.
- Existing routes and canonical URLs remain in use, so existing links continue to work.

## Evidence and limits

The screenshots are keyword-research estimates, not observed rankings for this website.
Ahrefs and Semrush give different difficulty estimates for one of the phrases, so neither
label is treated as proof that a first-page result will be easy or guaranteed.

FAQ markup describes visible answers. Google stopped displaying FAQ rich results in May 2026,
so the useful answers and matching markup are not presented as a way to obtain that feature.

Useful references: [Google Search Essentials](https://developers.google.com/search/docs/essentials),
[title guidance](https://developers.google.com/search/docs/appearance/title-link), and
[Google's FAQ feature removal notice](https://developers.google.com/search/updates).

Judge the changes using Search Console page/query performance over a meaningful interval after
Google recrawls the pages. A successful deployment confirms the implementation, not a ranking increase.

## Validation

Type checking, lint and all 2,452 unit tests passed. All 24 focused Playwright tests passed,
including Word/PDF downloads, template selection, content without JavaScript and accessibility.
Browser inspection confirmed one H1, 24 existing fragment destinations and six FAQ answers
matching the JSON-LD. The updated homepage and gallery were also visually inspected.
