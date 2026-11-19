// Waiter app: staff phones log in with the waiter PIN, see every table, take orders, serve food and answer calls.
(function () {
  const app = document.getElementById('app');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const load = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
  const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const pathSlug = (location.pathname.split('/')[2] || '').toLowerCase();
  const S = { me: null, tab: 'tables', orders: [], requests: [], menu: null, online: navigator.onLine !== false, sound: load('vw_sound', true) };
  let es = null, actx = null;
  const cur = n => (S.me ? S.me.restaurant.currency : '₹') + Number(n || 0).toLocaleString('en-IN');
  const ago = iso => { const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000)); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.floor(m / 60) + ' h ago' : Math.floor(m / 1440) + ' d ago'; };

  async function api(path, opts = {}) {
    let res;
    const ac = new AbortController(), tt = setTimeout(() => ac.abort(), opts.timeout || 15000);
    try { res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts, signal: ac.signal, body: opts.body ? JSON.stringify(opts.body) : undefined }); }
    catch (e) { const err = new Error('No internet. Check the WiFi or mobile data.'); err.network = true; throw err; }
    finally { clearTimeout(tt); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { const err = new Error(data.error || 'Something went wrong'); err.status = res.status; throw err; }
    return data;
  }
  function toast(html, kind) {
    const t = document.createElement('div'); t.className = 'toast' + (kind ? ' ' + kind : ''); t.innerHTML = html;
    document.getElementById('toasts').appendChild(t); setTimeout(() => t.remove(), 3200);
  }
  function sheet(html, cls = '') {
    const o = document.createElement('div'); o.className = 'overlay ' + cls; o.innerHTML = `<div class="sheet">${html}</div>`;
    o.addEventListener('click', e => { if (e.target === o || e.target.closest('[data-close]')) o.remove(); });
    document.body.appendChild(o); return o;
  }
  // ---- sound ----
  function unlock() { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); actx.resume(); } catch {} }
  function ding(times = 1) {
    try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch {}
    if (!S.sound || !actx) return;
    for (let k = 0; k < times; k++) [988, 1319].forEach((f, i) => {
      const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime + k * 0.7 + i * 0.15;
      o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      o.connect(g).connect(actx.destination); o.start(t); o.stop(t + 0.5);
    });
  }
  document.addEventListener('pointerdown', unlock, { once: true });

  // ---- orders saved on this phone while there is no internet ----
  const OUT = () => 'vw_out_' + (S.me ? S.me.restaurant.slug : pathSlug);
  async function flush() {
    const list = load(OUT(), []); if (!list.length) return;
    const left = [];
    for (const x of list) {
      try { const o = await api('/api/admin/orders', { method: 'POST', body: x }); upsert(o); }
      catch (e) { if (e.network) { left.push(x); } else toast(`Order for ${esc(x.tableName)} not sent: ${esc(e.message)}`, 'error'); }
    }
    store(OUT(), left);
    if (list.length !== left.length) { toast(`${icon('check', 18)} Saved orders sent to the kitchen`, 'ok'); render(); }
  }

  // ---- login ----
  function renderLogin(msg) {
    app.innerHTML = `<div class="w-login">
      <div class="w-brand">${icon('utensils', 26)}<div><b>Waiter</b><small>Veyra Dine In</small></div></div>
      <h1>Log in to take orders</h1>
      <p class="muted">Your restaurant admin gives you the restaurant ID and the waiter PIN. Ask them if you don't have them yet.</p>
      ${msg ? `<div class="w-err">${esc(msg)}</div>` : ''}
      <form id="lf" class="form">
        <label class="field"><span>Restaurant ID</span><input class="input" name="slug" value="${esc(pathSlug || load('vw_slug', ''))}" required autocapitalize="off" autocomplete="off"></label>
        <label class="field"><span>Your name</span><input class="input" name="name" value="${esc(load('vw_name', ''))}" required maxlength="30" autocomplete="name" placeholder="So the kitchen knows who took the order"></label>
        <label class="field"><span>Waiter PIN</span><input class="input pin" name="pin" type="password" inputmode="numeric" pattern="[0-9]*" minlength="4" maxlength="6" required autocomplete="off"></label>
        <button class="btn btn-dark btn-lg btn-block">Log in</button>
      </form></div>`;
    document.getElementById('lf').onsubmit = async e => {
      e.preventDefault(); const f = new FormData(e.target), b = e.target.querySelector('button:not(.pw-eye)'); b.disabled = true;
      try {
        await api('/api/waiter/login', { method: 'POST', body: { slug: f.get('slug').trim(), name: f.get('name').trim(), pin: f.get('pin') } });
        store('vw_slug', f.get('slug').trim().toLowerCase()); store('vw_name', f.get('name').trim());
        if (!pathSlug) history.replaceState(null, '', '/waiter/' + f.get('slug').trim().toLowerCase());
        unlock(); boot();
      } catch (err) { b.disabled = false; toast(esc(err.message), 'error'); }
    };
  }

  // ---- data ----
  async function boot() {
    try { S.me = await api('/api/admin/waiter/me'); }
    catch (e) { if (e.network && load('vw_cache', null)) { S.me = load('vw_cache', null); S.online = false; } else return renderLogin(e.status === 401 ? '' : e.message); }
    store('vw_cache', S.me); document.title = 'Waiter · ' + S.me.restaurant.name;
    if (S.me.restaurant.brandColor && window.applyBrand) window.applyBrand(S.me.restaurant.brandColor);
    await refresh(); connect(); render(); flush();
  }
  async function refresh() {
    try {
      const [orders, requests, menu] = await Promise.all([api('/api/admin/orders'), api('/api/admin/requests'), S.menu ? Promise.resolve(S.menu) : api('/api/admin/menu')]);
      S.orders = orders; S.requests = requests; S.menu = menu; store('vw_menu', menu); S.online = true;
    } catch (e) { if (e.status === 401) return renderLogin(); S.online = false; S.menu = S.menu || load('vw_menu', null); }
  }
  function upsert(o) { const i = S.orders.findIndex(x => x.id === o.id); if (['served', 'cancelled'].includes(o.status)) { if (i >= 0) S.orders.splice(i, 1); } else if (i >= 0) S.orders[i] = o; else S.orders.push(o); }
  function connect() {
    if (es) es.close();
    es = new EventSource('/api/admin/stream');
    es.addEventListener('order', e => {
      const o = JSON.parse(e.data), old = S.orders.find(x => x.id === o.id);
      if (o.status === 'ready' && (!old || old.status !== 'ready')) { ding(2); toast(`${icon('bell', 18)} <b>${esc(o.tableName)}</b>&nbsp;food is ready to serve`, 'ok'); }
      if (o.status === 'new' && !old && o.source === 'qr') { ding(1); toast(`${icon('bell', 18)} New order from <b>${esc(o.tableName)}</b>`); }
      upsert(o); render();
    });
    es.addEventListener('request', e => { const q = JSON.parse(e.data); if (!S.requests.some(x => x.id === q.id)) { S.requests.push(q); ding(2); toast(`${icon(REQ[q.type] ? REQ[q.type][0] : 'hand', 18)} <b>${esc(q.tableName)}</b>&nbsp;${esc(reqText(q))}`); } render(); });
    es.addEventListener('request-done', e => { const { id } = JSON.parse(e.data); S.requests = S.requests.filter(q => q.id !== id); render(); });
    es.onopen = () => { if (!S.online) { S.online = true; refresh().then(render); flush(); } };
    es.onerror = () => { if (S.online && navigator.onLine === false) { S.online = false; render(); } };
  }
  setInterval(() => { if (!S.me) return; api('/api/admin/ping', { method: 'POST', timeout: 10000 }).then(() => { if (!S.online) { S.online = true; refresh().then(render); } flush(); }).catch(e => { if (e.status === 401) return renderLogin(); if (S.online) { S.online = false; render(); } }); }, 30000);
  window.addEventListener('online', () => { S.online = true; if (S.me) { refresh().then(render); flush(); connect(); } });
  window.addEventListener('offline', () => { S.online = false; if (S.me) render(); });
  setInterval(() => { if (S.me && !document.querySelector('.overlay')) render(); }, 30000);

  const REQ = { waiter: ['hand', 'is calling a waiter'], bill: ['receipt', 'asked for the bill'], water: ['water', 'asked for water'], paid: ['check', 'paid by UPI'] };
  const reqText = q => q.type === 'paid' ? `${q.name || 'A guest'} paid ${cur(q.amount)} by UPI` : (REQ[q.type] || ['', 'needs you'])[1];

  // ---- table state from its live orders and calls ----
  function tableState(t) {
    const os = S.orders.filter(o => o.tableId === t.id), calls = S.requests.filter(q => q.tableId === t.id);
    const has = st => os.some(o => o.status === st);
    const state = has('ready') ? ['ready', 'Food ready'] : has('new') ? ['new', 'To accept'] : has('preparing') ? ['cooking', 'Cooking'] : os.length ? ['cooking', 'Cooking'] : ['free', 'Free'];
    return { os, calls, state, total: os.reduce((a, o) => a + o.total, 0) };
  }

  // ---- screens ----
  function render() {
    if (!S.me) return;
    const ready = S.orders.filter(o => o.status === 'ready').length, newQ = S.orders.filter(o => o.status === 'new').length, calls = S.requests.length;
    const queued = load(OUT(), []).length;
    app.innerHTML = `<div class="w-shell">
      <header class="w-top">
        <div class="w-who"><b>${esc(S.me.restaurant.name)}</b><small>${esc(S.me.name)}</small></div>
        <span class="w-net ${S.online ? 'on' : 'off'}"><i></i><span>${S.online ? 'Online' : 'Offline'}</span></span>
        <button class="icon-btn" id="snd" aria-label="${S.sound ? 'Sound on' : 'Sound off'}">${icon(S.sound ? 'sound' : 'mute', 20)}</button>
        <button class="icon-btn" id="out" aria-label="Log out">${icon('logout', 20)}</button>
      </header>
      ${!S.online ? `<div class="w-bar">${icon('wifi', 18)}<span><b>No internet.</b> You can still take orders. They are saved on this phone and go to the kitchen when the internet is back.</span></div>` : ''}
      ${queued ? `<div class="w-bar amber">${icon('clock', 18)}<span><b>${queued} order${queued > 1 ? 's' : ''} waiting to send.</b> ${S.online ? 'Sending now…' : 'Tell the kitchen by voice if it is urgent.'}</span></div>` : ''}
      <main class="w-main" id="main"></main>
      <nav class="w-nav">
        ${[['tables', 'Tables', 'qr', 0], ['orders', 'Orders', 'list', ready + newQ], ['calls', 'Calls', 'bell', calls]].map(([k, l, ic, n]) => `<button data-tab="${k}" class="${S.tab === k ? 'on' : ''}">${icon(ic, 22)}<span>${l}</span>${n ? `<em>${n}</em>` : ''}</button>`).join('')}
      </nav></div>`;
    const main = document.getElementById('main');
    ({ tables: renderTables, orders: renderOrders, calls: renderCalls })[S.tab](main);
    app.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { S.tab = b.dataset.tab; render(); window.scrollTo(0, 0); });
    document.getElementById('snd').onclick = () => { S.sound = !S.sound; store('vw_sound', S.sound); unlock(); if (S.sound) ding(1); render(); };
    document.getElementById('out').onclick = async () => { await api('/api/waiter/logout', { method: 'POST' }).catch(() => {}); S.me = null; if (es) es.close(); renderLogin(); };
  }

  function renderTables(c) {
    const ts = S.me.tables.map(t => ({ t, ...tableState(t) }));
    const busy = ts.filter(x => x.state[0] !== 'free').length;
    c.innerHTML = `<div class="w-head"><h1>Tables</h1><span class="muted">${busy} of ${ts.length} busy</span></div>
      <div class="w-legend"><span class="free">Free</span><span class="new">To accept</span><span class="cooking">Cooking</span><span class="ready">Food ready</span></div>
      <div class="w-grid">${ts.map(x => `<button class="w-table s-${x.state[0]}" data-t="${x.t.id}">
        ${x.calls.length ? `<span class="w-call">${icon(REQ[x.calls[0].type] ? REQ[x.calls[0].type][0] : 'hand', 14)}</span>` : ''}
        <b>${esc(x.t.name)}</b><small>${x.state[1]}</small>${x.total ? `<span class="w-amt">${cur(x.total)}</span>` : ''}</button>`).join('') || '<div class="empty">No tables yet. The owner adds them in Tables & QR.</div>'}
      </div>
      <button class="btn btn-lg btn-block w-take" id="takeaway">${icon('bag', 20)} Takeaway or counter order</button>`;
    c.querySelectorAll('[data-t]').forEach(b => b.onclick = () => openTable(S.me.tables.find(t => t.id === b.dataset.t)));
    document.getElementById('takeaway').onclick = () => takeOrder(null);
  }

  function orderCard(o) {
    const st = { new: ['To accept', 'new'], preparing: ['Cooking', 'cooking'], ready: ['Ready to serve', 'ready'] }[o.status] || [o.status, ''];
    return `<div class="w-order s-${st[1]}">
      <div class="w-oh"><div><b>${esc(o.tableName)}</b><small>#${o.number} · ${ago(o.createdAt)}${o.waiter ? ' · by ' + esc(o.waiter) : o.source === 'qr' ? ' · from QR' : ''}</small></div><span class="w-st">${st[0]}</span></div>
      <ul>${o.items.map(l => `<li><span class="d d-${esc(l.diet || 'veg')}"></span><b>${l.qty}×</b> ${esc(l.name)}${l.note ? ` <i>${esc(l.note)}</i>` : ''}</li>`).join('')}</ul>
      ${o.note ? `<p class="w-note">${icon('edit', 14)} ${esc(o.note)}</p>` : ''}
      <div class="w-oa"><span>${cur(o.total)}</span>
        ${o.status === 'new' ? `<button class="btn btn-dark" data-st="preparing" data-o="${o.id}">${icon('check', 18)} Accept</button>` : ''}
        ${o.status === 'ready' ? `<button class="btn btn-primary" data-st="served" data-o="${o.id}">${icon('check', 18)} Served</button>` : ''}
      </div></div>`;
  }
  function bindOrderBtns(root) {
    root.querySelectorAll('[data-st]').forEach(b => b.onclick = async () => {
      b.disabled = true;
      try { await api('/api/admin/orders/' + b.dataset.o, { method: 'PATCH', body: { status: b.dataset.st } }); const o = S.orders.find(x => x.id === b.dataset.o); if (o) { o.status = b.dataset.st; upsert(o); } toast(`${icon('check', 18)} ${b.dataset.st === 'served' ? 'Marked served' : 'Sent to the kitchen'}`, 'ok'); render(); const ov = document.querySelector('.overlay'); if (ov && ov.dataset.t) { ov.remove(); openTable(S.me.tables.find(t => t.id === ov.dataset.t)); } }
      catch (e) { b.disabled = false; toast(esc(e.message), 'error'); }
    });
  }

  function renderOrders(c) {
    const by = st => S.orders.filter(o => o.status === st).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const sec = (title, list, hint) => list.length ? `<h2 class="w-sec">${title} <span>${list.length}</span></h2>${hint ? `<p class="muted w-hint">${hint}</p>` : ''}${list.map(orderCard).join('')}` : '';
    const html = sec('Ready to serve', by('ready')) + sec('To accept', by('new'), 'Guest orders from the QR. Accept sends them to the kitchen.') + sec('Cooking', by('preparing'));
    c.innerHTML = `<div class="w-head"><h1>Orders</h1></div>${html || '<div class="empty">No open orders right now.</div>'}`;
    bindOrderBtns(c);
  }

  function renderCalls(c) {
    const list = [...S.requests].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    c.innerHTML = `<div class="w-head"><h1>Calls from tables</h1></div>${list.map(q => `<div class="w-callrow">
      <span class="w-ci">${icon(REQ[q.type] ? REQ[q.type][0] : 'hand', 22)}</span><div><b>${esc(q.tableName)}</b><small>${esc(reqText(q))} · ${ago(q.createdAt)}</small></div>
      <button class="btn" data-done="${q.id}">${icon('check', 18)} Done</button></div>`).join('') || '<div class="empty">No calls. When a guest taps "Call waiter" or "Ask for bill", it shows here with a sound.</div>'}`;
    c.querySelectorAll('[data-done]').forEach(b => b.onclick = async () => {
      b.disabled = true;
      try { await api('/api/admin/requests/' + b.dataset.done, { method: 'PATCH' }); S.requests = S.requests.filter(q => q.id !== b.dataset.done); render(); }
      catch (e) { b.disabled = false; toast(esc(e.message), 'error'); }
    });
  }

  function openTable(t) {
    const x = tableState(t);
    const o = sheet(`<div class="sheet-head"><h3>${esc(t.name)} <small class="muted">· ${x.state[1]}</small></h3><button class="icon-btn" data-close>${icon('x', 20)}</button></div>
      <div class="sheet-body">
        ${x.calls.map(q => `<div class="w-callrow small"><span class="w-ci">${icon(REQ[q.type] ? REQ[q.type][0] : 'hand', 20)}</span><div><b>${esc(reqText(q))}</b><small>${ago(q.createdAt)}</small></div><button class="btn" data-done="${q.id}">Done</button></div>`).join('')}
        ${x.os.length ? x.os.map(orderCard).join('') + `<div class="w-tot"><span>Table total so far</span><b>${cur(x.total)}</b></div>` : '<div class="empty">No orders at this table yet.</div>'}
      </div>
      <div class="sheet-foot"><button class="btn btn-primary btn-lg btn-block" id="take">${icon('plus', 20)} Take order for ${esc(t.name)}</button></div>`, 'w-ov');
    o.dataset.t = t.id;
    bindOrderBtns(o);
    o.querySelectorAll('[data-done]').forEach(b => b.onclick = async () => { b.disabled = true; try { await api('/api/admin/requests/' + b.dataset.done, { method: 'PATCH' }); S.requests = S.requests.filter(q => q.id !== b.dataset.done); o.remove(); render(); openTable(t); } catch (e) { b.disabled = false; toast(esc(e.message), 'error'); } });
    o.querySelector('#take').onclick = () => { o.remove(); takeOrder(t); };
  }

  // ---- take an order ----
  function takeOrder(t) {
    const menu = S.menu || { categories: [], items: [] };
    const cats = [...menu.categories].sort((a, b) => a.sort - b.sort).filter(cg => menu.items.some(i => i.categoryId === cg.id));
    const qty = {}; let q = '', cat = 'all', note = '';
    const o = sheet(`<div class="sheet-head"><h3>${t ? esc(t.name) : 'Takeaway / counter'}</h3><button class="icon-btn" data-close>${icon('x', 20)}</button></div>
      <div class="w-pick-top"><label class="w-search">${icon('search', 18)}<input id="q" placeholder="Search dishes" autocomplete="off"></label>
        <div class="w-cats" id="cats"><button data-c="all" class="on">All</button>${cats.map(cg => `<button data-c="${cg.id}">${esc(cg.name)}</button>`).join('')}</div></div>
      <div class="sheet-body" id="list"></div>
      <div class="sheet-foot w-send"><textarea class="input" id="note" rows="1" placeholder="Note for the kitchen (less spicy, no onion…)"></textarea><button class="btn btn-primary btn-lg btn-block" id="send" disabled>Add dishes</button></div>`, 'w-ov w-full');
    const list = o.querySelector('#list'), send = o.querySelector('#send');
    const items = () => menu.items.filter(i => !i.hidden && (cat === 'all' || i.categoryId === cat) && (!q || i.name.toLowerCase().includes(q))).sort((a, b) => (cats.findIndex(c => c.id === a.categoryId) - cats.findIndex(c => c.id === b.categoryId)) || a.sort - b.sort);
    const total = () => Object.entries(qty).reduce((s, [id, n]) => s + n * (menu.items.find(i => i.id === id) || { price: 0 }).price, 0);
    const count = () => Object.values(qty).reduce((a, b) => a + b, 0);
    const foot = () => { const n = count(); send.disabled = !n; send.innerHTML = n ? `${icon('chef', 20)} Send ${n} item${n > 1 ? 's' : ''} to kitchen · ${cur(total())}` : 'Add dishes'; };
    const row = i => `<div class="w-dish ${i.available === false ? 'off' : ''}" data-i="${i.id}"><span class="d d-${esc(i.diet || 'veg')}"></span><div class="w-dn"><b>${esc(i.name)}</b><small>${i.available === false ? 'Sold out' : cur(i.price)}</small></div>
      ${i.available === false ? '' : qty[i.id] ? `<div class="w-qty"><button data-m="${i.id}" aria-label="Less">${icon('minus', 18)}</button><b>${qty[i.id]}</b><button data-p="${i.id}" aria-label="More">${icon('plus', 18)}</button></div>` : `<button class="btn w-add" data-p="${i.id}">${icon('plus', 16)} Add</button>`}</div>`;
    const draw = () => {
      const its = items();
      list.innerHTML = its.map(row).join('') || '<div class="empty">No dish matches.</div>';
      foot();
    };
    list.addEventListener('click', e => {
      const p = e.target.closest('[data-p]'), m = e.target.closest('[data-m]');
      const id = p ? p.dataset.p : m ? m.dataset.m : null; if (!id) return;
      qty[id] = Math.max(0, (qty[id] || 0) + (p ? 1 : -1)); if (!qty[id]) delete qty[id];
      const el = list.querySelector(`[data-i="${id}"]`); if (el) el.outerHTML = row(menu.items.find(i => i.id === id)); foot();
    });
    o.querySelector('#q').oninput = e => { q = e.target.value.trim().toLowerCase(); draw(); };
    o.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { cat = b.dataset.c; o.querySelectorAll('[data-c]').forEach(x => x.classList.toggle('on', x === b)); draw(); list.scrollTop = 0; });
    o.querySelector('#note').oninput = e => { note = e.target.value; };
    send.onclick = async () => {
      const body = { tableId: t ? t.id : null, label: t ? '' : 'Takeaway', tableName: t ? t.name : 'Takeaway', items: Object.entries(qty).map(([id, n]) => ({ id, qty: n })), note, status: 'preparing', clientId: 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8) };
      send.disabled = true; send.textContent = 'Sending…';
      try { const r = await api('/api/admin/orders', { method: 'POST', body }); upsert(r); o.remove(); toast(`${icon('check', 18)} Order #${r.number} sent to the kitchen`, 'ok'); render(); }
      catch (e) {
        if (e.network) { const l = load(OUT(), []); l.push(body); store(OUT(), l); o.remove(); S.online = false; toast(`${icon('clock', 18)} No internet. Order saved on this phone and will send by itself.`); render(); }
        else { send.disabled = false; foot(); toast(esc(e.message), 'error'); }
      }
    };
    draw();
    setTimeout(() => { if (matchMedia('(min-width: 720px)').matches) o.querySelector('#q').focus(); }, 50);
  }

  boot();
})();
