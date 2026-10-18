# Site visitor statistics (private)

Page views are measured with GoatCounter on three pages: the homepage
(`index.html`), the Student Opportunities page (`student-match.html`), and the
resource library (`student-benefits.html`). Each page loads the standard
tracker tag:

```html
<script data-goatcounter="https://kinley-site.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>
```

## Privacy

- No cookies. GoatCounter does not use cookies or persistent identifiers.
- IP addresses are not stored: location is resolved on arrival and kept only
  as totals, so visits cannot be traced back to a person.
- The dashboard at `https://kinley-site.goatcounter.com/` is private. The
  public visitor counter ("Allow adding visitor counts on your website") stays
  OFF, and the old public counter widget was removed from the resource
  library page.
- The Student Opportunities page says this in its own words: anonymous visit
  counts (GoatCounter), no cookies, no IP addresses stored.
- Referrer policy is `strict-origin-when-cross-origin`: GoatCounter sees
  which site a visit came from (for example instagram.com), never the full
  referring URL.

## Limits

- Location comes from the IP address, so it is approximate. VPNs and some
  phone carriers report the wrong state, and campus Wi-Fi shows as Kansas.
- Ad blockers such as uBlock Origin block GoatCounter, so counts undercount.
  Use the numbers for trends, not exact totals.
- GoatCounter reports where visits came from, never who visited.

## Notes for maintainers

- `assets/visitor-stats.js`, `assets/visitor-stats-config.js`,
  `assets/visitor-stats.css`, and `visitor-stats-preview.html` belonged to the
  retired public counter widget and are no longer referenced by any page.
- The browser test (`npm run test:browser`) stubs the GoatCounter script and
  counter endpoint so test runs never send real pageviews, and asserts the
  tracker tag is present on the Student Opportunities page.

Official setup: https://www.goatcounter.com/help/start
