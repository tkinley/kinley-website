(function () {
  'use strict';
  var config = window.kinleyVisitorStats || {};
  var panel = document.getElementById('visitor-stats');
  if (!panel) return;
  var status = panel.querySelector('[data-visitor-status]');
  var badge = panel.querySelector('[data-visitor-badge]');
  var fields = panel.querySelectorAll('[data-visitor-period]');

  // A local design preview never sends analytics or counter requests.
  if (config.preview === true) {
    panel.hidden = false;
    badge.textContent = 'Design preview';
    status.textContent = 'Connect analytics to start counting. No visits are recorded in this preview.';
    return;
  }
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(config.siteCode || '')) return;
  // Keep local previews, forks, and other pages out of the real counts.
  if (window.location.origin !== config.origin || window.location.pathname !== config.path) return;

  var base = 'https://' + config.siteCode + '.goatcounter.com';
  window.goatcounter = {
    path: config.path,
    title: 'Notes for fellow students',
    // Avoid sending search strings or fragments from referring URLs.
    referrer: function () {
      if (!document.referrer) return '';
      try {
        var url = new URL(document.referrer);
        return /^https?:$/.test(url.protocol) ? url.origin + url.pathname : '';
      } catch (_) { return ''; }
    }
  };
  var tracker = document.createElement('script');
  tracker.async = true;
  tracker.src = 'https://gc.zgo.at/count.js';
  tracker.setAttribute('data-goatcounter', base + '/count');
  document.head.appendChild(tracker);

  panel.hidden = false;
  badge.textContent = 'Page views';
  status.textContent = 'Loading visitor statistics…';

  function readCount(field) {
    var url = new URL(base + '/counter/' + encodeURIComponent(config.path) + '.json');
    if (field.dataset.visitorPeriod) url.searchParams.set('start', field.dataset.visitorPeriod);
    var controller = new AbortController();
    var timer = window.setTimeout(function () { controller.abort(); }, 8000);
    return fetch(url.href, {credentials: 'omit', referrerPolicy: 'no-referrer', signal: controller.signal})
      .then(function (response) {
        // A new path returns 404 with a real zero-count JSON body.
        if (!response.ok && response.status !== 404) throw new Error('Counter unavailable');
        return response.json();
      })
      .then(function (data) {
        var value = typeof data.count === 'number' ? String(data.count) : data.count;
        if (typeof value !== 'string' || value.length > 32 || !/^[0-9][0-9,.\s\u00a0\u202f]*$/.test(value)) {
          throw new Error('Invalid counter response');
        }
        return value;
      })
      .finally(function () { window.clearTimeout(timer); });
  }
  Promise.all(Array.from(fields, readCount))
    .then(function (values) {
      fields.forEach(function (field, index) { field.textContent = values[index]; });
      status.textContent = 'Student Notes only · Counts may take up to four hours to refresh.';
    })
    .catch(function () {
      // Missing permissions, blocked requests, or service errors are never shown as zero visits.
      fields.forEach(function (field) { field.textContent = '—'; });
      badge.textContent = 'Unavailable';
      status.textContent = 'Visitor statistics are temporarily unavailable. Please check back later.';
    });
})();
