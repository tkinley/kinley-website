# Student Notes visitor statistics

The widget uses GoatCounter's public page-view counter. It records only the
published Student Notes page, not local previews, other pages, or forks.
No API keys or passwords belong in this repository.

## Connect the account

1. Create your account at https://www.goatcounter.com/signup. Suggested account
   name: `kinley-notes`; site domain: `tkinley.github.io`.
2. In GoatCounter's site settings, enable **Allow adding visitor counts on your
   website**. This exposes aggregate counts for use by the widget. Keep the
   detailed dashboard private if you do not want to share its other statistics.
3. Set `siteCode` in `assets/visitor-stats-config.js` to your actual account name
   (the part before `.goatcounter.com`). The widget stays hidden until this is set.
4. Publish the updated config and visit the live Student Notes page once.
5. Check your GoatCounter dashboard to confirm the visit arrived. The public
   counters can take up to four hours to refresh.

Open `visitor-stats-preview.html` to see the design without sending analytics
requests. Its dashes represent unavailable data, not zero visits.

The public widget displays page views since tracking began, over the past 30
days, and over the past 7 days. These are not unique-person counts. Detailed
statistics and estimated unique visits are available in GoatCounter itself.
Earlier visits cannot be recovered by this integration.

Official setup: https://www.goatcounter.com/help/start

Official public counter documentation:
https://www.goatcounter.com/help/visitor-counter
