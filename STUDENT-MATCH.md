# Student Opportunities

`student-match.html` sorts opportunities for K-State students by three answers: academic level, whether you're a U.S. citizen or permanent resident, and what you need. The audience is K-State students; the list includes both K-State resources and outside programs they can use. It is plain static HTML, CSS, JavaScript, and JSON on GitHub Pages. No build step, backend, account, uploads, or AI service.

## How it works

The page has two steps, like a search page. Step 1 shows only the three questions in one card, a "Show N results" button with the live count, and four quick starts (PhD travel money, Undergrad scholarships, Free software and AI, Food and everyday help). Step 2 is the list, with the answers pinned in a bar at the top and a "Change answers" button. Moving to the list adds a browser history entry, so Back returns to the questions. A link with `#list&...` opens straight on the list; a link with only answers opens the questions with them filled in. Old `#scholarships` links open the list with Money selected.

1. **Three questions.** Level (Undergrad, Master's, PhD), U.S. citizen or permanent resident (Yes, No, Skip; "No" covers every other status, not just student visas, so international-only awards stay visible for "No" with a line asking students who aren't on a student or exchange visa to confirm their status counts), and needs (Money, Travel, Research tools, Software & AI, Everyday help). Results update on every tap. A "K-State only" toggle hides outside programs.
2. **Groups.**
   - *Apply soon*: a deadline in the next 60 days.
   - *Open anytime*: rolling programs checked on their official pages. Nothing unchecked goes here.
   - *Later deadlines*: more than 60 days out.
   - *Ongoing benefits*: unchecked tools and services with no deadline in my notes. The group note and each card say they haven't been re-checked.
   - *Check the dates*: the round is closed, the next date isn't posted, the dates haven't been checked, or my notes mention an end date or a cohort (time-limited offers such as ChatGPT Plus, yearly cohorts such as Staley Food Security Scholars).
   - *Not for you* (collapsed): ruled out by a checked rule, with the reason and the check date.
3. **Only checked rules exclude.** An entry moves to *Not for you* only when a rule from `data/eligibility-checks.json` (read from the official page) excludes the chosen level or citizenship, or the entry can't apply to any current student. The same kind of rule coming from the unchecked catalogue (level limits and "international students" flags copied from the original cards) shows as a warning on the card ("My notes list this for... Not checked yet") and the card sorts to the bottom of its group. Skipping the citizenship question rules nothing out; restricted entries show the rule as something to check.
4. **Order.** Dated groups sort by deadline. In the undated groups, K-State entries come first, then checked entries. Cards limited to one department, college, or degree carry a tag such as "Division of Biology only"; the tag never excludes anyone.
5. **Scholarship Network pointer.** When money is selected (or nothing is), a note points to the K-State Scholarship Network, which matches one profile to donor and department scholarships. This list is meant to cover what that doesn't.
6. **No invented dates.** Only dates read from an official page (or a verified catalogue date) are shown as deadlines. A yearly cycle the source gives without a year (Sigma Xi's Mar 15 / Oct 1) is shown as "Likely Mar 15, 2027 (yearly cycle, not confirmed)." Timing copied from my notes is quoted as "My notes: ... Not checked yet." Unchecked funding entries with no notes say "Dates not checked yet."

## Data

- `data/student-opportunities.json`: the catalogue (159 entries) built from `student-benefits.html` plus `data/student-funding-updates.json` by `scripts/extract-student-opportunities.mjs`. It says what exists.
- `data/eligibility-checks.json`: hand-checked facts for the funding entries that matter most (45 as of Oct 18, 2026, including the ISSS international scholarships, the Division of Biology awards, the IFT and NRES awards, and the SDUR undergraduate research and travel awards). Each entry records needs, levels, citizenship rule, amount, a one-line "who," deadline, things to check, the source URL, and the check date. The page merges it over the catalogue at load time, so a catalogue rebuild never erases it.

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
| `unit` | Short tag for entries limited to one department, college, or degree. Display only. |
| `title`, `url` | Optional display overrides. |
| `source`, `source_note`, `checked` | Where and when the facts were read. |

To refresh: open each `source`, update the fields and `checked`, then bump `checked_on`. Dates roll forward only when the source publishes new ones; `annual` is for sources that state a yearly cycle without a year.

## Privacy

- Matching runs in the browser. The page fetches only its own two JSON files.
- Level, needs, and the K-State toggle are written to the URL hash so a list can be bookmarked or shared. The citizenship answer is never written to the URL, storage, or cookies, and is reset when a page is restored from the back-forward cache.
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

The unit tests cover the catalogue-to-library match, the overlay's shape and sources, citizenship and level rules, checked rules versus unchecked warnings, the K-State filter and ordering, unit tags, deadline selection (next date, annual cycles, rolling, closed), grouping, the needs filter, and the hash format. The browser test pins the date to Oct 18, 2026 and checks the three-tap flow, checked reasons in *Not for you*, warnings on unchecked cards, the K-State toggle, the Scholarship Network note, citizenship staying out of the URL, bookmarked hashes and the old `#scholarships` link, search, keyboard use, no storage or third-party requests, data-load fallbacks, the funding redirect, and automated WCAG A/AA plus overflow checks at 320, 390, 768, and 1440 px. Set `MATCHER_BROWSER` to use a specific Chrome or Edge.

## History

The first version read a CV (PDF.js and Mammoth in a worker) to pre-fill a long profile form. It found only a few keywords, labelled every entry "needs verification," and refused to use citizenship, so federal fellowships still showed for visa holders. It was replaced on Oct 18, 2026 by the three-question flow and the checked-facts file; the parsers (about 3.4 MB) were removed.

To add an opportunity that isn't in the resource library, add a record to `data/student-funding-updates.json` (source sheet "Manual addition"), run `node scripts/extract-student-opportunities.mjs`, then add its checked facts to `data/eligibility-checks.json`.
