# kinley-website

Source for [tkinley.github.io/kinley-website](https://tkinley.github.io/kinley-website/), my academic site. Plain HTML, CSS, and JavaScript served by GitHub Pages, with no build step.

## What's here

| Path | What it is |
|---|---|
| `index.html` | Homepage: publications, ongoing research, experience, teaching |
| `statistics.html` | Statistics hub: Iovance data-first case study and links to the existing Kalman/FDR sketches |
| `biotech.html` | Biotech hub: clinical case studies and the existing catalyst and investor trackers |
| `statistics/iovance-data-first.html` | Readable Iovance article: current data, selection concerns, Wilson uncertainty, prediction, and validation |
| `notebooks/Iovance_Data_First_Companion.ipynb` | Executed 21-cell companion, newly reconstructed from the roadmap and primary source; not the original chat attachment |
| `scripts/build-iovance-notebook.py` | Rebuilds and executes the companion and exports its figures to `assets/iovance/` (requires nbformat, nbclient, ipykernel, matplotlib) |
| `assets/research-notes.css` | Shared Statistics/Biotech styling, matching the existing tracker pages |
| `student-match.html` | Student Opportunities: three questions, then a list of funding, tools, and help sorted by deadline. See `STUDENT-MATCH.md` |
| `biotech-catalysts.html` | Biotech Catalysts 2027: binary PDUFA and Phase 3 watchlist, linked quietly from the footer |
| `other-tracker.html` | Other tracker: stated biotech longs and shorts for outside investors (Martin Shkreli from 2025, Adam May from 2024), switchable at the top of the page (`#shkreli`, `#adam-may`). Shares page tabs with the catalysts page |
| `data/adam-may-positions.json` | Data for the Adam May view of the Other tracker; same format, plus a `pitches` list |
| `data/shkreli-positions.json` | Data for the Shkreli tracker. To update: add a dated entry to `events`, change the position's `status` / `lastSeen`, and bump `updated` |
| `data/eligibility-checks.json` | Hand-checked eligibility, amounts, and deadlines for the main funding entries, with sources and dates |
| `student-benefits.html` | Resource library: the full list of research computing, funding, and K-State resources |
| `assets/kalman-model.mjs`, `assets/kalman-sketch.js` | Fig. 1: a Kalman filter tracking a simulated random walk, with a 95% band and an adjustable noise assumption |
| `assets/fdr-model.mjs`, `assets/fdr-sketch.js` | Fig. 2: 100 simulated z-tests, p < 0.05 versus the Benjamini–Hochberg procedure |
| `assets/sketches.css` | Styles for both sketches |
| `assets/katex/` | KaTeX stylesheet and fonts for the pre-rendered equations (MIT license) |
| `assets/visitor-stats*`, `ANALYTICS.md` | Optional GoatCounter page counter for Student Notes |
| `tests/` | Unit tests for the two statistical models and the opportunity matcher, plus an optional browser test |

Both sketches use seeded random numbers, so every visitor sees the same simulated data, and the models are tested separately from the drawing code.

## Run locally

Module scripts do not load from `file://`, so serve the folder:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## Tests

```sh
node --test tests/*.test.mjs
```

## Deploy

Push to `main`. GitHub Pages republishes within a minute or two.

When anything in `assets/` changes, bump the `?v=` number on the asset links in `index.html` and on the model imports at the top of the two sketch scripts, so browsers never mix cached old files with new ones.
