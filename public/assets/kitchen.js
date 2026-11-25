// Veyra Dine In kitchen display (KDS). Opened with the secret link from Settings › Kitchen display.
// Shows every order to cook as a ticket with a timer. Cooks tap Start cooking, then Ready.
(function () {
  const app = document.getElementById('app');
  const slug = (location.pathname.split('/')[2] || '').toLowerCase();
  const key = new URLSearchParams(location.search).get('k') || '';
  const qs = `s=${encodeURIComponent(slug)}&k=${encodeURIComponent(key)}`;
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const ls = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
  let S = null, es = null, online = true, seen = null, fresh = new Set(), audio = null, ask = '', askT = 0, busy = new Set();
  let soundOn = ls.get('vd_kds_sound') !== '0';

  function off(msg) {
    if (es) { es.close(); es = null; }
    app.innerHTML = `<div class="k-off"><div><h1>Kitchen display is off</h1><p>${esc(msg || 'Turn it on in Settings › Kitchen display, then open the link again.')}</p></div></div>`;
    setTimeout(load, 60000);
  }
  async function load() {
    try {
      const r = await fetch('/api/kitchen/state?' + qs, { cache: 'no-store' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return off(j.error);
      take(j); connect();
      if (!audio && !ls.get('vd_kds_started')) startOverlay();
    } catch { online = false; app.innerHTML = '<div class="k-off"><div><h1>No internet</h1><p>The kitchen screen tries again by itself.</p></div></div>'; setTimeout(load, 8000); }
  }
  function take(j) {
    const firstLoad = !S; S = Object.assign(S || {}, j); online = true;
    const ids = (S.cooking || []).map(o => o.id);
    if (seen && !firstLoad) { const nw = (S.cooking || []).filter(o => !seen.has(o.id)); if (nw.length) { nw.forEach(o => fresh.add(o.id)); chime(); setTimeout(() => { nw.forEach(o => fresh.delete(o.id)); }, 4000); } }
    seen = new Set([...(seen || []), ...ids]);
    document.documentElement.style.setProperty('--brand', /^#[0-9a-f]{6}$/i.test(S.restaurant.brandColor) ? S.restaurant.brandColor : '#E4572E');
    document.title = 'Kitchen · ' + S.restaurant.name;
    draw();
  }
  function connect() {
    if (es) es.close();
    es = new EventSource('/api/kitchen/stream?' + qs);
    es.addEventListener('state', e => take(JSON.parse(e.data)));
    es.addEventListener('orders', e => take(JSON.parse(e.data)));
    es.addEventListener('cfg', e => take(JSON.parse(e.data)));
    es.addEventListener('off', () => { es.close(); es = null; load(); });
    es.onopen = () => { if (!online) { online = true; draw(); } };
    es.onerror = () => { online = false; draw(); if (es && es.readyState === 2) { es = null; setTimeout(load, 5000); } };
  }
  // keeps "Kitchen online" on for guests while this screen is open
  setInterval(() => { if (S) fetch('/api/kitchen/ping', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ s: slug, k: key }) }).catch(() => {}); }, 30000);

  // ---------- sound ----------
  function chime() {
    if (!soundOn || !audio || (S && S.cfg && S.cfg.sound === false)) return;
    try { const t = audio.currentTime; [[988, 0], [1319, .16], [988, .32]].forEach(([f, d]) => { const o = audio.createOscillator(), g = audio.createGain(); o.type = 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(0, t + d); g.gain.linearRampToValueAtTime(.35, t + d + .02); g.gain.exponentialRampToValueAtTime(.001, t + d + .4); o.connect(g).connect(audio.destination); o.start(t + d); o.stop(t + d + .45); }); } catch {}
  }
  function unlock() { try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); audio.resume(); } catch {} wake(); }
  function startOverlay() {
    const o = document.createElement('div'); o.className = 'k-start';
    o.innerHTML = `<div><h2>Start the kitchen screen</h2><p>Tap once to go full screen and hear a bell for every new order.</p><button id="go">Start</button><button class="skip" id="skip">Not now</button></div>`;
    document.body.appendChild(o);
    o.querySelector('#go').onclick = () => { unlock(); fullscreen(); ls.set('vd_kds_started', '1'); o.remove(); };
    o.querySelector('#skip').onclick = () => { unlock(); o.remove(); };
  }
  document.addEventListener('pointerdown', () => { if (!audio) unlock(); }, { once: true });
  let lock = null;
  async function wake() { try { if ('wakeLock' in navigator && !lock) { lock = await navigator.wakeLock.request('screen'); lock.addEventListener('release', () => { lock = null; }); } } catch {} }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') wake(); });
  function fullscreen() { const d = document.documentElement; if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else if (d.requestFullscreen) d.requestFullscreen().catch(() => {}); }
  function toast(t) { const x = document.createElement('div'); x.className = 'k-toast'; x.textContent = t; document.body.appendChild(x); setTimeout(() => x.remove(), 3500); }

  // ---------- actions ----------
  async function move(id, status) {
    if (busy.has(id)) return; busy.add(id); draw();
    try {
      const r = await fetch('/api/kitchen/order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ s: slug, k: key, id, status }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) toast(j.error || 'Could not update the order'); else take(j);
    } catch { toast('No internet. Tap again when it is back.'); }
    busy.delete(id); draw();
  }

  // ---------- drawing ----------
  const mins = iso => Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60000));
  function timer(o) {
    const m = mins(o.createdAt);
    if (o.readyBy) { const left = Math.round((Date.parse(o.readyBy) - Date.now()) / 60000); return [`${m} min`, left < 0 ? 'late' : left <= 3 ? 'warn' : '', left >= 0 ? `due in ${left} min` : `${-left} min late`]; }
    return [`${m} min`, m >= 20 ? 'late' : m >= 10 ? 'warn' : '', ''];
  }
  const diet = d => d === 'veg' || d === 'nonveg' || d === 'egg' ? `<span class="dt ${d}"></span>` : '';
  const src = o => o.source === 'waiter' ? `Waiter${o.waiter ? ' ' + o.waiter : ''}` : o.source === 'counter' ? ((o.table || 'Counter') === 'Counter' ? 'Counter' : 'Staff') : o.source === 'wifi' ? 'WiFi backup' : 'QR order';
  function ticket(o) {
    const [tt, tc, due] = timer(o), isNew = o.status === 'new', sub = [src(o) === 'Counter' && (o.table || 'Counter') === 'Counter' ? '' : src(o), o.name, due].filter(Boolean).join(' · ');
    return `<article class="t ${isNew ? 'new' : ''} ${fresh.has(o.id) ? 'fresh' : ''}">
      <div class="t-h"><span class="t-no">#${esc(o.number)}</span><div class="t-who"><b>${esc(o.table || 'Counter')}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</div><span class="t-time ${tc}">${tt}</span></div>
      <ul class="t-items">${o.items.map(l => `<li><span class="q">${l.qty}×</span><span class="n">${diet(l.diet)}${esc(l.name)}</span>${l.note ? `<span class="ln">${esc(l.note)}</span>` : ''}</li>`).join('')}</ul>
      ${o.note ? `<div class="t-note">${esc(o.note)}</div>` : ''}
      <button class="t-go" data-id="${esc(o.id)}" data-to="${isNew ? 'preparing' : 'ready'}" ${busy.has(o.id) ? 'disabled' : ''}>${isNew ? icon('chef', 22) + ' Start cooking' : icon('check', 22) + ' Ready'}</button>
    </article>`;
  }
  function draw() {
    if (!S) return;
    const R = S.restaurant, C = S.cooking || [], RD = S.ready || [], nNew = C.filter(o => o.status === 'new').length;
    const tot = {}; C.forEach(o => o.items.forEach(l => { tot[l.name] = (tot[l.name] || 0) + l.qty; }));
    const all = Object.entries(tot).sort((a, b) => b[1] - a[1]);
    const logo = R.logo ? `<img class="k-logo" src="${esc(R.logo)}" alt="">` : `<span class="k-logo txt">${esc((R.name || 'R').trim().charAt(0).toUpperCase())}</span>`;
    const y = window.scrollY;
    app.innerHTML = `<div class="k">
      <header class="k-top">${logo}<div class="k-name"><small>Kitchen</small><h1>${esc(R.name)}</h1></div>
        ${online ? '' : `<span class="k-net">${icon('wifi', 16)} Reconnecting…</span>`}
        ${S.accepting === false ? '<span class="k-pause">Orders paused</span>' : ''}
        <div class="k-stat"><span class="new"><b>${nNew}</b> new</span><span><b>${C.length - nNew}</b> cooking</span><span><b>${RD.length}</b> ready</span></div>
        <span class="k-clock" id="clk">${clock()}</span>
        <button class="k-btn ${soundOn ? '' : 'off'}" id="snd" title="${soundOn ? 'Sound on' : 'Sound off'}" aria-label="Sound">${icon(soundOn ? 'sound' : 'mute', 20)}</button>
        <button class="k-btn" id="fs" title="Full screen" aria-label="Full screen">${icon('expand', 20)}</button></header>
      <div class="allday">${all.length ? `<span class="lbl">To make</span>${all.map(([n, q]) => `<span><b>${q}×</b> ${esc(n)}</span>`).join('')}` : ''}</div>
      <main class="tickets">${C.length ? C.map(ticket).join('') : '<div class="k-empty" style="grid-column:1/-1"><div><h2>All caught up</h2><p>New orders appear here with a bell.</p></div></div>'}</main>
      ${S.cfg && S.cfg.readyShow === false ? '' : `<footer class="k-ready"><span>Ready</span>${RD.length ? RD.map(o => `<button data-back="${esc(o.id)}" class="${ask === o.id ? 'ask' : ''}">#${esc(o.number)} <small>${ask === o.id ? 'Tap again to cook again' : esc(o.table || 'Counter')}</small></button>`).join('') : '<span class="none">Orders you mark ready show here for 15 minutes. Tap one to bring it back.</span>'}</footer>`}
    </div>`;
    window.scrollTo(0, y);
    app.querySelector('#fs').onclick = fullscreen;
    app.querySelector('#snd').onclick = () => { soundOn = !soundOn; ls.set('vd_kds_sound', soundOn ? '1' : '0'); unlock(); if (soundOn) chime(); draw(); };
    app.querySelectorAll('[data-to]').forEach(b => b.onclick = () => move(b.dataset.id, b.dataset.to));
    app.querySelectorAll('[data-back]').forEach(b => b.onclick = () => {
      if (ask === b.dataset.back) { ask = ''; clearTimeout(askT); move(b.dataset.back, 'preparing'); return; }
      ask = b.dataset.back; clearTimeout(askT); askT = setTimeout(() => { ask = ''; draw(); }, 4000); draw();
    });
  }
  function clock() { return new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }); }
  setInterval(() => { if (S && !busy.size) draw(); }, 30000); // timers move on
  if (!slug || !key) off('This link is missing its key. Open the link from Settings › Kitchen display.'); else load();
})();
