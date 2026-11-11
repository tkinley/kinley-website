# Student Opportunities email subscription

Status: built, not live. The subscribe row sits at the bottom of the results
list on student-match.html and stays dormant until a real form endpoint
replaces the placeholder. Nothing is sent, stored, or tracked before that.

## How it works

- The row (assets/student-match-subscribe.mjs + .css) shows an email field,
  Weekly / Every 2 weeks pills (Every 2 weeks is the default), and one
  button. On tap, and only on tap, it POSTs the email, the frequency, and
  the visitor's three answers (level, citizenship, needs) to the endpoint.
- Under the row, four optional groups sharpen the picks: School (K-State or
  another university), College (the K-State colleges), Stage (just started,
  middle, final year), and Background (first-generation, financial need;
  more than one allowed). All are skippable, none are prefilled, and they
  are sent only with the same tap.
- This is the page's one deliberate exception to "answers never leave the
  browser." The fine print under the row says so, and the privacy paragraph
  in "How this works" names the exception too. The Content-Security-Policy
  opens connect-src to https://formspree.io only; form-action stays 'none'.
- Signups arrive as form submissions (free tier: 50/month), each carrying
  the answers, so digests can be picked per segment from day one.

## Going live (about two minutes, account owner only)

1. Create a free form at formspree.io for the site owner's email.
2. Copy its form ID and replace REPLACE_WITH_FORM_ID in
   assets/student-match-subscribe.mjs.
3. Commit and push. The button starts accepting signups immediately.

Note: form capture is single opt-in (no confirmation email). Treat every
captured address as a request from whoever typed it, keep the first email
easy to leave, and honor every unsubscribe or STOP reply at once.

## Building a digest

The digest reuses the page's own matching engine, so an email cannot
recommend something the page rules out for the same answers:

    node scripts/build-digest.mjs --level PhD --citizen no --needs money,travel
    node scripts/build-digest.mjs --level Undergraduate --citizen yes --needs money --out digest-ug.txt

Sections: deadlines entering the next 30 days (Apply soon), deadlines
within 90 days (Coming up), up to 5 rolling picks (Open anytime), and
Also worth a look. Run one digest per signup segment, at the frequency
each subscriber picked:

    node scripts/build-digest.mjs --level Undergraduate --citizen yes --needs money --school kstate --college arts-sciences --stage final

How the extra answers are used today: School drops K-State-only entries
for subscribers elsewhere. College drops an entry when its checked unit
tag names a different college (unit tags are mapped in UNIT_COLLEGES in
the script; an unmapped tag never excludes anyone). Stage and Background
cannot exclude in the current data, so they pull instead: checked entries
whose own text matches them (final year, first-generation, financial
need) are lifted out of the undated groups into Also worth a look, with
the matching line quoted. The web page itself still matches on the three
original answers only; teaching the page the new rules is a later step.

## Sending rule

Every digest is a draft first. It goes out only after the site owner has
read the exact text and approved that send. No scheduled job sends on its
own.
