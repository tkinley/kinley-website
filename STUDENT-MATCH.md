# Student Opportunity Matcher

The standalone page is `student-match.html`. Production is plain static HTML, CSS, JavaScript, JSON, and vendored libraries: no build step, Node runtime, backend, account, API key, or external AI service. Deployment uses the existing GitHub Pages setup on `main`. The matcher does not require repository-setting changes.

## Preview locally

From this folder, with Node installed for local development:

```powershell
node scripts/serve-student-match.mjs
```

Open <http://127.0.0.1:4173/student-match.html>. Stop the preview with Ctrl+C. An existing VS Code static HTTP preview also works. Direct `file://` opening cannot load the JSON/modules/workers reliably; the page explains this and links to the original directory. On GitHub Pages the existing static host serves everything without Node. All asset paths are relative and support the repository's `/kinley-website/` path.

## Changed files

- `student-benefits.html`: one additional link panel before the existing controls. All prior content, cards, URLs, scripts, styles, and visitor statistics remain intact.
- `student-match.html`: accessible upload → profile → results workflow, privacy explanation, independent-project notice, and directory links.
- `assets/student-match.css`: isolated responsive styling using the existing cream, forest green, teal, typography, and rounded cards.
- `assets/student-match.mjs`: transient profile state, file controls, reviewable suggestions, filters, sorting, explanations, and reset controls.
- `assets/student-match-file-help.js`: classic-script explanation for direct `file://` opening, where browser modules cannot run.
- `assets/student-match-engine.mjs`: deterministic eligibility checks, relevance ranking, date handling, and allowlisted CV hints.
- `assets/student-document-worker.js`: PDF/DOCX text parsing outside the UI thread.
- `data/student-opportunities.json`: all 108 original cards, including original descriptions, benefit labels, nuanced notes, URLs, and card-number provenance.
- `assets/vendor/`: PDF.js 6.4.299, Mammoth 1.13.0, local copies of the existing font families, license files, and a source/SHA-256 manifest. `assets/student-match-icon.svg` provides the local favicon.
- `scripts/`: optional local preview, reproducible card extraction, and pinned dependency-vendoring helpers.
- `tests/student-match*`: rule, integrity, privacy, parser, browser interaction, accessibility, and layout checks using entirely fictional files/profiles.
- `package.json`, `package-lock.json`, `.gitignore`: optional development checks only. `node_modules/` and generated `test-results/` are ignored.

`index.html`, the visitor-statistics assets/configuration, existing directory controls, and unrelated components are unchanged. This workspace had no `.git` metadata; preservation was checked against hashes taken before editing, with the single added directory panel removed for comparison.

## Data and matching rules

Every original resource URL is retained, including generic provider pages and older notices. The migration is **not an independent verification** of the original claims. All `last_verified` values and confirmed `deadline.date` values are `null`. Current availability remains “Verification needed.” Unknowns are never filled with a conversion date, an assumed annual cycle, or a guessed requirement.

1. Evaluate explicit restrictions documented in the original card before ranking. The small set of hard rules covers explicit PhD/graduate-stage conditions and explicit current-enrollment conditions. Missing or “Prefer not to say” answers remain unknown. A contradiction yields “Not eligible based on supplied information,” with the rule and answer shown. Those rules still need confirmation against current provider terms.
2. Keep other conditions as unresolved checks: candidacy, memberships, host agreement, research purpose, semester credit hours, fees, citizenship, and current access terms. No extra sensitive information is requested to resolve these.
3. Broad domestic/international status never proves citizenship, nationality, permanent residency, visa category, or funding eligibility. The imported data establishes no broad student-status exclusions. An international student is therefore not automatically rejected from NSF GRFP or another citizenship-restricted program: the legal criteria remain unresolved. Destination words such as “domestic/international” travel do not restrict student status.
4. Rank by selected interest overlap (4 points per matching interest), exact field/skill token overlap (2 per token, up to six), explicitly listed academic level (2), and K-State resource relevance for a self-reported enrolled student (1). These internal weights are deterministic relevance signals, not eligibility or acceptance probabilities. The UI shows qualitative relevance and the actual matching reasons, never percentages.
5. Recommend entries with a positive relevance signal, no known contradiction, and no elapsed listed cycle. A profile with no matching signals opens the full directory. “All opportunities” always includes every card, including clearly labeled past cycles and conflicts. Filters, search, and status selection further narrow either view.
6. Past listed cycles (MSA/Fulbright) and elapsed explicitly dated source deadlines are excluded from recommendations. Unverified recurring or yearless deadlines are never advanced into a new cycle. Deadline sorting uses only verified upcoming dates; when none exist it explicitly falls back to name order.

The imported catalogue cannot establish **complete** eligibility for any resource. Therefore its “Likely eligible” count is initially zero. That is intentional: an incomplete source should not become a claim of eligibility. The engine supports that label when a future maintainer establishes complete documented rules and the student's supplied answers satisfy them. Availability is presented separately and still needs checking.

For a future verified entry, record the official evidence and nuanced conditions in notes, set `last_verified` only to the actual check date, and set `deadline.verified: true` plus an ISO `deadline.date` only after confirming a full date/current call. `eligibility_rules.complete` must remain false while conditions are unknown. The `academic_levels` field is `null` for unknown, rather than an invented list; `student_status_restrictions` is likewise `null`. Each known machine rule carries its source text. Additional matching tags describe relevance only.

To reproduce the original-card migration:

```powershell
node scripts/extract-student-opportunities.mjs
```

This regenerates migration metadata and will overwrite future manual verification edits; preserve those edits separately or update the extraction script first. The `schema_version` is 1.

## Privacy and document handling

- No analytics or third-party fonts/scripts are loaded by the matcher. The original pages keep their existing analytics unchanged.
- The only application `fetch` loads the local opportunity JSON. Document bytes/text are never submitted with a request, written to storage, placed in URLs, rendered as HTML, or logged by application code. A restrictive page CSP limits asset loading to this origin and disables form submissions/objects. External resource links use `noopener noreferrer` and no-referrer policy.
- Selecting a file does not transmit it. Bytes are transferred to a disposable worker. PDF.js uses its local worker; Mammoth uses `extractRawText`, with external-file access disabled. PDF evaluation, font rendering, and WASM are disabled for text extraction. Libraries/fonts are pinned and served locally rather than fetched at file-selection time from a CDN.
- The worker returns only allowlisted possible academic level/field, skill keywords, and broad interests. No arbitrary CV passage, filename, identity, contact details, citizenship, immigration status, or K-State enrollment is returned. Hints may be ambiguous; conflicting levels/fields yield no suggestion. All suggestions require explicit review/use and remain manually editable.
- “Remove document & suggestions” cancels parsing and clears suggestions plus unedited fields originating from them; manual edits are preserved. “Reset everything” clears the complete form, suggestions, worker, and results profile. Reload also clears the profile. There is no localStorage, sessionStorage, IndexedDB, database, cookies, or service worker in the matcher.
- Files are limited to 8 MB, PDFs to 30 pages, extracted text to 200,000 characters, and DOCX declared expanded contents to 30 MB/2,000 entries. Parsing has a 25-second timeout and is cancellable. Invalid, encrypted, scanned, image-only, or complex documents fall back to manual entry. No OCR is performed. Unusual font encodings may also require manual entry.

Selecting a document should be optional throughout. The form intentionally does not request student IDs, birthdates, passports, SSNs, transcripts, immigration documents, income figures, or contact information.

## Validation

Run built-in tests (no installation needed):

```powershell
node --test tests/*.test.mjs
```

For browser checks only:

```powershell
npm.cmd install
npm.cmd run test:browser
```

The browser script starts/stops its own loopback static server on port 4187. It uses installed Chrome/Edge on Windows. On another host, install Playwright Chromium (`npx playwright install chromium`) or set `MATCHER_BROWSER` to a Chromium executable. No production dependency installation is required.

Validation completed with installed Chrome 156:

- 14 Node tests passed, including the 5 existing Kalman model tests.
- 21 browser check groups passed: fictional domestic/international undergraduate and graduate profiles; all filters/search/sorting/pagination; minimal-profile fallback; real PDF.js/Mammoth extraction of synthetic files; review/edit/removal; drag-and-drop; scan/empty/oversized/corrupt/unsupported file fallbacks; parser timeout; reset/reload and data-load failure; keyboard controls; GitHub Pages repository paths; JavaScript-disabled and direct-file fallbacks. The direct-file helper was added after the complete 20-group run and validated separately along with HTTP startup.
- The tested matcher flow made only same-origin GET requests, no POSTs or third-party requests, and left browser storage empty. No page JavaScript errors were observed.
- No automated WCAG A/AA violations or horizontal overflow at 320, 375, 768, and 1440 px. Screenshots were visually reviewed. Automated checks do not replace testing with a screen reader or real mobile devices.

Reports/screenshots are generated into ignored `test-results/`. Live offer availability, every external link's current destination, real-world eligibility, current scholarship cycles, Safari/Firefox, OCR, and assistive-technology behavior have not been independently verified. The interface communicates unknown availability and eligibility rather than manufacturing answers.

## GitHub Pages deployment

The matcher is deployed alongside the existing website by pushing to the existing `main` branch. Before deployment, the matcher was applied to the latest upstream revision, preserving Funding Notes, the homepage, both statistics sketches, and visitor analytics. The two newer Google AI Pro/ChatGPT Plus source notes were retained in the JSON migration without inventing verification dates. All 24 tests in the combined upstream-and-matcher checkout passed.
