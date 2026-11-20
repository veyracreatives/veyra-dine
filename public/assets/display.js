// Veyra Dine In counter display. Opened with the secret link from Settings › Counter display.
// Idle: order board (preparing / ready to collect), menu QR, guest WiFi, offers.
// When the counter builds an order or opens a bill: items, total and a UPI QR for the exact amount.
(function () {
  const app = document.getElementById('app');
  const slug = (location.pathname.split('/')[2] || '').toLowerCase();
  const key = new URLSearchParams(location.search).get('k') || '';
  const qs = `s=${encodeURIComponent(slug)}&k=${encodeURIComponent(key)}`;
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  let S = null, es = null, online = true, lastReady = null, lastLines = [], thanksTimer = 0, calmTimer = 0, audio = null, started = false;
  const ls = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
  const cur = n => (S && S.restaurant.currency || '₹') + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

  function off(msg) {
    if (es) { es.close(); es = null; }
    app.innerHTML = `<div class="d-off"><div><h1>Counter display is off</h1><p>${esc(msg || 'Turn it on in Settings › Counter display, then open the link again.')}</p></div></div>`;
    setTimeout(load, 60000); // keeps trying, so the screen comes back by itself when the owner turns it on again
  }

  async function load() {
    try {
      const r = await fetch('/api/display/state?' + qs, { cache: 'no-store' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return off(j.error);
      S = j; setBrand(); draw(); connect();
      if (!started && !ls.get('vd_disp_started')) startOverlay();
    } catch { online = false; app.innerHTML = '<div class="d-off"><div><h1>No internet</h1><p>The display tries again by itself.</p></div></div>'; setTimeout(load, 10000); }
  }

  function connect() {
    if (es) es.close();
    es = new EventSource('/api/display/stream?' + qs);
    es.addEventListener('state', e => { S = JSON.parse(e.data); online = true; setBrand(); draw(); });
    es.addEventListener('board', e => { S.board = JSON.parse(e.data); draw(); });
    es.addEventListener('screen', e => { S.screen = JSON.parse(e.data); draw(); });
    es.addEventListener('info', e => { const x = JSON.parse(e.data); Object.assign(S, x); setBrand(); draw(); });
    es.addEventListener('off', () => { es.close(); es = null; load(); });
    es.onopen = () => { if (!online) { online = true; draw(); } };
    es.onerror = () => {
      online = false; draw();
      if (es && es.readyState === 2) { es = null; setTimeout(load, 5000); } // closed for good (link changed or display off): check why
    };
  }

  function setBrand() { document.documentElement.style.setProperty('--brand', /^#[0-9a-f]{6}$/i.test(S.restaurant.brandColor) ? S.restaurant.brandColor : '#E4572E'); document.title = S.restaurant.name + ' · Counter display'; }

  // ---------- sound: a soft two-note chime when an order is ready ----------
  function chime() {
    if (!S || !S.cfg.sound || !audio) return;
    try {
      const t = audio.currentTime;
      [[880, 0], [1320, .18]].forEach(([f, d]) => { const o = audio.createOscillator(), g = audio.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0, t + d); g.gain.linearRampToValueAtTime(.25, t + d + .02); g.gain.exponentialRampToValueAtTime(.001, t + d + .6); o.connect(g).connect(audio.destination); o.start(t + d); o.stop(t + d + .65); });
    } catch {}
  }
  function startOverlay() {
    const o = document.createElement('div'); o.className = 'd-start';
    o.innerHTML = `<div><h2>Start the counter display</h2><p>Tap once to go full screen and turn on the sound for ready orders.</p><button id="go">Start display</button><button class="skip" id="skip">Not now</button></div>`;
    document.body.appendChild(o);
    o.querySelector('#go').onclick = () => { unlock(); fullscreen(); ls.set('vd_disp_started', '1'); o.remove(); };
    o.querySelector('#skip').onclick = () => { unlock(); o.remove(); };
  }
  function unlock() { started = true; try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); audio.resume(); } catch {} wake(); }
  document.addEventListener('pointerdown', () => { if (!audio) unlock(); }, { once: true });
  let lock = null;
  async function wake() { try { if ('wakeLock' in navigator && !lock) { lock = await navigator.wakeLock.request('screen'); lock.addEventListener('release', () => { lock = null; }); } } catch {} }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') wake(); });
  function fullscreen() { const d = document.documentElement; if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else if (d.requestFullscreen) d.requestFullscreen().catch(() => {}); }

  // hide the full-screen button when nobody moves the mouse
  function stir() { const d = app.querySelector('.d'); if (!d) return; d.classList.remove('calm'); clearTimeout(calmTimer); calmTimer = setTimeout(() => { const x = app.querySelector('.d'); if (x) x.classList.add('calm'); }, 4000); }
  document.addEventListener('mousemove', stir); document.addEventListener('touchstart', stir, { passive: true });

  // ---------- drawing ----------
  function screenNow() {
    const s = S.screen || { mode: 'idle' };
    if (s.mode !== 'idle' && s.at && Date.now() - Date.parse(s.at) > (s.mode === 'thanks' ? 12000 : 20 * 60e3)) return { mode: 'idle' };
    return s;
  }
  function draw() {
    if (!S) return;
    const R = S.restaurant, s = screenNow(), paying = ['cart', 'order', 'bill'].includes(s.mode);
    // ready chime: a number that was not ready before
    const readyIds = (S.board.ready || []).map(o => o.id);
    const fresh = lastReady ? readyIds.filter(id => !lastReady.includes(id)) : [];
    if (fresh.length) chime();
    lastReady = readyIds;

    let main, side = '';
    if (s.mode === 'thanks') {
      clearTimeout(thanksTimer); thanksTimer = setTimeout(() => { S.screen = { mode: 'idle' }; draw(); }, 10000);
      main = `<div class="card thanks"><div class="tick">${icon('check', 96)}</div><h2>Thank you!</h2><p>${s.amount ? `Paid ${cur(s.amount)}. ` : ''}${esc(R.name)} hopes to see you again.</p></div>`;
    } else if (paying) {
      const lines = s.lines || [], newKeys = lines.map(l => l.name + '|' + l.price + '|' + l.qty);
      const before = new Set(lastLines); lastLines = newKeys;
      main = `<div class="card bill"><div class="bill-h"><h2>${esc(s.mode === 'cart' ? (s.title || 'Your order') : s.title || 'Your bill')}</h2>${s.number ? `<span class="tag">Order #${esc(s.number)}</span>` : s.mode === 'cart' ? '<span class="tag">Adding…</span>' : ''}</div>
        <div class="lines">${lines.map((l, i) => `<div class="ln ${before.size && !before.has(newKeys[i]) ? 'fresh' : ''}"><span class="q">${l.qty}×</span><span class="n">${esc(l.name)}</span><span class="a">${cur(l.qty * l.price)}</span></div>`).join('')}</div>
        <div class="sums">
          ${s.discount ? `<div><span>Discount</span><span>−${cur(s.discount)}</span></div>` : ''}
          <div class="tot"><span>Total</span><span>${cur(s.total)}</span></div>
          ${s.paid ? `<div class="paid"><span>Paid</span><span>${cur(s.paid)}</span></div><div class="tot"><span>To pay</span><span>${cur(s.left)}</span></div>` : ''}
        </div></div>`;
      const label = s.split ? `Each person pays (split ${s.split} ways)` : s.who ? `${esc(s.who)} pays` : s.mode === 'cart' ? 'Total so far' : 'Amount to pay';
      side = s.qr
        ? `<div class="card pay"><span class="lbl">${label}</span><span class="amt">${cur(s.pay)}</span><div class="big">${s.qr}</div><span class="sub">Scan with any UPI app to pay <b>${esc(s.upiName)}</b></span><div class="apps"><span>GPay</span><span>PhonePe</span><span>Paytm</span><span>BHIM</span></div></div>`
        : `<div class="card pay cash"><span class="lbl">${label}</span><span class="amt">${cur(s.pay || s.total)}</span><span class="sub">Please pay at the counter. Cash, card and UPI accepted.</span></div>`;
    } else {
      lastLines = [];
      const B = S.board || { preparing: [], ready: [] };
      const nums = list => list.map(o => `<div class="num ${fresh.includes(o.id) ? 'new' : ''}"><b>${esc(o.number)}</b>${o.table ? `<small>${esc(o.table)}</small>` : ''}</div>`).join('');
      main = S.cfg.board
        ? `<div class="board">
            <div class="card b-col"><h2><span class="dot"></span>Preparing</h2><div class="nums">${B.preparing.length ? nums(B.preparing) : '<span class="b-empty">No orders cooking right now.</span>'}</div></div>
            <div class="card b-col ready"><h2><span class="dot"></span>Ready to collect</h2><div class="nums">${B.ready.length ? nums(B.ready) : '<span class="b-empty">Your order number shows here when it is ready.</span>'}</div></div>
          </div>`
        : `<div class="card hero"><h2>${esc(S.cfg.welcome || 'Welcome to ' + R.name)}</h2>${R.tagline ? `<p>${esc(R.tagline)}</p>` : ''}</div>`;
      const cards = [];
      if (S.cfg.board && S.cfg.welcome) cards.push(`<div class="card welcome"><p>${esc(S.cfg.welcome)}</p></div>`);
      if (S.menuQr) cards.push(`<div class="card"><div class="qrrow"><div class="qr">${S.menuQr.svg}</div><div><h3>See our menu</h3><p>Scan with your phone camera.</p></div></div></div>`);
      if (S.wifi) cards.push(`<div class="card"><div class="qrrow"><div class="qr"><img alt="" src="/api/menu/${encodeURIComponent(R.slug)}/wifi-qr"></div><div><h3>Free WiFi</h3><p>${esc(S.wifi.ssid)}</p>${S.wifi.pass ? `<span class="pw">${esc(S.wifi.pass)}</span>` : ''}</div></div></div>`);
      if (S.offers && S.offers.length) cards.push(`<div class="card"><p class="k">${icon('gift', 18)} Today's offers</p>${S.offers.slice(0, 3).map(c => `<div class="offer"><span class="code">${esc(c.code)}</span><div><b>${esc(c.label)}</b>${c.note ? `<small>${esc(c.note)}</small>` : ''}</div></div>`).join('')}</div>`);
      side = cards.join('');
    }
    const logo = R.logo ? `<img class="d-logo" src="${esc(R.logo)}" alt="">` : `<span class="d-logo txt">${esc((R.name || 'R').trim().charAt(0).toUpperCase())}</span>`;
    const calm = app.querySelector('.d.calm') ? ' calm' : '';
    app.innerHTML = `<div class="d${calm}">
      <header class="d-top">${logo}<div class="d-name"><h1>${esc(R.name)}</h1>${R.tagline && (paying || S.cfg.board) ? `<p>${esc(R.tagline)}</p>` : ''}</div>
        ${online ? '' : `<span class="d-net">${icon('wifi', 16)} Reconnecting…</span>`}
        <span class="d-clock" id="clk">${clock()}</span>
        <button class="d-fs" id="fs" title="Full screen" aria-label="Full screen">${icon('expand', 20)}</button></header>
      <main class="d-body${side ? '' : ' solo'}${paying ? ' paying' : ''}">${main}${side ? `<aside class="d-side">${side}</aside>` : ''}</main>
      <footer class="d-foot"><span>${s.mode === 'thanks' ? '' : paying ? 'Please check your order. Tell us if anything is wrong.' : S.cfg.board ? 'Listen for your number, or watch this screen.' : ''}</span><span>Powered by <b>Veyra Dine In</b></span></footer>
    </div>`;
    app.querySelector('#fs').onclick = fullscreen;
    fitLines(); fitSide(); fitNums();
  }
  function fitNums() { // more numbers than fit: keep the oldest cooking and the newest ready ones, say how many more
    app.querySelectorAll('.nums').forEach(n => {
      if (n.scrollHeight <= n.clientHeight + 2) return;
      n.insertAdjacentHTML('afterend', '<div class="b-more">+0 more</div>'); // take its room first, then drop numbers until the rest fit
      let gone = 0; while (n.children.length > 1 && n.scrollHeight > n.clientHeight + 2) { n.lastElementChild.remove(); gone++; }
      n.nextElementSibling.textContent = `+${gone} more`;
    });
  }
  function fitSide() { // too many cards for a short screen: drop the last ones instead of cutting them
    const sd = app.querySelector('.d-side'); if (!sd || getComputedStyle(sd).overflow !== 'hidden') return;
    while (sd.children.length > 1 && sd.scrollHeight > sd.clientHeight + 2) sd.lastElementChild.remove();
  }
  function fitLines() { const l = app.querySelector('.lines'); if (!l) return; l.classList.toggle('more', l.scrollHeight > l.clientHeight + 2); if (l.scrollHeight > l.clientHeight + 2) { const fresh = l.querySelector('.fresh'); (fresh || l.lastElementChild).scrollIntoView({ block: 'end' }); } }
  function clock() { return new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }); }
  setInterval(() => { const c = document.getElementById('clk'); if (c) c.textContent = clock(); }, 15000);
  setInterval(() => { if (S && S.screen && S.screen.mode !== 'idle' && screenNow().mode === 'idle') draw(); }, 30000);
  setInterval(() => { if (S && online) fetch('/api/display/state?' + qs, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(j => { if (j) { S.board = j.board; draw(); } }).catch(() => {}); }, 120000); // old "ready" numbers leave after 30 minutes
  window.addEventListener('resize', () => draw());
  if (document.fonts) { document.fonts.ready.then(() => draw()); document.fonts.addEventListener('loadingdone', () => draw()); } // sizes change once the fonts arrive
  if (!slug || !key) off('This link is missing its key. Open the link from Settings › Counter display.'); else load();
})();
