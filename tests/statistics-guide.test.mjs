import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

// Lesson order as the Alea hub shows it: folders group-1 to group-5, cards in order.
function hubOrder() {
  const hub = read('statistics.html'), order = [];
  for (let i = 1; i <= 5; i++) {
    const start = hub.indexOf(`id="group-${i}"`), end = hub.indexOf('</section>', start);
    assert.ok(start > 0, `folder group-${i} exists`);
    for (const m of hub.slice(start, end).matchAll(/href="statistics\/([a-z0-9-]+)\.html"/g)) order.push(m[1]);
  }
  return order;
}

test('previous and next lesson links follow the hub folder order', () => {
  const order = hubOrder();
  assert.equal(order.length, 17);
  order.forEach((slug, i) => {
    const page = read(`statistics/${slug}.html`);
    const prev = page.match(/rel="prev" href="([a-z0-9-]+)\.html"/)?.[1], next = page.match(/rel="next" href="([a-z0-9-]+)\.html"/)?.[1];
    assert.equal(prev, order[i - 1], `${slug} previous`);
    assert.equal(next, order[i + 1], `${slug} next`);
  });
});

test('the IOVA case links its safety and endpoint sections to the matching lessons', () => {
  const page = read('valuations/iova.html');
  const section = id => { const start = page.indexOf(`<section id="${id}">`); return page.slice(start, page.indexOf('</section>', start)); };
  assert.match(section('safety-context'), /href="\.\.\/statistics\/safety-and-benefit-risk\.html"/);
  assert.match(section('trial-design'), /href="\.\.\/statistics\/cox-regression\.html"/);
  assert.match(section('trial-design'), /href="\.\.\/statistics\/confidence-intervals\.html"/);
});
