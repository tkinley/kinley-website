// Optional integration checks against a local static server.
// Run: npm run test:browser  (set MATCHER_BROWSER to use a specific Chrome/Edge)
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
const { default: AxeBuilder } = require('@axe-core/playwright');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'test-results');
const origin = 'http://127.0.0.1:4187';
const page_url = `${origin}/kinley-website/student-match.html`;
fs.mkdirSync(out, { recursive: true });
const pass = (name) => console.log(`PASS ${name}`);

(async () => {
  const server = spawn(process.execPath, ['scripts/serve-student-match.mjs'], { cwd: root, env: { ...process.env, PORT: '4187', MATCHER_BASE_PATH: '/kinley-website' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let browser;
  try {
    await new Promise((resolve, reject) => { server.stdout.once('data', resolve); server.once('error', reject); server.once('exit', (code) => reject(new Error(`Preview server exited ${code}`))); });
    const executablePath = process.env.MATCHER_BROWSER || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
    browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    context.setDefaultTimeout(10000);
    // Pin "today" so the deadline groups are reproducible.
    await context.addInitScript(() => {
      const fixed = new Date('2026-10-18T12:00:00').valueOf();
      const RealDate = Date;
      // eslint-disable-next-line no-global-assign
      Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [fixed])); } static now() { return fixed; } };
    });
    const page = await context.newPage();
    // Stub GoatCounter: the tracker tag must be present, but tests must not
    // send real pageviews or trip the console-error listener on a blocked load.
    await page.route('https://gc.zgo.at/count.js', (r) => r.fulfill({ contentType: 'application/javascript', body: '/* goatcounter stubbed in tests */' }));
    await page.route('https://kinley-site.goatcounter.com/count*', (r) => r.fulfill({ status: 200, body: '' }));
    const requests = [], errors = [];
    page.on('request', (r) => requests.push({ url: r.url(), method: r.method() }));
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

    await page.goto(page_url);
    await page.waitForSelector('.card');
    assert.match(await page.locator('#answer-summary').innerText(), /^Everything: \d+ to look at/);
    assert.equal(await page.locator('#group-soon .card').first().getAttribute('data-id'), 'nsf-grfp');
    assert.match(await page.locator('#group-soon .card').first().innerText(), /1 day left/);
    assert.equal(await page.locator('input[type=file]').count(), 0);
    await page.screenshot({ path: path.join(out, 'matcher-desktop.png'), fullPage: false });
    assert.deepEqual(await page.locator('.group h3').evaluateAll((n) => n.map((x) => x.firstChild.textContent)), ['Apply soon', 'Open anytime', 'Later deadlines', 'Ongoing benefits', 'Check the dates']);
    const anytimeMeta = await page.locator('#group-anytime .card .meta').allInnerTexts();
    assert.ok(anytimeMeta.length && anytimeMeta.every((t) => /^Checked /.test(t)));
    assert.match(await page.locator('.lede').innerText(), /sorted by deadline/);
    pass('loads with grouped results, no upload control, GRFP first in Apply soon');

    await page.locator('label.option', { hasText: /^PhD$/ }).click();
    await page.locator('label.option', { hasText: /^No$/ }).click();
    await page.locator('#need-options label', { hasText: 'Money' }).click();
    await page.waitForFunction(() => location.hash === '#level=phd&needs=money');
    assert.doesNotMatch(await page.evaluate(() => location.href), /visa|citizen/);
    assert.match(await page.locator('#answer-summary').innerText(), /PhD · not citizen or PR · Money: \d+ to look at, \d+ ruled out\./);
    assert.equal(await page.locator('#ksn-note').isVisible(), true);
    const soon = await page.locator('#group-soon .card').evaluateAll((n) => n.map((x) => x.dataset.id));
    assert.ok(!soon.includes('nsf-grfp') && !soon.includes('doe-scgsr'));
    await page.locator('#group-out summary').click();
    const outText = await page.locator('#out-list').innerText();
    assert.match(outText, /NSF GRFP\s+Needs U\.S\. citizenship or permanent residency\./);
    assert.match(outText, /Boren Fellowship\s+Needs U\.S\. citizenship\. Checked Oct 18, 2026\./);
    await page.locator('#kstate-only').check({ force: true });
    await page.waitForFunction(() => location.hash === '#level=phd&needs=money&ks=1');
    const tags = await page.locator('.card .card-tags').allInnerTexts();
    assert.ok(tags.length && tags.every((t) => /K-STATE/i.test(t)));
    assert.ok(await page.locator('.card .tag-unit', { hasText: 'Division of Biology only' }).count());
    await page.locator('#kstate-only').uncheck({ force: true });
    await page.screenshot({ path: path.join(out, 'matcher-visa-phd.png'), fullPage: true });
    pass('three taps rule out citizenship-restricted fellowships with checked reasons; K-State toggle and unit tags; citizenship stays out of the URL');

    await page.locator('label.option', { hasText: /^Undergrad$/ }).click();
    await page.locator('#need-options label', { hasText: 'Money' }).click();
    await page.locator('#need-options label', { hasText: 'Everyday help' }).click();
    assert.deepEqual(await page.locator('input[name=needs]:checked').evaluateAll((n) => n.map((x) => x.value)), ['everyday']);
    await page.fill('#search', 'leadership development');
    const warned = page.locator('.card[data-id="graduate-leadership-development"] .warning');
    assert.match(await warned.innerText(), /Not checked yet/);
    assert.equal(await page.locator('#out-list a', { hasText: 'Graduate Leadership Development' }).count(), 0);
    assert.equal(await page.locator('#ksn-note').isVisible(), false);
    await page.fill('#search', '');
    await page.locator('label.option', { hasText: /^PhD$/ }).click();
    await page.locator('#need-options label', { hasText: 'Everyday help' }).click();
    await page.locator('#need-options label', { hasText: 'Money' }).click();
    await page.waitForFunction(() => location.hash === '#level=phd&needs=money');
    pass('rules from unchecked notes warn on the card instead of excluding; KSN note only for money');

    const hidden = await page.locator('#group-dates .card').count();
    const more = page.locator('#group-dates .show-all');
    if (await more.count()) { await more.click(); assert.ok(await page.locator('#group-dates .card').count() > hidden); }
    await page.fill('#search', 'sigma xi');
    assert.deepEqual((await page.locator('.card').evaluateAll((n) => n.map((x) => x.dataset.id))).sort(), ['k-state-sigma-xi-research-grants', 'sigma-xi-giar']);
    await page.fill('#search', 'zzzz-nothing');
    assert.equal(await page.locator('#empty-state').isVisible(), true);
    await page.locator('#clear-search').click();
    pass('show all, search, and empty state');

    await page.goto('about:blank');
    await page.goto(`${page_url}#level=ms&needs=travel,everyday`);
    await page.waitForSelector('.card');
    assert.equal(await page.locator('input[name=level][value="Master\'s"]').isChecked(), true);
    assert.equal(await page.locator('input[name=needs][value=travel]').isChecked(), true);
    assert.equal(await page.locator('input[name=citizen][value=""]').isChecked(), true);
    await page.locator('#start-over').click();
    assert.equal(await page.evaluate(() => location.hash), '');
    await page.goto(`${page_url}#scholarships`);
    await page.waitForSelector('.card');
    assert.equal(await page.locator('input[name=needs][value=money]').isChecked(), true);
    pass('bookmarked hashes restore answers; old #scholarships links still work; start over clears');

    for (const [width, height] of [[1440, 1000], [768, 1000], [390, 844], [320, 700]]) {
      await page.setViewportSize({ width, height });
      await page.goto('about:blank');
      await page.goto(`${page_url}#level=phd&needs=money,travel`);
      await page.waitForSelector('.card');
      await page.locator('#group-out summary').click();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `overflow at ${width}px`);
      const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      fs.writeFileSync(path.join(out, `accessibility-${width}.json`), JSON.stringify(audit.violations, null, 2));
      assert.deepEqual(audit.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })), [], `accessibility at ${width}px`);
      await page.screenshot({ path: path.join(out, `matcher-${width}.png`) });
      pass(`${width}px: no horizontal overflow, no automated WCAG A/AA violations`);
    }

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('about:blank');
    await page.goto(page_url);
    await page.waitForSelector('.card');
    await page.keyboard.press('Tab');
    assert.equal(await page.locator('.skip-link').evaluate((e) => e === document.activeElement), true);
    await page.locator('input[name=level]').first().focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('input[name=level][value="Master\'s"]').isChecked(), true);
    await page.locator('input[name=needs]').first().focus();
    await page.keyboard.press('Space');
    assert.equal(await page.locator('input[name=needs]').first().isChecked(), true);
    pass('keyboard: skip link, arrow keys on radios, space on needs');

    const stored = await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length, cookie: document.cookie }));
    assert.deepEqual(stored, { local: 0, session: 0, cookie: '' });
    assert.equal(await page.locator('script[data-goatcounter="https://kinley-site.goatcounter.com/count"]').count(), 1, 'goatcounter tracker tag present');
    const gcAllowed = (r) => r.url.startsWith('https://gc.zgo.at/') || r.url.startsWith('https://kinley-site.goatcounter.com/');
    assert.ok(requests.every((r) => (r.url.startsWith(origin) && r.method === 'GET') || gcAllowed(r)), JSON.stringify(requests.filter((r) => !((r.url.startsWith(origin) && r.method === 'GET') || gcAllowed(r)))));
    assert.ok(!requests.some((r) => /pdfjs|mammoth|worker/.test(r.url)));
    assert.deepEqual(errors, []);
    pass('no storage, no cookies, own-origin GETs plus stubbed GoatCounter, no parser downloads, no page errors');

    const broken = await context.newPage();
    await broken.route('**/student-opportunities.json', (r) => r.fulfill({ status: 500, body: '' }));
    await broken.goto(page_url);
    await broken.waitForSelector('#data-error:not([hidden])');
    assert.match(await broken.locator('#data-error').innerText(), /resource library/);
    await broken.close();
    const noOverlay = await context.newPage();
    await noOverlay.route('**/eligibility-checks.json', (r) => r.fulfill({ status: 404, body: '' }));
    await noOverlay.goto(page_url);
    await noOverlay.waitForSelector('.card');
    await noOverlay.close();
    pass('catalogue failure shows a fallback; a missing checks file degrades to the catalogue alone');

    const funding = await context.newPage();
    await funding.goto(`${origin}/kinley-website/funding.html`);
    await funding.waitForURL(/student-match\.html/, { timeout: 8000 });
    await funding.close();
    pass('funding.html still redirects here');
  } finally {
    await browser?.close();
    server.kill();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
