# kinley-website

Source for [tkinley.github.io/kinley-website](https://tkinley.github.io/kinley-website/), my academic site. Plain HTML, CSS, and JavaScript served by GitHub Pages, with no build step.

## What's here

| Path | What it is |
|---|---|
| `index.html` | Homepage: publications, ongoing research, experience, teaching |
| `student-match.html` | Student Opportunities: three questions, then a list of funding, tools, and help sorted by deadline. See `STUDENT-MATCH.md` |
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
