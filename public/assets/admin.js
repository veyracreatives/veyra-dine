// Restaurant admin: live orders, menu, tables + QR codes, branding, settings.
(function () {
  const app = document.getElementById('app');
  const TZ = new Date().getTimezoneOffset();
  const S = { me: null, tab: 'orders', orders: [], requests: [], stats: null, menu: null, tables: null, selCat: null, mobileCol: 'new', newIds: new Set(), sound: localStorage.getItem('vd_sound') !== 'off', audioOk: false, histDate: new Date(Date.now() - TZ * 60000).toISOString().slice(0, 10), history: [] };
  let es = null, titleTimer = null;

  // ---------- helpers ----------
  async function api(path, opts = {}) {
    const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', ...opts, body: opts.body ? JSON.stringify(opts.body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && !path.includes('/login')) { renderLogin(); throw new Error('Please log in'); }
    if (!res.ok) throw new Error(data.error || 'Something went wrong');
    return data;
  }
  function toast(msg, type = '') {
    const el = document.createElement('div'); el.className = 'toast ' + type; el.innerHTML = msg;
    document.getElementById('toasts').appendChild(el); setTimeout(() => el.remove(), 3500);
  }
  const cur = v => fmtMoney(v, S.me ? S.me.restaurant.currency : '₹');
  function ago(iso) {
    const m = Math.floor((Date.now() - Date.parse(iso)) / 60000);
    if (m < 1) return 'Just now'; if (m < 60) return m + ' min ago';
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  function modal(html, { wide = false } = {}) {
    const o = document.createElement('div'); o.className = 'overlay center';
    o.innerHTML = `<div class="sheet" style="${wide ? 'max-width:640px' : ''}" role="dialog" aria-modal="true">${html}</div>`;
    o.addEventListener('click', e => { if (e.target === o || e.target.closest('[data-close]')) o.remove(); });
    document.body.appendChild(o); o.close = () => o.remove();
    const f = o.querySelector('input:not([type=hidden]):not([type=file]),textarea'); if (f) setTimeout(() => f.focus(), 50);
    return o;
  }
  function confirmBox(title, text, okLabel = 'Delete') {
    return new Promise(resolve => {
      const o = modal(`<div class="sheet-head"><h3>${title}</h3></div><div class="sheet-body"><p class="muted" style="margin:0">${text}</p></div>
        <div class="sheet-foot" style="display:flex;gap:10px;justify-content:flex-end"><button class="btn" data-close>Keep it</button><button class="btn btn-dark" id="ok">${okLabel}</button></div>`);
      o.querySelector('#ok').onclick = () => { o.close(); resolve(true); };
      o.addEventListener('click', e => { if (e.target === o || e.target.closest('[data-close]')) resolve(false); });
    });
  }
  // shrink photos in the browser before upload
  function readImage(file, max = 1200, keepPng = false) {
    return new Promise((resolve, reject) => {
      if (!file) return reject(new Error('No file'));
      if (file.type === 'image/svg+xml') { const fr = new FileReader(); fr.onload = () => resolve(fr.result); fr.readAsDataURL(file); return; }
      const img = new Image(); const url = URL.createObjectURL(file);
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        const ctx = c.getContext('2d');
        if (!keepPng) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); }
        ctx.drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        resolve(keepPng ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.84));
      };
      img.onerror = () => reject(new Error('That file is not an image we can read'));
      img.src = url;
    });
  }
  function pickFile(accept = 'image/*') {
    return new Promise(resolve => { const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.onchange = () => resolve(i.files[0]); i.click(); });
  }

  // ---------- sound + notifications ----------
  let actx = null;
  function unlockAudio() { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); actx.resume(); S.audioOk = true; } catch {} }
  function chime(times = 2) {
    if (!S.sound || !actx) return;
    for (let k = 0; k < times; k++) [880, 1175, 1568].forEach((f, i) => {
      const o = actx.createOscillator(), g = actx.createGain(); const t = actx.currentTime + k * 0.9 + i * 0.16;
      o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.connect(g).connect(actx.destination); o.start(t); o.stop(t + 0.55);
    });
  }
  function notify(title, body) {
    if (window.vdDesktop) window.vdDesktop.alert(title, body);
    else if ('Notification' in window && Notification.permission === 'granted' && document.hidden) { try { new Notification(title, { body, tag: 'vd-' + Date.now() }); } catch {} }
    let on = false; clearInterval(titleTimer); const base = `${S.me.restaurant.name} · Admin`;
    titleTimer = setInterval(() => { document.title = (on = !on) ? `🔔 ${title}` : base; }, 1000);
    setTimeout(() => { clearInterval(titleTimer); document.title = base; }, 20000);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && S.me) { clearInterval(titleTimer); document.title = `${S.me.restaurant.name} · Admin`; } });

  // ---------- login ----------
  function renderLogin(mode) {
    if (es) { es.close(); es = null; }
    mode = mode || (location.pathname.startsWith('/signup') ? 'signup' : 'login');
    const pre = location.pathname.split('/')[2] || localStorage.getItem('vd_slug') || '';
    document.title = mode === 'signup' ? 'Start your free trial' : 'Log in';
    app.innerHTML = `<div class="auth">
      <div class="brand-side"><div class="logo"><span class="mark">${icon('qr', 24)}</span>Veyra Dine In</div>
        <h1>Orders from every table, <em>right here.</em></h1><p>Guests scan the QR on their table and order from their phone. You see it here with the table number and a sound.</p>
        <ul class="ticks"><li>${icon('check', 20)} 10 days free, every feature</li><li>${icon('check', 20)} No card needed</li><li>${icon('check', 20)} Your menu stays saved when you buy</li></ul>
        <div class="foot">Made by Veyra Creative &amp; Digital Lab · Navi Mumbai</div></div>
      <div class="form-side"><div class="form-card">
        <div class="tabs2"><button class="${mode === 'signup' ? 'on' : ''}" data-mode="signup">Start free trial</button><button class="${mode === 'login' ? 'on' : ''}" data-mode="login">Log in</button></div>
        ${mode === 'signup' ? `<form id="sf">
          <span class="trial-chip">${icon('check', 15)} 10-day free trial</span><h2>Create your restaurant</h2><p class="muted">Takes one minute. You can change everything later.</p>
          <div class="form">
            <label class="field"><span>Restaurant name</span><input class="input" name="name" required maxlength="80" autocomplete="organization"></label>
            <div class="row2"><label class="field"><span>Your name</span><input class="input" name="ownerName" required maxlength="80" autocomplete="name"></label>
              <label class="field"><span>Mobile (WhatsApp)</span><input class="input" name="phone" required inputmode="tel" maxlength="16" autocomplete="tel"></label></div>
            <label class="field"><span>Email</span><input class="input" name="email" type="email" required autocomplete="email"></label>
            <label class="field"><span>Create a password</span><input class="input" name="password" type="password" minlength="6" required autocomplete="new-password"><small>Staff use this to open orders on their phones.</small></label>
            <button class="btn btn-primary btn-lg btn-block">Start 10-day free trial</button>
          </div></form>`
        : `<form id="lf"><h2>Welcome back</h2><p class="muted">Log in to see your live orders.</p>
          <div class="form">
            <label class="field"><span>Email or restaurant ID</span><input class="input" name="slug" value="${esc(pre)}" required autocapitalize="off" autocomplete="username"></label>
            <label class="field"><span>Password</span><input class="input" type="password" name="password" required autocomplete="current-password"></label>
            <button class="btn btn-lg btn-block btn-dark">Log in</button>
          </div>
          <div class="small-link">Forgot your password? Message us on <a href="https://wa.me/918928246726" target="_blank">WhatsApp</a>.</div></form>`}
        <div id="gwrap" hidden><div class="or" style="margin:20px 0 14px">or</div><div class="gbtn" style="display:flex;justify-content:center;min-height:44px"></div></div>
      </div></div></div>`;
    app.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => renderLogin(b.dataset.mode));
    const afterLogin = async (r, created) => { localStorage.setItem('vd_slug', r.slug); history.replaceState(null, '', '/admin/' + r.slug + location.search); if (created) S.tab = 'menu'; await boot(); if (created) toast(`${icon('check', 18)} Your free trial has started`, 'ok'); };
    window.VDGoogle && VDGoogle.mount(document.getElementById('gwrap'), async credential => {
      try {
        const r = await api('/api/admin/google', { method: 'POST', body: { credential } });
        if (!r.needSignup) return afterLogin(r);
        const card = app.querySelector('.form-card');
        card.innerHTML = `<form id="gsf"><span class="trial-chip">${icon('check', 15)} 10-day free trial</span><h2>One more step</h2><p class="muted">Signed in as <b>${esc(r.email)}</b>. Tell us about your restaurant.</p>
          <div class="form"><label class="field"><span>Restaurant name</span><input class="input" name="name" required maxlength="80" autocomplete="organization"></label>
          <label class="field"><span>Mobile (WhatsApp)</span><input class="input" name="phone" required inputmode="tel" maxlength="16" autocomplete="tel"></label>
          <button class="btn btn-primary btn-lg btn-block">Start 10-day free trial</button></div>
          <div class="small-link"><a href="#" id="gback">Use a different account</a></div></form>`;
        card.querySelector('#gback').onclick = e => { e.preventDefault(); renderLogin(mode); };
        card.querySelector('#gsf').onsubmit = async e => {
          e.preventDefault(); const f = new FormData(e.target), btn = e.submitter; if (btn) btn.disabled = true;
          try { afterLogin(await api('/api/admin/google', { method: 'POST', body: { credential, name: f.get('name'), phone: f.get('phone') } }), true); }
          catch (err) { toast(esc(err.message), 'error'); if (btn) btn.disabled = false; }
        };
      } catch (err) { toast(esc(err.message), 'error'); }
    }, { text: mode === 'signup' ? 'signup_with' : 'signin_with' });
    const lf = document.getElementById('lf');
    if (lf) lf.onsubmit = async e => {
      e.preventDefault(); const f = new FormData(e.target);
      try { const r = await api('/api/admin/login', { method: 'POST', body: { slug: f.get('slug'), password: f.get('password') } }); localStorage.setItem('vd_slug', r.slug); history.replaceState(null, '', '/admin/' + r.slug + location.search); boot(); }
      catch (err) { toast(esc(err.message), 'error'); }
    };
    const sf = document.getElementById('sf');
    if (sf) sf.onsubmit = async e => {
      e.preventDefault(); const btn = e.submitter; if (btn) btn.disabled = true;
      try { const r = await api('/api/signup', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); localStorage.setItem('vd_slug', r.slug); history.replaceState(null, '', '/admin/' + r.slug + location.search); S.tab = 'menu'; await boot(); toast(`${icon('check', 18)} Your free trial has started. Add your menu first.`, 'ok'); }
      catch (err) { toast(esc(err.message), 'error'); if (btn) btn.disabled = false; }
    };
  }

  // ---------- trial, license, buying ----------
  const inr = n => '₹' + Number(n).toLocaleString('en-IN');
  function buyLink(plan) {
    const r = S.me.restaurant;
    return S.me.buyUrl + encodeURIComponent(`Hi Veyra, I want to buy Veyra Dine In ${plan} (${plan === 'lifetime' ? inr(S.me.plans.lifetime) : plan === 'monthly' ? inr(S.me.plans.monthly) + '/month' : inr(S.me.plans.yearly) + '/year'}) for ${r.name}. My login email: ${r.email || r.slug}`);
  }
  // A paid plan is 'ending soon' 7 days before a monthly plan ends, 30 days before a yearly one. A trial always shows the bar.
  const endingSoon = a => a.plan === 'trial' || (a.plan === 'monthly' && a.daysLeft <= 7) || (a.plan === 'yearly' && a.daysLeft <= 30);
  function trialBar() {
    const a = S.me.restaurant.access;
    if (!a || a.plan === 'lifetime' || !endingSoon(a)) return '';
    const label = a.plan === 'trial' ? `Free trial <span class="days">${a.daysLeft} day${a.daysLeft === 1 ? '' : 's'} left</span> Everything you set up stays when you buy.` : `Your ${a.plan === 'monthly' ? 'monthly' : 'yearly'} plan ends in <span class="days">${a.daysLeft} day${a.daysLeft === 1 ? '' : 's'}</span>`;
    return `<div class="trial-bar">${icon('clock', 18)} ${label}<a class="btn btn-sm btn-primary" href="${esc(buyLink('lifetime'))}" target="_blank">Buy lifetime ${inr(S.me.plans.lifetime)}</a><button class="btn btn-sm" data-license>Enter license key</button></div>`;
  }
  function keyForm(onDone) {
    return { html: `<label class="field"><span>License key</span><div class="key-row"><input class="input" id="lk" placeholder="VEYRA-XXXX-XXXX-XXXX" autocomplete="off" spellcheck="false"><button class="btn btn-primary" id="lkBtn" type="button">Activate</button></div></label>`,
      bind(root) {
        root.querySelector('#lkBtn').onclick = async e => {
          const btn = e.currentTarget; btn.disabled = true;
          try { const r = await api('/api/admin/activate', { method: 'POST', body: { key: root.querySelector('#lk').value } }); S.me.restaurant = r.restaurant; onDone(); }
          catch (err) { toast(esc(err.message), 'error'); btn.disabled = false; }
        };
      } };
  }
  function buyOptions() {
    return `<div class="or">Don't have a key?</div><div class="buy-row">
      <a class="buy best" href="${esc(buyLink('lifetime'))}" target="_blank"><b>Lifetime</b><div class="pr">${inr(S.me.plans.lifetime)}</div><small>Pay once, use forever</small></a>
      <a class="buy" href="${esc(buyLink('yearly'))}" target="_blank"><b>Yearly</b><div class="pr">${inr(S.me.plans.yearly)}</div><small>per year</small></a>
      <a class="buy" href="${esc(buyLink('monthly'))}" target="_blank"><b>Monthly</b><div class="pr">${inr(S.me.plans.monthly)}</div><small>per month</small></a></div>
      <div class="help">${icon('phone', 18)} Need help? WhatsApp <a href="https://wa.me/918928246726" target="_blank">+91 89282 46726</a></div>`;
  }
  function licenseModal() {
    const kf = keyForm(() => { o.close(); renderActivated(); });
    const o = modal(`<div class="sheet-head"><h3>Enter license key</h3><button class="icon-btn" data-close>${icon('x', 20)}</button></div><div class="sheet-body">
      <p class="muted" style="margin:0 0 16px">You get the key on WhatsApp or email after you pay.</p>${kf.html}${buyOptions()}</div>`, { wide: true });
    kf.bind(o);
  }
  function renderActivate() {
    if (es) { es.close(); es = null; }
    const a = S.me.restaurant.access;
    const kf = keyForm(renderActivated);
    app.innerHTML = `<div class="activate-page"><div class="act-card"><div class="big-ic">${icon('clock', 32)}</div>
      <h2>${a.plan === 'trial' ? 'Your free trial has ended' : a.plan === 'suspended' ? 'Your license is paused' : 'Your plan has ended'}</h2>${a.plan === 'suspended' ? '<p class="muted">Please contact Veyra on WhatsApp +91 89282 46726.</p>' : ''}
      <p class="muted">Your menu, tables and QR codes are all saved. Enter your license key to start taking orders again.</p>
      ${kf.html}${buyOptions()}
      <div class="small-link" style="text-align:left"><a href="#" id="lo2">Log out</a></div></div></div>`;
    kf.bind(app);
    document.getElementById('lo2').onclick = async e => { e.preventDefault(); await api('/api/admin/logout', { method: 'POST' }); renderLogin('login'); };
  }
  function renderActivated() {
    const r = S.me.restaurant;
    app.innerHTML = `<div class="activate-page"><div class="act-card success"><div class="big-ic">${icon('check', 34)}</div>
      <h2>You're all set</h2><p class="muted">Thank you for buying Veyra Dine In. Your restaurant is fully activated.</p>
      <div class="lic-box"><span>Restaurant</span><b>${esc(r.name)}</b><span>Plan</span><b>${r.access.plan === 'lifetime' ? 'Lifetime' : 'Yearly, until ' + new Date(r.access.until).toLocaleDateString()}</b><span>Updates</span><b>Included</b></div>
      <button class="btn btn-primary btn-lg btn-block" id="goOrders">Go to live orders</button></div></div>`;
    document.getElementById('goOrders').onclick = () => { S.tab = 'orders'; boot(); };
  }

  // ---------- shell ----------
  const TABS = [['orders', 'Live orders', 'bell'], ['history', 'Sales by date', 'history'], ['menu', 'Menu', 'book'], ['offers', 'Coupons', 'star'], ['tables', 'Tables & QR', 'qr'], ['branding', 'Branding', 'palette'], ['settings', 'Settings', 'settings']];
  const MOBILE_TABS = [['orders', 'Orders', 'bell'], ['menu', 'Menu', 'book'], ['tables', 'Tables', 'qr'], ['branding', 'Branding', 'palette'], ['settings', 'More', 'settings']];
  function activeCount() { return S.orders.filter(o => o.status === 'new').length + S.requests.length; }
  function renderShell() {
    const r = S.me.restaurant;
    applyBrand(r.brandColor);
    document.title = `${r.name} · Admin`;
    const n = activeCount();
    app.innerHTML = `<div class="shell">
      <aside class="side">
        <div class="brand-row"><div class="lg">${r.logo ? `<img src="${esc(r.logo)}" alt="">` : esc(r.name[0])}</div><div><b>${esc(r.name)}</b><small>Admin panel</small></div></div>
        ${TABS.map(([k, l, ic]) => `<button class="nav ${S.tab === k ? 'on' : ''}" data-tab="${k}">${icon(ic, 20)} ${l}${k === 'orders' && n ? `<span class="count">${n}</span>` : ''}</button>`).join('')}
        <div class="spacer"></div>
        <a class="nav" href="/m/${r.slug}" target="_blank">${icon('eye', 20)} View customer menu</a>
        <button class="nav" id="logout">${icon('logout', 20)} Log out</button>
        <div class="foot">Veyra Dine In</div>
      </aside>
      <div class="main">${trialBar()}
        <div class="topbar">
          <h1>${TABS.find(t => t[0] === S.tab)[1]}</h1>
          <label class="live-pill switch" title="When off, customers can still see the menu but can't order">
            <input type="checkbox" id="accepting" ${r.acceptingOrders ? 'checked' : ''}><span class="track"></span><span id="accLabel">${r.acceptingOrders ? 'Taking orders' : 'Orders paused'}</span>
          </label>
          <button class="icon-btn" id="soundBtn" title="${S.sound ? 'Sound alerts on' : 'Sound alerts off'}">${icon(S.sound ? 'sound' : 'mute', 20)}</button>
        </div>
        <div class="content" id="content"></div>
      </div>
      <nav class="tabbar">${MOBILE_TABS.map(([k, l, ic]) => `<button class="${S.tab === k || (k === 'settings' && (S.tab === 'history' || S.tab === 'offers')) ? 'on' : ''}" data-tab="${k}">${icon(ic, 22)}${l}${k === 'orders' && n ? `<span class="count">${n}</span>` : ''}</button>`).join('')}</nav>
    </div>`;
    app.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => go(b.dataset.tab));
    app.querySelectorAll('[data-license]').forEach(b => b.onclick = licenseModal);
    document.getElementById('logout').onclick = async () => { await api('/api/admin/logout', { method: 'POST' }); renderLogin(); };
    document.getElementById('accepting').onchange = async e => {
      const on = e.target.checked;
      try { S.me.restaurant = await api('/api/admin/settings', { method: 'PUT', body: { acceptingOrders: on } }); document.getElementById('accLabel').textContent = on ? 'Taking orders' : 'Orders paused'; toast(on ? 'Customers can order again' : 'Ordering paused. Customers can still see the menu.'); }
      catch (err) { e.target.checked = !on; toast(esc(err.message), 'error'); }
    };
    document.getElementById('soundBtn').onclick = () => { S.sound = !S.sound; localStorage.setItem('vd_sound', S.sound ? 'on' : 'off'); unlockAudio(); if (S.sound) chime(1); renderShell(); };
    renderTab();
  }
  function go(tab) { S.tab = tab; location.hash = tab; renderShell(); window.scrollTo(0, 0); }
  function refreshBadges() {
    const n = activeCount();
    document.querySelectorAll('[data-tab="orders"]').forEach(b => { let c = b.querySelector('.count'); if (!n) { if (c) c.remove(); return; } if (!c) { c = document.createElement('span'); c.className = 'count'; b.appendChild(c); } c.textContent = n; });
  }
  function renderTab() {
    const c = document.getElementById('content');
    ({ orders: renderOrders, history: renderHistory, offers: renderOffers, menu: renderMenu, tables: renderTables, branding: renderBranding, settings: renderSettings })[S.tab](c);
  }

  // ---------- live orders ----------
  const COLS = [['new', 'New orders', 'var(--brand)'], ['preparing', 'Preparing', 'var(--amber)'], ['ready', 'Ready to serve', 'var(--green)']];
  const REQ = { waiter: ['hand', 'is calling a waiter'], bill: ['receipt', 'asked for the bill'], water: ['water', 'asked for water'], paid: ['check', 'paid by UPI'] };
  const reqText = q => q.type === 'paid' ? `${esc(q.name || 'A guest')} says they paid ${cur(q.amount)} by UPI. Check your UPI app.` : REQ[q.type][1];
  async function loadLive() {
    const [orders, requests, stats] = await Promise.all([api('/api/admin/orders?scope=active'), api('/api/admin/requests'), api('/api/admin/stats?tz=' + TZ)]);
    S.orders = orders; S.requests = requests; S.stats = stats;
  }
  function renderOrders(c) {
    const st = S.stats || { ordersToday: 0, salesToday: 0, activeTables: 0, activeOrders: 0 };
    const isLocal = /localhost|127\.0\.0\.1/.test(S.me.baseUrl);
    c.innerHTML = `
      ${!S.audioOk && !window.vdDesktop ? `<div class="banner">${icon('bell', 22)}<span>Turn on alerts so you hear a sound and get a pop-up for every new order.</span><button class="btn btn-primary" id="enableAlerts">Turn on alerts</button></div>` : ''}
      <div class="stats">
        <button class="stat link" data-gosales>  <small>Orders today</small><b>${st.ordersToday}</b><span class="sub">Other days ›</span></button>
        <button class="stat link" data-gosales><small>Sales today</small><b>${cur(st.salesToday)}</b><span class="sub">Other days ›</span></button>
        <div class="stat"><small>Orders in progress</small><b>${st.activeOrders}</b></div>
        <div class="stat"><small>Tables ordering now</small><b>${st.activeTables}</b></div>
      </div>
      <div class="requests">${S.requests.map(q => `<div class="req"><span class="ico">${icon(REQ[q.type][0], 22)}</span><div class="grow"><b>${esc(q.tableName)}</b> ${reqText(q)}<small>${ago(q.createdAt)}</small></div>${q.type === 'bill' || q.type === 'paid' ? `<button class="btn" data-obill="${q.tableId}">${icon('receipt', 18)} Open bill</button>` : ''}<button class="btn btn-dark" data-req="${q.id}">${icon('check', 18)} Done</button></div>`).join('')}</div>
      <div class="seg">${COLS.map(([k, l]) => `<button class="${S.mobileCol === k ? 'on' : ''}" data-col="${k}">${l.split(' ')[0]} (${S.orders.filter(o => o.status === k).length})</button>`).join('')}</div>
      <div class="board">${COLS.map(([k, l, color]) => {
        const list = S.orders.filter(o => o.status === k).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        return `<div class="colwrap ${S.mobileCol === k ? 'on' : ''}"><div class="col-head"><span class="dot" style="background:${color}"></span>${l}<span class="n" style="background:color-mix(in srgb, ${color} 14%, #fff);color:${color}">${list.length}</span></div>
          <div class="col">${list.length ? list.map(orderCard).join('') : `<div class="col-empty">${k === 'new' ? (isLocal ? 'No new orders yet.' : 'Waiting for orders. New ones pop up here with a sound.') : 'Nothing here right now.'}</div>`}</div></div>`;
      }).join('')}</div>`;
    const en = document.getElementById('enableAlerts');
    if (en) en.onclick = async () => { unlockAudio(); chime(1); if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission(); renderOrders(c); toast('Alerts are on. Keep this page open.', 'ok'); };
    c.querySelectorAll('[data-gosales]').forEach(b => b.onclick = () => { setRange(...rangeFor('today'), 'today'); go('history'); });
    c.querySelectorAll('[data-col]').forEach(b => b.onclick = () => { S.mobileCol = b.dataset.col; renderOrders(c); });
    c.querySelectorAll('[data-obill]').forEach(b => b.onclick = () => counterBill(b.dataset.obill));
    c.querySelectorAll('[data-req]').forEach(b => b.onclick = async () => { await api('/api/admin/requests/' + b.dataset.req, { method: 'PATCH', body: {} }); S.requests = S.requests.filter(q => q.id !== b.dataset.req); renderOrders(c); refreshBadges(); });
    c.querySelectorAll('[data-status]').forEach(b => b.onclick = () => setStatus(b.dataset.id, b.dataset.status));
    c.querySelectorAll('[data-kot]').forEach(b => b.onclick = () => { const o = S.orders.find(x => x.id === b.dataset.kot); if (o) printKot(o); });
  }
  // Promised time: guests see "ready in about X min". Late orders turn red here.
  function dueChip(o, mins) {
    if (o.readyBy && (o.status === 'new' || o.status === 'preparing')) {
      const left = Math.round((Date.parse(o.readyBy) - Date.now()) / 60000);
      return left >= 0 ? `<div class="o-time ${left <= 2 ? 'soon' : ''}" title="Guests were told it would be ready by then">${icon('clock', 14)} Due in ${left} min</div>`
        : `<div class="o-time late" title="Later than guests were told">${icon('clock', 14)} Late by ${-left} min</div>`;
    }
    return `<div class="o-time ${mins > 20 && o.status !== 'ready' ? 'late' : ''}">${icon('clock', 14)} ${ago(o.createdAt)}</div>`;
  }
  function orderCard(o) {
    const mins = (Date.now() - Date.parse(o.createdAt)) / 60000;
    const next = { new: ['preparing', 'Accept & start cooking'], preparing: ['ready', 'Mark as ready'], ready: ['served', 'Mark as served'] }[o.status];
    return `<article class="order ${S.newIds.has(o.id) ? 'is-new' : ''}">
      <div class="o-head"><div><div class="o-table">${esc(o.tableName)}</div><div class="o-meta">Order #${o.number}${o.customerName ? ' · ' + esc(o.customerName) : ''}</div></div>
        ${dueChip(o, mins)}</div>
      <div class="o-items">${o.items.map(l => `<div class="o-line"><span class="q">${l.qty}×</span>${dietMark(l.diet)}<span class="nm">${esc(l.name)}${l.note ? `<small>${esc(l.note)}</small>` : ''}${l.by && new Set(o.items.map(x => x.by)).size > 1 ? `<small class="by">for ${esc(l.by)}</small>` : ''}</span></div>`).join('')}</div>
      ${o.note ? `<div class="o-note">${icon('edit', 16)} ${esc(o.note)}</div>` : ''}
      <div class="o-foot"><span class="total">${cur(o.total)}${o.coupon ? `<small class="cpn">${esc(o.coupon)} −${cur(o.discount)}</small>` : ''}</span>
<button class="btn btn-sm btn-ghost" data-kot="${o.id}" title="Print kitchen ticket (KOT)">${icon('printer', 16)} KOT</button>${o.tableId ? `<button class="btn btn-sm btn-ghost" data-obill="${o.tableId}" title="See, split and print the bill for this table">${icon('receipt', 16)} Bill</button>` : ''}
                ${o.status === 'new' ? `<button class="btn btn-sm btn-ghost btn-danger" data-id="${o.id}" data-status="cancelled">Cancel</button>` : ''}
        <button class="btn btn-primary" data-id="${o.id}" data-status="${next[0]}">${next[1]}</button></div>
    </article>`;
  }
  async function setStatus(oid, status) {
    if (status === 'cancelled' && !(await confirmBox('Cancel this order?', 'The customer will see that the order was cancelled.', 'Cancel order'))) return;
    try {
      const o = await api('/api/admin/orders/' + oid, { method: 'PATCH', body: { status } });
      S.newIds.delete(oid); upsertOrder(o);
      if (status === 'served') toast(`${icon('check', 18)} ${esc(o.tableName)} served`, 'ok');
    } catch (err) { toast(esc(err.message), 'error'); }
  }
  function upsertOrder(o) {
    const i = S.orders.findIndex(x => x.id === o.id);
    const active = ['new', 'preparing', 'ready'].includes(o.status);
    if (i >= 0) { if (active) S.orders[i] = o; else S.orders.splice(i, 1); } else if (active) S.orders.push(o);
    api('/api/admin/stats?tz=' + TZ).then(s => { S.stats = s; if (S.tab === 'orders') renderOrders(document.getElementById('content')); });
    if (S.tab === 'orders') renderOrders(document.getElementById('content'));
    refreshBadges();
  }
  function connect() {
    if (es) es.close();
    es = new EventSource('/api/admin/stream');
    es.addEventListener('order', e => {
      const o = JSON.parse(e.data);
      const isNew = o.status === 'new' && !S.orders.some(x => x.id === o.id);
      if (isNew) {
        S.newIds.add(o.id); setTimeout(() => S.newIds.delete(o.id), 60000);
        chime(2); notify(`New order · ${o.tableName}`, o.items.map(l => `${l.qty}× ${l.name}`).join(', ') + ' · ' + cur(o.total));
        toast(`${icon('bell', 18)} New order from <b>${esc(o.tableName)}</b>`, 'ok');
        S.mobileCol = 'new';
        if (BILLCFG().autoKot && window.vdDesktop && window.vdDesktop.print) printKot(o);
      }
      upsertOrder(o);
    });
    es.addEventListener('request', e => {
      const q = JSON.parse(e.data); S.requests.push(q);
      chime(1); notify(q.type === 'paid' ? `${q.tableName}: ${q.name || 'A guest'} paid ${cur(q.amount)} by UPI` : `${q.tableName} ${REQ[q.type][1]}`, '');
      toast(`${icon(REQ[q.type][0], 18)} <b>${esc(q.tableName)}</b>&nbsp;${reqText(q)}`);
      if (S.tab === 'orders') renderOrders(document.getElementById('content')); refreshBadges();
    });
    es.addEventListener('request-done', e => { const { id } = JSON.parse(e.data); S.requests = S.requests.filter(q => q.id !== id); if (S.tab === 'orders') renderOrders(document.getElementById('content')); refreshBadges(); });
    es.onopen = () => loadLive().then(() => { if (S.tab === 'orders') renderOrders(document.getElementById('content')); refreshBadges(); }).catch(() => {});
  }
  setInterval(() => { if (S.tab === 'orders' && !document.querySelector('.overlay')) renderOrders(document.getElementById('content')); }, 30000);

  // ---------- sales by date ----------
  const dkey = t => new Date(t - TZ * 60000).toISOString().slice(0, 10);
  const DAY = 86400000;
  function rangeFor(k) {
    const today = dkey(Date.now()), d = new Date(today + 'T00:00:00Z');
    if (k === 'today') return [today, today];
    if (k === 'yesterday') { const y = dkey(Date.now() - DAY); return [y, y]; }
    if (k === '7d') return [dkey(Date.now() - 6 * DAY), today];
    if (k === '30d') return [dkey(Date.now() - 29 * DAY), today];
    if (k === 'month') return [today.slice(0, 8) + '01', today];
    if (k === 'lastmonth') { const f = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)); const l = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 0)); return [f.toISOString().slice(0, 10), l.toISOString().slice(0, 10)]; }
    return null;
  }
  const RANGES = [['today', 'Today'], ['yesterday', 'Yesterday'], ['7d', 'Last 7 days'], ['30d', 'Last 30 days'], ['month', 'This month'], ['lastmonth', 'Last month']];
  const nice = k => new Date(k + 'T00:00:00Z').toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const short = k => new Date(k + 'T00:00:00Z').toLocaleDateString([], { day: 'numeric', month: 'short', timeZone: 'UTC' });
  function setRange(from, to, preset) { S.rFrom = from; S.rTo = to; S.rPreset = preset || null; }
  async function renderHistory(c) {
    if (!S.rFrom) setRange(...rangeFor('today'), 'today');
    const one = S.rFrom === S.rTo;
    const label = one ? (S.rFrom === dkey(Date.now()) ? 'Today' : S.rFrom === dkey(Date.now() - DAY) ? 'Yesterday' : nice(S.rFrom)) : `${nice(S.rFrom)} to ${nice(S.rTo)}`;
    c.innerHTML = `<div class="sales">
      <div class="panel range-bar">
        <div class="presets">${RANGES.map(([k, l]) => `<button class="chip ${S.rPreset === k ? 'on' : ''}" data-preset="${k}">${l}</button>`).join('')}</div>
        <div class="pick">
          <button class="btn btn-sm icon-only" id="prevDay" title="Previous day" aria-label="Previous day">‹</button>
          <label>From <input type="date" class="input" id="rFrom" value="${S.rFrom}" max="${dkey(Date.now())}"></label>
          <label>To <input type="date" class="input" id="rTo" value="${S.rTo}" max="${dkey(Date.now())}"></label>
          <button class="btn btn-sm icon-only" id="nextDay" title="Next day" aria-label="Next day" ${S.rTo >= dkey(Date.now()) ? 'disabled' : ''}>›</button>
        </div>
      </div>
      <h2 class="range-title">${esc(label)}</h2>
      <div id="rep"><div class="empty">Loading…</div></div></div>`;
    c.querySelectorAll('[data-preset]').forEach(b => b.onclick = () => { setRange(...rangeFor(b.dataset.preset), b.dataset.preset); renderHistory(c); });
    const fromI = document.getElementById('rFrom'), toI = document.getElementById('rTo');
    fromI.onchange = () => { if (!fromI.value) return; setRange(fromI.value, toI.value && toI.value >= fromI.value ? toI.value : fromI.value); renderHistory(c); };
    toI.onchange = () => { if (!toI.value) return; setRange(fromI.value && fromI.value <= toI.value ? fromI.value : toI.value, toI.value); renderHistory(c); };
    const shift = n => { const span = (Date.parse(S.rTo) - Date.parse(S.rFrom)) + DAY; const f = Date.parse(S.rFrom) + n * span, t = Date.parse(S.rTo) + n * span; const iso = x => new Date(x).toISOString().slice(0, 10); setRange(iso(f), iso(t)); renderHistory(c); };
    document.getElementById('prevDay').onclick = () => shift(-1);
    document.getElementById('nextDay').onclick = () => shift(1);
    const R = await api(`/api/admin/report?from=${S.rFrom}&to=${S.rTo}&tz=${TZ}`);
    const rep = document.getElementById('rep'); if (!rep) return;
    const B = { new: 'badge-brand', preparing: 'badge-amber', ready: 'badge-green', served: 'badge-grey', cancelled: 'badge-red' };
    const maxDay = Math.max(1, ...R.days.map(d => d.sales));
    const best = R.days.reduce((a, d) => d.sales > (a ? a.sales : 0) ? d : a, null);
    const busyHour = R.hours.indexOf(Math.max(...R.hours));
    const hourLabel = h => new Date(Date.UTC(2000, 0, 1, h)).toLocaleTimeString([], { hour: 'numeric', timeZone: 'UTC' });
    rep.innerHTML = `
      <div class="stats">
        <div class="stat"><small>Sales</small><b>${cur(R.sales)}</b>${R.discounts ? `<span class="sub">after ${cur(R.discounts)} coupon discounts</span>` : ''}</div>
        <div class="stat"><small>Orders</small><b>${R.orders}</b>${R.cancelled ? `<span class="sub">${R.cancelled} cancelled, not counted</span>` : ''}</div>
        <div class="stat"><small>Average order</small><b>${cur(R.average)}</b></div>
        <div class="stat"><small>${one ? 'Busiest hour' : 'Best day'}</small><b>${R.orders ? (one ? `${hourLabel(busyHour)}` : `${short(best.date)}`) : '–'}</b>${R.orders ? `<span class="sub">${one ? `${R.hours[busyHour]} orders` : cur(best.sales)}</span>` : ''}</div>
      </div>
      ${R.orders ? `
      ${!one ? `<div class="panel"><div class="panel-head"><h2>Sales by day</h2><span class="muted">Click a day to open it</span></div>
        <div class="bars ${R.days.length > 16 ? 'dense' : ''}">${R.days.map(d => `<button class="bar" data-day="${d.date}" title="${short(d.date)}: ${cur(d.sales)}, ${d.orders} orders"><span class="v">${d.sales ? cur(d.sales) : ''}</span><span class="f" style="height:${Math.max(d.sales ? 3 : 0, Math.round(d.sales / maxDay * 100))}%"></span><span class="d">${short(d.date)}</span></button>`).join('')}</div></div>` : ''}
      <div class="two">
        <div class="panel"><div class="panel-head"><h2>Top dishes</h2></div>
          <table class="tbl"><thead><tr><th>Dish</th><th class="r">Sold</th><th class="r">Sales</th></tr></thead><tbody>${R.dishes.map(d => `<tr><td>${esc(d.name)}</td><td class="r">${d.qty}</td><td class="r">${cur(d.sales)}</td></tr>`).join('')}</tbody></table></div>
        <div class="panel"><div class="panel-head"><h2>By table</h2></div>
          <table class="tbl"><thead><tr><th>Table</th><th class="r">Orders</th><th class="r">Sales</th></tr></thead><tbody>${R.tables.map(t => `<tr><td>${esc(t.name)}</td><td class="r">${t.orders}</td><td class="r">${cur(t.sales)}</td></tr>`).join('')}</tbody></table></div>
      </div>` : ''}
      <div class="panel"><div class="panel-head"><h2>Orders</h2>${R.list.length ? `<button class="btn btn-sm" id="csv">${icon('download', 16)} Download (Excel)</button>` : ''}</div>
      ${R.list.length ? `<table class="tbl"><thead><tr><th>Order</th><th>Table</th><th class="hide-sm">Items</th><th>Status</th><th class="r">Total</th></tr></thead><tbody>
        ${R.list.map(o => `<tr><td><b>#${o.number}</b><br><span class="muted">${one ? '' : short(dkey(Date.parse(o.createdAt))) + ', '}${new Date(o.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span></td><td>${esc(o.tableName)}${o.customerName ? `<br><span class="muted">${esc(o.customerName)}</span>` : ''}</td>
          <td class="hide-sm">${o.items.map(l => `${l.qty}× ${esc(l.name)}`).join('<br>')}</td><td><span class="badge ${B[o.status]}">${o.status[0].toUpperCase() + o.status.slice(1)}</span></td><td class="r"><b>${cur(o.total)}</b></td></tr>`).join('')}
        </tbody><tfoot><tr><td colspan="3" class="hide-sm"></td><td><b>${R.orders} orders</b></td><td class="r"><b>${cur(R.sales)}</b></td></tr></tfoot></table>`
        : `<div class="empty">${icon('receipt', 40)}<div>No orders ${one ? 'on this day' : 'in these dates'}.</div></div>`}</div>`;
    rep.querySelectorAll('[data-day]').forEach(b => b.onclick = () => { setRange(b.dataset.day, b.dataset.day); renderHistory(c); });
    const csv = document.getElementById('csv');
    if (csv) csv.onclick = () => {
      const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const rows = [['Order', 'Date', 'Time', 'Table', 'Customer', 'Items', 'Status', 'Total'].map(q).join(',')].concat(R.list.map(o => [o.number, dkey(Date.parse(o.createdAt)), new Date(o.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }), o.tableName, o.customerName, o.items.map(l => `${l.qty} x ${l.name}`).join('; '), o.status, o.total].map(q).join(',')));
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + rows.join('\r\n')], { type: 'text/csv' }));
      a.download = `orders-${S.rFrom}${one ? '' : '-to-' + S.rTo}.csv`; a.click();
    };
  }

  // ---------- menu ----------
  async function renderMenu(c) {
    if (!S.menu) { c.innerHTML = '<div class="empty">Loading menu…</div>'; S.menu = await api('/api/admin/menu'); }
    const { categories, items } = S.menu;
    if (!categories.some(x => x.id === S.selCat)) S.selCat = categories[0] ? categories[0].id : null;
    const list = items.filter(i => i.categoryId === S.selCat);
    const cat = categories.find(x => x.id === S.selCat);
    c.innerHTML = `<div class="menu-grid">
      <div class="panel"><div class="panel-head"><h2>Categories</h2><button class="btn btn-sm" id="addCat">${icon('plus', 16)} Add</button></div>
        <div class="cat-list">${categories.map(x => `<button class="cat-item ${x.id === S.selCat ? 'on' : ''}" data-cat="${x.id}"><span>${esc(x.name)}</span><span class="c">${items.filter(i => i.categoryId === x.id).length}</span>
          <span class="mini" data-ren="${x.id}" title="Rename">${icon('edit', 15)}</span><span class="mini" data-delcat="${x.id}" title="Delete">${icon('trash', 15)}</span></button>`).join('') || '<div class="empty" style="padding:20px">Add your first category, like “Starters”.</div>'}</div></div>
      <div class="panel"><div class="panel-head"><h2>${cat ? esc(cat.name) : 'Dishes'} <span class="muted" style="font-weight:600">· ${list.length} dishes</span></h2>${cat ? `<button class="btn btn-primary" id="addItem">${icon('plus', 18)} Add dish</button>` : ''}</div>
        <div>${list.map(it => `<div class="item-row ${it.available ? '' : 'off'}">
          ${it.photo ? `<img class="thumb" src="${esc(it.photo)}" alt="">` : `<div class="thumb">${icon('image', 22)}</div>`}
          <div class="info"><b>${dietMark(it.diet)} ${esc(it.name)} ${it.bestseller ? '<span class="badge badge-amber">Bestseller</span>' : ''}</b><small>${esc(it.description) || '&nbsp;'}</small></div>
          <div class="pr">${cur(it.price)}</div>
          <label class="switch" title="Available today"><input type="checkbox" data-avail="${it.id}" ${it.available ? 'checked' : ''}><span class="track"></span><span class="hide-sm" style="width:72px">${it.available ? 'In stock' : 'Sold out'}</span></label>
          <button class="icon-btn" data-edit="${it.id}" aria-label="Edit">${icon('edit', 18)}</button>
        </div>`).join('') || `<div class="empty">${icon('utensils', 40)}<div>No dishes here yet.</div>${cat ? '<button class="btn btn-primary" style="margin-top:14px" id="addItem2">Add your first dish</button>' : ''}</div>`}</div></div>
    </div>`;
    c.querySelectorAll('[data-cat]').forEach(b => b.onclick = e => {
      if (e.target.closest('[data-ren]')) return renameCat(e.target.closest('[data-ren]').dataset.ren);
      if (e.target.closest('[data-delcat]')) return deleteCat(e.target.closest('[data-delcat]').dataset.delcat);
      S.selCat = b.dataset.cat; renderMenu(c);
    });
    document.getElementById('addCat').onclick = () => renameCat(null);
    ['addItem', 'addItem2'].forEach(k => { const b = document.getElementById(k); if (b) b.onclick = () => editItem(null); });
    c.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => editItem(b.dataset.edit));
    c.querySelectorAll('[data-avail]').forEach(i => i.onchange = async () => {
      try { const it = await api('/api/admin/items/' + i.dataset.avail, { method: 'PUT', body: { available: i.checked } }); Object.assign(S.menu.items.find(x => x.id === it.id), it); renderMenu(c); toast(`${esc(it.name)} is ${it.available ? 'back in stock' : 'marked sold out'}`); }
      catch (err) { toast(esc(err.message), 'error'); }
    });
  }
  function renameCat(cid) {
    const x = cid && S.menu.categories.find(k => k.id === cid);
    const o = modal(`<form><div class="sheet-head"><h3>${x ? 'Rename category' : 'New category'}</h3><button type="button" class="icon-btn" data-close>${icon('x', 20)}</button></div>
      <div class="sheet-body"><label class="field"><span>Category name</span><input class="input" name="n" value="${x ? esc(x.name) : ''}" placeholder="e.g. Starters, Main Course, Drinks" required maxlength="60"></label></div>
      <div class="sheet-foot"><button class="btn btn-primary btn-lg btn-block">${x ? 'Save' : 'Add category'}</button></div></form>`);
    o.querySelector('form').onsubmit = async e => {
      e.preventDefault(); const name = new FormData(e.target).get('n');
      try {
        if (x) Object.assign(x, await api('/api/admin/categories/' + x.id, { method: 'PUT', body: { name } }));
        else { const nc = await api('/api/admin/categories', { method: 'POST', body: { name } }); S.menu.categories.push(nc); S.selCat = nc.id; }
        o.close(); renderMenu(document.getElementById('content'));
      } catch (err) { toast(esc(err.message), 'error'); }
    };
  }
  async function deleteCat(cid) {
    const x = S.menu.categories.find(k => k.id === cid);
    if (!(await confirmBox(`Delete “${esc(x.name)}”?`, 'Only empty categories can be deleted.'))) return;
    try { await api('/api/admin/categories/' + cid, { method: 'DELETE' }); S.menu.categories = S.menu.categories.filter(k => k.id !== cid); renderMenu(document.getElementById('content')); }
    catch (err) { toast(esc(err.message), 'error'); }
  }
  function editItem(iid) {
    const it = iid ? S.menu.items.find(x => x.id === iid) : { name: '', description: '', price: '', diet: 'veg', categoryId: S.selCat, available: true, bestseller: false, spicy: false, photo: '' };
    let photo = it.photo, photoChanged = false;
    const o = modal(`<form><div class="sheet-head"><h3>${iid ? 'Edit dish' : 'Add a dish'}</h3><button type="button" class="icon-btn" data-close>${icon('x', 20)}</button></div>
      <div class="sheet-body form">
        <div class="photo-drop" id="pd" tabindex="0">${photo ? `<img src="${esc(photo)}" alt="">` : ''}<div>${icon('image', 30)}<div>Add a photo</div><small>Dishes with photos sell better</small></div>${photo ? `<span class="btn btn-sm change">${icon('edit', 15)} Change</span>` : ''}</div>
        <label class="field"><span>Dish name</span><input class="input" name="name" value="${esc(it.name)}" required maxlength="80" placeholder="e.g. Paneer Tikka"></label>
        <div class="row2">
          <label class="field"><span>Price (${esc(S.me.restaurant.currency)})</span><input class="input" name="price" type="number" inputmode="decimal" min="0" step="0.01" value="${it.price}" required placeholder="249"></label>
          <label class="field"><span>Category</span><select class="select" name="categoryId">${S.menu.categories.map(k => `<option value="${k.id}" ${k.id === it.categoryId ? 'selected' : ''}>${esc(k.name)}</option>`).join('')}</select></label>
        </div>
        <label class="field"><span>Description (optional)</span><textarea class="textarea" name="description" maxlength="300" placeholder="What's in it, portion size, how it's served">${esc(it.description)}</textarea></label>
        <div class="field"><span>Type</span><div class="choice">
          ${[['veg', 'Veg'], ['nonveg', 'Non-veg'], ['egg', 'Egg'], ['none', 'Not food / skip']].map(([v, l]) => `<label><input type="radio" name="diet" value="${v}" ${it.diet === v ? 'checked' : ''}><span>${dietMark(v)} ${l}</span></label>`).join('')}
        </div></div>
        <div class="toggles">
          <label class="switch"><input type="checkbox" name="available" ${it.available ? 'checked' : ''}><span class="track"></span>In stock (customers can order it)</label>
          <label class="switch"><input type="checkbox" name="bestseller" ${it.bestseller ? 'checked' : ''}><span class="track"></span>Show “Bestseller” tag</label>
          <label class="switch"><input type="checkbox" name="spicy" ${it.spicy ? 'checked' : ''}><span class="track"></span>Spicy</label>
        </div>
      </div>
      <div class="sheet-foot" style="display:flex;gap:10px">${iid ? `<button type="button" class="btn btn-danger" id="del">${icon('trash', 18)} Delete</button>` : ''}<button class="btn btn-primary btn-lg" style="flex:1">${iid ? 'Save changes' : 'Add dish'}</button></div></form>`, { wide: true });
    const pd = o.querySelector('#pd');
    pd.onclick = async () => {
      const f = await pickFile(); if (!f) return;
      try { photo = await readImage(f, 1200); photoChanged = true; pd.innerHTML = `<img src="${photo}" alt=""><span class="btn btn-sm change">${icon('edit', 15)} Change</span>`; }
      catch (err) { toast(esc(err.message), 'error'); }
    };
    o.querySelector('form').onsubmit = async e => {
      e.preventDefault(); const f = new FormData(e.target); const btn = e.submitter; if (btn) btn.disabled = true;
      const body = { name: f.get('name'), price: f.get('price'), categoryId: f.get('categoryId'), description: f.get('description'), diet: f.get('diet'), available: !!f.get('available'), bestseller: !!f.get('bestseller'), spicy: !!f.get('spicy') };
      if (photoChanged) body.photo = photo;
      try {
        const saved = await api(iid ? '/api/admin/items/' + iid : '/api/admin/items', { method: iid ? 'PUT' : 'POST', body });
        if (iid) Object.assign(it, saved); else S.menu.items.push(saved);
        S.selCat = saved.categoryId; o.close(); renderMenu(document.getElementById('content')); toast(`${icon('check', 18)} ${esc(saved.name)} saved`, 'ok');
      } catch (err) { toast(esc(err.message), 'error'); if (btn) btn.disabled = false; }
    };
    const del = o.querySelector('#del');
    if (del) del.onclick = async () => {
      if (!(await confirmBox(`Delete ${esc(it.name)}?`, 'It will be removed from your menu. Tip: use “Sold out” instead if it is only out for today.'))) return;
      await api('/api/admin/items/' + iid, { method: 'DELETE' }); S.menu.items = S.menu.items.filter(x => x.id !== iid); o.close(); renderMenu(document.getElementById('content'));
    };
  }

  // ---------- tables & QR ----------
  async function renderTables(c) {
    c.innerHTML = '<div class="empty">Loading tables…</div>';
    S.tables = await api('/api/admin/tables');
    const isLocal = /localhost|127\.0\.0\.1/.test(S.me.baseUrl) && !S.me.publicUrlSet;
    const busy = new Set(S.orders.map(o => o.tableName));
    c.innerHTML = `
      ${isLocal ? `<div class="hint">${icon('wifi', 20)}<div><b>Phones can't open “localhost”.</b> To test with a phone on the same Wi-Fi, open this admin at ${S.me.lan.map(ip => `<code>http://${ip}:${S.me.port}</code>`).join(' or ') || 'your computer\'s network address'} and the QR codes will update. Once the app is online, they will use your website address.</div></div>` : ''}
      <div class="panel" style="margin-bottom:18px"><div class="panel-head"><div><h2>${S.tables.length} tables</h2><span class="muted" style="font-size:14px">Each table has its own QR code. Orders show the table number.</span></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="addMany">${icon('plus', 18)} Add several</button><button class="btn btn-primary" id="addOne">${icon('plus', 18)} Add table</button>${S.tables.length ? `<a class="btn btn-dark" href="/print-qr" target="_blank">${icon('printer', 18)} Print all QR cards</a>` : ''}</div></div></div>
      <div class="tables-grid">${S.tables.map(t => `<div class="tcard ${t.active ? '' : 'off'}">
        <div class="tname"><b>${esc(t.name)}</b>${busy.has(t.name) ? '<span class="badge badge-green live">● Ordering now</span>' : t.active ? '' : '<span class="badge badge-grey">Off</span>'}</div>
        <div class="qrbox">${t.qr}</div>
        <div class="acts">
          <a class="btn btn-sm" href="/api/admin/tables/${t.id}/qr.png" download>${icon('download', 16)} PNG</a>
          <a class="btn btn-sm" href="${esc(t.url)}" target="_blank">${icon('eye', 16)} Test</a>
          <button class="btn btn-sm" data-copy="${esc(t.url)}">${icon('copy', 16)} Copy link</button>
          <button class="btn btn-sm" data-tedit="${t.id}">${icon('settings', 16)} Options</button>
          <button class="btn btn-sm btn-dark span2" data-tbill="${t.id}">${icon('receipt', 16)} Bill and split</button>
        </div></div>`).join('') || `<div class="empty" style="grid-column:1/-1">${icon('qr', 44)}<div>No tables yet. Add your tables to get their QR codes.</div></div>`}</div>`;
    document.getElementById('addOne').onclick = () => addTables(false);
    document.getElementById('addMany').onclick = () => addTables(true);
    c.querySelectorAll('[data-copy]').forEach(b => b.onclick = async () => { try { await navigator.clipboard.writeText(b.dataset.copy); toast('Link copied'); } catch { prompt('Copy this link', b.dataset.copy); } });
    c.querySelectorAll('[data-tedit]').forEach(b => b.onclick = () => tableOptions(S.tables.find(t => t.id === b.dataset.tedit)));
    c.querySelectorAll('[data-tbill]').forEach(b => b.onclick = () => counterBill(b.dataset.tbill));
  }
  function addTables(many) {
    const nums = S.tables.map(t => parseInt((t.name.match(/\d+/) || [0])[0], 10)).filter(Boolean);
    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    const o = modal(`<form><div class="sheet-head"><h3>${many ? 'Add several tables' : 'Add a table'}</h3><button type="button" class="icon-btn" data-close>${icon('x', 20)}</button></div>
      <div class="sheet-body form">${many
        ? `<div class="row2"><label class="field"><span>From number</span><input class="input" type="number" name="from" min="1" value="${next}" required></label><label class="field"><span>How many</span><input class="input" type="number" name="count" min="1" max="100" value="10" required></label></div>
           <label class="field"><span>Name them</span><input class="input" name="prefix" value="Table" maxlength="30"><small>Creates “Table ${next}”, “Table ${next + 1}” and so on.</small></label>`
        : `<label class="field"><span>Table name or number</span><input class="input" name="name" value="Table ${next}" required maxlength="40"><small>Anything your staff will recognise, like “Table 12”, “Terrace 3” or “Cabin A”.</small></label>`}</div>
      <div class="sheet-foot"><button class="btn btn-primary btn-lg btn-block">Create QR code${many ? 's' : ''}</button></div></form>`);
    o.querySelector('form').onsubmit = async e => {
      e.preventDefault(); const f = new FormData(e.target);
      const names = many ? Array.from({ length: Math.min(100, +f.get('count')) }, (_, i) => `${(f.get('prefix') || 'Table').trim()} ${+f.get('from') + i}`) : [f.get('name')];
      try { const made = await api('/api/admin/tables', { method: 'POST', body: { names } }); o.close(); toast(`${icon('check', 18)} ${made.length} QR code${made.length > 1 ? 's' : ''} ready`, 'ok'); renderTables(document.getElementById('content')); }
      catch (err) { toast(esc(err.message), 'error'); }
    };
  }
  function tableOptions(t) {
    const o = modal(`<form><div class="sheet-head"><h3>${esc(t.name)}</h3><button type="button" class="icon-btn" data-close>${icon('x', 20)}</button></div>
      <div class="sheet-body form">
        <label class="field"><span>Table name</span><input class="input" name="name" value="${esc(t.name)}" maxlength="40"></label>
        <label class="switch"><input type="checkbox" name="active" ${t.active ? 'checked' : ''}><span class="track"></span>Table is in use (QR code works)</label>
        <div class="toggles"><b>Make a new QR code</b><span class="muted" style="font-size:14px">Use this if a QR sticker was copied or misused. The old code stops working and you'll need to print the new one.</span><button type="button" class="btn" id="regen">${icon('refresh', 18)} Make new QR code</button></div>
      </div>
      <div class="sheet-foot" style="display:flex;gap:10px"><button type="button" class="btn btn-danger" id="tdel">${icon('trash', 18)} Delete table</button><button class="btn btn-primary btn-lg" style="flex:1">Save</button></div></form>`);
    const done = () => { o.close(); renderTables(document.getElementById('content')); };
    o.querySelector('form').onsubmit = async e => { e.preventDefault(); const f = new FormData(e.target); await api('/api/admin/tables/' + t.id, { method: 'PUT', body: { name: f.get('name'), active: !!f.get('active') } }); done(); };
    o.querySelector('#regen').onclick = async () => { if (!(await confirmBox('Make a new QR code?', 'The printed QR for this table will stop working.', 'Make new code'))) return; await api('/api/admin/tables/' + t.id, { method: 'PUT', body: { newCode: true } }); toast('New QR code made. Print it again.'); done(); };
    o.querySelector('#tdel').onclick = async () => { if (!(await confirmBox(`Delete ${esc(t.name)}?`, 'Its QR code will stop working.'))) return; await api('/api/admin/tables/' + t.id, { method: 'DELETE' }); done(); };
  }

  // ---------- branding ----------
  const PRESETS = ['#E4572E', '#C2410C', '#B91C1C', '#BE185D', '#7C3AED', '#1D4ED8', '#0F766E', '#15803D', '#A16207', '#1A1A1A'];
  function renderBranding(c) {
    const r = S.me.restaurant;
    const draft = { logo: r.logo, cover: r.cover, brandColor: r.brandColor };
    const changed = {};
    c.innerHTML = `<div class="brand-grid"><form class="panel" id="bf"><div class="panel-body form">
        <div class="sub">Logo & photos</div>
        <div class="logo-up"><div class="lg" id="lgp">${r.logo ? `<img src="${esc(r.logo)}" alt="">` : icon('image', 28)}</div>
          <div style="display:grid;gap:8px"><b>Logo</b><span class="muted" style="font-size:13px">Square image works best (PNG or JPG).</span><div style="display:flex;gap:8px"><button type="button" class="btn btn-sm" id="lgBtn">${icon('image', 16)} ${r.logo ? 'Change' : 'Upload'}</button>${r.logo ? `<button type="button" class="btn btn-sm btn-ghost" id="lgRm">Remove</button>` : ''}</div></div></div>
        <div class="field"><span>Cover photo (top of the menu)</span><div class="cover-up" id="cvp" style="${r.cover ? `background-image:url('${esc(r.cover)}')` : ''}"><button type="button" class="btn btn-sm" id="cvBtn">${icon('image', 16)} ${r.cover ? 'Change' : 'Upload'}</button>${r.cover ? '<button type="button" class="btn btn-sm" id="cvRm">Remove</button>' : ''}</div></div>
        <div class="sub">Name & colour</div>
        <label class="field"><span>Restaurant name</span><input class="input" name="name" value="${esc(r.name)}" maxlength="80" required></label>
        <label class="field"><span>Short line under the name</span><input class="input" name="tagline" value="${esc(r.tagline)}" maxlength="120" placeholder="e.g. Home-style Indian kitchen · Vashi"></label>
        <div class="field"><span>Brand colour</span><div class="swatches">${PRESETS.map(h => `<button type="button" class="sw ${h.toLowerCase() === r.brandColor.toLowerCase() ? 'on' : ''}" style="background:${h}" data-sw="${h}" aria-label="${h}"></button>`).join('')}<input type="color" class="color-in" id="cin" value="${r.brandColor}" title="Pick any colour"></div><small>Used for buttons and highlights on the customer menu.</small></div>
        <div class="sub">Social media & links</div>
        ${SOCIALS.map(([k, l, ic]) => `<label class="social-field"><span class="si">${icon(ic, 20)}</span><span class="field" style="flex:1"><input class="input" name="s_${k}" value="${esc(r.socials[k] || '')}" placeholder="${l} link${k === 'whatsapp' ? ' (e.g. https://wa.me/91XXXXXXXXXX)' : ''}" aria-label="${l}"></span></label>`).join('')}
        <div class="sub">Contact</div>
        <div class="row2"><label class="field"><span>Phone</span><input class="input" name="phone" value="${esc(r.phone)}" maxlength="30"></label><label class="field"><span>Currency symbol</span><input class="input" name="currency" value="${esc(r.currency)}" maxlength="4"></label></div>
        <label class="field"><span>Address</span><input class="input" name="address" value="${esc(r.address)}" maxlength="200"></label>
        <label class="field"><span>Note at the bottom of the menu</span><input class="input" name="footerNote" value="${esc(r.footerNote)}" maxlength="120" placeholder="e.g. All prices include taxes."></label>
        <div class="save-bar"><button class="btn btn-primary btn-lg">${icon('check', 18)} Save branding</button></div>
      </div></form>
      <div class="preview"><div class="sub" style="margin:0 0 10px;text-align:center">Live preview</div><div class="phone"><iframe id="pv" src="/m/${r.slug}?preview=1" title="Menu preview"></iframe></div></div></div>`;
    const setColor = h => { draft.brandColor = h; changed.brandColor = h; applyBrand(h); c.querySelectorAll('.sw').forEach(s => s.classList.toggle('on', s.dataset.sw.toLowerCase() === h.toLowerCase())); document.getElementById('cin').value = h; };
    c.querySelectorAll('[data-sw]').forEach(b => b.onclick = () => setColor(b.dataset.sw));
    document.getElementById('cin').oninput = e => setColor(e.target.value);
    document.getElementById('lgBtn').onclick = async () => { const f = await pickFile(); if (!f) return; const d = await readImage(f, 512, true); changed.logo = d; document.getElementById('lgp').innerHTML = `<img src="${d}" alt="">`; };
    const lgRm = document.getElementById('lgRm'); if (lgRm) lgRm.onclick = () => { changed.logo = ''; document.getElementById('lgp').innerHTML = icon('image', 28); };
    document.getElementById('cvBtn').onclick = async () => { const f = await pickFile(); if (!f) return; const d = await readImage(f, 1400); changed.cover = d; document.getElementById('cvp').style.backgroundImage = `url('${d}')`; };
    const cvRm = document.getElementById('cvRm'); if (cvRm) cvRm.onclick = () => { changed.cover = ''; document.getElementById('cvp').style.backgroundImage = ''; };
    document.getElementById('bf').onsubmit = async e => {
      e.preventDefault(); const f = new FormData(e.target); const btn = e.submitter; btn.disabled = true;
      const socials = {}; SOCIALS.forEach(([k]) => { let v = (f.get('s_' + k) || '').trim(); if (v && !/^https?:\/\//i.test(v)) v = 'https://' + v; socials[k] = v; });
      const body = { name: f.get('name'), tagline: f.get('tagline'), phone: f.get('phone'), currency: f.get('currency'), address: f.get('address'), footerNote: f.get('footerNote'), socials, ...changed };
      try { S.me.restaurant = await api('/api/admin/settings', { method: 'PUT', body }); toast(`${icon('check', 18)} Branding saved`, 'ok'); renderShell(); }
      catch (err) { toast(esc(err.message), 'error'); btn.disabled = false; }
    };
  }

  // ---------- settings ----------
  function renderSettings(c) {
    const r = S.me.restaurant;
    const menuUrl = `${S.me.baseUrl}/m/${r.slug}`;
    const a = r.access || {}, lic = r.license;
    const planTxt = a.plan === 'lifetime' ? 'Lifetime' : (a.plan === 'yearly' || a.plan === 'monthly') ? `${a.plan === 'monthly' ? 'Monthly' : 'Yearly'}, until ${new Date(a.until).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}` : `Free trial, ${a.daysLeft} day${a.daysLeft === 1 ? '' : 's'} left`;
    const keyTxt = lic ? (lic.code || lic.key.slice(0, 18) + '…') : '';
    c.innerHTML = `<div style="display:grid;gap:18px;max-width:720px">
      <div class="panel" id="planPanel"><div class="panel-head"><h2>Plan and license</h2>${endingSoon(a) || (lic && lic.updatesUntil && lic.updatesUntil < new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10)) ? '<button class="btn btn-sm btn-primary" data-license>Enter license key</button>' : ''}</div><div class="panel-body form">
        <div class="lic-box" style="margin:0"><span>Plan</span><b>${esc(planTxt)}</b>${lic ? `<span>Licensed to</span><b>${esc(lic.to)}</b><span>License key</span><b style="font-family:ui-monospace,Consolas,monospace;word-break:break-all">${esc(keyTxt)}</b>${lic.at ? `<span>Activated</span><b>${new Date(lic.at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</b>` : ''}` : ''}<span>Updates</span><b>${a.plan === 'trial' ? 'Included after you buy' : lic && lic.updatesUntil ? (lic.updatesUntil >= new Date().toISOString().slice(0, 10) ? 'Included until ' : 'Ended on ') + new Date(lic.updatesUntil + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Included'}</b></div>
        ${a.plan === 'lifetime' && lic && lic.updatesUntil && lic.updatesUntil < new Date().toISOString().slice(0, 10) ? `<p class="muted" style="margin:0">Your app keeps working. To get the newest features again, renew updates on <a href="https://wa.me/918928246726?text=${encodeURIComponent('Hi Veyra, I want to renew Veyra Dine In updates for ' + r.name)}" target="_blank">WhatsApp +91 89282 46726</a> and enter the new key above.</p>` : ''}
        <div style="display:flex;gap:8px;flex-wrap:wrap">${lic ? `<button class="btn" id="cpyKey">${icon('copy', 18)} Copy license key</button>` : `<a class="btn btn-primary" href="${esc(buyLink('lifetime'))}" target="_blank">Buy lifetime ${inr(S.me.plans.lifetime)}</a><a class="btn" href="${esc(buyLink('yearly'))}" target="_blank">Buy yearly ${inr(S.me.plans.yearly)}</a><a class="btn" href="${esc(buyLink('monthly'))}" target="_blank">Buy monthly ${inr(S.me.plans.monthly)}</a>`}<a class="btn" href="https://dinein.veyracreatives.com/download/Veyra-Dine-In-Setup.exe">${icon('download', 18)} Download Windows app</a></div>
      </div></div>
      <form class="panel" id="ideaF"><div class="panel-head"><div><h2>Suggest a feature or ask for custom work</h2><span class="muted" style="font-size:14px">Tell Veyra what you'd like next, or what you need built for your restaurant. We reply on WhatsApp.</span></div></div><div class="panel-body form">
        <div class="wseg" style="display:flex;gap:8px;flex-wrap:wrap"><label class="switch"><input type="radio" name="type" value="feature" checked> Feature idea</label><label class="switch"><input type="radio" name="type" value="custom"> Custom build</label></div>
        <label class="field"><span>Your message</span><textarea class="input" name="message" rows="3" maxlength="2000" required placeholder="E.g. a kitchen screen, or 3 outlets with one dashboard"></textarea></label>
        <button class="btn btn-primary" style="justify-self:start">Send to Veyra</button>
      </div></form>
      <div class="panel"><div class="panel-head"><h2>Your restaurant</h2></div><div class="panel-body form">
        <label class="field"><span>Restaurant ID (used to log in)</span><input class="input" value="${esc(r.slug)}" readonly></label>
        <label class="field"><span>Menu link without a table (view only, for Instagram bio or Google)</span><div style="display:flex;gap:8px"><input class="input" value="${esc(menuUrl)}" readonly><button class="btn" id="cpy">${icon('copy', 18)}</button></div></label>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="toHist">${icon('history', 18)} Sales by date</button><button class="btn" id="toOffers">${icon('star', 18)} Coupons</button></div>
      </div></div>
      <form class="panel" id="upf"><div class="panel-head"><div><h2>Split bill and UPI payments</h2><span class="muted" style="font-size:14px">Guests can split the bill by who ate what and pay their share straight to you by UPI. No fees, no payment gateway.</span></div></div><div class="panel-body form">
        <label class="field"><span>Your UPI ID</span><input class="input" name="upiId" placeholder="e.g. masalatable@okaxis" value="${esc(r.upiId || '')}"><small>Find it in GPay, PhonePe or Paytm under your profile. Leave empty to have guests pay at the counter.</small></label>
        <label class="field"><span>Name shown in the UPI app</span><input class="input" name="upiName" placeholder="${esc(r.name)}" value="${esc(r.upiName || '')}"></label>
        <button class="btn btn-primary" style="justify-self:start">Save UPI details</button>
      </div></form>
      <div class="panel" id="gpan"><div class="panel-head"><div><h2>Guest log in</h2><span class="muted" style="font-size:14px">Guests log in with their mobile number or email and a password before they send an order. You get a list of your regular customers.</span></div></div><div class="panel-body form">
        <label class="switch"><input type="checkbox" id="glog" ${r.guestLogin !== false ? 'checked' : ''}><span class="track"></span>Guests must log in before ordering</label>
        <div id="glist"><div class="muted">Loading guests…</div></div>
      </div></div>
      <form class="panel" id="bpf"><div class="panel-head"><div><h2>Bill printer</h2><span class="muted" style="font-size:14px">Print a small bill or a kitchen ticket (KOT) on a thermal receipt printer.</span></div></div><div class="panel-body form">
        <div class="field"><span>Paper width</span><div class="wseg"><button type="button" data-w="58" class="${BILLCFG().width === '58' ? 'on' : ''}">58 mm (2 inch)</button><button type="button" data-w="80" class="${BILLCFG().width === '80' ? 'on' : ''}">80 mm (3 inch)</button></div></div>
        ${window.vdDesktop && window.vdDesktop.printers ? `<label class="field"><span>Printer on this computer</span><select class="input" id="prn"><option value="">Ask every time</option></select><small>Pick your receipt printer to print straight away without a pop-up.</small></label>` : `<small class="muted">On this device the bill opens the normal print window. In the Windows app you can pick the printer once and print with one tap.</small>`}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><label class="field"><span>GSTIN (optional)</span><input class="input" name="gstin" maxlength="20" value="${esc(BILLCFG().gstin)}" placeholder="27ABCDE1234F1Z5"></label><label class="field"><span>FSSAI no. (optional)</span><input class="input" name="fssai" maxlength="20" value="${esc(BILLCFG().fssai)}"></label></div>
        <label class="field"><span>Line at the bottom of the bill</span><input class="input" name="footer" maxlength="120" value="${esc(BILLCFG().footer)}"></label>
        <label class="switch"><input type="checkbox" name="showUpi" ${BILLCFG().showUpi ? 'checked' : ''}><span class="track"></span>Print a UPI QR for the amount due${r.upiId ? '' : ' (add your UPI ID above first)'}</label>
        ${window.vdDesktop && window.vdDesktop.print ? `<label class="switch"><input type="checkbox" name="autoKot" ${BILLCFG().autoKot ? 'checked' : ''}><span class="track"></span>Print a kitchen ticket (KOT) for every new order automatically</label>` : ''}
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-primary">Save printer settings</button><button type="button" class="btn" id="testp">${icon('printer', 18)} Print a test bill</button></div>
      </div></form>
      <form class="panel" id="pf"><div class="panel-head"><h2>Change password</h2></div><div class="panel-body form">
        <label class="field"><span>Current password</span><input class="input" type="password" name="current" required></label>
        <label class="field"><span>New password</span><input class="input" type="password" name="next" minlength="6" required><small>At least 6 characters. Other devices will be logged out.</small></label>
        <button class="btn btn-primary" style="justify-self:start">Update password</button>
      </div></form>
      <button class="btn btn-lg" id="lo" style="justify-self:start">${icon('logout', 18)} Log out</button>
    </div>`;
    const ck = document.getElementById('cpyKey'); if (ck) ck.onclick = async () => { const k = lic.code || lic.key; try { await navigator.clipboard.writeText(k); toast('License key copied'); } catch { prompt('Your license key', k); } };
    c.querySelectorAll('[data-license]').forEach(b => b.onclick = licenseModal);
    document.getElementById('ideaF').onsubmit = async e => { e.preventDefault(); const f = new FormData(e.target); try { await api('/api/requests', { method: 'POST', body: { type: f.get('type'), message: f.get('message') } }); e.target.reset(); toast(`${icon('check', 18)} Sent. Thank you!`, 'ok'); } catch (err) { toast(esc(err.message), 'error'); } };
    document.getElementById('cpy').onclick = async () => { try { await navigator.clipboard.writeText(menuUrl); toast('Link copied'); } catch { prompt('Copy this link', menuUrl); } };
    document.getElementById('toHist').onclick = () => go('history');
    document.getElementById('toOffers').onclick = () => go('offers');
    document.getElementById('upf').onsubmit = async e => {
      e.preventDefault(); const f = new FormData(e.target);
      try { S.me.restaurant = await api('/api/admin/settings', { method: 'PUT', body: { upiId: f.get('upiId'), upiName: f.get('upiName') } }); toast(`${icon('check', 18)} UPI details saved`, 'ok'); }
      catch (err) { toast(esc(err.message), 'error'); }
    };
    { let w = BILLCFG().width; const bf = document.getElementById('bpf');
      bf.querySelectorAll('[data-w]').forEach(b => b.onclick = () => { w = b.dataset.w; bf.querySelectorAll('[data-w]').forEach(x => x.classList.toggle('on', x === b)); });
      const prn = document.getElementById('prn');
      if (prn) window.vdDesktop.printers().then(list => { prn.innerHTML = '<option value="">Ask every time</option>' + list.map(p => `<option value="${esc(p.name)}">${esc(p.label)}${p.isDefault ? ' (default)' : ''}</option>`).join(''); prn.value = lsGet('vd_printer'); }).catch(() => {});
      const saveBill = async () => { const f = new FormData(bf); if (prn) lsSet('vd_printer', prn.value); S.me.restaurant = await api('/api/admin/settings', { method: 'PUT', body: { bill: { width: w, gstin: f.get('gstin'), fssai: f.get('fssai'), footer: f.get('footer'), showUpi: !!f.get('showUpi'), autoKot: !!f.get('autoKot') } } }); };
      bf.onsubmit = async e => { e.preventDefault(); try { await saveBill(); toast(`${icon('check', 18)} Printer settings saved`, 'ok'); } catch (err) { toast(esc(err.message), 'error'); } };
      document.getElementById('testp').onclick = async () => { try { await saveBill(); await printTestBill(); } catch (err) { toast(esc(err.message), 'error'); } };
    }
    document.getElementById('glog').onchange = async e => { try { S.me.restaurant = await api('/api/admin/settings', { method: 'PUT', body: { guestLogin: e.target.checked } }); toast(e.target.checked ? 'Guests now log in before ordering' : 'Guests can order without logging in', 'ok'); } catch (err) { toast(esc(err.message), 'error'); } };
    loadGuests();
    document.getElementById('lo').onclick = async () => { await api('/api/admin/logout', { method: 'POST' }); renderLogin(); };
    document.getElementById('pf').onsubmit = async e => {
      e.preventDefault(); const f = new FormData(e.target);
      try { await api('/api/admin/password', { method: 'POST', body: { current: f.get('current'), next: f.get('next') } }); e.target.reset(); toast('Password updated', 'ok'); }
      catch (err) { toast(esc(err.message), 'error'); }
    };
  }

  // ---------- guest accounts ----------
  async function loadGuests() {
    const box = document.getElementById('glist'); if (!box) return;
    let list; try { list = await api('/api/admin/guests'); } catch (err) { box.innerHTML = `<div class="muted">${esc(err.message)}</div>`; return; }
    let q = '';
    const draw = () => {
      const f = list.filter(g => !q || (g.name + ' ' + g.phone + ' ' + g.email).toLowerCase().includes(q.toLowerCase()));
      box.querySelector('#gtb').innerHTML = f.length ? f.slice(0, 200).map(g => `<tr><td><b>${esc(g.name)}</b><div class="muted" style="font-size:13px">${esc(g.phone || g.email)}</div></td><td class="hide-sm">${g.orders}</td><td>${cur(g.spent)}</td><td class="hide-sm">${new Date(g.lastAt).toLocaleDateString([], { day: 'numeric', month: 'short' })}</td><td style="text-align:right"><button type="button" class="btn btn-sm" data-gpw="${g.id}">Reset password</button></td></tr>`).join('') : `<tr><td colspan="5" class="muted">${list.length ? 'No guest matches.' : 'No guest accounts yet. They appear here after guests log in to order.'}</td></tr>`;
      box.querySelectorAll('[data-gpw]').forEach(b => b.onclick = () => resetGuest(list.find(g => g.id === b.dataset.gpw)));
    };
    box.innerHTML = `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><b style="flex:1">${list.length} guest account${list.length === 1 ? '' : 's'}</b>${list.length ? `<input class="input" id="gq" placeholder="Search name or number" style="max-width:220px"><button type="button" class="btn btn-sm" id="gcsv">${icon('download', 16)} Export</button>` : ''}</div>
      <div style="overflow-x:auto;margin-top:10px"><table class="tbl"><thead><tr><th>Guest</th><th class="hide-sm">Orders</th><th>Spent</th><th class="hide-sm">Last visit</th><th></th></tr></thead><tbody id="gtb"></tbody></table></div>`;
    draw();
    const gq = box.querySelector('#gq'); if (gq) gq.oninput = () => { q = gq.value; draw(); };
    const gc = box.querySelector('#gcsv'); if (gc) gc.onclick = () => {
      const cell = v => /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v;
      const csv = [['Name', 'Mobile', 'Email', 'Orders', 'Spent', 'First visit', 'Last visit'], ...list.map(g => [g.name, g.phone, g.email, g.orders, g.spent, g.createdAt.slice(0, 10), g.lastAt.slice(0, 10)])].map(r => r.map(cell).join(',')).join('\n');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'guests.csv'; a.click();
    };
  }
  function resetGuest(g) {
    const pw = String(Math.floor(1000 + Math.random() * 9000));
    confirmBox(`Reset password for ${g.name}?`, `Their new password will be ${pw}. Tell them, and they can log in with it.`, 'Reset password').then(async ok => {
      if (!ok) return;
      try { await api(`/api/admin/guests/${g.id}/password`, { method: 'POST', body: { password: pw } }); toast(`${icon('check', 18)} New password for ${esc(g.name)}: <b>${pw}</b>`, 'ok'); } catch (err) { toast(esc(err.message), 'error'); }
    });
  }

  // ---------- small bill / KOT printing (58 or 80 mm thermal) ----------
  const BILLCFG = () => Object.assign({ width: '80', gstin: '', fssai: '', footer: '', autoKot: false, showUpi: true }, S.me.restaurant.bill || {});
  const lsGet = k => { try { return localStorage.getItem(k) || ''; } catch { return ''; } };
  const lsSet = (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch {} };
  const stamp = d => new Date(d || Date.now()).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  const pm = v => fmtMoney(v, S.me.restaurant.currency).replace(/\.00$/, '');
  function receiptDoc(inner) {
    const w = BILLCFG().width === '58' ? 58 : 80, narrow = w === 58;
    return `<!doctype html><html><head><meta charset="utf-8"><title>Bill</title><style>
      @page { size: ${w}mm auto; margin: 0 }
      * { box-sizing: border-box } html, body { margin: 0; background: #fff }
      body { width: ${w}mm; padding: 3mm ${narrow ? 2.5 : 4}mm 8mm; font: ${narrow ? 11 : 12.5}px/1.35 "Segoe UI", Arial, sans-serif; color: #000 }
      .c { text-align: center } .b { font-weight: 700 } .sm { font-size: ${narrow ? 9.5 : 10.5}px } .xl { font-size: ${narrow ? 18 : 22}px; font-weight: 800; letter-spacing: .02em }
      h1 { font-size: ${narrow ? 15 : 17}px; margin: 0 0 1mm; text-align: center; text-transform: uppercase; letter-spacing: .04em }
      hr { border: 0; border-top: 1px dashed #000; margin: 2mm 0 }
      .r { display: flex; justify-content: space-between; gap: 2mm } .r > :first-child { flex: 1; min-width: 0; overflow-wrap: anywhere } .r > :last-child { white-space: nowrap }
      .it { margin: .8mm 0 } .it small { display: block; font-size: ${narrow ? 9.5 : 10.5}px }
      .tot { font-size: ${narrow ? 14 : 16}px; font-weight: 800; margin-top: 1mm }
      .qr { width: ${narrow ? 30 : 36}mm; height: ${narrow ? 30 : 36}mm; margin: 2mm auto 1mm } .qr svg { width: 100%; height: 100% }
      .kq { font-size: ${narrow ? 14 : 16}px; font-weight: 800; min-width: 7mm; display: inline-block }
    </style></head><body>${inner}</body></html>`;
  }
  function billHeader() {
    const r = S.me.restaurant, c = BILLCFG();
    return `<h1>${esc(r.name)}</h1>${r.address ? `<div class="c sm">${esc(r.address)}</div>` : ''}${r.phone ? `<div class="c sm">Ph: ${esc(r.phone)}</div>` : ''}${c.gstin ? `<div class="c sm">GSTIN: ${esc(c.gstin)}</div>` : ''}${c.fssai ? `<div class="c sm">FSSAI: ${esc(c.fssai)}</div>` : ''}`;
  }
  async function printDoc(html) {
    const d = window.vdDesktop;
    if (d && d.print) {
      const name = lsGet('vd_printer');
      const res = await d.print(html, { deviceName: name || undefined, silent: !!name }).catch(e => ({ ok: false, error: e.message }));
      if (res && !res.ok && res.error && !/cancel/i.test(res.error)) toast('Could not print: ' + esc(res.error), 'error');
      return;
    }
    const f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0';
    document.body.append(f);
    const doc = f.contentDocument; doc.open(); doc.write(html); doc.close();
    setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch {} setTimeout(() => f.remove(), 60000); }, 350);
  }
  async function printBill(B) {
    const c = BILLCFG(), r = S.me.restaurant;
    const items = []; for (const l of B.lines) { const k = l.name + '|' + l.price; const x = items.find(i => i.k === k); if (x) x.qty += l.qty; else items.push({ k, name: l.name, qty: l.qty, price: l.price }); }
    const sub = items.reduce((a, i) => a + i.qty * i.price, 0), paid = B.paid.reduce((a, p) => a + p.amount, 0), left = Math.max(0, Math.round(B.total - paid));
    const M = { cash: 'Cash', upi: 'UPI', card: 'Card' };
    let qr = '';
    if (c.showUpi && r.upiId && left > 0) { try { qr = await (await fetch(`/api/admin/upi-qr?am=${left}&n=${encodeURIComponent(B.table.name + ' bill')}`)).text(); } catch {} }
    const html = receiptDoc(`${billHeader()}<hr>
      <div class="c b">BILL · ${esc(B.table.name)}</div>
      <div class="r sm"><span>${stamp()}</span><span>${B.orders.length ? 'Order ' + B.orders.map(o => '#' + o.number).join(', ') : ''}</span></div>
      ${B.people.length > 1 ? `<div class="sm">Guests: ${B.people.map(p => esc(p.name)).join(', ')}</div>` : ''}
      <hr><div class="r sm b"><span>Item</span><span>Amount</span></div>
      ${items.map(i => `<div class="it"><div class="r"><span>${i.qty} × ${esc(i.name)}</span><span>${pm(i.qty * i.price)}</span></div>${i.qty > 1 ? `<small>@ ${pm(i.price)} each</small>` : ''}</div>`).join('')}
      <hr><div class="r"><span>Items (${items.reduce((a, i) => a + i.qty, 0)})</span><span>${pm(sub)}</span></div>
      ${B.discount ? `<div class="r"><span>Coupon ${esc(B.coupons.join(', '))}</span><span>− ${pm(B.discount)}</span></div>` : ''}
      <div class="r tot"><span>TOTAL</span><span>${pm(B.total)}</span></div>
      ${paid ? `<hr>${B.paid.map(p => `<div class="r sm"><span>Paid · ${esc(p.name)} (${M[p.method] || 'UPI'})</span><span>${pm(p.amount)}</span></div>`).join('')}<div class="r b"><span>${left ? 'Balance due' : 'Fully paid'}</span><span>${left ? pm(left) : ''}</span></div>` : ''}
      ${qr ? `<hr><div class="c b">Scan to pay ${pm(left)} by UPI</div><div class="qr">${qr}</div><div class="c sm">${esc(r.upiId)}</div>` : ''}
      ${c.footer ? `<hr><div class="c">${esc(c.footer)}</div>` : ''}
      ${r.poweredBy ? '<div class="c sm" style="margin-top:2mm">Powered by Veyra Dine In</div>' : ''}`);
    await printDoc(html);
  }
  async function printKot(o) {
    const html = receiptDoc(`<div class="c b">KITCHEN ORDER (KOT)</div><div class="c xl">${esc(o.tableName)}</div>
      <div class="r sm"><span>Order #${o.number}${o.customerName ? ' · ' + esc(o.customerName) : ''}</span><span>${stamp(o.createdAt)}</span></div><hr>
      ${o.items.map(l => `<div class="it"><span class="kq">${l.qty}×</span> <b>${esc(l.name)}</b>${l.note ? `<small>» ${esc(l.note)}</small>` : ''}${l.by && new Set(o.items.map(x => x.by)).size > 1 ? `<small>for ${esc(l.by)}</small>` : ''}</div>`).join('')}
      ${o.note ? `<hr><div class="b">Note: ${esc(o.note)}</div>` : ''}<hr><div class="c sm">${o.items.reduce((a, l) => a + l.qty, 0)} items</div>`);
    await printDoc(html);
  }
  async function printTestBill() {
    await printBill({ table: { name: 'Table 1' }, orders: [{ number: 101 }], people: [{ name: 'Test' }], lines: [{ name: 'Paneer Tikka', qty: 1, price: 260 }, { name: 'Butter Naan', qty: 3, price: 45 }, { name: 'Masala Chai', qty: 2, price: 30 }], discount: 0, coupons: [], total: 455, paid: [] });
  }

  // ---------- bill and split at the counter ----------
  async function counterBill(tableId) {
    let B, mode = 'person', n = 2, sel = null;
    const o = modal('<div class="sheet-body"><div class="empty">Loading…</div></div>', { wide: true });
    o.classList.add('cbill-ov');
    const M = { cash: 'Cash', upi: 'UPI', card: 'Card' };
    const load = async () => { B = await api(`/api/admin/tables/${tableId}/bill`); if (mode === 'equal' && n < 2) n = Math.max(2, B.people.length); draw(); };
    function draw() {
      const paidTotal = B.paid.reduce((a, p) => a + p.amount, 0), left = Math.max(0, Math.round(B.total - paidTotal));
      const paidBy = gid => B.paid.filter(p => p.gid === gid).reduce((a, p) => a + p.amount, 0);
      const rows = mode === 'person'
        ? B.people.map(p => ({ gid: p.gid, name: p.name, amount: p.amount, due: Math.max(0, p.amount - paidBy(p.gid)), items: B.lines.filter(l => !l.shared && l.gid === p.gid) }))
        : Array.from({ length: n }, (_, i) => { const gid = 'eq' + (i + 1), each = Math.ceil(B.total / n), amt = i < n - 1 ? each : Math.max(0, Math.round(B.total) - each * (n - 1)); return { gid, name: 'Person ' + (i + 1), amount: amt, due: Math.max(0, amt - paidBy(gid)), items: [] }; });
      o.querySelector('.sheet').innerHTML = `<div class="sheet-head"><h3>${esc(B.table.name)} · Bill</h3><button class="icon-btn" data-close>${icon('x', 20)}</button></div>
      <div class="sheet-body cbill">
        ${!B.lines.length ? `<div class="empty">${icon('receipt', 40)}<div>No open bill on this table.</div></div>` : `
        <div class="cb-top"><div><small>Total</small><b>${cur(B.total)}</b>${B.discount ? `<span class="muted">after ${cur(B.discount)} coupon</span>` : ''}</div><div><small>Paid</small><b>${cur(paidTotal)}</b></div><div><small>Still to pay</small><b class="${left ? 'due' : 'ok'}">${left ? cur(left) : 'All paid'}</b></div></div>
        <div class="seg cb-seg"><button class="${mode === 'person' ? 'on' : ''}" data-m="person">By what each ate</button><button class="${mode === 'equal' ? 'on' : ''}" data-m="equal">Split equally</button><button class="${mode === 'one' ? 'on' : ''}" data-m="one">One payment</button></div>
        ${mode === 'equal' ? `<div class="cb-n">Split between <button class="btn btn-sm" data-n="-1">−</button><b>${n}</b><button class="btn btn-sm" data-n="1">+</button> people · ${cur(Math.ceil(B.total / n))} each</div>` : ''}
        ${mode === 'one' ? `<div class="cb-row sel"><div class="cb-who"><b>Whole table</b><small>${B.lines.map(l => `${l.qty}× ${esc(l.name)}`).join(', ')}</small></div><div class="cb-amt">${cur(left)}</div>
            ${left ? `<div class="cb-pay">${Object.entries(M).map(([k, l]) => `<button class="btn btn-sm" data-pay="${k}" data-gid="table" data-name="Table" data-amt="${left}">${l}</button>`).join('')}</div>` : `<span class="badge badge-green">${icon('check', 13)} Paid</span>`}</div>`
          : rows.map(r => `<div class="cb-row"><div class="cb-who"><b>${esc(r.name)}</b>${r.items.length ? `<small>${r.items.map(l => `${l.qty}× ${esc(l.name)}`).join(', ')}</small>` : ''}${B.paid.filter(p => p.gid === r.gid).map(p => `<small class="pd">${icon('check', 12)} ${cur(p.amount)} ${M[p.method] || 'UPI'}${p.counter ? '' : ' (guest says paid)'}</small>`).join('')}</div>
            <div class="cb-amt">${cur(r.amount)}</div>
            ${r.due ? `<div class="cb-pay">${Object.entries(M).map(([k, l]) => `<button class="btn btn-sm" data-pay="${k}" data-gid="${esc(r.gid)}" data-name="${esc(r.name)}" data-amt="${r.due}">${l}${r.due !== r.amount ? ' ' + cur(r.due) : ''}</button>`).join('')}</div>` : `<span class="badge badge-green">${icon('check', 13)} Paid</span>`}</div>`).join('')}
        ${mode === 'person' && B.lines.some(l => l.shared) ? `<p class="muted" style="font-size:13px">Shared by the table, split equally: ${B.lines.filter(l => l.shared).map(l => `${l.qty}× ${esc(l.name)}`).join(', ')}</p>` : ''}
        `}
      </div>
      <div class="sheet-foot" style="display:flex;gap:10px;justify-content:space-between;flex-wrap:wrap">
        <button class="btn" data-close>Close</button>
        ${B.lines.length ? `<button class="btn btn-dark" id="pbill">${icon('printer', 18)} Print bill</button>` : ''}
        ${B.lines.length ? `<button class="btn ${left ? '' : 'btn-primary'}" id="settle">${icon('check', 18)} ${left ? 'Clear table anyway' : 'Done, clear table'}</button>` : ''}
      </div>`;
      o.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { mode = b.dataset.m; if (mode === 'equal') n = Math.max(2, B.people.length); draw(); });
      o.querySelectorAll('[data-n]').forEach(b => b.onclick = () => { n = Math.max(2, Math.min(30, n + Number(b.dataset.n))); draw(); });
      o.querySelectorAll('[data-pay]').forEach(b => b.onclick = async () => {
        b.disabled = true;
        try { const x = await api(`/api/admin/tables/${tableId}/payment`, { method: 'POST', body: { gid: b.dataset.gid, name: b.dataset.name, amount: b.dataset.amt, method: b.dataset.pay } }); B = x; toast(`${icon('check', 18)} ${esc(b.dataset.name)} paid ${cur(b.dataset.amt)} by ${M[b.dataset.pay]}`, 'ok'); draw(); }
        catch (err) { b.disabled = false; toast(esc(err.message), 'error'); }
      });
      const pb = o.querySelector('#pbill'); if (pb) pb.onclick = () => printBill(B);
      const st = o.querySelector('#settle'); if (st) st.onclick = async () => {
        if (left && !(await confirmBox('Clear table with money still due?', `${cur(left)} is not marked as paid yet.`, 'Clear table'))) return;
        await api(`/api/admin/tables/${tableId}/settle`, { method: 'POST' }); o.close();
        S.requests = S.requests.filter(q => !(q.tableId === tableId && (q.type === 'bill' || q.type === 'paid'))); if (S.tab === 'orders') renderOrders(document.getElementById('content')); refreshBadges();
        toast(`${icon('check', 18)} ${esc(B.table.name)} is cleared for the next guests`, 'ok');
      };
    }
    try { await load(); } catch (err) { o.close(); toast(esc(err.message), 'error'); }
  }

  // ---------- coupons ----------
  async function renderOffers(c) {
    c.innerHTML = '<div class="empty">Loading…</div>';
    const list = await api('/api/admin/coupons');
    const today = dkey(Date.now());
    const state = x => !x.active ? ['Off', 'badge-grey'] : x.expires && x.expires < today ? ['Expired', 'badge-red'] : x.maxUses && x.uses >= x.maxUses ? ['Used up', 'badge-grey'] : ['Active', 'badge-green'];
    c.innerHTML = `<div class="panel" style="margin-bottom:18px"><div class="panel-head"><div><h2>Coupon codes</h2><span class="muted" style="font-size:14px">Guests type the code in their order. Codes marked “Show on menu” also appear at the top of the menu.</span></div>
        <button class="btn btn-primary" id="newC">${icon('plus', 18)} New coupon</button></div>
      ${list.length ? `<table class="tbl"><thead><tr><th>Code</th><th>Discount</th><th class="hide-sm">Used</th><th class="hide-sm">Valid till</th><th>Status</th><th></th></tr></thead><tbody>
        ${list.map(x => `<tr><td><b class="code">${esc(x.code)}</b>${x.showOnMenu ? '<br><span class="muted">Shown on menu</span>' : ''}</td><td>${esc(x.label)}</td><td class="hide-sm">${x.uses || 0}${x.maxUses ? ' / ' + x.maxUses : ''}</td><td class="hide-sm">${x.expires ? new Date(x.expires + 'T00:00:00Z').toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : 'No end date'}</td>
          <td><span class="badge ${state(x)[1]}">${state(x)[0]}</span></td><td class="r"><button class="btn btn-sm" data-cedit="${x.id}">${icon('edit', 16)} Edit</button></td></tr>`).join('')}</tbody></table>`
        : `<div class="empty">${icon('star', 40)}<div>No coupons yet. Try WELCOME10 for 10% off a first visit, or WEEKDAY50 for ₹50 off on quiet days.</div></div>`}</div>`;
    document.getElementById('newC').onclick = () => couponForm(null, () => renderOffers(c));
    c.querySelectorAll('[data-cedit]').forEach(b => b.onclick = () => couponForm(list.find(x => x.id === b.dataset.cedit), () => renderOffers(c)));
  }
  function couponForm(x, done) {
    const v = x || { code: '', type: 'percent', value: 10, minOrder: '', maxOff: '', maxUses: '', expires: '', active: true, showOnMenu: true, note: '' };
    const o = modal(`<div class="sheet-head"><h3>${x ? 'Edit coupon' : 'New coupon'}</h3><button class="icon-btn" data-close>${icon('x', 20)}</button></div>
      <form class="sheet-body form" id="cf">
        <label class="field"><span>Code guests type</span><input class="input" name="code" required maxlength="20" placeholder="WELCOME10" value="${esc(v.code)}" style="text-transform:uppercase"></label>
        <div class="row2"><label class="field"><span>Type</span><select class="input" name="type"><option value="percent" ${v.type === 'percent' ? 'selected' : ''}>% off</option><option value="flat" ${v.type === 'flat' ? 'selected' : ''}>${esc(S.me.restaurant.currency || '₹')} off</option></select></label>
          <label class="field"><span>Discount</span><input class="input" name="value" type="number" min="1" required value="${v.value}"></label></div>
        <div class="row2"><label class="field"><span>Minimum order (optional)</span><input class="input" name="minOrder" type="number" min="0" placeholder="e.g. 500" value="${v.minOrder || ''}"></label>
          <label class="field"><span>Maximum discount (optional)</span><input class="input" name="maxOff" type="number" min="0" placeholder="e.g. 150" value="${v.maxOff || ''}"></label></div>
        <div class="row2"><label class="field"><span>Valid till (optional)</span><input class="input" name="expires" type="date" value="${v.expires || ''}"></label>
          <label class="field"><span>Times it can be used (optional)</span><input class="input" name="maxUses" type="number" min="0" placeholder="No limit" value="${v.maxUses || ''}"></label></div>
        <label class="field"><span>Short note for guests (optional)</span><input class="input" name="note" maxlength="80" placeholder="e.g. Weekdays only, not on drinks" value="${esc(v.note || '')}"></label>
        <label class="switch-row"><input type="checkbox" name="showOnMenu" ${v.showOnMenu ? 'checked' : ''}> Show this offer at the top of the menu</label>
        <label class="switch-row"><input type="checkbox" name="active" ${v.active ? 'checked' : ''}> Coupon is on</label>
        <div style="display:flex;gap:10px;justify-content:space-between;flex-wrap:wrap">${x ? `<button type="button" class="btn btn-ghost btn-danger" id="cdel">${icon('trash', 18)} Delete</button>` : '<span></span>'}<button class="btn btn-primary">${x ? 'Save' : 'Create coupon'}</button></div>
      </form>`, { wide: true });
    o.querySelector('#cf').onsubmit = async e => {
      e.preventDefault(); const f = new FormData(e.target);
      const body = { code: f.get('code'), type: f.get('type'), value: f.get('value'), minOrder: f.get('minOrder'), maxOff: f.get('maxOff'), maxUses: f.get('maxUses'), expires: f.get('expires'), note: f.get('note'), showOnMenu: f.has('showOnMenu'), active: f.has('active') };
      try { await api('/api/admin/coupons' + (x ? '/' + x.id : ''), { method: x ? 'PUT' : 'POST', body }); o.close(); toast(`${icon('check', 18)} Coupon saved`, 'ok'); done(); }
      catch (err) { toast(esc(err.message), 'error'); }
    };
    const del = o.querySelector('#cdel'); if (del) del.onclick = async () => { if (!(await confirmBox('Delete this coupon?', 'Guests will not be able to use it any more.', 'Delete'))) return; await api('/api/admin/coupons/' + x.id, { method: 'DELETE' }); o.close(); done(); };
  }

  // ---------- boot ----------
  async function boot() {
    try { S.me = await api('/api/admin/me'); } catch { return; }
    if (window.vdDesktop) { window.vdDesktop.ready({ name: S.me.restaurant.name, access: S.me.restaurant.access }); unlockAudio(); }
    if (!S.me.restaurant.access.active) return renderActivate();
    const h = location.hash.slice(1); if (TABS.some(t => t[0] === h)) S.tab = h;
    await loadLive().catch(() => {});
    renderShell(); connect();
    document.addEventListener('click', unlockOnce, { once: true });
  }
  function unlockOnce() { unlockAudio(); if (S.tab === 'orders') { const en = document.getElementById('enableAlerts'); if (en && S.audioOk && !('Notification' in window && Notification.permission === 'default')) renderOrders(document.getElementById('content')); } }
  window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (S.me && h !== S.tab && TABS.some(t => t[0] === h)) { S.tab = h; renderShell(); } });
  boot();
})();

// ---------- "New update available" bar (Windows app only) ----------
(() => {
  if (!window.vdDesktop || !window.vdDesktop.onUpdate) return;
  const bar = document.createElement('div'); bar.className = 'upd-bar'; bar.hidden = true; document.body.prepend(bar);
  window.vdDesktop.onUpdate(u => {
    const show = ['available', 'downloading', 'ready', 'error'].includes(u.state);
    bar.hidden = !show; document.body.classList.toggle('has-upd', show);
    if (!show) return;
    const head = `<span class="upd-ico">${icon('download', 20)}</span>`;
    if (u.state === 'available') bar.innerHTML = `${head}<div class="upd-txt"><b>New update available</b><span>Version ${u.version} is ready to install. You have ${u.current}. Your menu, tables and orders stay as they are.</span></div><button class="btn btn-sm upd-later">Later</button><button class="btn btn-sm btn-primary upd-go">Update now</button>`;
    else if (u.state === 'downloading') bar.innerHTML = `${head}<div class="upd-txt"><b>Downloading update ${u.version}… ${u.percent || 0}%</b><span>The app restarts by itself when it's done. It takes about a minute.</span><div class="upd-prog"><i style="width:${u.percent || 0}%"></i></div></div>`;
    else if (u.state === 'ready') bar.innerHTML = `${head}<div class="upd-txt"><b>Update ${u.version} downloaded</b><span>Restarting to finish the update…</span></div><button class="btn btn-sm btn-primary upd-go">Restart now</button>`;
    else bar.innerHTML = `${head}<div class="upd-txt"><b>The update could not download</b><span>Check the internet connection and try again.</span></div><button class="btn btn-sm btn-primary upd-go">Try again</button>`;
    const go = bar.querySelector('.upd-go'); if (go) go.onclick = () => { go.disabled = true; window.vdDesktop.updateNow(); };
    const later = bar.querySelector('.upd-later'); if (later) later.onclick = () => window.vdDesktop.updateLater();
  });
})();
