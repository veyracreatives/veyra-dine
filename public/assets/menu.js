// Customer menu: scan QR -> browse -> add to order -> place -> live status.
(function () {
  const slug = location.pathname.split('/')[2];
  const params = new URLSearchParams(location.search);
  const tableToken = params.get('t') || '';
  const app = document.getElementById('app');
  const ORDERS_KEY = `vd_orders_${slug}_${tableToken}`;

  let D = null;                 // menu data
  let vegOnly = false, query = '';
  let orderStream = null;
  // Table Together: everyone at this table shares one order. Each phone has its own guest id.
  const GID = load('vd_gid', null) || (() => { const g = 'g' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36).slice(-4); store('vd_gid', g); return g; })();
  let T = { lines: [], people: [] }; // shared table order
  let B = null;                      // table bill
  let coupon = load('vd_coupon_' + slug, null); // { code, discount, label }
  let tableStream = null, onTable = null;
  const myName = () => localStorage.getItem('vd_name') || '';
  let G = null; // logged-in guest account
  const needLogin = () => D.restaurant.guestLogin && !G;
  const cart = new Proxy({}, { get: (_, id) => { const l = T.lines.find(x => x.gid === GID && x.itemId === id); return l ? l.qty : 0; } });

  function load(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch { return d; } }
  function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  const cur = v => fmtMoney(v, D.restaurant.currency);
  const item = id => D.items.find(i => i.id === id);
  const canOrder = () => D.table && D.restaurant.acceptingOrders;

  function toast(msg, type = '') {
    const el = document.createElement('div'); el.className = 'toast ' + type; el.innerHTML = msg;
    document.getElementById('toasts').appendChild(el); setTimeout(() => el.remove(), 3200);
  }
  async function api(path, opts = {}) {
    const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts, body: opts.body ? JSON.stringify(opts.body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
    return data;
  }

  // ---------- cart ----------
  function cartLines() { return T.lines.map(l => ({ ...l, it: item(l.itemId) })).filter(l => l.it && l.qty > 0); }
  function cartCount() { return cartLines().reduce((s, l) => s + l.qty, 0); }
  function cartTotal() { return cartLines().reduce((s, l) => s + l.qty * l.it.price, 0); }
  function refreshCart() {
    document.querySelectorAll('[data-ctl]').forEach(el => { const it = item(el.dataset.ctl); if (it) el.innerHTML = control(it); });
    renderCartBar(); if (onTable) onTable();
  }
  let pending = 0;
  async function setQty(id, qty) {
    qty = Math.max(0, Math.min(50, qty));
    const mine = T.lines.find(l => l.gid === GID && l.itemId === id);
    if (mine) mine.qty = qty; else if (qty) T.lines.push({ gid: GID, name: myName() || 'You', itemId: id, qty });
    T.lines = T.lines.filter(l => l.qty > 0);
    refreshCart(); pending++;
    try { const t = await api(`/api/menu/${slug}/table/cart`, { method: 'POST', body: { t: tableToken, gid: GID, name: myName(), itemId: id, qty } }); if (--pending === 0) { T = t; refreshCart(); } }
    catch (err) { pending--; toast(esc(err.message), 'error'); loadTable(); }
  }
  async function loadTable() { try { const x = await api(`/api/menu/${slug}/table?t=${encodeURIComponent(tableToken)}`); T = x.cart; B = x.bill; refreshCart(); } catch {} }
  function connectTable() {
    if (!D.table) return;
    loadTable();
    if (!('EventSource' in window)) { setInterval(loadTable, 5000); return; }
    tableStream = new EventSource(`/api/menu/${slug}/table/stream?t=${encodeURIComponent(tableToken)}`);
    tableStream.addEventListener('cart', e => { if (!pending) { T = JSON.parse(e.data); refreshCart(); } });
    tableStream.addEventListener('bill', e => { B = JSON.parse(e.data); if (location.hash === '#bill') renderBill(); });
    tableStream.addEventListener('placed', e => {
      const o = JSON.parse(e.data); rememberOrder(o);
      if (o.gid !== GID) { document.querySelectorAll('.overlay').forEach(x => x.close ? x.close() : x.remove()); toast(`${icon('check', 18)} ${esc(o.by)} sent the table's order to the kitchen`, 'ok'); location.hash = 'order=' + o.id; }
    });
    tableStream.addEventListener('settled', () => { justSettled = true; if (location.hash === '#bill') renderBill(); toast(`${icon('check', 18)} Bill settled. Thank you for dining with us!`, 'ok'); });
  }
  function rememberOrder(o) {
    const mine = load(ORDERS_KEY, []).filter(x => x.id !== o.id && Date.now() - Date.parse(x.createdAt) < 12 * 3600e3);
    mine.unshift({ id: o.id, createdAt: o.createdAt }); store(ORDERS_KEY, mine.slice(0, 10));
  }
  const people = () => T.people.length;
  function control(it) {
    if (!it.available) return '<span class="sold">Sold out</span>';
    if (!canOrder()) return '';
    const q = cart[it.id] || 0;
    if (!q) return `<button class="add" data-add="${it.id}" aria-label="Add ${esc(it.name)}">ADD ${icon('plus', 16)}</button>`;
    return `<div class="stepper"><button data-dec="${it.id}" aria-label="Remove one">${icon('minus', 18)}</button><span>${q}</span><button data-inc="${it.id}" aria-label="Add one">${icon('plus', 18)}</button></div>`;
  }
  function renderCartBar() {
    let bar = document.getElementById('cartbar');
    const n = cartCount();
    if (!n || !canOrder() || location.hash.startsWith('#order=')) { if (bar) bar.remove(); return; }
    if (!bar) { bar = document.createElement('button'); bar.id = 'cartbar'; bar.className = 'cartbar'; bar.onclick = openCart; document.body.appendChild(bar); }
    const ppl = people();
    bar.innerHTML = `<span><b>${n} item${n > 1 ? 's' : ''} · ${cur(cartTotal())}</b><small>${esc(D.table.name)}${ppl > 1 ? ` · ${ppl} people adding` : ''}</small></span><span class="go">View order ${icon('right', 18)}</span>`;
  }

  // ---------- menu page ----------
  function renderMenu() {
    const r = D.restaurant;
    if (document.title === 'Menu') document.title = `${r.name} · Menu`;
    const socials = SOCIALS.filter(([k]) => r.socials[k]).map(([k, label, ic]) => `<a class="social" href="${esc(r.socials[k])}" target="_blank" rel="noopener" aria-label="${label}" title="${label}">${icon(ic, 19)}</a>`).join('');
    const mine = load(ORDERS_KEY, []);
    app.innerHTML = `
      <header class="hero">
        <div class="cover ${r.cover ? 'has-img' : ''}" style="${r.cover ? `background-image:url('${esc(r.cover)}')` : ''}"></div>
        <div class="top-actions">
          ${mine.length ? `<a class="pill-btn" href="#order=${mine[0].id}">${icon('receipt', 16)} My orders</a>` : '<span></span>'}
          ${D.table ? `<span class="ta-right">${B && B.lines.length ? `<a class="pill-btn" href="#bill">${icon('receipt', 16)} Bill</a>` : ''}<button class="pill-btn" id="helpBtn">${icon('hand', 16)} Call waiter</button></span>` : ''}
        </div>
        <div class="identity">
          <div class="logo">${r.logo ? `<img src="${esc(r.logo)}" alt="${esc(r.name)} logo">` : esc(r.name.slice(0, 1))}</div>
          <div class="name-row"><h1>${esc(r.name)}</h1>${r.tagline ? `<p class="tagline">${esc(r.tagline)}</p>` : ''}</div>
          ${D.table ? `<div class="table-chip">${icon('utensils', 18)} You're ordering for ${esc(D.table.name)}</div>` : ''}
          ${socials ? `<div class="socials">${socials}</div>` : ''}
        </div>
      </header>
      ${!D.table ? `<div class="notice">${icon('qr', 18)}<span>You're viewing the menu. To order, scan the QR code on your table.</span></div>` : ''}
      ${D.table && !r.acceptingOrders ? `<div class="notice">${icon('clock', 18)}<span>We're not taking orders on the app right now. Please ask our staff.</span></div>` : ''}
      ${D.table && r.acceptingOrders ? `<div class="together">${icon('utensils', 18)}<span><b>Ordering with friends?</b> Everyone at ${esc(D.table.name)} can scan the QR and add to this same order from their own phone.</span></div>` : ''}
      ${D.offers && D.offers.length ? `<div class="offers">${D.offers.map(o => `<button class="offer" data-offer="${esc(o.code)}"><span class="tag">${icon('star', 15)}</span><span><b>${esc(o.label)}</b><small>Use code <code>${esc(o.code)}</code>${o.note ? ' · ' + esc(o.note) : ''}</small></span></button>`).join('')}</div>` : ''}
      <div class="tools">
        <label class="search">${icon('search', 18)}<input id="q" type="search" placeholder="Search dishes" value="${esc(query)}" autocomplete="off"></label>
        <button class="veg-toggle ${vegOnly ? 'on' : ''}" id="veg">${dietMark('veg')} Veg only</button>
      </div>
      <nav class="cats" id="cats"></nav>
      <main id="sections"></main>
      <footer class="footer">
        <h3>${esc(r.name)}</h3>
        ${r.address ? `<p>${icon('pin', 14)} ${esc(r.address)}</p>` : ''}
        ${r.phone ? `<p><a href="tel:${esc(r.phone.replace(/\s/g, ''))}">${esc(r.phone)}</a></p>` : ''}
        ${r.footerNote ? `<p class="muted">${esc(r.footerNote)}</p>` : ''}
        <div class="follow">
          ${r.socials.instagram ? `<a class="ig" href="${esc(r.socials.instagram)}" target="_blank" rel="noopener">${icon('instagram', 20)} Follow us on Instagram</a>` : ''}
          ${r.socials.google ? `<a href="${esc(r.socials.google)}" target="_blank" rel="noopener">${icon('star', 20)} Rate us on Google</a>` : ''}
        </div>
        ${r.poweredBy ? '<div class="powered">Powered by Veyra Dine In</div>' : ''}
      </footer>`;
    renderSections();
    document.getElementById('q').oninput = e => { query = e.target.value; renderSections(); };
    document.getElementById('veg').onclick = e => { vegOnly = !vegOnly; e.currentTarget.classList.toggle('on', vegOnly); renderSections(); };
    const hb = document.getElementById('helpBtn'); if (hb) hb.onclick = openHelp;
    renderCartBar();
  }

  function renderSections() {
    const q = query.trim().toLowerCase();
    const list = D.items.filter(i => (!vegOnly || i.diet === 'veg') && (!q || (i.name + ' ' + i.description).toLowerCase().includes(q)));
    const cats = D.categories.filter(c => list.some(i => i.categoryId === c.id));
    document.getElementById('cats').innerHTML = cats.map((c, i) => `<button class="cat ${i === 0 ? 'on' : ''}" data-cat="${c.id}">${esc(c.name)}</button>`).join('');
    document.getElementById('sections').innerHTML = cats.length ? cats.map(c => {
      const dishes = list.filter(i => i.categoryId === c.id);
      return `<section class="section" id="c-${c.id}"><h2>${esc(c.name)} <span class="count">(${dishes.length})</span></h2>${dishes.map(dish).join('')}</section>`;
    }).join('') : `<div class="empty">${icon('search', 40)}<div>No dishes match “${esc(query)}”.</div></div>`;
    spy();
  }
  function dish(it) {
    return `<article class="dish ${it.available ? '' : 'unavailable'}">
      <div class="dish-info" data-open="${it.id}">
        <div class="dish-tags">${dietMark(it.diet)}${it.bestseller ? '<span class="badge badge-amber">★ Bestseller</span>' : ''}${it.spicy ? `<span class="spicy" title="Spicy">${icon('flame', 16)}</span>` : ''}</div>
        <h3>${esc(it.name)}</h3>
        <div class="price">${cur(it.price)}${D.prep && D.prep[it.id] ? `<span class="prep">${icon('clock', 13)} ${D.prep[it.id]} min</span>` : ''}</div>
        ${it.description ? `<p class="desc">${esc(it.description)}</p>` : ''}
      </div>
      <div class="dish-side ${it.photo ? '' : 'no-photo'}">
        ${it.photo ? `<img class="dish-photo" src="${esc(it.photo)}" alt="${esc(it.name)}" loading="lazy" data-open="${it.id}">` : ''}
        <div class="add-wrap" data-ctl="${it.id}">${control(it)}</div>
      </div>
    </article>`;
  }

  // category tabs follow the scroll
  let spyObs = null;
  function spy() {
    if (spyObs) spyObs.disconnect();
    const tabs = document.getElementById('cats');
    spyObs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const id = e.target.id.slice(2);
        tabs.querySelectorAll('.cat').forEach(b => b.classList.toggle('on', b.dataset.cat === id));
        const on = tabs.querySelector('.cat.on'); if (on) tabs.scrollTo({ left: on.offsetLeft - 18, behavior: 'smooth' });
      });
    }, { rootMargin: '-70px 0px -70% 0px' });
    document.querySelectorAll('.section').forEach(s => spyObs.observe(s));
  }

  // ---------- sheets ----------
  function sheet(html, cls = '') {
    const o = document.createElement('div'); o.className = 'overlay center';
    o.innerHTML = `<div class="sheet ${cls}" role="dialog" aria-modal="true">${html}</div>`;
    o.addEventListener('click', e => { if (e.target === o || e.target.closest('[data-close]')) close(); });
    document.body.appendChild(o); document.body.style.overflow = 'hidden';
    function close() { o.remove(); if (!document.querySelector('.overlay')) document.body.style.overflow = ''; }
    o.close = close; return o;
  }

  function openItem(id) {
    const it = item(id); if (!it) return;
    let qty = Math.max(1, cart[id] || 1);
    const o = sheet(`
      <div style="position:relative">
        <button class="close-float" data-close aria-label="Close">${icon('x', 20)}</button>
        ${it.photo ? `<img class="detail-photo" src="${esc(it.photo)}" alt="${esc(it.name)}">` : ''}
      </div>
      <div class="sheet-body" style="${it.photo ? '' : 'padding-top:60px'}">
        <div class="dish-tags">${dietMark(it.diet)}${it.bestseller ? '<span class="badge badge-amber">★ Bestseller</span>' : ''}${it.spicy ? `<span class="badge badge-red">${icon('flame', 13)} Spicy</span>` : ''}</div>
        <h2>${esc(it.name)}</h2>
        <div class="price" style="font-size:18px">${cur(it.price)}</div>
        ${it.description ? `<p class="muted" style="margin:10px 0 0">${esc(it.description)}</p>` : ''}
      </div>
      ${it.available && canOrder() ? `<div class="sheet-foot" style="display:flex;gap:12px;align-items:center">
        <div class="qty-big"><button data-q="-1" aria-label="Less">${icon('minus', 20)}</button><span id="dq">${qty}</span><button data-q="1" aria-label="More">${icon('plus', 20)}</button></div>
        <button class="btn btn-primary btn-lg" style="flex:1" id="dadd">Add · ${cur(it.price * qty)}</button>
      </div>` : `<div class="sheet-foot"><div class="${it.available ? 'muted' : 'sold'}" style="justify-content:center;width:100%">${it.available ? 'Scan the QR on your table to order' : 'Sold out for now'}</div></div>`}`, 'detail');
    o.querySelectorAll('[data-q]').forEach(b => b.onclick = () => {
      qty = Math.max(1, Math.min(50, qty + Number(b.dataset.q)));
      o.querySelector('#dq').textContent = qty; o.querySelector('#dadd').textContent = `Add · ${cur(it.price * qty)}`;
    });
    const add = o.querySelector('#dadd'); if (add) add.onclick = () => { setQty(id, qty); o.close(); toast(`${icon('check', 18)} Added ${esc(it.name)}`, 'ok'); };
  }

  // ---------- coupons ----------
  async function checkCoupon(code, quiet) {
    try { coupon = await api(`/api/menu/${slug}/coupon`, { method: 'POST', body: { code, subtotal: cartTotal() } }); store('vd_coupon_' + slug, coupon); if (!quiet) toast(`${icon('check', 18)} ${esc(coupon.code)} applied. You save ${cur(coupon.discount)}`, 'ok'); return true; }
    catch (err) { if (!quiet || coupon) toast(esc(err.message), 'error'); coupon = null; store('vd_coupon_' + slug, null); return false; }
  }

  // ---------- guest log in (before ordering) ----------
  async function adoptGuestName() {
    if (!G) return; localStorage.setItem('vd_name', G.name);
    if (D.table) try { T = await api(`/api/menu/${slug}/table/name`, { method: 'POST', body: { t: tableToken, gid: GID, name: G.name } }); refreshCart(); } catch {}
  }
  function guestLogin() {
    return new Promise(resolve => {
      let mode = 'login';
      const o = sheet(`<div class="sheet-head"><h2 id="gt"></h2><button class="icon-btn" data-close aria-label="Close">${icon('x', 20)}</button></div>
        <form class="sheet-body glogin" id="gf" novalidate>
          <p class="muted" id="gs"></p>
          <div class="seg-tabs"><button type="button" data-gm="login">Log in</button><button type="button" data-gm="signup">Create account</button></div>
          <label class="field" id="gnf"><span>Your name</span><input class="input" name="name" maxlength="40" autocomplete="name" placeholder="E.g. Asha"></label>
          <label class="field"><span>Mobile number or email</span><input class="input" name="login" autocomplete="username" inputmode="email" placeholder="98xxxxxxxx or you@gmail.com"></label>
          <label class="field"><span>Password</span><input class="input" type="password" name="password" autocomplete="current-password" placeholder="At least 4 characters"></label>
          <div class="gerr" id="ge" role="alert"></div>
          <button class="btn btn-primary btn-lg btn-block" id="gb"></button>
          <small class="muted gfoot">We use this only for your orders at ${esc(D.restaurant.name)}. Forgot your password? Ask the staff to reset it.</small>
        </form>`);
      const f = o.querySelector('#gf');
      const set = m => {
        mode = m;
        o.querySelectorAll('[data-gm]').forEach(b => b.classList.toggle('on', b.dataset.gm === m));
        o.querySelector('#gt').textContent = m === 'login' ? 'Log in to order' : 'Create your account';
        o.querySelector('#gs').textContent = m === 'login' ? 'Welcome back. Log in once and your order goes straight to the kitchen.' : 'Takes 10 seconds. Next time you only need your number and password.';
        o.querySelector('#gnf').hidden = m === 'login';
        f.password.autocomplete = m === 'login' ? 'current-password' : 'new-password';
        o.querySelector('#gb').textContent = m === 'login' ? 'Log in and continue' : 'Create account and continue';
        o.querySelector('#ge').textContent = '';
      };
      o.querySelectorAll('[data-gm]').forEach(b => b.onclick = () => set(b.dataset.gm));
      set(localStorage.getItem('vd_had_acct') ? 'login' : 'signup');
      const closeIt = o.close; let done = false;
      o.close = () => { closeIt(); if (!done) resolve(false); };
      f.onsubmit = async e => {
        e.preventDefault(); const btn = o.querySelector('#gb'); btn.disabled = true;
        try {
          const r = await api(`/api/menu/${slug}/guest/${mode}`, { method: 'POST', body: { name: f.name.value.trim() || myName(), login: f.login.value, password: f.password.value } });
          G = r.guest; localStorage.setItem('vd_had_acct', '1'); await adoptGuestName();
          toast(`${icon('check', 18)} Hi ${esc(G.name)}!`, 'ok'); done = true; closeIt(); resolve(true);
        } catch (err) { o.querySelector('#ge').textContent = err.message; btn.disabled = false; if (/already have an account/i.test(err.message)) set('login'); }
      };
      setTimeout(() => (mode === 'login' ? f.login : f.name).focus(), 50);
    });
  }

  // ---------- the table's shared order ----------
  function openCart() {
    const o = sheet(`<div class="sheet-head"><h2>${esc(D.table.name)}'s order</h2><button class="icon-btn" data-close aria-label="Close">${icon('x', 20)}</button></div>
      <div class="sheet-body">
        <div class="cart-table">${icon('utensils', 18)}<span>Everyone at ${esc(D.table.name)} adds to this order from their own phone.</span></div>
        <div id="acct"></div>
        <label class="field me-name" ${D.restaurant.guestLogin ? 'hidden' : ''}><span>Your name, so friends see what you added</span><input class="input" id="cname" maxlength="40" placeholder="E.g. Asha" value="${esc(myName())}"></label>
        <div id="lines"></div>
        <div class="coupon-box" id="cbox"></div>
        <div class="form-grid">
          <label class="field"><span>Cooking instructions (optional)</span><textarea class="textarea" id="note" maxlength="300" placeholder="E.g. less spicy, no onion, Jain">${esc(sessionStorage.getItem('vd_note') || '')}</textarea></label>
        </div>
        <div class="bill" id="bill"></div>
      </div>
      <div class="sheet-foot"><button class="btn btn-primary btn-lg btn-block" id="place"></button><small class="foot-hint" id="fh"></small></div>`);
    let lastSub = null;
    const draw = () => {
      const lines = cartLines();
      if (!lines.length) { o.close(); return; }
      const groups = []; for (const l of lines) { let g = groups.find(x => x.gid === l.gid); if (!g) groups.push(g = { gid: l.gid, name: l.name, lines: [] }); g.lines.push(l); }
      groups.sort((a, b) => (b.gid === GID) - (a.gid === GID));
      o.querySelector('#lines').innerHTML = groups.map(g => `<div class="who"><span class="av">${esc((g.gid === GID ? (myName() || 'You') : g.name).slice(0, 1).toUpperCase())}</span>${g.gid === GID ? `You${myName() ? ` (${esc(myName())})` : ''}` : esc(g.name)}<span class="muted">${cur(g.lines.reduce((s, l) => s + l.qty * l.it.price, 0))}</span></div>` +
        g.lines.map(({ it, qty, gid }) => `<div class="line">${dietMark(it.diet)}<div class="line-info"><b>${esc(it.name)}</b><small>${cur(it.price)} each</small></div>
          ${gid === GID ? `<div class="stepper"><button data-dec="${it.id}" aria-label="Remove one">${icon('minus', 16)}</button><span>${qty}</span><button data-inc="${it.id}" aria-label="Add one">${icon('plus', 16)}</button></div>` : `<span class="qty-ro">${qty}×</span>`}
          <div class="line-total">${cur(it.price * qty)}</div></div>`).join('')).join('') +
        `<button class="btn btn-ghost btn-sm" data-close style="margin-top:10px;color:var(--brand)">${icon('plus', 16)} Add more dishes</button>`;
      const sub = cartTotal();
      if (coupon && sub !== lastSub && lastSub !== null) checkCoupon(coupon.code, true).then(draw);
      lastSub = sub;
      const off = coupon ? coupon.discount : 0, pay = Math.max(0, sub - off);
      o.querySelector('#cbox').innerHTML = coupon
        ? `<div class="coupon-on">${icon('check', 18)}<span><b>${esc(coupon.code)} applied</b><small>${esc(coupon.label)}</small></span><button class="btn btn-ghost btn-sm" id="crm">Remove</button></div>`
        : `<div class="coupon-in"><input class="input" id="ccode" placeholder="Have a coupon code?" autocapitalize="characters" maxlength="20"><button class="btn" id="capply">Apply</button></div>
           ${D.offers && D.offers.length ? `<div class="coupon-list">${D.offers.map(x => `<button class="chip-offer" data-code="${esc(x.code)}"><code>${esc(x.code)}</code> ${esc(x.label)}</button>`).join('')}</div>` : ''}`;
      o.querySelector('#bill').innerHTML = `<div><span>Item total</span><span>${cur(sub)}</span></div>${off ? `<div class="save"><span>Coupon ${esc(coupon.code)}</span><span>−${cur(off)}</span></div>` : ''}<div class="grand"><span>To pay</span><span>${cur(pay)}</span></div>`;
      o.querySelector('#place').innerHTML = needLogin() ? `${icon('user', 18)} Log in to send order · ${cur(pay)}` : `Send ${groups.length > 1 ? "the table's" : ''} order to kitchen · ${cur(pay)}`;
      o.querySelector('#acct').innerHTML = !D.restaurant.guestLogin ? '' : G
        ? `<div class="acct-on"><span class="av">${esc(G.name.slice(0, 1).toUpperCase())}</span><span>Ordering as <b>${esc(G.name)}</b><small>${esc(G.phone || G.email)}</small></span><button class="btn btn-ghost btn-sm" id="glo">Not you?</button></div>`
        : `<div class="acct-off">${icon('user', 18)}<span>Log in with your mobile number or email to place the order.</span></div>`;
      const glo = o.querySelector('#glo'); if (glo) glo.onclick = async () => { await api(`/api/menu/${slug}/guest/logout`, { method: 'POST' }).catch(() => {}); G = null; draw(); };
      o.querySelector('#fh').textContent = groups.length > 1 ? `Sends everyone's dishes together (${groups.length} people).` : 'Friends can still add from their phones before you send.';
      const crm = o.querySelector('#crm'); if (crm) crm.onclick = () => { coupon = null; store('vd_coupon_' + slug, null); draw(); };
      const ca = o.querySelector('#capply'); if (ca) ca.onclick = async () => { const v = o.querySelector('#ccode').value.trim(); if (v && await checkCoupon(v)) draw(); };
      o.querySelectorAll('[data-code]').forEach(b => b.onclick = async () => { if (await checkCoupon(b.dataset.code)) draw(); });
    };
    onTable = draw;
    const closeSheet = o.close; o.close = () => { onTable = null; closeSheet(); };
    o.addEventListener('click', e => { if (e.target === o || e.target.closest('[data-close]')) onTable = null; });
    o.querySelector('#lines').addEventListener('click', e => {
      const b = e.target.closest('[data-inc],[data-dec]'); if (!b) return;
      const id = b.dataset.inc || b.dataset.dec; setQty(id, cart[id] + (b.dataset.inc ? 1 : -1));
    });
    o.querySelector('#note').oninput = e => sessionStorage.setItem('vd_note', e.target.value);
    o.querySelector('#cname').onchange = async e => {
      const name = e.target.value.trim(); localStorage.setItem('vd_name', name); draw();
      if (name) try { T = await api(`/api/menu/${slug}/table/name`, { method: 'POST', body: { t: tableToken, gid: GID, name } }); refreshCart(); } catch {}
    };
    draw();
    o.querySelector('#place').onclick = async e => {
      const btn = e.currentTarget;
      if (needLogin()) { if (!(await guestLogin())) return; o.querySelector('#cname').value = myName(); draw(); }
      btn.disabled = true; btn.textContent = 'Sending to kitchen…';
      const name = o.querySelector('#cname').value.trim(); localStorage.setItem('vd_name', name);
      try {
        const order = await api(`/api/menu/${slug}/orders`, { method: 'POST', body: { table: tableToken, shared: true, gid: GID, name, note: o.querySelector('#note').value, coupon: coupon ? coupon.code : '' } });
        T = { lines: [], people: [] }; sessionStorage.removeItem('vd_note'); coupon = null; store('vd_coupon_' + slug, null);
        rememberOrder(order); o.close(); location.hash = 'order=' + order.id;
      } catch (err) { toast(esc(err.message), 'error'); btn.disabled = false; if (/log in/i.test(err.message)) G = null; if (/coupon/i.test(err.message)) { coupon = null; store('vd_coupon_' + slug, null); } draw(); }
    };
  }

  // ---------- split the bill ----------
  let splitMode = 'person', splitN = 0, payFor = null;
  function upiHref(amount, who) {
    const u = D.restaurant.upi; if (!u) return '';
    return 'upi://pay?' + new URLSearchParams({ pa: u.id, pn: u.name, am: Number(amount).toFixed(2), cu: 'INR', tn: `${D.table.name} ${who || ''}`.trim().slice(0, 50) }).toString();
  }
  function renderBill() {
    if (location.hash !== '#bill') return;
    window.removeEventListener('scroll', noop);
    if (!B) { app.innerHTML = '<div class="loading"><div class="spinner"></div></div>'; return; }
    const r = D.restaurant, isPhone = /Android|iPhone|iPad/i.test(navigator.userAgent);
    const paidBy = gid => B.paid.filter(p => p.gid === gid).reduce((s, p) => s + p.amount, 0);
    const paidTotal = B.paid.reduce((s, p) => s + p.amount, 0);
    const left = Math.max(0, Math.round(B.total - paidTotal));
    if (!splitN) splitN = Math.max(2, B.people.length);
    const equal = Math.ceil(B.total / splitN);
    const me = B.people.find(p => p.gid === GID);
    if (!payFor) payFor = me ? me.gid : null;
    const target = splitMode === 'equal' ? { gid: GID, name: myName() || 'Me', amount: equal } : (B.people.find(p => p.gid === payFor) || null);
    const due = target ? Math.max(0, target.amount - (splitMode === 'equal' ? paidBy(GID) : paidBy(target.gid))) : 0;
    app.innerHTML = `<div class="status-page bill-page">
      <button class="btn btn-ghost btn-sm" id="back">${icon('left', 18)} Back to menu</button>
      <h1 class="bill-h">Split the bill</h1>
      <p class="muted" style="margin:2px 0 16px">${esc(D.table.name)} · ${B.orders.length} order${B.orders.length === 1 ? '' : 's'}</p>
      ${!B.lines.length ? `<div class="empty">${icon('receipt', 40)}<div>${justSettled ? 'All paid. Thank you for dining with us!' : 'No orders on this table yet.'}</div></div>` : `
      <div class="bill-total"><div><small>Table total</small><b>${cur(B.total)}</b>${B.discount ? `<span class="save-chip">You saved ${cur(B.discount)}${B.coupons.length ? ' with ' + B.coupons.map(esc).join(', ') : ''}</span>` : ''}</div>
        <div><small>Still to pay</small><b class="${left ? '' : 'ok'}">${left ? cur(left) : 'All paid'}</b></div></div>
      <div class="seg2"><button class="${splitMode === 'person' ? 'on' : ''}" data-mode="person">By what each person ate</button><button class="${splitMode === 'equal' ? 'on' : ''}" data-mode="equal">Split equally</button></div>
      ${splitMode === 'person' ? `
        <p class="muted small">Tap a dish everyone shared to split it equally between all.</p>
        ${B.people.map(p => { const pd = paidBy(p.gid); return `<div class="person ${p.gid === payFor ? 'sel' : ''}" data-pay="${p.gid}">
          <div class="p-head"><span class="av">${esc(p.name.slice(0, 1).toUpperCase())}</span><b>${p.gid === GID ? 'You' : esc(p.name)}</b>${pd >= p.amount ? `<span class="badge badge-green">${icon('check', 13)} Paid</span>` : pd ? `<span class="badge badge-amber">Paid ${cur(pd)}</span>` : ''}<span class="amt">${cur(p.amount)}</span></div>
          ${p.gid === payFor ? '' : `<div class="pick-hint">Tap here to pay ${p.gid === GID ? 'your' : 'this'} share</div>`}
          <div class="p-lines">${B.lines.filter(l => !l.shared && l.gid === p.gid).map(l => `<button class="pl" data-share="${l.key}">${l.qty}× ${esc(l.name)}<span>${cur(Math.round(l.amount))}</span></button>`).join('')}
          ${p.sharedPart ? `<div class="pl muted">Share of dishes for the table<span>${cur(Math.round(p.sharedPart))}</span></div>` : ''}</div></div>`; }).join('')}
        ${B.lines.some(l => l.shared) ? `<div class="person shared-box"><div class="p-head"><span class="av">${icon('utensils', 14)}</span><b>Shared by the table</b></div><div class="p-lines">${B.lines.filter(l => l.shared).map(l => `<button class="pl on" data-unshare="${l.key}">${l.qty}× ${esc(l.name)}<span>${cur(Math.round(l.amount))}</span></button>`).join('')}</div></div>` : ''}
      ` : `
        <div class="eq"><span>Split between</span><div class="qty-big"><button data-n="-1" aria-label="Fewer">${icon('minus', 20)}</button><span>${splitN}</span><button data-n="1" aria-label="More">${icon('plus', 20)}</button></div><span>people</span></div>
        <div class="eq-each">${cur(equal)} <small>each</small></div>`}
      <div class="paybox">
        ${target ? `<div class="pb-head"><small>${splitMode === 'equal' ? 'Your share' : target.gid === GID ? 'Your share' : 'Paying for ' + esc(target.name)}</small><b>${due ? cur(due) : 'Paid'}</b></div>` : `<div class="pb-head"><small>Tap a person above to pay their share</small></div>`}
        ${target && due ? (r.upi ? `
          ${isPhone ? '' : `<img class="upi-qr" alt="UPI QR code" src="/api/menu/${slug}/table/upi-qr?t=${encodeURIComponent(tableToken)}&am=${due}&n=${encodeURIComponent(target.name)}">`}
          <a class="btn btn-primary btn-lg btn-block" href="${esc(upiHref(due, target.name))}">${icon('phone', 20)} Pay ${cur(due)} with UPI</a>
          <small class="muted center">Opens GPay, PhonePe, Paytm or any UPI app. Paid to ${esc(r.upi.name)} (${esc(r.upi.id)}).</small>
          <button class="btn btn-block" id="ipaid">${icon('check', 18)} I've paid ${cur(due)}</button>`
          : `<div class="notice" style="margin:0">${icon('receipt', 18)}<span>Please pay at the counter. Show this screen to the staff.</span></div>
          <button class="btn btn-block" id="askbill">${icon('receipt', 18)} Ask for the bill</button>`) : ''}
      </div>`}
    </div>`;
    document.getElementById('back').onclick = () => { location.hash = ''; };
    app.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { splitMode = b.dataset.mode; renderBill(); });
    app.querySelectorAll('[data-n]').forEach(b => b.onclick = () => { splitN = Math.max(2, Math.min(30, splitN + Number(b.dataset.n))); renderBill(); });
    app.querySelectorAll('[data-pay]').forEach(el => el.onclick = e => { if (e.target.closest('.p-lines')) return; payFor = el.dataset.pay; renderBill(); document.querySelector('.paybox').scrollIntoView({ behavior: 'smooth', block: 'end' }); });
    const share = async (key, shared) => { try { B = await api(`/api/menu/${slug}/table/share`, { method: 'POST', body: { t: tableToken, gid: GID, key, shared } }); renderBill(); } catch (err) { toast(esc(err.message), 'error'); } };
    app.querySelectorAll('[data-share]').forEach(b => b.onclick = () => share(b.dataset.share, true));
    app.querySelectorAll('[data-unshare]').forEach(b => b.onclick = () => share(b.dataset.unshare, false));
    const ip = document.getElementById('ipaid'); if (ip) ip.onclick = async () => {
      ip.disabled = true;
      try { B = await api(`/api/menu/${slug}/table/paid`, { method: 'POST', body: { t: tableToken, gid: splitMode === 'equal' ? GID : target.gid, name: splitMode === 'equal' ? (myName() || 'A guest') : target.name, amount: due } }); toast(`${icon('check', 18)} Thanks! The counter has been told.`, 'ok'); renderBill(); }
      catch (err) { ip.disabled = false; toast(esc(err.message), 'error'); }
    };
    const ab = document.getElementById('askbill'); if (ab) ab.onclick = async () => { try { await api(`/api/menu/${slug}/requests`, { method: 'POST', body: { table: tableToken, type: 'bill' } }); toast(`${icon('check', 18)} The staff will bring your bill.`, 'ok'); } catch (err) { toast(esc(err.message), 'error'); } };
  }
  let justSettled = false;
  function noop() {}

  function openHelp() {
    const o = sheet(`<div class="sheet-head"><h2>How can we help?</h2><button class="icon-btn" data-close aria-label="Close">${icon('x', 20)}</button></div>
      <div class="sheet-body"><p class="muted" style="margin:0 0 14px">We'll let the staff know you're at ${esc(D.table.name)}.</p><div class="help-grid">
        <button class="help-opt" data-req="waiter"><span class="ico">${icon('hand', 24)}</span><span>Call a waiter<small>Someone will come to your table</small></span></button>
        <button class="help-opt" data-req="bill"><span class="ico">${icon('receipt', 24)}</span><span>Ask for the bill<small>We'll bring it to your table</small></span></button>
        <a class="help-opt" href="#bill" data-close><span class="ico">${icon('list', 24)}</span><span>Split the bill and pay<small>Each person pays their share by UPI</small></span></a>
        <button class="help-opt" data-req="water"><span class="ico">${icon('water', 24)}</span><span>Bring water<small>Still water for the table</small></span></button>
      </div></div>`);
    o.querySelectorAll('[data-req]').forEach(b => b.onclick = async () => {
      try { await api(`/api/menu/${slug}/requests`, { method: 'POST', body: { table: tableToken, type: b.dataset.req } }); o.close(); toast(`${icon('check', 18)} Done. The staff has been told.`, 'ok'); }
      catch (err) { toast(esc(err.message), 'error'); }
    });
  }

  // ---------- order status ----------
  const STEPS = [['new', 'Order sent', 'The kitchen has your order'], ['preparing', 'Being prepared', 'Our chefs are cooking'], ['ready', 'Ready', 'Coming to your table'], ['served', 'Served', 'Enjoy your meal!']];
  function renderStatus(order) {
    const r = D.restaurant;
    const idx = STEPS.findIndex(s => s[0] === order.status);
    const t = new Date(order.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const head = order.status === 'cancelled' ? ['Order cancelled', 'Please speak to our staff if this is a mistake.'] :
      order.status === 'served' ? ['Enjoy your meal!', 'Your order has been served.'] :
      order.status === 'ready' ? ['Your food is ready', 'It is on its way to your table.'] :
      order.status === 'preparing' ? ['Being prepared', 'The kitchen has started on your order.'] : ['Order placed!', 'The kitchen has received your order.'];
    const mine = load(ORDERS_KEY, []);
    app.innerHTML = `<div class="status-page">
      <button class="btn btn-ghost btn-sm" id="back">${icon('left', 18)} Back to menu</button>
      <div class="status-hero">
        <div class="tick" style="${order.status === 'cancelled' ? 'background:var(--red);box-shadow:0 0 0 10px var(--red-soft)' : ''}">${icon(order.status === 'cancelled' ? 'x' : order.status === 'served' ? 'utensils' : 'check', 38)}</div>
        <h1>${head[0]}</h1><p>${head[1]}</p>
        ${eta(order)}
      </div>
      <div class="track">
        <div class="track-head"><b>Order #${order.number} · ${esc(order.tableName)}</b><span class="muted">${t}</span></div>
        ${order.status === 'cancelled' ? '<div class="cancelled-box">This order was cancelled.</div>' : `<div class="steps">${STEPS.map((s, i) => `<div class="step ${i < idx || order.status === 'served' ? 'done' : i === idx ? 'now' : ''}"><span class="b">${i < idx || order.status === 'served' ? icon('check', 15) : ''}</span><span><strong>${s[1]}</strong><small>${s[2]}</small></span></div>`).join('')}</div>`}
        <div class="order-lines">${order.items.map(l => `<div><span>${l.qty} × ${esc(l.name)}</span><span>${cur(l.price * l.qty)}</span></div>`).join('')}
          ${order.note ? `<div class="muted"><span>Note: ${esc(order.note)}</span></div>` : ''}
          ${order.discount ? `<div><span>Item total</span><span>${cur(order.subtotal)}</span></div><div class="save"><span>Coupon ${esc(order.coupon)}</span><span>−${cur(order.discount)}</span></div>` : ''}
          <div class="t"><span>Total</span><span>${cur(order.total)}</span></div></div>
      </div>
      <div class="stack">
        ${canOrder() ? `<button class="btn btn-primary btn-lg btn-block" id="more">${icon('plus', 20)} Order more</button>` : ''}
        ${D.table ? `<a class="btn btn-lg btn-block" href="#bill">${icon('list', 20)} Split the bill and pay</a>` : ''}
        ${D.table ? `<button class="btn btn-lg btn-block" id="help2">${icon('hand', 20)} Call waiter or ask for bill</button>` : ''}
        ${r.socials.instagram ? `<div class="follow" style="margin:6px 0 0"><a class="ig" href="${esc(r.socials.instagram)}" target="_blank" rel="noopener">${icon('instagram', 20)} Follow ${esc(r.name)} on Instagram</a></div>` : ''}
      </div>
      ${mine.length > 1 ? `<h3 style="margin:26px 0 4px;font-size:16px">Your earlier orders</h3>${mine.filter(m => m.id !== order.id).map(m => `<a class="mo" href="#order=${m.id}"><span>${new Date(m.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span><span style="color:var(--brand);font-weight:700">View ${icon('right', 16)}</span></a>`).join('')}` : ''}
    </div>`;
    const back = () => { location.hash = ''; };
    document.getElementById('back').onclick = back;
    const more = document.getElementById('more'); if (more) more.onclick = back;
    const h2 = document.getElementById('help2'); if (h2) h2.onclick = openHelp;
    renderCartBar();
  }
  function eta(order) {
    if (!order.readyBy || !['new', 'preparing'].includes(order.status)) return '';
    const mins = Math.round((Date.parse(order.readyBy) - Date.now()) / 60000);
    const at = new Date(order.readyBy).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return mins > 0 ? `<div class="eta">${icon('clock', 18)}<span>Ready in about <b>${mins} min</b><small>by ${at}, based on how long this kitchen usually takes</small></span></div>`
      : `<div class="eta late">${icon('clock', 18)}<span><b>Almost there</b><small>Taking a little longer than usual. The kitchen can see it.</small></span></div>`;
  }
  setInterval(() => { const el = document.querySelector('.eta'); if (el && lastOrder) el.outerHTML = eta(lastOrder); }, 30000);
  let lastOrder = null;
  let lastStatus = null;
  function showOrder(oid) {
    if (orderStream) orderStream.close();
    lastStatus = null;
    app.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    window.scrollTo(0, 0);
    const startPolling = () => {
      const tick = async () => { if (location.hash !== '#order=' + oid) return; try { update(await api('/api/orders/' + oid)); } catch {} setTimeout(tick, 6000); };
      tick();
    };
    const update = o => {
      if (lastStatus && lastStatus !== o.status && navigator.vibrate) navigator.vibrate(200);
      if (lastStatus && lastStatus !== o.status && o.status === 'ready') toast(`${icon('bell', 18)} Your food is ready!`, 'ok');
      lastStatus = o.status; lastOrder = o; renderStatus(o);
    };
    if ('EventSource' in window) {
      orderStream = new EventSource(`/api/orders/${oid}/stream`);
      orderStream.addEventListener('order', e => update(JSON.parse(e.data)));
      orderStream.onerror = () => { if (orderStream.readyState === 2) { orderStream = null; startPolling(); } };
    } else startPolling();
  }

  function route() {
    const m = /^#order=([A-Za-z0-9]+)$/.exec(location.hash);
    if (m) return showOrder(m[1]);
    if (orderStream) { orderStream.close(); orderStream = null; }
    if (location.hash === '#bill' && D.table) { window.scrollTo(0, 0); renderCartBar(); return renderBill(); }
    renderMenu();
  }

  // delegated clicks for menu controls
  document.addEventListener('click', e => {
    const of = e.target.closest('[data-offer]');
    if (of && !of.closest('.overlay')) { if (!canOrder()) return toast('Scan the QR on your table to order and use this offer.'); if (!cartCount()) return toast(`Add dishes first, then use code ${esc(of.dataset.offer)} in your order.`); checkCoupon(of.dataset.offer).then(ok => ok && openCart()); return; }
    const a = e.target.closest('[data-add],[data-inc],[data-dec],[data-open],[data-cat]');
    if (!a || a.closest('.overlay')) return;
    if (a.dataset.add) { setQty(a.dataset.add, 1); if (navigator.vibrate) navigator.vibrate(15); }
    else if (a.dataset.inc) setQty(a.dataset.inc, cart[a.dataset.inc] + 1);
    else if (a.dataset.dec) setQty(a.dataset.dec, cart[a.dataset.dec] - 1);
    else if (a.dataset.open) openItem(a.dataset.open);
    else if (a.dataset.cat) { const s = document.getElementById('c-' + a.dataset.cat); if (s) window.scrollTo({ top: s.getBoundingClientRect().top + scrollY - 56, behavior: 'smooth' }); }
  });
  window.addEventListener('hashchange', route);

  (async function init() {
    try {
      D = await api(`/api/menu/${slug}${tableToken ? '?t=' + encodeURIComponent(tableToken) : ''}`);
      if (D.restaurant.guestLogin && D.table) { try { G = (await api(`/api/menu/${slug}/guest/me`)).guest; } catch {} if (G) adoptGuestName(); }
      applyBrand(D.restaurant.brandColor);
      document.querySelector('meta[name=theme-color]').content = D.restaurant.brandColor;
      route();
      connectTable();
    } catch (err) {
      app.innerHTML = `<div class="empty" style="padding-top:30vh">${icon('utensils', 44)}<h2 style="color:var(--ink)">Menu not found</h2><p>${esc(err.message)}</p></div>`;
    }
  })();
})();
