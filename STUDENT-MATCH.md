# Student Opportunities

`student-match.html` sorts K-State student resources by three answers: academic level, whether you're a U.S. citizen or permanent resident, and what you need. It is plain static HTML, CSS, JavaScript, and JSON on GitHub Pages. No build step, backend, account, uploads, or AI service.

## How it works

1. **Three questions.** Level (Undergrad, Master's, PhD), U.S. citizen or permanent resident (Yes, No/student visa, Skip), and needs (Money, Travel, Research tools, Software & AI, Everyday help). Results update on every tap.
2. **Five groups.**
   - *Apply soon*: a confirmed deadline in the next 60 days.
   - *Open anytime*: rolling applications and ongoing benefits.
   - *Later this year*: a confirmed deadline more than 60 days out.
   - *Check the dates*: the round is closed, the next date isn't posted, or nobody has checked the dates yet.
   - *Not for you* (collapsed): ruled out by a rule written in the data, with the reason shown.
3. **Ruling out is explicit.** An entry moves to *Not for you* only when its own data excludes the chosen level or citizenship answer, or it can't apply to any current student (for example, a prize that needs a finished PhD). Skipping the citizenship question rules nothing out; restricted entries show the rule as something to check instead.
4. **No invented dates.** Only dates read from an official page (or a verified catalogue date) are shown as deadlines. Unchecked funding entries say "Dates not checked yet."

## Data

- `data/student-opportunities.json`: the catalogue (158 entries) built from `student-benefits.html` plus `data/student-funding-updates.json` by `scripts/extract-student-opportunities.mjs`. It says what exists.
- `data/eligibility-checks.json`: hand-checked facts for the funding entries that matter most (27 as of Oct 18, 2026). Each entry records needs, levels, citizenship rule, amount, a one-line "who," deadline, things to check, the source URL, and the check date. The page merges it over the catalogue at load time, so a catalogue rebuild never erases it.

Overlay fields:

| Field | Meaning |
| --- | --- |
| `needs` | `money`, `travel`, `research`, `software`, `everyday`. Overrides the category mapping. |
| `levels` | `Undergraduate`, `Master's`, `PhD`, or `null` if the source doesn't limit it. |
| `level_reason` | Optional wording when the chosen level isn't allowed. |
| `citizenship` | `us_only` (citizens, nationals, permanent residents), `us_citizen_only` (no permanent residents), `international_only`, `any`, `not_stated`. |
| `deadline` | `dates` (ISO, as published), `annual` (`MM-DD` cycles the source lists without a year), `rolling: true`, `label`, `note`. No dates and no `rolling` means the next date isn't posted. |
| `check` | Short lines shown under "before you apply." |
| `exclude` | Rules the entry out for every current student, with this reason. |
| `title`, `url` | Optional display overrides. |
| `source`, `source_note`, `checked` | Where and when the facts were read. |

To refresh: open each `source`, update the fields and `checked`, then bump `checked_on`. Dates roll forward only when the source publishes new ones; `annual` is for sources that state a yearly cycle without a year.

## Privacy

- Matching runs in the browser. The page fetches only its own two JSON files.
- Level and needs are written to the URL hash so a list can be bookmarked or shared. The citizenship answer is never written to the URL, storage, or cookies, and is reset when a page is restored from the back-forward cache.
- A strict CSP limits everything to this origin, disables workers, objects, and form submission. External links open with `noopener noreferrer`.

## Preview and tests

```
node scripts/serve-student-match.mjs
```

Open http://127.0.0.1:4173/student-match.html. Opening the file directly (`file://`) won't work because browsers block modules there.

```
node --test tests/*.test.mjs
npm install
npm run test:browser
```

The unit tests cover the catalogue-to-library match, the overlay's shape and sources, citizenship and level rules, deadline selection (next date, annual cycles, rolling, closed), grouping, the needs filter, and the hash format. The browser test pins the date to Oct 18, 2026 and checks the three-tap flow, reasons in *Not for you*, citizenship staying out of the URL, bookmarked hashes and the old `#scholarships` link, search, keyboard use, no storage or third-party requests, data-load fallbacks, the funding redirect, and automated WCAG A/AA plus overflow checks at 320, 390, 768, and 1440 px. Set `MATCHER_BROWSER` to use a specific Chrome or Edge.

## History

The first version read a CV (PDF.js and Mammoth in a worker) to pre-fill a long profile form. It found only a few keywords, labelled every entry "needs verification," and refused to use citizenship, so federal fellowships still showed for visa holders. It was replaced on Oct 18, 2026 by the three-question flow and the checked-facts file; the parsers (about 3.4 MB) were removed.
