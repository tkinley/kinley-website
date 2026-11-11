// Subscribe row for Student Opportunities (see SUBSCRIPTION.md).
//
// This is the page's one deliberate exception to "answers never leave the
// browser": when a visitor types an email and taps the button, the email,
// the chosen frequency, the three matcher answers, and any of the optional
// extra answers they picked are sent to the form endpoint so the digest can
// be picked for them. Nothing is sent on page load, on answer changes, or
// from this module's own storage (there is none).
//
// TO GO LIVE: create a free Formspree form and replace REPLACE_WITH_FORM_ID
// below with its ID. While the placeholder is in place the button explains
// that signup is not live yet and sends nothing.

const SUBSCRIBE_ENDPOINT = 'https://formspree.io/f/REPLACE_WITH_FORM_ID';
const DORMANT = SUBSCRIBE_ENDPOINT.includes('REPLACE_WITH_FORM_ID');

const root = document.getElementById('subscribe');
if (root) {
  const form = document.getElementById('answers');
  const email = document.getElementById('sub-email');
  const go = document.getElementById('sub-go');
  const status = document.getElementById('sub-status');
  let frequency = 'biweekly';
  const extra = { school: '', college: '', stage: '', background: [] };

  const say = (text) => {
    status.hidden = !text;
    status.textContent = text || '';
  };

  for (const pill of root.querySelectorAll('.sub-freq .sub-pill')) {
    pill.addEventListener('click', () => {
      frequency = pill.dataset.freq || 'biweekly';
      for (const p of root.querySelectorAll('.sub-freq .sub-pill')) p.classList.toggle('is-on', p === pill);
    });
  }

  // Optional extra answers: one pick per group, except Background, which
  // allows several. Tapping a picked pill again clears it.
  for (const group of root.querySelectorAll('.sub-pills[data-group]')) {
    const name = group.dataset.group;
    const multi = group.dataset.multi === 'true';
    for (const pill of group.querySelectorAll('.sub-pill')) {
      pill.addEventListener('click', () => {
        const value = pill.dataset.value || '';
        if (multi) {
          const on = pill.classList.toggle('is-on');
          extra[name] = on ? [...extra[name], value] : extra[name].filter((v) => v !== value);
        } else {
          const wasOn = pill.classList.contains('is-on');
          for (const p of group.querySelectorAll('.sub-pill')) p.classList.remove('is-on');
          pill.classList.toggle('is-on', !wasOn);
          extra[name] = wasOn ? '' : value;
        }
      });
    }
  }

  const readAnswers = () => {
    const data = new FormData(form);
    return {
      level: data.get('level') || '',
      citizen: data.get('citizen') || '',
      needs: data.getAll('needs'),
    };
  };

  go.addEventListener('click', async () => {
    const address = (email.value || '').trim();
    if (DORMANT) {
      say('Email signup is not live yet. The list above is the whole thing for now.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      say('That email does not look complete.');
      email.focus();
      return;
    }
    go.disabled = true;
    say('Sending…');
    try {
      const res = await fetch(SUBSCRIBE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email: address, frequency, ...readAnswers(), ...extra, source: 'student-match' }),
      });
      if (!res.ok) throw new Error(String(res.status));
      email.value = '';
      say("You're in. The first email lands with the next digest.");
    } catch {
      say('That did not go through. Try again in a moment.');
    } finally {
      go.disabled = false;
    }
  });
}
