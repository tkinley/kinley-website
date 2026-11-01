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

    // Wait until the data has loaded and the questions view shows a live count.
    const ready = (p) => p.waitForFunction(() => /^Show \d+ results?$/.test(document.getElementById('see-label').textContent));
    const listIds = (sel) => page.locator(sel).evaluateAll((n) => n.map((x) => x.dataset.id));

    await page.goto(page_url);
    await ready(page);
    assert.equal(await page.locator('#ask').isVisible(), true);
    assert.equal(await page.locator('#list').isHidden(), true, 'the list waits for the second step');
    assert.equal(await page.locator('input[type=file]').count(), 0);
    assert.equal(await page.locator('.preset').count(), 4);
    await page.screenshot({ path: path.join(out, 'matcher-desktop.png'), fullPage: false });
    const before = await page.locator('#see-label').innerText();
    await page.locator('#need-options label', { hasText: 'Money' }).click();
    await page.waitForFunction((b) => document.getElementById('see-label').textContent !== b, before);
    const odometer = () => page.locator('#odo .strip').evaluateAll((n) => n.map((x) => x.style.getPropertyValue('--d')).join(''));
    assert.equal(await odometer(), (await page.locator('#see-label').innerText()).match(/\d+/)[0], 'odometer shows the count');
    assert.deepEqual(await page.locator('.taps i').evaluateAll((n) => n.map((x) => x.classList.contains('on'))), [false, false, true]);
    await page.locator('label.option', { hasText: /^PhD$/ }).click();
    assert.equal(await page.locator('#see-list').evaluate((n) => n.classList.contains('ready')), false);
    await page.locator('label.option', { hasText: /^Skip$/ }).click();
    assert.deepEqual(await page.locator('.taps i').evaluateAll((n) => n.map((x) => x.classList.contains('on'))), [true, true, true]);
    assert.equal(await page.locator('#see-list').evaluate((n) => n.classList.contains('ready') && n.classList.contains('shine')), true, 'all three taps light the button');
    await page.locator('#start-over').click();
    assert.deepEqual(await page.locator('.taps i').evaluateAll((n) => n.map((x) => x.classList.contains('on'))), [false, false, false]);
    pass('step 1: questions on their own; tap dots, rolling count, and a light-up when all three are answered');

    await page.locator('#see-list').click();
    await page.waitForFunction(() => location.hash === '#list');
    assert.equal(await page.locator('#list').isVisible(), true);
    assert.equal(await page.locator('#ask').isHidden(), true);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'results-title');
    assert.ok(await page.locator('.card.enter').count() > 0, 'cards rise in');
    await page.waitForFunction(() => document.querySelector('.results-head').classList.contains('arrived'));
    assert.equal(await page.locator('#group-soon .card').first().getAttribute('data-id'), 'nsf-grfp');
    assert.match(await page.locator('#group-soon .card').first().innerText(), /1 day left/);
    assert.deepEqual(await page.locator('.group h3').evaluateAll((n) => n.map((x) => x.firstChild.textContent)), ['Apply soon', 'Open anytime', 'Later deadlines', 'Ongoing benefits', 'Check the dates']);
    const anytimeMeta = await page.locator('#group-anytime .card .meta').allInnerTexts();
    assert.ok(anytimeMeta.length && anytimeMeta.every((t) => /^Checked /.test(t)));
    assert.equal(await page.locator('#answer-chips').innerText(), 'Everything');
    await page.goBack();
    await page.waitForFunction(() => !document.getElementById('ask').hidden);
    assert.equal(await page.locator('#list').isHidden(), true);
    assert.doesNotMatch(await page.evaluate(() => location.hash), /list/);
    pass('step 2: the list opens as its own view; browser Back returns to the questions');

    await page.locator('label.option', { hasText: /^PhD$/ }).click();
    await page.locator('label.option', { hasText: /^No$/ }).click();
    await page.locator('#need-options label', { hasText: 'Money' }).click();
    await page.waitForFunction(() => location.hash === '#level=phd&needs=money');
    await page.locator('#see-list').click();
    await page.waitForFunction(() => location.hash === '#list&level=phd&needs=money');
    assert.doesNotMatch(await page.evaluate(() => location.href), /visa|citizen/);
    assert.deepEqual(await page.locator('#answer-chips .chip').allInnerTexts(), ['PhD', 'not citizen or PR', 'Money']);
    await page.locator('#answer-chips .chip', { hasText: 'Money' }).click();
    await page.waitForFunction(() => document.querySelector('#groups .card.flash'));
    assert.equal(await page.locator('#ask').isHidden(), true, 'tapping an answer chip stays on the list');
    assert.equal(await page.locator('#list').isVisible(), true);
    pass('answer chips jump down the list: tapping one scrolls to its first matching result, no page change');
    assert.match(await page.locator('#list-count').innerText(), /^\d+ results · \d+ ruled out$/);
    assert.equal(await page.locator('#ksn-note').isVisible(), true);
    const soon = await listIds('#group-soon .card');
    assert.ok(!soon.includes('nsf-grfp') && !soon.includes('doe-scgsr'));
    await page.locator('#group-out summary').click();
    const outText = await page.locator('#out-list').innerText();
    assert.match(outText, /NSF GRFP\s+Needs U\.S\. citizenship or permanent residency\./);
    assert.match(outText, /Boren Fellowship\s+Needs U\.S\. citizenship\. Checked Oct 18, 2026\./);
    await page.locator('#kstate-only').check({ force: true });
    await page.waitForFunction(() => location.hash === '#list&level=phd&needs=money&ks=1');
    const tags = await page.locator('.card .card-tags').allInnerTexts();
    assert.ok(tags.length && tags.every((t) => /K-STATE/i.test(t)));
    assert.ok(await page.locator('.card .tag-unit', { hasText: 'Division of Biology only' }).count());
    await page.fill('#search', 'sigma');
    await page.locator('#back').click();
    await page.waitForFunction(() => !document.getElementById('ask').hidden);
    assert.equal(await page.locator('#search').inputValue(), '', 'going back clears the search so the count is honest');
    assert.equal(await page.locator('#ks-note').isVisible(), true, 'the questions screen says K-State only is on');
    await page.locator('#ks-off').click();
    assert.equal(await page.locator('#ks-note').isHidden(), true);
    await page.locator('#see-list').click();
    await page.waitForFunction(() => location.hash === '#list&level=phd&needs=money');
    await page.screenshot({ path: path.join(out, 'matcher-visa-phd.png'), fullPage: true });
    pass('three taps rule out citizenship-restricted fellowships with checked reasons; answer chips, K-State toggle, unit tags; citizenship stays out of the URL');

    await page.locator('#back').click();
    await page.waitForFunction(() => !document.getElementById('ask').hidden);
    await page.locator('label.option', { hasText: /^Undergrad$/ }).click();
    await page.locator('#need-options label', { hasText: 'Money' }).click();
    await page.locator('#need-options label', { hasText: 'Everyday help' }).click();
    assert.deepEqual(await page.locator('input[name=needs]:checked').evaluateAll((n) => n.map((x) => x.value)), ['everyday']);
    await page.locator('#see-list').click();
    await page.waitForFunction(() => !document.getElementById('list').hidden);
    await page.fill('#search', 'leadership development');
    const warned = page.locator('.card[data-id="graduate-leadership-development"] .warning');
    assert.match(await warned.innerText(), /Not checked yet/);
    assert.equal(await page.locator('#out-list a', { hasText: 'Graduate Leadership Development' }).count(), 0);
    assert.equal(await page.locator('#ksn-note').isVisible(), false);
    await page.fill('#search', '');
    pass('rules from unchecked notes warn on the card instead of excluding; KSN note only for money; Change answers goes back');

    await page.goto('about:blank');
    await page.goto(`${page_url}#list&level=phd&needs=money`);
    await page.waitForSelector('#list .card');
    const hidden = await page.locator('#group-dates .card').count();
    const more = page.locator('#group-dates .show-all');
    if (await more.count()) { await more.click(); assert.ok(await page.locator('#group-dates .card').count() > hidden); }
    await page.fill('#search', 'sigma xi');
    assert.deepEqual((await listIds('.card')).sort(), ['k-state-sigma-xi-research-grants', 'sigma-xi-giar']);
    await page.fill('#search', 'zzzz-nothing');
    assert.equal(await page.locator('#empty-state').isVisible(), true);
    await page.locator('#clear-search').click();
    pass('shared list links open straight on the list; show all, search, and empty state');

    await page.goto('about:blank');
    await page.goto(`${page_url}#level=ms&needs=travel,everyday`);
    await ready(page);
    assert.equal(await page.locator('#ask').isVisible(), true);
    assert.equal(await page.locator('input[name=level][value="Master\'s"]').isChecked(), true);
    assert.equal(await page.locator('input[name=needs][value=travel]').isChecked(), true);
    assert.equal(await page.locator('input[name=citizen][value=""]').isChecked(), true);
    await page.locator('#start-over').click();
    assert.equal(await page.evaluate(() => location.hash), '');
    await page.goto(`${page_url}#scholarships`);
    await page.waitForSelector('#list .card');
    assert.equal(await page.locator('input[name=needs][value=money]').isChecked(), true);
    await page.goto('about:blank');
    await page.goto(page_url);
    await ready(page);
    await page.locator('.preset', { hasText: 'PhD travel money' }).click();
    await page.waitForFunction(() => location.hash === '#list&level=phd&needs=travel');
    assert.deepEqual(await page.locator('#answer-chips .chip').allInnerTexts(), ['PhD', 'Travel']);
    pass('bookmarked answers restore; old #scholarships links open the list; start over clears; quick starts jump to the list');

    const phone = await context.newPage();
    await phone.setViewportSize({ width: 390, height: 844 });
    await phone.route('https://gc.zgo.at/count.js', (r) => r.fulfill({ contentType: 'application/javascript', body: '' }));
    await phone.route('**/data/*.json', async (r) => { await new Promise((x) => setTimeout(x, 500)); await r.continue(); });
    await phone.goto(page_url);
    await ready(phone);
    const go = await phone.locator('#see-list').boundingBox();
    assert.ok(go && go.y + go.height <= 844, 'the Show results button is on the first phone screen');
    await phone.locator('#see-list').click();
    await phone.waitForSelector('#list .card');
    assert.equal(await phone.locator('.list-bar').isVisible(), true);
    await phone.close();
    pass('phone: Show results sits on the first screen, even on a slow load');

    for (const [width, height] of [[1440, 1000], [768, 1000], [390, 844], [320, 700]]) {
      await page.setViewportSize({ width, height });
      for (const view of ['', 'list&']) {
        await page.goto('about:blank');
        await page.goto(`${page_url}#${view}level=phd&needs=money,travel`);
        await ready(page);
        if (view) { await page.waitForSelector('#list .card'); await page.locator('#group-out summary').click(); }
        // Let the view's entrance animation finish so contrast is measured at full opacity.
        await page.waitForFunction(() => document.getAnimations().every((x) => x.playState !== 'running'));
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `overflow at ${width}px ${view || 'ask'}`);
        const viewAudit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        assert.deepEqual(viewAudit.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })), [], `accessibility at ${width}px ${view || 'ask'}`);
        await page.screenshot({ path: path.join(out, `matcher-${width}-${view ? 'list' : 'ask'}.png`) });
      }
      pass(`${width}px: both views, no horizontal overflow, no automated WCAG A/AA violations`);
    }

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('about:blank');
    await page.goto(page_url);
    await ready(page);
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
    await ready(noOverlay);
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
