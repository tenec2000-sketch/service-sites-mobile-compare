// Booking buttons: without JavaScript they call the salon; with it they open the
// online booking of the chosen branch, on the service of the row when it has one
// (data-book="slug:id slug:id"; data-book-at fixes the branch). Branch buttons (data-branch-pick) switch the
// branch, which the next visit remembers; the door sign (data-sign) says whether
// the salon is open right now, by Moscow time.
(() => {
  const [, param, path = 'book'] = (document.body.dataset.booking || '5173 services book').split(' ');
  const slugs = (document.body.dataset.branches || '').split(' ').filter(Boolean);
  const branchKey = `booking-branch:${slugs[0]}`;
  const labels = new WeakMap();
  let branch = slugs[0];
  try {
    const kept = localStorage.getItem(branchKey) ?? localStorage.getItem('branch');
    if (slugs.includes(kept)) branch = kept;
  } catch {}

  const link = () => {
    for (const a of document.querySelectorAll('[data-book]')) {
      const at = a.dataset.bookAt || branch; // a button of one branch books there
      const ids = Object.fromEntries(a.dataset.book.split(' ').filter(Boolean).map((p) => p.split(':')));
      const id = ids[at];
      const unavailableHere = a.dataset.book && !id;
      const label = a.firstChild;
      if (label?.nodeType === Node.TEXT_NODE) {
        if (!labels.has(a)) labels.set(a, label.nodeValue);
        label.nodeValue = unavailableHere ? 'По телефону' : labels.get(a);
      }
      if (unavailableHere) {
        // No online booking yet: the button calls the chosen branch.
        const phone = document.querySelector(`[data-branch-only="${at}"] a[href^="tel:"]`);
        if (phone) a.href = phone.getAttribute('href');
        continue;
      }
      const url = new URL('./client.html', document.baseURI);
      if (id) url.searchParams.set(param, id);
      if (path === 'calc' && a.dataset.calcKind) url.searchParams.set('kind', a.dataset.calcKind);
      if (path === 'calc' && a.dataset.calcSurface) url.searchParams.set('surface', a.dataset.calcSurface);
      a.href = url.href;
    }
    for (const b of document.querySelectorAll('[data-branch-pick]')) b.setAttribute('aria-pressed', String(b.dataset.branchPick === branch));
    for (const el of document.querySelectorAll('[data-branch-only]')) el.hidden = el.dataset.branchOnly !== branch;
    sign();
  };

  function sign() {
    const el = document.querySelector('[data-sign]');
    if (!el) return;
    const week = JSON.parse(el.dataset.sign)[branch];
    const now = new Date(Date.now() + 3 * 3_600_000); // Europe/Moscow, no DST
    const day = (now.getUTCDay() + 6) % 7;
    const time = now.toISOString().slice(11, 16);
    const today = week[day];
    const state = el.querySelector('[data-sign-state]');
    const when = el.querySelector('[data-sign-when]');
    if (today && time >= today[0] && time < today[1]) {
      el.dataset.open = 'true';
      state.textContent = 'Открыто';
      when.textContent = `сегодня до ${today[1]}`;
      return;
    }
    el.dataset.open = 'false';
    state.textContent = 'Закрыто';
    if (today && time < today[0]) {
      when.textContent = `откроемся сегодня в ${today[0]}`;
      return;
    }
    for (let i = 1; i <= 7; i++) {
      const next = week[(day + i) % 7];
      if (next) {
        when.textContent = `откроемся ${i === 1 ? 'завтра' : ['в понедельник', 'во вторник', 'в среду', 'в четверг', 'в пятницу', 'в субботу', 'в воскресенье'][(day + i) % 7]} в ${next[0]}`;
        return;
      }
    }
  }

  for (const b of document.querySelectorAll('[data-branch-pick]')) {
    b.addEventListener('click', () => {
      branch = b.dataset.branchPick;
      try {
      localStorage.setItem(branchKey, branch);
      } catch {}
      link();
    });
  }
  link();
  setInterval(sign, 60_000);

  // A long word in a wide face: a headline shrinks until its longest word fits
  // the column, so a word is never cut, at its hyphen either. The name on the
  // first screen; the titles of a row of cards together, so they keep one size;
  // the rows of the price board together, a name with its price.
  const widest = (nodes) => {
    const range = document.createRange();
    let w = 0;
    for (const node of nodes)
      for (const m of node.data.matchAll(/\S+/g)) {
        range.setStart(node, m.index);
        range.setEnd(node, m.index + m[0].length);
        w = Math.max(w, [...range.getClientRects()].reduce((s, r) => s + r.width, 0));
      }
    return w;
  };
  const texts = (el) => {
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walk.nextNode()) nodes.push(walk.currentNode);
    return nodes;
  };
  const title = document.querySelector('.hero h1');
  const name = title && title.firstChild;
  // A group: [the box a word must fit, its text, the element whose size changes].
  const groups = [
    name && name.nodeType === Node.TEXT_NODE ? [[title, [name], title]] : [],
    ...[...document.querySelectorAll('.cards')].map((cards) => [...cards.querySelectorAll('.card h3')].map((h) => [h, texts(h), h])),
    ...[...document.querySelectorAll('.menu-rows')].map((rows) =>
      [...rows.querySelectorAll('.menu-row')].map((row) => [row.querySelector('.menu-name'), texts(row.querySelector('.menu-name')), row]),
    ),
  ].filter((group) => group.length);
  const fit = () => {
    for (const group of groups) {
      for (const [, , el] of group) el.style.fontSize = '';
      const k = Math.min(...group.map(([box, nodes]) => box.clientWidth / (widest(nodes) || box.clientWidth)));
      if (k < 1) for (const [, , el] of group) el.style.fontSize = `${Math.floor(parseFloat(getComputedStyle(el).fontSize) * k * 0.98)}px`;
    }
  };
  fit();
  if (document.fonts) document.fonts.ready.then(fit);
  addEventListener('resize', fit);
})();
