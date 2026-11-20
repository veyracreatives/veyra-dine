// Restaurant admin: live orders, menu, tables + QR codes, branding, settings.
(function () {
  const app = document.getElementById('app');
  const TZ = new Date().getTimezoneOffset();
  const S = { me: null, tab: 'orders', orders: [], requests: [], stats: null, menu: null, tables: null, selCat: null, mobileCol: 'new', newIds: new Set(), sound: localStorage.getItem('vd_sound') !== 'off', audioOk: false, histDate: new Date(Date.now() - TZ * 60000).toISOString().slice(0, 10), history: [] };
  let es = null, titleTimer = null;

  // ---------- helpers ----------
  async function api(path, opts = {}) {
    let res;
    try { res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', cache: 'no-store', ...opts, body: opts.body ? JSON.stringify(opts.body) : undefined }); }
    catch (e) { if (S.me && !path.includes('/login')) goOffline(); const err = new Error('No internet right now. This is saved and will sync when you are back online.'); err.offline = true; throw err; }
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
    else {
      try { if (navigator.vibrate) navigator.vibrate([250, 120, 250]); } catch {}
      if ('Notification' in window && Notification.permission === 'granted' && (document.hidden || isPhoneApp())) {
        const opt = { body, tag: 'vd-' + Date.now(), icon: '/icon-192.png', badge: '/icon-192.png', vibrate: [250, 120, 250], renotify: true };
        if (S.swReg && S.swReg.showNotification) S.swReg.showNotification(title, opt).catch(() => {}); else { try { new Notification(title, opt); } catch {} }
      }
    }
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
    document.title = mode === 'signup' ? 'Start your free trial' : mode === 'forgot' ? 'Reset your password' : 'Log in';
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
        : mode === 'forgot' ? `<div id="rst"><h2>Reset your password</h2><p class="muted">We'll email a 6-digit code to the email you signed up with.</p>
          <form id="rf1" class="form"><label class="field"><span>Email or restaurant ID</span><input class="input" name="who" value="${esc(pre)}" required autocapitalize="off" autocomplete="username"></label>
            <button class="btn btn-lg btn-block btn-dark">Email me a code</button></form>
          <form id="rf2" class="form" hidden><p class="muted" id="rfTo" style="margin:0"></p>
            <label class="field"><span>6-digit code</span><input class="input" name="code" required inputmode="numeric" autocomplete="one-time-code" maxlength="7" pattern="[0-9 ]{6,7}" style="font:700 22px/1 ui-monospace,Consolas,monospace;letter-spacing:.3em"></label>
            <label class="field"><span>New password</span><input class="input" type="password" name="password" minlength="6" required autocomplete="new-password"></label>
            <button class="btn btn-lg btn-block btn-dark">Save and log in</button>
            <div class="small-link" style="margin-top:4px">No email? Check spam, or <a href="#" id="rfAgain">send a new code</a></div></form>
          <p class="muted" id="rfGoogle" style="margin:18px 0 0">Signed up with Google? You can also continue with Google and set a new password straight away.</p></div>`
        : `<form id="lf"><h2>Welcome back</h2><p class="muted">Log in to see your live orders.</p>
          <div class="form">
            <label class="field"><span>Email or restaurant ID</span><input class="input" name="slug" value="${esc(pre)}" required autocapitalize="off" autocomplete="username"></label>
            <label class="field"><span>Password</span><input class="input" type="password" name="password" required autocomplete="current-password"></label>
            <button class="btn btn-lg btn-block btn-dark">Log in</button>
          </div>
          <div class="small-link"><a href="#" data-mode="forgot">Forgot your password?</a></div></form>`}
        <div id="gwrap" hidden>${mode === 'forgot' ? '' : '<div class="or" style="margin:20px 0 14px">or</div>'}<div class="gbtn" style="display:flex;justify-content:center;min-height:44px"></div></div>
        ${mode === 'forgot' ? `<div class="small-link" style="margin-top:18px">Still stuck? Message us on <a href="https://wa.me/918928246726" target="_blank">WhatsApp</a> and we'll reset it for you.<br><a href="#" data-mode="login">Back to log in</a></div>` : ''}
      </div></div></div>`;
    app.querySelectorAll('[data-mode]').forEach(b => b.onclick = e => { e.preventDefault(); renderLogin(b.dataset.mode); });
    const afterLogin = async (r, created) => { if (r.reset) setTimeout(newPassword, 400); localStorage.setItem('vd_slug', r.slug); history.replaceState(null, '', '/admin/' + r.slug + location.search); if (created) S.tab = 'menu'; await boot(); if (created) toast(`${icon('check', 18)} Your free trial has started`, 'ok'); };
    const reset = mode === 'forgot';
    if (reset) {
      const f1 = document.getElementById('rf1'), f2 = document.getElementById('rf2'); let who = '';
      const sendCode = async () => {
        const btn = f1.querySelector('button:not(.pw-eye)'); btn.disabled = true;
        try { const r = await api('/api/admin/reset/start', { method: 'POST', body: { who } }); f1.hidden = true; f2.hidden = false; document.getElementById('rfTo').innerHTML = `We sent a code to <b>${esc(r.to)}</b>. It works for 10 minutes.`; f2.code.focus(); toast(`${icon('check', 18)} Code sent`, 'ok'); }
        catch (err) { toast(esc(err.message), 'error'); } finally { btn.disabled = false; }
      };
      f1.onsubmit = e => { e.preventDefault(); who = f1.who.value.trim(); sendCode(); };
      document.getElementById('rfAgain').onclick = e => { e.preventDefault(); sendCode(); };
      f2.onsubmit = async e => {
        e.preventDefault(); const btn = f2.querySelector('button:not(.pw-eye)'); btn.disabled = true;
        try { const r = await api('/api/admin/reset/finish', { method: 'POST', body: { who, code: f2.code.value, password: f2.password.value } }); toast(`${icon('check', 18)} Password changed`, 'ok'); await afterLogin(r); }
        catch (err) { toast(esc(err.message), 'error'); btn.disabled = false; }
      };
      // email codes need the server's email settings; without them, fall back to Google and WhatsApp only
      fetch('/api/auth/config').then(r => r.json()).then(c => { if (!c.emailReset) { document.getElementById('rf1').hidden = true; document.querySelector('#rst > p.muted').textContent = 'Signed up with a Gmail or Google account? Continue with Google using that email. You\'ll be logged in and can set a new password straight away.'; document.getElementById('rfGoogle').hidden = true; } }).catch(() => {});
    }
    const gw = document.getElementById('gwrap');
    // Windows app: Google blocks sign-in inside app windows, so finish it in the normal browser
    const onlineHost = /(^|\.)veyracreatives\.com$/.test(location.hostname);
    if (/Electron/i.test(navigator.userAgent) && (onlineHost || window.vdDesktop && vdDesktop.useOnline)) {
      gw.hidden = false;
      gw.querySelector('.gbtn').innerHTML = `<button type="button" class="btn btn-lg btn-block gdev"><svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg> Continue with Google</button>`;
      if (onlineHost) {
        gw.querySelector('.gdev').onclick = () => googleDevice(reset, afterLogin);
        // the app just switched from this-computer mode because the owner chose Google: start it straight away
        if (/[?&]google=1\b/.test(location.search)) { history.replaceState(null, '', location.pathname); googleDevice(reset, afterLogin); }
      } else {
        // this-computer mode: Google accounts live on the online server, so switch the app to it first
        gw.hidden = true;
        vdDesktop.mode().then(m => {
          if (!m || m.mode !== 'local' || !m.canOnline) return;
          gw.hidden = false;
          gw.querySelector('.gdev').onclick = () => vdDesktop.useOnline('google');
          gw.insertAdjacentHTML('beforeend', `<div class="small-link" style="margin-top:14px">This computer is running on its own. <a href="#" id="useOnline">Log in to your online account instead</a></div>`);
          document.getElementById('useOnline').onclick = e => { e.preventDefault(); vdDesktop.useOnline(''); };
        }).catch(() => {});
      }
    } else window.VDGoogle && VDGoogle.mount(gw, async credential => {
      try {
        const r = await api('/api/admin/google', { method: 'POST', body: { credential, reset } });
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

  // Windows app: sign in with Google in the normal browser, then this window logs in by itself
  async function googleDevice(reset, afterLogin) {
    let d; try { d = await api('/api/admin/google/device', { method: 'POST', body: { reset } }); } catch (err) { return toast(esc(err.message), 'error'); }
    window.open(d.url, '_blank');
    const o = modal(`<div class="sheet-head"><h3>Finish in your browser</h3><button class="icon-btn" data-close>${icon('x', 20)}</button></div><div class="sheet-body">
      <p style="margin:0 0 10px">We opened Google sign-in in your web browser. Check that it shows this code:</p>
      <div style="font:800 28px/1 ui-monospace,Consolas,monospace;letter-spacing:.12em;background:var(--brand-soft,#FDE7DC);color:#C2410C;padding:14px;border-radius:12px;text-align:center">${esc(d.short)}</div>
      <p class="muted" style="margin:12px 0 0;font-size:14px">This window logs in by itself once you're done. <a href="${esc(d.url)}" target="_blank">Open the browser again</a></p></div>`);
    let stop = false; const end = () => { stop = true; }; o.addEventListener('click', e => { if (e.target === o || e.target.closest('[data-close]')) end(); });
    const started = Date.now();
    while (!stop && Date.now() - started < 15 * 60000) {
      await new Promise(r => setTimeout(r, 2000)); if (stop) return;
      try { const r = await api('/api/admin/google/device/poll?c=' + encodeURIComponent(d.code)); if (r.ok) { o.close(); return afterLogin(r, r.created); } }
      catch (err) { o.close(); return toast(esc(err.message), 'error'); }
    }
  }
  function newPassword() {
    const o = modal(`<form><div class="sheet-head"><h3>Set a new password</h3></div><div class="sheet-body form">
      <p class="muted" style="margin:0">You're logged in with Google. Choose a new password for your restaurant. Staff use it to open orders on their phones.</p>
      <label class="field"><span>New password</span><input class="input" type="password" name="next" minlength="6" required autocomplete="new-password"><small>At least 6 characters. Other devices will be logged out.</small></label>
      </div><div class="sheet-foot" style="display:flex;gap:10px;justify-content:flex-end"><button type="button" class="btn" data-close>Later</button><button class="btn btn-primary">Save password</button></div></form>`);
    o.querySelector('form').onsubmit = async e => { e.preventDefault(); try { await api('/api/admin/password', { method: 'POST', body: { next: new FormData(e.target).get('next') } }); o.close(); toast('New password saved', 'ok'); } catch (err) { toast(esc(err.message), 'error'); } };
  }
  // ---------- import a whole menu at once ----------
  function parseMenu(text) {
    // One dish per line: Category, Dish, Price, Veg/Non-veg, Description. Also accepts "Dish - 120" lines under a "Category:" heading line.
    const rows = []; let cat = '';
    const cells = line => { const out = []; let cur = '', q = false; for (let i = 0; i < line.length; i++) { const ch = line[i]; if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; } else if (ch === '"') q = true; else if (ch === ',' || ch === '\t' || ch === ';') { out.push(cur.trim()); cur = ''; } else cur += ch; } out.push(cur.trim()); return out; };
    for (let raw of String(text).replace(/^﻿/, '').split(/\r?\n/)) {
      const line = raw.trim(); if (!line) continue;
      const c = cells(line);
      if (c.length >= 3 && /^\d+(\.\d+)?$/.test(c[2].replace(/[₹,\s]/g, ''))) { rows.push({ category: c[0], name: c[1], price: c[2].replace(/[₹,\s]/g, ''), diet: c[3] || '', description: c[4] || '' }); continue; }
      if (/^category\s*,/i.test(line)) continue; // header row
      const m = /^(?:\d+\s*[.)]\s*)?(.+?)\s*(?:[-–:|]|\s)\s*₹?\s*(\d+(?:\.\d+)?)\s*$/.exec(line);
      if (m && cat) { rows.push({ category: cat, name: m[1].trim(), price: m[2], diet: '' }); continue; }
      cat = line.replace(/[:\-–]+$/, '').trim();
    }
    return rows;
  }
  function importMenu() {
    const o = modal(`<div class="sheet-head"><h3>Import menu</h3><button class="icon-btn" data-close>${icon('x', 20)}</button></div><div class="sheet-body form">
      <p class="muted" style="margin:0;font-size:14px">Add many dishes at once. Nothing is deleted. A dish that already exists in the same category gets the new price instead of a copy.</p>
      <label class="field"><span>Choose a CSV file (Excel: File › Save as › CSV)</span><input class="input" type="file" id="impFile" accept=".csv,.txt,text/csv,text/plain"></label>
      <label class="field"><span>Or paste the menu</span><textarea class="input" id="impText" rows="8" placeholder="Category, Dish, Price, Veg or Non-veg, Description&#10;Dosa, Masala Dosa, 60, Veg&#10;Dosa, Mysore Masala Dosa, 120, Veg&#10;&#10;or&#10;&#10;Dosa&#10;Masala Dosa - 60&#10;Mysore Masala Dosa - 120"></textarea></label>
      <div id="impPrev" class="muted" style="font-size:14px">Paste or choose a file to see what will be added.</div>
      </div><div class="sheet-foot" style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap"><button type="button" class="btn" id="impSample">${icon('download', 16)} Sample file</button><button class="btn btn-primary" id="impGo" disabled>Import</button></div>`, { wide: true });
    const ta = o.querySelector('#impText'), prev = o.querySelector('#impPrev'), go = o.querySelector('#impGo');
    let rows = [];
    const show = () => {
      rows = parseMenu(ta.value); go.disabled = !rows.length;
      if (!rows.length) { prev.innerHTML = ta.value.trim() ? 'No dishes found. Use one dish per line: Category, Dish, Price.' : 'Paste or choose a file to see what will be added.'; return; }
      const cats = [...new Set(rows.map(r => r.category))];
      prev.innerHTML = `<b style="color:var(--ink)">${rows.length} dishes in ${cats.length} ${cats.length === 1 ? 'category' : 'categories'}</b>: ${cats.map(c => `${esc(c)} (${rows.filter(r => r.category === c).length})`).join(', ')}`;
      go.textContent = `Import ${rows.length} dishes`;
    };
    ta.oninput = show;
    o.querySelector('#impFile').onchange = e => { const f = e.target.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { ta.value = rd.result; show(); }; rd.readAsText(f); };
    o.querySelector('#impSample').onclick = () => { const csv = 'Category,Dish,Price,Veg or Non-veg,Description\nStarters,Paneer Tikka,249,Veg,Cottage cheese grilled in the tandoor\nMain Course,Butter Chicken,349,Non-veg,\nDrinks,Masala Chaas,59,Veg,\n'; const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' })); a.download = 'menu-sample.csv'; document.body.appendChild(a); a.click(); a.remove(); };
    go.onclick = async () => {
      go.disabled = true; go.textContent = 'Importing…';
      try {
        const r = await api('/api/admin/menu/import', { method: 'POST', body: { rows } });
        o.close(); S.menu = null; renderTab();
        toast(`${icon('check', 18)} ${r.added} dishes added${r.updated ? `, ${r.updated} prices updated` : ''}${r.same ? `, ${r.same} already there` : ''}${r.skipped.length ? `. ${r.skipped.length} lines skipped` : ''}`, 'ok');
      } catch (err) { go.disabled = false; show(); toast(esc(err.message), 'error'); }
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
          <span class="net-pill" id="netPill"></span>
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
    drawNet();
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
  // ---------- works offline: cache, outbox and sync ----------
  S.offPaid = {};
  const OFFK = () => 'vd_off_' + (S.me ? S.me.restaurant.slug : ''), OUTK = () => 'vd_outbox_' + (S.me ? S.me.restaurant.slug : '');
  function saveCache() { if (!S.me) return; try { localStorage.setItem(OFFK(), JSON.stringify({ at: Date.now(), me: S.me, orders: S.orders, requests: S.requests, stats: S.stats, menu: S.menu, tables: S.tables })); } catch {} }
  const outbox = () => { try { return JSON.parse(localStorage.getItem(OUTK()) || '[]'); } catch { return []; } };
  const setOutbox = a => { try { localStorage.setItem(OUTK(), JSON.stringify(a)); } catch {} };
  function queue(x) { const a = outbox(); a.push({ ...x, at: new Date().toISOString() }); setOutbox(a); drawOffBar(); }
  let pingT = null, syncing = false;
  function goOffline(justSync) {
    if (!justSync && !S.offline) { S.offline = true; drawOffBar(); if (S.me && document.getElementById('content') && S.tab === 'orders') renderOrders(document.getElementById('content')); }
    if (!pingT) pingT = setInterval(tryOnline, 8000);
    if (justSync) tryOnline();
  }
  // Online pill in the top bar. Guests see "Kitchen online" on the menu while this page is open and connected.
  function drawNet() {
    const el = document.getElementById('netPill'); if (!el) return;
    const on = !S.offline && navigator.onLine !== false && (!es || es.readyState !== 2);
    el.className = 'net-pill ' + (on ? 'on' : 'off');
    el.title = on ? 'Connected. New orders arrive here live, and guests see "Kitchen online".' : 'Not connected. Guests see "Kitchen offline". Orders they send will show here when you are back online.';
    if (on && S.me && S.me.hubMode) el.title = 'WiFi backup. Guests and waiters on your WiFi can order.';
    el.innerHTML = `<i></i><span>${on ? (S.me && S.me.hubMode ? 'On WiFi' : 'Online') : 'Offline'}</span>`;
  }
  setInterval(() => { if (S.me && !S.offline) fetch('/api/admin/ping', { method: 'POST' }).then(r => { if (r.status === 401) return; drawNet(); }).catch(() => { drawNet(); }); }, 30000);
  window.addEventListener('online', () => drawNet()); window.addEventListener('offline', () => drawNet());
  function drawOffBar() {
    drawNet();
    let bar = document.getElementById('offbar');
    const n = outbox().length;
    if (!S.offline && !n) { if (bar) bar.remove(); return; }
    if (!bar) { bar = document.createElement('div'); bar.id = 'offbar'; bar.className = 'off-bar'; document.body.prepend(bar); }
    bar.innerHTML = S.offline ? `${icon('wifi', 18)}<span><b>No internet.</b> Keep going: take counter orders, print KOT and bills. ${n ? `<b>${n} change${n === 1 ? '' : 's'}</b> will sync` : 'Everything syncs'} when the internet is back.</span>`
      : `${icon('wifi', 18)}<span>Back online. Syncing ${n} saved change${n === 1 ? '' : 's'}…</span>`;
  }
  async function tryOnline() {
    if (syncing) return;
    try { const r = await fetch('/api/admin/stats?tz=' + TZ, { cache: 'no-store', credentials: 'same-origin' }); if (!r.ok) return; } catch { return; }
    syncing = true; const wasOff = S.offline; S.offline = false; drawOffBar();
    const items = outbox(), ids = {}; let done = 0;
    try {
      for (const x of items) {
        if (x.kind === 'order') { const o = await api('/api/admin/orders', { method: 'POST', body: { ...x.body, offline: true, clientId: x.tmpId } }); ids[x.tmpId] = o.id; }
        else if (x.kind === 'status') { const oid = ids[x.id] || x.id; if (!String(oid).startsWith('off-')) await api('/api/admin/orders/' + oid, { method: 'PATCH', body: { status: x.status } }).catch(e => { if (e.offline) throw e; }); }
        else if (x.kind === 'payment') await api(`/api/admin/tables/${x.tableId}/payment`, { method: 'POST', body: x.body }).catch(e => { if (e.offline) throw e; });
        else if (x.kind === 'settle') await api(`/api/admin/tables/${x.tableId}/settle`, { method: 'POST' }).catch(e => { if (e.offline) throw e; });
        done++; setOutbox(items.slice(done));
      }
    } catch (e) { syncing = false; S.offline = true; drawOffBar(); return; }
    clearInterval(pingT); pingT = null; syncing = false; S.offPaid = {};
    setOutbox([]); drawOffBar();
    try { await loadLive(); } catch {}
    connect(); renderShell(); saveCache();
    if (wasOff || done) toast(`${icon('check', 18)} Back online${done ? `. ${done} saved change${done === 1 ? '' : 's'} synced` : ''}`, 'ok');
  }
  window.addEventListener('online', () => { if (S.offline || outbox().length) tryOnline(); });
  window.addEventListener('offline', () => { if (S.me) goOffline(); });
  function offlineStatus(oid, status) {
    const o = S.orders.find(x => x.id === oid); if (!o) return;
    const a = outbox(), mine = a.find(x => x.kind === 'order' && x.tmpId === oid);
    if (mine) { mine.body.status = status; setOutbox(a); } else queue({ kind: 'status', id: oid, status });
    o.status = status; o.updatedAt = new Date().toISOString(); S.newIds.delete(oid);
    if (!['new', 'preparing', 'ready'].includes(status)) { if (status !== 'cancelled') (S.offServed = S.offServed || []).push(o); S.orders = S.orders.filter(x => x.id !== oid); }
    saveCache(); drawOffBar(); if (S.tab === 'orders') renderOrders(document.getElementById('content'));
  }
  function offlineBill(tableId) {
    const t = (S.tables || []).find(x => x.id === tableId) || { id: tableId, name: (S.orders.find(o => o.tableId === tableId) || {}).tableName || 'Table' };
    const list = [...S.orders, ...(S.offServed || [])].filter(o => o.tableId === tableId && o.status !== 'cancelled');
    const lines = []; list.forEach(o => o.items.forEach((l, i) => lines.push({ key: o.id + ':' + i, name: l.name, qty: l.qty, price: l.price, amount: l.qty * l.price, gid: 'table', by: 'Table' })));
    const total = list.reduce((a, o) => a + o.total, 0);
    return { table: { id: t.id, name: t.name }, total, discount: list.reduce((a, o) => a + (o.discount || 0), 0), coupons: [...new Set(list.map(o => o.coupon).filter(Boolean))], lines, people: lines.length ? [{ gid: 'table', name: 'Table', amount: Math.round(total), own: total, sharedPart: 0 }] : [], paid: (S.offPaid[tableId] || []).slice(), orders: list.map(o => ({ id: o.id, number: o.number, status: o.status })) };
  }

  // ---------- counter display: the screen customers see at the counter ----------
  const DISP = () => !!(S.me && S.me.restaurant.displayCfg && S.me.restaurant.displayCfg.on);
  let dispT = 0;
  function toDisplay(body, now) { // what the customer screen shows; quietly does nothing offline or when it is off
    if (!DISP() || S.offline) return; clearTimeout(dispT);
    const go = () => api('/api/admin/display/show', { method: 'POST', body }).catch(() => {});
    if (now) go(); else dispT = setTimeout(go, 250);
  }
  function onGone(el, fn) { const mo = new MutationObserver(() => { if (!el.isConnected) { mo.disconnect(); fn(); } }); mo.observe(document.body, { childList: true }); }
  const KDS = () => !!(S.me && S.me.restaurant.kitchenCfg && S.me.restaurant.kitchenCfg.on);
  async function openKitchen() {
    try {
      const d = await api('/api/admin/kitchen-link'); if (!d.link) return toast('Turn on the kitchen display in Settings first.', 'error');
      const w = window.open(d.link, 'vd-kitchen', 'popup,width=1280,height=760');
      if (!w && !window.vdDesktop) toast('Your browser blocked the window. Allow pop-ups for this site, or copy the link from Settings › Kitchen display.', 'error');
      else toast('Kitchen display opened. Move it to the kitchen screen and tap Start.', 'ok');
    } catch (err) { toast(esc(err.message), 'error'); }
  }
  async function openDisplay() {
    try {
      const d = await api('/api/admin/display-link'); if (!d.link) return toast('Turn on the counter display in Settings first.', 'error');
      const w = window.open(d.link, 'vd-display', 'popup,width=1280,height=760');
      if (!w && !window.vdDesktop) toast('Your browser blocked the window. Allow pop-ups for this site, or copy the link from Settings › Counter display.', 'error');
      else toast('Counter display opened. Move it to the screen that faces customers and tap Start display.', 'ok');
    } catch (err) { toast(esc(err.message), 'error'); }
  }

  // ---------- counter order (also works offline) ----------
  async function newOrder() {
    if (!S.menu || !S.tables) { try { const [mn, tb] = await Promise.all([S.menu || api('/api/admin/menu'), S.tables || api('/api/admin/tables')]); S.menu = mn; S.tables = tb; saveCache(); } catch (err) { if (!S.menu || !S.tables) return toast('Open the Menu and Tables tabs once while online, then counter orders work offline too.', 'error'); } }
    const items = S.menu.items.filter(i => !i.hidden), cats = S.menu.categories || [], tables = S.tables.filter(t => t.active !== false);
    const cart = {}; let q = '', cat = '';
    const L = S.me.restaurant.loyalty;
    const o = modal(`<div class="sheet-head"><h3>New order</h3><button class="icon-btn" data-close>${icon('x', 20)}</button></div>
      <div class="sheet-body pos">
        <div class="pos-top"><label class="field"><span>Table</span><select class="input" id="ptab"><option value="">Counter / takeaway</option>${tables.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></label>
          <label class="field"><span>Customer name (optional)</span><input class="input" id="pname" maxlength="60"></label>
          ${L ? `<label class="field"><span>Mobile for points (optional)</span><input class="input" id="pphone" inputmode="tel" maxlength="14"></label>` : ''}</div>
        <div class="pos-find"><input class="input" id="pq" placeholder="Search dishes"><div class="pos-cats"><button class="chip on" data-pc="">All</button>${cats.map(k => `<button class="chip" data-pc="${k.id}">${esc(k.name)}</button>`).join('')}</div></div>
        <div class="pos-list" id="plist"></div>
        <label class="field"><span>Note for the kitchen (optional)</span><input class="input" id="pnote" maxlength="300" placeholder="E.g. less spicy"></label>
      </div>
      <div class="sheet-foot pos-foot"><div id="psum" class="muted">No dishes yet</div><button class="btn btn-primary btn-lg" id="psend" disabled>${icon('printer', 18)} Send to kitchen</button></div>`, { wide: true });
    o.classList.add('pos-ov');
    const draw = () => {
      const list = items.filter(i => (!cat || i.categoryId === cat) && (!q || i.name.toLowerCase().includes(q)));
      o.querySelector('#plist').innerHTML = list.map(i => `<div class="pos-it ${cart[i.id] ? 'on' : ''} ${i.available === false ? 'off' : ''}"><span class="nm">${dietMark(i.diet)} ${esc(i.name)}<small>${cur(i.price)}${i.available === false ? ' · sold out' : ''}</small></span>
        ${cart[i.id] ? `<span class="pos-q"><button class="btn btn-sm" data-d="${i.id}">−</button><b>${cart[i.id]}</b><button class="btn btn-sm" data-a="${i.id}">+</button></span>` : `<button class="btn btn-sm" data-a="${i.id}">${icon('plus', 16)} Add</button>`}</div>`).join('') || '<div class="empty">No dishes found</div>';
      const n = Object.values(cart).reduce((a, b) => a + b, 0), tot = Object.entries(cart).reduce((a, [id, qty]) => a + qty * (items.find(i => i.id === id) || {}).price, 0);
      o.querySelector('#psum').innerHTML = n ? `<b>${n} item${n === 1 ? '' : 's'}</b> · ${cur(tot)}` : 'No dishes yet';
      o.querySelector('#psend').disabled = !n;
      const tSel = o.querySelector('#ptab'), tN = tSel && tSel.value ? tSel.options[tSel.selectedIndex].text : '';
      toDisplay(n ? { mode: 'cart', title: tN || 'Your order', lines: Object.entries(cart).map(([id, qty]) => { const it = items.find(i => i.id === id) || {}; return { name: it.name, qty, price: it.price }; }) } : { mode: 'idle' });
    };
    let sentOrder = null;
    onGone(o, () => toDisplay(sentOrder && !sentOrder.offline ? { mode: 'order', orderId: sentOrder.id } : { mode: 'idle' }, true));
    o.querySelector('#ptab').onchange = () => draw();
    o.querySelector('#plist').onclick = e => { const b = e.target.closest('[data-a],[data-d]'); if (!b) return; const id = b.dataset.a || b.dataset.d; cart[id] = Math.max(0, (cart[id] || 0) + (b.dataset.a ? 1 : -1)); if (!cart[id]) delete cart[id]; draw(); };
    o.querySelector('#pq').oninput = e => { q = e.target.value.trim().toLowerCase(); draw(); };
    o.querySelectorAll('[data-pc]').forEach(b => b.onclick = () => { cat = b.dataset.pc; o.querySelectorAll('[data-pc]').forEach(x => x.classList.toggle('on', x === b)); draw(); });
    o.querySelector('#psend').onclick = async e => {
      const btn = e.currentTarget; btn.disabled = true;
      const tId = o.querySelector('#ptab').value, t = tables.find(x => x.id === tId);
      const body = { tableId: tId || null, label: t ? '' : 'Counter', items: Object.entries(cart).map(([id, qty]) => ({ id, qty, price: (items.find(i => i.id === id) || {}).price })), name: o.querySelector('#pname').value.trim(), note: o.querySelector('#pnote').value.trim(), phone: o.querySelector('#pphone') ? o.querySelector('#pphone').value : '', status: 'preparing' };
      let order;
      if (!S.offline) { try { order = await api('/api/admin/orders', { method: 'POST', body }); } catch (err) { if (!err.offline) { btn.disabled = false; return toast(esc(err.message), 'error'); } } }
      if (!order) { // offline: keep it here, print the KOT, sync later
        const tmpId = 'off-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), lines = body.items.map(x => { const it = items.find(i => i.id === x.id); return { itemId: it.id, name: it.name, price: it.price, qty: x.qty, diet: it.diet }; });
        const total = lines.reduce((a, l) => a + l.price * l.qty, 0);
        order = { id: tmpId, number: 'OFF-' + (outbox().filter(x => x.kind === 'order').length + 1), tableId: tId || null, tableName: t ? t.name : 'Counter', items: lines, note: body.note, customerName: body.name, total, subtotal: total, discount: 0, coupon: '', status: 'preparing', createdAt: new Date().toISOString(), offline: true, source: 'counter' };
        queue({ kind: 'order', tmpId, body: { ...body, createdAt: order.createdAt } });
      }
      sentOrder = order; o.close(); upsertOrder(order);
      if (window.vdDesktop && window.vdDesktop.print && BILLCFG().autoKot) printKot(order);
      toast(`${icon('check', 18)} Order for ${esc(order.tableName)} sent${order.offline && String(order.id).startsWith('off-') ? ' (saved offline)' : ''}. ${window.vdDesktop && BILLCFG().autoKot ? 'KOT printing.' : 'Tap KOT on the order to print the kitchen ticket.'}`, 'ok');
    };
    draw(); setTimeout(() => o.querySelector('#pq').focus(), 60);
  }

  // ---------- loyalty customers ----------
  async function gameBoard() {
    const o = modal(`<div class="sheet-head"><h3>Game leaderboard</h3><button class="icon-btn" data-close>${icon('x', 20)}</button></div><div class="sheet-body"><div class="empty">Loading…</div></div>`, { wide: true });
    let d; const ld = async () => { d = await api('/api/admin/games'); };
    const row = (x, i, g, last) => `<tr><td>${i + 1}</td><td><b>${esc(x.name)}</b>${x.phone ? `<br><small class="muted">${esc(x.phone)}</small>` : ''}</td><td class="r"><b>${x.score}</b></td><td class="r">${x.rewarded ? `<span class="badge badge-green">Rewarded${x.rewarded.points ? ' +' + x.rewarded.points + ' pts' : ''}</span>` : `${i === 0 ? `<button class="btn btn-sm btn-primary" data-rw="${x.id}">Give reward</button> ` : ''}`}<button class="btn btn-sm btn-ghost" data-hide="${x.id}" title="Remove this score">${icon('trash', 16)}</button></td></tr>`;
    const draw = () => {
      const c = d.cfg; o.querySelector('.sheet-body').innerHTML = `<p class="muted" style="margin:0 0 12px;font-size:14px">Weeks run Monday to Sunday. ${c.reward || c.points ? `Reward: <b>${esc(c.reward || '')}${c.reward && c.points ? ' + ' : ''}${c.points ? c.points + ' points' : ''}</b>. Give it to last week's winner when they visit.` : 'Set a weekly reward in Settings › Games to bring players back.'}</p>
        ${Object.entries(d.games).map(([g, x]) => `<h4 style="margin:18px 0 6px">${esc(x.name)} <small class="muted">· ${x.plays} ${x.plays === 1 ? 'score' : 'scores'} this week</small></h4>
          ${x.last.length ? `<div class="muted" style="font-size:13px;margin:0 0 6px">Last week's winner</div><table class="tbl"><tbody>${row(x.last[0], 0, g, true)}</tbody></table>` : ''}
          <div class="muted" style="font-size:13px;margin:8px 0 6px">This week</div>${x.week.length ? `<div style="overflow-x:auto"><table class="tbl"><tbody>${x.week.map((y, i) => row(y, i, g)).join('')}</tbody></table></div>` : '<p class="muted" style="margin:0">No scores yet.</p>'}`).join('')}`;
      o.querySelectorAll('[data-rw]').forEach(b => b.onclick = async () => { try { await api('/api/admin/games/reward', { method: 'POST', body: { id: b.dataset.rw, points: d.loyalty ? d.cfg.points : 0 } }); toast(d.loyalty && d.cfg.points ? 'Reward given and points added' : 'Marked as rewarded', 'ok'); await ld(); draw(); } catch (err) { toast(esc(err.message), 'error'); } });
      o.querySelectorAll('[data-hide]').forEach(b => b.onclick = async () => { if (!(await confirmBox('Remove this score?', 'It will no longer show on the leaderboard.', 'Remove'))) return; try { await api('/api/admin/games/hide', { method: 'POST', body: { id: b.dataset.hide } }); await ld(); draw(); } catch (err) { toast(esc(err.message), 'error'); } });
    };
    try { await ld(); draw(); } catch (err) { o.querySelector('.sheet-body').innerHTML = `<div class="empty">${esc(err.message)}</div>`; }
  }
  async function customers() {
    const L = S.me.restaurant.loyaltyCfg; let list = [], q = '';
    const o = modal(`<div class="sheet-head"><h3>Loyalty customers</h3><button class="icon-btn" data-close>${icon('x', 20)}</button></div><div class="sheet-body"><div class="empty">Loading…</div></div>`, { wide: true });
    const draw = () => {
      const f = list.filter(c => !q || c.phone.includes(q) || (c.name || '').toLowerCase().includes(q));
      o.querySelector('.sheet-body').innerHTML = `<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap"><input class="input" id="cq" placeholder="Search name or number" style="flex:1;min-width:160px" value="${esc(q)}"><button class="btn" id="ccsv">${icon('download', 16)} Excel</button></div>
        <p class="muted" style="margin:0 0 10px;font-size:13px">${list.length} customers · ${list.reduce((a, c) => a + c.points, 0)} points unused (worth ${cur(Math.round(list.reduce((a, c) => a + c.points, 0) * L.value))})</p>
        ${f.length ? `<div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Customer</th><th class="r">Points</th><th class="r hide-sm">Visits</th><th class="r hide-sm">Spent</th><th></th></tr></thead><tbody>${f.map(c => `<tr><td><b>${esc(c.name || '–')}</b><br><span class="muted">${c.phone}</span></td><td class="r"><b>${c.points}</b></td><td class="r hide-sm">${c.visits}</td><td class="r hide-sm">${cur(c.spent)}</td><td class="r"><button class="btn btn-sm" data-adj="${c.phone}">Change</button></td></tr>`).join('')}</tbody></table></div>` : `<div class="empty">${icon('user', 36)}<div>${list.length ? 'No match' : 'No customers yet. Points start when guests or staff add a mobile number to an order.'}</div></div>`}`;
      const cq = o.querySelector('#cq'); cq.oninput = e => { q = e.target.value.trim().toLowerCase(); const pos = e.target.selectionStart; draw(); const n = o.querySelector('#cq'); n.focus(); n.setSelectionRange(pos, pos); };
      o.querySelector('#ccsv').onclick = () => { const qq = v => `"${String(v ?? '').replace(/"/g, '""')}"`; const rows = [['Name', 'Mobile', 'Points', 'Visits', 'Spent', 'Last visit'].map(qq).join(',')].concat(list.map(c => [c.name, c.phone, c.points, c.visits, c.spent, (c.lastAt || '').slice(0, 10)].map(qq).join(','))); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + rows.join('\r\n')], { type: 'text/csv' })); a.download = 'loyalty-customers.csv'; a.click(); };
      o.querySelectorAll('[data-adj]').forEach(b => b.onclick = async () => {
        const c = list.find(x => x.phone === b.dataset.adj);
        const m = modal(`<form><div class="sheet-head"><h3>${esc(c.name || c.phone)}</h3><button type="button" class="icon-btn" data-close>${icon('x', 20)}</button></div><div class="sheet-body form">
          <p style="margin:0">Has <b>${c.points} points</b>.</p>
          <label class="field"><span>Name</span><input class="input" name="name" value="${esc(c.name)}" maxlength="60"></label>
          <label class="field"><span>Add points (use − to take away)</span><input class="input" name="pts" type="number" step="1" placeholder="E.g. 20 or -20"></label>
          <label class="field"><span>Reason (optional)</span><input class="input" name="note" maxlength="80" placeholder="E.g. birthday bonus"></label>
          ${c.history.length ? `<div class="muted" style="font-size:13px">${c.history.slice(0, 6).map(h => `${new Date(h.at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}: ${h.points > 0 ? '+' : ''}${h.points} ${esc(h.note)}`).join('<br>')}</div>` : ''}
          </div><div class="sheet-foot"><button class="btn btn-primary btn-lg btn-block">Save</button></div></form>`);
        m.querySelector('form').onsubmit = async e => { e.preventDefault(); const f = new FormData(e.target); try { const x = await api('/api/admin/customers/adjust', { method: 'POST', body: { phone: c.phone, name: f.get('name'), points: f.get('pts'), note: f.get('note') } }); Object.assign(c, x); m.close(); draw(); toast('Saved', 'ok'); } catch (err) { toast(esc(err.message), 'error'); } };
      });
    };
    try { list = await api('/api/admin/customers'); draw(); } catch (err) { o.close(); toast(esc(err.message), 'error'); }
  }

  // ---------- phone app (install to home screen) ----------
  const isStandalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  const isPhone = () => window.innerWidth < 760 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) || (window.matchMedia && matchMedia('(hover: none) and (pointer: coarse)').matches); // phones and tablets
  const isPhoneApp = () => isStandalone() && isPhone();
  const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); S.installEvt = e; if (S.me && (S.tab === 'orders' || S.tab === 'settings')) renderShell(); });
  window.addEventListener('appinstalled', () => { S.installEvt = null; lsSet('vd_app_hint', 'x'); toast('Installed. Open “Dine In Admin” from your home screen.', 'ok'); });
  async function installApp() {
    if (S.installEvt) { S.installEvt.prompt(); const r = await S.installEvt.userChoice.catch(() => null); S.installEvt = null; if (r && r.outcome === 'accepted') return; renderShell(); return; }
    phoneSteps();
  }
  function phoneSteps() {
    const ios = isIOS();
    modal(`<div class="sheet-head"><h3>Add to your home screen</h3><button class="icon-btn" data-close>${icon('x', 20)}</button></div><div class="sheet-body">
      <ol class="steps">${ios
        ? `<li>Open this page in <b>Safari</b>.</li><li>Tap the <b>Share</b> button (square with an arrow) at the bottom.</li><li>Scroll down and tap <b>Add to Home Screen</b>, then <b>Add</b>.</li>`
        : `<li>Open this page in <b>Chrome</b>.</li><li>Tap the <b>⋮</b> menu at the top right.</li><li>Tap <b>Install app</b> or <b>Add to Home screen</b>, then <b>Install</b>.</li>`}
        <li>Open <b>Dine In Admin</b> from your home screen and tap <b>Turn on alerts</b> once.</li></ol>
      <p class="muted" style="margin:12px 0 0;font-size:14px">You stay logged in for 30 days. Keep the app open (it can be in the background) to get the order sound and pop-up.</p>
      </div><div class="sheet-foot"><button class="btn btn-primary" data-close>Got it</button></div>`);
  }
  function phoneBanner() {
    if (window.vdDesktop || isStandalone() || !isPhone() || lsGet('vd_app_hint')) return '';
    return `<div class="banner app-hint">${icon('mobile', 22)}<span><b>Use this as an app.</b> Put Dine In Admin on your home screen and open it in one tap.</span><button class="btn btn-primary" id="appInstall">${S.installEvt ? 'Install' : 'How'}</button><button class="icon-btn" id="appHintX" aria-label="Hide">${icon('x', 18)}</button></div>`;
  }
  async function phonePanel(box) {
    if (!box) return;
    const ios = isIOS(), inApp = isStandalone();
    let q = null; try { q = await api('/api/admin/phone-qr'); } catch {}
    box.innerHTML = `<div class="panel-head"><div><h2>Use on your phone</h2><span class="muted" style="font-size:14px">Take orders, print KOT and bills, and see sales from your phone. Works on Android and iPhone, no download from the Play Store needed.</span></div></div>
      <div class="panel-body"><div class="phone-app">
        ${q ? `<div class="qr-box">${q.svg}<small>Scan with your phone camera</small></div>` : ''}
        <div class="phone-steps">
          ${inApp ? `<div class="hint" style="background:var(--green-soft,#E7F6EC);color:#14532D;margin:0 0 12px">${icon('check', 20)}<div><b>You're using the phone app.</b> Tap <b>Turn on alerts</b> on Live orders once so new orders ring.</div></div>` : ''}
          ${q ? `<div class="field"><span>Admin link for your phone</span><div style="display:flex;gap:8px"><input class="input" value="${esc(q.url)}" readonly style="min-width:0;flex:1"><button class="btn" id="cpyPhone" type="button">${icon('copy', 18)}</button></div></div>` : ''}
          <ol class="steps"><li>Scan the QR or open the link on your phone and log in with your Restaurant ID and password.</li>
            <li>${ios ? 'In Safari tap <b>Share › Add to Home Screen</b>.' : 'In Chrome tap <b>⋮ › Install app</b> (iPhone: Safari <b>Share › Add to Home Screen</b>).'}</li>
            <li>Open <b>Dine In Admin</b> from the home screen and tap <b>Turn on alerts</b>.</li></ol>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
            ${!window.vdDesktop && !inApp && isPhone() ? `<button class="btn btn-primary" id="phoneInstall" type="button">${icon('mobile', 18)} ${S.installEvt ? 'Install on this phone' : 'Add to home screen'}</button>` : ''}
            ${q ? `<a class="btn" target="_blank" href="https://wa.me/?text=${encodeURIComponent('Veyra Dine In admin for ' + S.me.restaurant.name + ': ' + q.url)}">${icon('phone', 18)} Send link on WhatsApp</a>` : ''}
          </div>
          ${q && /^http:\/\/(10|192\.168|172\.)/.test(q.url) ? `<p class="muted" style="font-size:13px;margin:10px 0 0">This computer runs your orders on the shop Wi-Fi, so the phone must be on the same Wi-Fi. Switch the app to online mode to use it from anywhere.</p>` : `<p class="muted" style="font-size:13px;margin:10px 0 0">Works on mobile data too. Several phones can be logged in at the same time, for example the owner and the counter.</p>`}
        </div></div></div>`;
    const cp = box.querySelector('#cpyPhone'); if (cp) cp.onclick = () => { navigator.clipboard.writeText(q.url).then(() => toast('Link copied', 'ok')).catch(() => { box.querySelector('input').select(); }); };
    const ib = box.querySelector('#phoneInstall'); if (ib) ib.onclick = installApp;
  }
  function hubBanner() {
    if (!S.me.hubMode) return '';
    return `<div class="banner hub-on">${icon('wifi', 22)}<span>No internet, so the WiFi backup is on. Orders from the backup QR and from waiters on your WiFi come in here. They go to your online account by themselves when the internet is back. Keep this computer on.</span></div>`;
  }
  async function drawHub() {
    const b = document.getElementById('hubB'); if (!b) return;
    const h = await window.vdDesktop.hub().catch(() => null);
    if (!document.body.contains(b)) return;
    if (!h) { b.innerHTML = '<p class="muted" style="margin:0">The WiFi backup could not start on this computer. Close and open the app again.</p>'; return; }
    const a0 = h.copiedAt ? ago(h.copiedAt) : '', when = /ago|now/i.test(a0) ? a0.toLowerCase() : 'at ' + a0;
    b.innerHTML = `<div class="hub-box"><span>Status</span><b>${h.copiedAt ? 'Ready. Copy updated ' + esc(when) : 'Making the first copy…'}</b><span>Backup address on your WiFi</span><b style="word-break:break-all">${h.lan ? esc(h.lan) : 'Connect this computer to the restaurant WiFi'}</b>${h.pending ? `<span>Waiting to go online</span><b>${h.pending} order${h.pending > 1 ? 's' : ''}</b>` : ''}</div>
      <ol class="hub-steps"><li>Print the backup QR cards and stick one on each table, next to the normal one (or on the back).</li><li>Keep this computer on and connected to the restaurant WiFi, with the app open.</li><li>Ask whoever set up your WiFi router to give this computer a fixed address, so the backup QR keeps working.</li><li>The first time, Windows may ask about the firewall. Tap <b>Allow</b> so phones on the WiFi can reach this computer.</li></ol>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-primary" type="button" id="hubPrint" ${h.copiedAt && h.lan ? '' : 'disabled'}>${icon('printer', 18)} Print backup QR cards</button><button class="btn" type="button" id="hubRef">${icon('refresh', 18)} Update the copy now</button></div>`;
    document.getElementById('hubPrint').onclick = () => { window.vdDesktop.hubPrint(); toast('The backup QR cards open in your browser. Print them from there.', 'ok'); };
    document.getElementById('hubRef').onclick = () => { window.vdDesktop.hubRefresh(); toast('Updating the copy. This takes a few seconds.', 'ok'); setTimeout(drawHub, 6000); };
  }
  function renderOrders(c) {
    const st = S.stats || { ordersToday: 0, salesToday: 0, activeTables: 0, activeOrders: 0 };
    const isLocal = /localhost|127\.0\.0\.1/.test(S.me.baseUrl);
    c.innerHTML = `
      ${phoneBanner()}${hubBanner()}
      <div class="o-tools"><button class="btn btn-primary" id="newOrder">${icon('plus', 18)} New order</button>${KDS() ? `<button class="btn" id="openKds">${icon('chef', 18)} Kitchen display</button>` : ''}${DISP() ? `<button class="btn" id="openDisp">${icon('monitor', 18)} Customer display</button>` : ''}<span class="muted">Take an order at the counter or for a phone call. ${S.me.restaurant.service && S.me.restaurant.service.autoAccept ? 'QR orders go straight to the kitchen.' : ''}</span></div>
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
    const no = document.getElementById('newOrder'); if (no) no.onclick = () => newOrder();
    const od = document.getElementById('openDisp'); if (od) od.onclick = openDisplay;
    const ok = document.getElementById('openKds'); if (ok) ok.onclick = openKitchen;
    const ai = document.getElementById('appInstall'); if (ai) ai.onclick = installApp;
    const ax = document.getElementById('appHintX'); if (ax) ax.onclick = () => { lsSet('vd_app_hint', 'x'); renderOrders(c); };
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
      <div class="o-head"><div><div class="o-table">${esc(o.tableName)}</div><div class="o-meta">Order #${o.number}${o.customerName ? ' · ' + esc(o.customerName) : ''}</div>${o.offline && String(o.id).startsWith('off-') ? `<span class="badge badge-amber o-tag">${icon('wifi', 12)} Saved offline</span>` : o.source === 'counter' ? `<span class="badge badge-grey o-tag">Counter order</span>` : ''}</div>
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
    if (S.offline || String(oid).startsWith('off-')) return offlineStatus(oid, status);
    try {
      const o = await api('/api/admin/orders/' + oid, { method: 'PATCH', body: { status } });
      S.newIds.delete(oid); upsertOrder(o);
      if (status === 'served') toast(`${icon('check', 18)} ${esc(o.tableName)} served`, 'ok');
    } catch (err) { if (err.offline) return offlineStatus(oid, status); toast(esc(err.message), 'error'); }
  }
  function upsertOrder(o) {
    const i = S.orders.findIndex(x => x.id === o.id);
    const active = ['new', 'preparing', 'ready'].includes(o.status);
    if (i >= 0) { if (active) S.orders[i] = o; else S.orders.splice(i, 1); } else if (active) S.orders.push(o);
    if (!S.offline) api('/api/admin/stats?tz=' + TZ).then(s => { S.stats = s; saveCache(); if (S.tab === 'orders') renderOrders(document.getElementById('content')); }).catch(() => {});
    saveCache();
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
    es.onerror = () => setTimeout(drawNet, 50);
    es.onopen = () => { drawNet(); return loadLive().then(() => { if (S.tab === 'orders') renderOrders(document.getElementById('content')); refreshBadges(); }).catch(() => {}); };
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
      <div id="ws"></div>
        <div class="panel"><div class="panel-head"><h2>By table</h2></div>
          <table class="tbl"><thead><tr><th>Table</th><th class="r">Orders</th><th class="r">Sales</th></tr></thead><tbody>${R.tables.map(t => `<tr><td>${esc(t.name)}</td><td class="r">${t.orders}</td><td class="r">${cur(t.sales)}</td></tr>`).join('')}</tbody></table></div>
      </div>` : ''}
      <div class="panel"><div class="panel-head"><h2>Orders</h2>${R.list.length ? `<button class="btn btn-sm" id="csv">${icon('download', 16)} Download (Excel)</button>` : ''}</div>
      ${R.list.length ? `<table class="tbl"><thead><tr><th>Order</th><th>Table</th><th class="hide-sm">Items</th><th>Status</th><th class="r">Total</th><th class="r"><span class="hide-sm">Bill</span></th></tr></thead><tbody>
        ${R.list.map(o => `<tr><td><b>#${o.number}</b><br><span class="muted">${one ? '' : short(dkey(Date.parse(o.createdAt))) + ', '}${new Date(o.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span></td><td>${esc(o.tableName)}${o.customerName ? `<br><span class="muted">${esc(o.customerName)}</span>` : ''}</td>
          <td class="hide-sm">${o.items.map(l => `${l.qty}× ${esc(l.name)}`).join('<br>')}</td><td><span class="badge ${B[o.status]}">${o.status[0].toUpperCase() + o.status.slice(1)}</span></td><td class="r"><b>${cur(o.total)}</b></td><td class="r">${o.status !== 'cancelled' ? `<button class="btn btn-sm btn-ghost" data-rbill="${o.id}" title="Print this bill again">${icon('printer', 16)}<span class="hide-sm"> Print</span></button>` : ''}</td></tr>`).join('')}
        </tbody><tfoot><tr><td colspan="3" class="hide-sm"></td><td><b>${R.orders} orders</b></td><td class="r"><b>${cur(R.sales)}</b></td><td></td></tr></tfoot></table>`
        : `<div class="empty">${icon('receipt', 40)}<div>No orders ${one ? 'on this day' : 'in these dates'}.</div></div>`}</div>`;
    rep.querySelectorAll('[data-day]').forEach(b => b.onclick = () => { setRange(b.dataset.day, b.dataset.day); renderHistory(c); });
    drawWhatSells(R, one);
    rep.querySelectorAll('[data-rbill]').forEach(b => b.onclick = () => { const o = R.list.find(x => x.id === b.dataset.rbill); if (!o) return;
      printBill({ table: { name: o.tableName }, when: o.createdAt, orders: [o], people: o.customerName ? [{ name: o.customerName }] : [], lines: o.items.map(l => ({ name: l.name, qty: l.qty, price: l.price })), discount: o.discount || 0, coupons: o.coupon ? [o.coupon] : [], total: o.total, paid: [] }); });
    const csv = document.getElementById('csv');
    if (csv) csv.onclick = () => {
      const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const rows = [['Order', 'Date', 'Time', 'Table', 'Customer', 'Items', 'Status', 'Total'].map(q).join(',')].concat(R.list.map(o => [o.number, dkey(Date.parse(o.createdAt)), new Date(o.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }), o.tableName, o.customerName, o.items.map(l => `${l.qty} x ${l.name}`).join('; '), o.status, o.total].map(q).join(',')));
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + rows.join('\r\n')], { type: 'text/csv' }));
      a.download = `orders-${S.rFrom}${one ? '' : '-to-' + S.rTo}.csv`; a.click();
    };
  }

  // ---------- what sells: share of sales by category and dish, and dishes nobody ordered ----------
  function drawWhatSells(R, one) {
    const box = document.getElementById('ws'); if (!box || !R.orders) return;
    const pct = (a, b) => b ? (a * 100 / b) : 0, fmtP = v => (v >= 10 || v === 0 ? Math.round(v) : v.toFixed(1)) + '%';
    const totalQty = R.dishes.reduce((t, d) => t + d.qty, 0), base = R.itemSales || 1;
    S.wsSort = S.wsSort || 'sales'; if (S.wsCat && !R.categories.some(k => k.name === S.wsCat)) S.wsCat = '';
    let list = R.dishes.filter(d => !S.wsCat || d.category === S.wsCat).slice().sort((a, b) => S.wsSort === 'qty' ? b.qty - a.qty || b.sales - a.sales : b.sales - a.sales || b.qty - a.qty);
    const shown = S.wsAll ? list : list.slice(0, 12);
    const top = R.categories[0], low = R.categories.length > 1 ? R.categories[R.categories.length - 1] : null;
    const bar = (v, max) => `<span class="ws-bar"><i style="width:${Math.max(2, Math.round(v * 100 / (max || 1)))}%"></i></span>`;
    const maxCat = Math.max(...R.categories.map(k => k.sales), 1), maxDish = Math.max(...list.map(d => S.wsSort === 'qty' ? d.qty : d.sales), 1);
    box.innerHTML = `<div class="panel"><div class="panel-head"><div><h2>What sells</h2><span class="muted" style="font-size:14px">${one ? 'This day' : 'These dates'}: ${totalQty} items sold across ${R.orders} orders${top ? `. <b>${esc(top.name)}</b> brings ${fmtP(pct(top.sales, base))} of sales${low ? `, <b>${esc(low.name)}</b> only ${fmtP(pct(low.sales, base))}` : ''}.` : ''}</span></div><button class="btn btn-sm" id="wsCsv">${icon('download', 16)} Download (Excel)</button></div>
      <div class="panel-body">
        <h3 class="ws-h">By category</h3>
        <div class="ws-cats">${R.categories.map(k => `<button class="ws-cat ${S.wsCat === k.name ? 'on' : ''}" data-wscat="${esc(k.name)}"><span class="nm">${esc(k.name)}</span>${bar(k.sales, maxCat)}<b>${fmtP(pct(k.sales, base))}</b><small>${cur(k.sales)} · ${k.qty} sold</small></button>`).join('')}</div>
        <div class="ws-tools"><h3 class="ws-h">${S.wsCat ? esc(S.wsCat) : 'All dishes'}${S.wsCat ? ` <button class="chip" data-wscat="">Show all</button>` : ''}</h3>
          <div class="ws-seg"><button class="${S.wsSort === 'sales' ? 'on' : ''}" data-wssort="sales">By sales</button><button class="${S.wsSort === 'qty' ? 'on' : ''}" data-wssort="qty">By quantity</button></div></div>
        <div style="overflow-x:auto"><table class="tbl ws-tbl"><thead><tr><th>Dish</th><th class="hide-sm">Category</th><th class="r">Sold</th><th class="r hide-sm">Share of items</th><th class="r">Sales</th><th class="r">Share of sales</th><th class="r hide-sm" title="How many orders had this dish">In orders</th></tr></thead><tbody>
          ${shown.map(d => `<tr><td>${dietMark(d.diet)} ${esc(d.name)}${bar(S.wsSort === 'qty' ? d.qty : d.sales, maxDish)}</td><td class="hide-sm muted">${esc(d.category)}</td><td class="r">${d.qty}</td><td class="r hide-sm">${fmtP(pct(d.qty, totalQty))}</td><td class="r">${cur(d.sales)}</td><td class="r"><b>${fmtP(pct(d.sales, base))}</b></td><td class="r hide-sm">${fmtP(pct(d.orders, R.orders))}</td></tr>`).join('')}
        </tbody></table></div>
        ${list.length > 12 ? `<button class="btn btn-sm" id="wsAll" style="margin-top:10px">${S.wsAll ? 'Show top 12' : `Show all ${list.length} dishes`}</button>` : ''}
        ${R.notSold.filter(n => !S.wsCat || n.category === S.wsCat).length ? `<h3 class="ws-h" style="margin-top:22px">Not ordered ${one ? 'on this day' : 'in these dates'} <span class="muted" style="font-weight:600">(0%)</span></h3>
          <div class="ws-zero">${R.notSold.filter(n => !S.wsCat || n.category === S.wsCat).map(n => `<span>${esc(n.name)} <small>${esc(n.category)}</small></span>`).join('')}</div>
          <p class="muted" style="font-size:13px;margin:8px 0 0">Think about a better photo, a lower price, a combo, or taking these off the menu.</p>` : ''}
      </div></div>`;
    box.querySelectorAll('[data-wscat]').forEach(b => b.onclick = () => { S.wsCat = S.wsCat === b.dataset.wscat ? '' : b.dataset.wscat; S.wsAll = false; drawWhatSells(R, one); });
    box.querySelectorAll('[data-wssort]').forEach(b => b.onclick = () => { S.wsSort = b.dataset.wssort; drawWhatSells(R, one); });
    const all = box.querySelector('#wsAll'); if (all) all.onclick = () => { S.wsAll = !S.wsAll; drawWhatSells(R, one); };
    box.querySelector('#wsCsv').onclick = () => {
      const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const rows = [['Dish', 'Category', 'Sold', 'Share of items %', 'Sales', 'Share of sales %', 'In orders %'].map(q).join(',')]
        .concat(R.dishes.map(d => [d.name, d.category, d.qty, pct(d.qty, totalQty).toFixed(1), d.sales, pct(d.sales, base).toFixed(1), pct(d.orders, R.orders).toFixed(1)].map(q).join(',')))
        .concat(R.notSold.map(n => [n.name, n.category, 0, 0, 0, 0, 0].map(q).join(',')))
        .concat(['', ['Category', '', 'Sold', '', 'Sales', 'Share of sales %', ''].map(q).join(',')]).concat(R.categories.map(k => [k.name, '', k.qty, '', k.sales, pct(k.sales, base).toFixed(1), ''].map(q).join(',')));
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + rows.join('\r\n')], { type: 'text/csv' }));
      a.download = `what-sells-${S.rFrom}${one ? '' : '-to-' + S.rTo}.csv`; a.click();
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
      <div class="panel"><div class="panel-head"><h2>Categories</h2><div style="display:flex;gap:6px"><button class="btn btn-sm" id="impMenu" title="Add many dishes at once from a list or a CSV file">${icon('download', 16)} Import</button><button class="btn btn-sm" id="addCat">${icon('plus', 16)} Add</button></div></div>
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
    document.getElementById('impMenu').onclick = importMenu;
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
    const r = S.me.restaurant, DC = () => r.displayCfg || {}, KC = () => r.kitchenCfg || {};
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
      <div class="panel" id="phonePanel"></div>
      <div class="panel" id="waitP"><div class="panel-head"><div><h2>Waiters</h2><span class="muted" style="font-size:14px">Waiters take orders on their own phones: tap the table, add dishes, send to the kitchen. They also see calls from tables and when food is ready.</span></div></div><div class="panel-body form">
        <form id="wpinF" class="loy-f"><input class="input" name="pin" type="password" inputmode="numeric" pattern="[0-9]*" minlength="4" maxlength="6" placeholder="${r.hasWaiterPin ? 'New PIN, 4–6 digits' : 'PIN, 4–6 digits'}" required autocomplete="new-password"><button class="btn btn-primary">${r.hasWaiterPin ? 'Change PIN' : 'Set PIN'}</button></form>
        <small class="muted" style="margin-top:-8px">${r.hasWaiterPin ? 'A PIN is set. Changing it logs out every waiter phone.' : 'No PIN yet, so waiters cannot log in.'}</small>
        <div id="wlink" class="w-link-box"></div>
      </div></div>
      <form class="panel" id="kdsF"><div class="panel-head"><div><h2>Kitchen display (KDS)</h2><span class="muted" style="font-size:14px">A screen in the kitchen with every order to cook as a big ticket: table, dishes, notes and a timer that turns amber at 10 minutes and red at 20. Cooks tap Start cooking, then Ready, and the counter, waiters and guests see it at once. No paper KOT needed. Use a TV, a monitor or a tablet.</span></div>${KC().on ? `<button type="button" class="btn btn-sm" id="kdsOpen">${icon('chef', 16)} Open kitchen display</button>` : ''}</div><div class="panel-body form">
        <label class="switch"><input type="checkbox" name="on" ${KC().on ? 'checked' : ''}><span class="track"></span>Turn on the kitchen display</label>
        <div class="disp-opts">
          <label class="switch"><input type="checkbox" name="sound" ${KC().sound !== false ? 'checked' : ''}><span class="track"></span>Ring a bell for every new order</label>
          <label class="switch"><input type="checkbox" name="readyShow" ${KC().readyShow !== false ? 'checked' : ''}><span class="track"></span>Show ready orders at the bottom (tap to bring one back)</label>
        </div>
        <button class="btn btn-primary" style="justify-self:start">Save kitchen display</button>
        <div id="klink" class="w-link-box"></div>
      </div></form>
      <form class="panel" id="dispF"><div class="panel-head"><div><h2>Counter display (customer screen)</h2><span class="muted" style="font-size:14px">A screen at your counter that faces customers. While you take an order or open a bill it shows the dishes, the total and a UPI QR for the exact amount. The rest of the time it shows which order numbers are cooking and which are ready to collect. Use a second monitor, a TV or an old tablet.</span></div>${DC().on ? `<button type="button" class="btn btn-sm" id="dispOpen">${icon('monitor', 16)} Open display</button>` : ''}</div><div class="panel-body form">
        <label class="switch"><input type="checkbox" name="on" ${DC().on ? 'checked' : ''}><span class="track"></span>Turn on the counter display</label>
        <label class="field"><span>Welcome message (optional)</span><input class="input" name="welcome" maxlength="120" value="${esc(DC().welcome || '')}" placeholder="E.g. Fresh dosas all day. Order and pay at the counter."></label>
        <div class="disp-opts">
          <label class="switch"><input type="checkbox" name="board" ${DC().board ? 'checked' : ''}><span class="track"></span>Show order numbers: Preparing and Ready to collect</label>
          <label class="switch"><input type="checkbox" name="sound" ${DC().sound ? 'checked' : ''}><span class="track"></span>Chime when an order is ready</label>
          <label class="switch"><input type="checkbox" name="menuQr" ${DC().menuQr ? 'checked' : ''}><span class="track"></span>Show the menu QR</label>
          <label class="switch"><input type="checkbox" name="wifi" ${DC().wifi ? 'checked' : ''}><span class="track"></span>Show guest WiFi${r.wifiCfg && r.wifiCfg.on ? '' : ' (turn on WiFi for guests below)'}</label>
          <label class="switch"><input type="checkbox" name="offers" ${DC().offers ? 'checked' : ''}><span class="track"></span>Show coupons marked “Show on menu”</label>
        </div>
        ${r.upiId ? '' : '<p class="muted" style="margin:0;font-size:13px">Add your UPI ID under “Split bill and UPI payments” so the screen shows a QR to pay. Without it, the screen shows the amount and asks guests to pay at the counter.</p>'}
        <button class="btn btn-primary" style="justify-self:start">Save counter display</button>
        <div id="dlink" class="w-link-box"></div>
      </div></form>
      ${window.vdDesktop && window.vdDesktop.hub && !S.me.hubMode ? `<div class="panel" id="hubP"><div class="panel-head"><div><h2>WiFi backup (no internet)</h2><span class="muted" style="font-size:14px">This computer keeps a copy of your menu and tables. If the internet goes down, the app switches to it by itself. Guests scan the backup QR and waiters keep taking orders on your WiFi. When the internet is back, every order goes online with no doubles.</span></div></div><div class="panel-body form" id="hubB"><p class="muted" style="margin:0">Checking the backup…</p></div></div>` : ''}
      <form class="panel" id="svcF"><div class="panel-head"><div><h2>Orders without a waiter</h2><span class="muted" style="font-size:14px">Guests scan, order and pay from the table. The kitchen gets the order straight away.</span></div></div><div class="panel-body form">
        <label class="switch"><input type="checkbox" name="autoAccept" ${r.service && r.service.autoAccept ? 'checked' : ''}><span class="track"></span>Send QR orders straight to the kitchen (no "Accept" tap needed)</label>
        <label class="switch"><input type="checkbox" name="payFirst" ${r.service && r.service.payFirst ? 'checked' : ''} ${r.upiId ? '' : 'disabled'}><span class="track"></span>Ask guests to pay by UPI right after they order</label>
        ${r.upiId ? '' : '<p class="muted" style="margin:0;font-size:13px">Add your UPI ID under “Split bill and UPI payments” to turn on pay at the table.</p>'}
        <p class="muted" style="margin:0;font-size:13px">${window.vdDesktop ? 'To print the kitchen ticket (KOT) by itself for every order, turn on “Print a KOT automatically” under Bill printer below.' : 'Kitchen tickets print by themselves in the Windows app (Settings › Bill printer).'} Guests' “I've paid” shows here with the amount. Check it in your UPI app.</p>
      </div></form>
      <form class="panel" id="wifiF"><div class="panel-head"><div><h2>WiFi for guests</h2><span class="muted" style="font-size:14px">Guests see a WiFi button on the menu with the name and password, a copy button and a QR to join.</span></div></div><div class="panel-body form">
        <label class="switch"><input type="checkbox" name="on" ${r.wifiCfg && r.wifiCfg.on ? 'checked' : ''}><span class="track"></span>Show WiFi on the menu</label>
        <div class="loy-rules" style="grid-template-columns:1fr 1fr">
          <label class="field"><span>WiFi name</span><input class="input" name="ssid" maxlength="32" value="${esc((r.wifiCfg || {}).ssid || '')}" placeholder="E.g. MasalaTable_Guest"></label>
          <label class="field"><span>Password (leave empty if none)</span><input class="input" name="pass" maxlength="63" value="${esc((r.wifiCfg || {}).pass || '')}" autocomplete="off"></label>
        </div>
        <button class="btn btn-primary" style="justify-self:start">Save WiFi</button>
      </div></form>
      <form class="panel" id="gameF"><div class="panel-head"><div><h2>Games for guests</h2><span class="muted" style="font-size:14px">Three free mini games guests play while the food cooks. The best scores each week go on a leaderboard on your menu and on the Veyra Dine In website (first name and score only, never phone numbers).</span></div>${r.gamesCfg && r.gamesCfg.on ? `<button type="button" class="btn btn-sm" id="gbBtn">${icon('star', 16)} Leaderboard</button>` : ''}</div><div class="panel-body form">
        <label class="switch"><input type="checkbox" name="on" ${r.gamesCfg && r.gamesCfg.on ? 'checked' : ''}><span class="track"></span>Show games on the menu</label>
        <div class="loy-rules" style="grid-template-columns:1fr 1fr">
          <label class="field"><span>Weekly prize for the top scorer (optional)</span><input class="input" name="reward" maxlength="80" value="${esc((r.gamesCfg || {}).reward || '')}" placeholder="E.g. Free gulab jamun"></label>
          <label class="field"><span>Bonus loyalty points for the winner</span><input class="input" name="points" type="number" min="0" step="1" value="${(r.gamesCfg || {}).points || 0}" ${r.loyaltyCfg && r.loyaltyCfg.on ? '' : 'disabled title="Turn on loyalty points to use this"'}></label>
        </div>
        <p class="muted" style="margin:0;font-size:13px">Games are free to play. Never charge guests to play for a prize.</p>
        <button class="btn btn-primary" style="justify-self:start">Save games</button>
      </div></form>
      <form class="panel" id="loyF"><div class="panel-head"><div><h2>Loyalty points</h2><span class="muted" style="font-size:14px">Customers collect points with their mobile number. No app or card needed. You choose the rules.</span></div>${r.loyaltyCfg && r.loyaltyCfg.on ? `<button type="button" class="btn btn-sm" id="custBtn">${icon('user', 16)} Customers</button>` : ''}</div><div class="panel-body form">
        <label class="switch"><input type="checkbox" name="on" ${r.loyaltyCfg && r.loyaltyCfg.on ? 'checked' : ''}><span class="track"></span>Give loyalty points</label>
        <div class="loy-rules">
          <label class="field"><span>Spend (₹) to earn 1 point</span><input class="input" name="spend" type="number" min="1" step="1" value="${(r.loyaltyCfg || {}).spend || 100}"></label>
          <label class="field"><span>1 point is worth (₹)</span><input class="input" name="value" type="number" min="0.01" step="0.01" value="${(r.loyaltyCfg || {}).value || 1}"></label>
          <label class="field"><span>Points needed before they can be used</span><input class="input" name="min" type="number" min="0" step="1" value="${(r.loyaltyCfg || {}).min ?? 50}"></label>
        </div>
        <p class="muted" id="loyEx" style="margin:0;font-size:14px"></p>
        <button class="btn btn-primary" style="justify-self:start">Save loyalty rules</button>
      </div></form>
      <form class="panel" id="ideaF"><div class="panel-head"><div><h2>Suggest a feature or ask for custom work</h2><span class="muted" style="font-size:14px">Tell Veyra what you'd like next, or what you need built for your restaurant. We reply on WhatsApp.</span></div></div><div class="panel-body form">
        <div class="wseg" style="justify-self:start" role="radiogroup" aria-label="What is it?"><label><input type="radio" name="type" value="feature" checked>Feature idea</label><label><input type="radio" name="type" value="custom">Custom build</label></div>
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
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px"><label class="field"><span>GSTIN (optional)</span><input class="input" name="gstin" maxlength="20" value="${esc(BILLCFG().gstin)}" placeholder="27ABCDE1234F1Z5"></label><label class="field"><span>FSSAI no. (optional)</span><input class="input" name="fssai" maxlength="20" value="${esc(BILLCFG().fssai)}"></label></div>
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
    phonePanel(document.getElementById('phonePanel'));
    const svcF = document.getElementById('svcF');
    api('/api/admin/waiter-link').then(d => { const b = document.getElementById('wlink'); if (!b) return; b.innerHTML = `<div class="w-qr">${d.qr}</div><div><b>Waiters scan this, or open:</b><a href="${esc(d.link)}" target="_blank">${esc(d.link)}</a><span class="muted">Log in with your restaurant ID <b>${esc(r.slug)}</b>, their name and the PIN.</span><button class="btn btn-sm" type="button" id="wcopy">${icon('copy', 16)} Copy link</button></div>`; document.getElementById('wcopy').onclick = () => { navigator.clipboard.writeText(d.link).then(() => toast('Link copied', 'ok')).catch(() => {}); }; }).catch(() => {});
    if (document.getElementById('hubB')) drawHub();
    const kdsF = document.getElementById('kdsF');
    const drawKLink = () => api('/api/admin/kitchen-link').then(d => { const b = document.getElementById('klink'); if (!b || !d.link || !d.on) return;
      b.innerHTML = `<div class="w-qr">${d.qr}</div><div><b>Open this on the kitchen screen, or scan it with the tablet:</b><a href="${esc(d.link)}" target="_blank" rel="noreferrer">${esc(d.link.replace(/^https?:\/\//, '').replace(/\?k=.*/, '?k=…'))}</a>
        <span class="muted">${d.screens ? `${icon('check', 14)} ${d.screens} kitchen screen${d.screens === 1 ? ' is' : 's are'} open now.` : 'No kitchen screen is open right now.'} No login needed, so anyone with this link can use it. Make a new link if it gets shared.</span>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-sm btn-primary" type="button" id="kOpen">${icon('chef', 16)} Open on this computer</button><button class="btn btn-sm" type="button" id="kCopy">${icon('copy', 16)} Copy link</button><button class="btn btn-sm btn-ghost" type="button" id="kNew">${icon('refresh', 16)} New link</button></div></div>`;
      document.getElementById('kOpen').onclick = openKitchen;
      document.getElementById('kCopy').onclick = () => { navigator.clipboard.writeText(d.link).then(() => toast('Link copied', 'ok')).catch(() => prompt('Copy this link', d.link)); };
      document.getElementById('kNew').onclick = async () => { if (!(await confirmBox('Make a new kitchen link?', 'Kitchen screens using the old link stop at once. Open the new link on them again.', 'Make new link'))) return; try { S.me.restaurant = await api('/api/admin/kitchen/new-link', { method: 'POST' }); saveCache(); toast('New link made', 'ok'); drawKLink(); } catch (err) { toast(esc(err.message), 'error'); } };
    }).catch(() => {});
    drawKLink();
    const kOpenTop = document.getElementById('kdsOpen'); if (kOpenTop) kOpenTop.onclick = openKitchen;
    kdsF.onsubmit = async e => { e.preventDefault(); const f = new FormData(kdsF); try { S.me.restaurant = await api('/api/admin/settings', { method: 'PUT', body: { kitchen: { on: !!f.get('on'), sound: !!f.get('sound'), readyShow: !!f.get('readyShow') } } }); saveCache(); toast(`${icon('check', 18)} Kitchen display saved`, 'ok'); renderSettings(c); } catch (err) { toast(esc(err.message), 'error'); } };
    const dispF = document.getElementById('dispF');
    const drawDLink = () => api('/api/admin/display-link').then(d => { const b = document.getElementById('dlink'); if (!b || !d.link || !d.on) return;
      b.innerHTML = `<div class="w-qr">${d.qr}</div><div><b>Open this on the customer screen, or scan it with the tablet:</b><a href="${esc(d.link)}" target="_blank" rel="noreferrer">${esc(d.link.replace(/^https?:\/\//, '').replace(/\?k=.*/, '?k=…'))}</a>
        <span class="muted">${d.screens ? `${icon('check', 14)} ${d.screens} screen${d.screens === 1 ? ' is' : 's are'} showing it now.` : 'No screen is showing it right now.'} Second monitor: tap Open on this computer, drag the window to that screen and tap Start display. Anyone with this link can see the screen, so make a new link if it gets shared.</span>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-sm btn-primary" type="button" id="dOpen">${icon('monitor', 16)} Open on this computer</button><button class="btn btn-sm" type="button" id="dCopy">${icon('copy', 16)} Copy link</button><button class="btn btn-sm btn-ghost" type="button" id="dNew">${icon('refresh', 16)} New link</button></div></div>`;
      document.getElementById('dOpen').onclick = openDisplay;
      document.getElementById('dCopy').onclick = () => { navigator.clipboard.writeText(d.link).then(() => toast('Link copied', 'ok')).catch(() => prompt('Copy this link', d.link)); };
      document.getElementById('dNew').onclick = async () => { if (!(await confirmBox('Make a new display link?', 'Screens using the old link stop at once. Open the new link on them again.', 'Make new link'))) return; try { S.me.restaurant = await api('/api/admin/display/new-link', { method: 'POST' }); saveCache(); toast('New link made', 'ok'); drawDLink(); } catch (err) { toast(esc(err.message), 'error'); } };
    }).catch(() => {});
    drawDLink();
    const dOpenTop = document.getElementById('dispOpen'); if (dOpenTop) dOpenTop.onclick = openDisplay;
    dispF.onsubmit = async e => { e.preventDefault(); const f = new FormData(dispF); try { S.me.restaurant = await api('/api/admin/settings', { method: 'PUT', body: { display: { on: !!f.get('on'), welcome: f.get('welcome'), board: !!f.get('board'), sound: !!f.get('sound'), menuQr: !!f.get('menuQr'), wifi: !!f.get('wifi'), offers: !!f.get('offers') } } }); saveCache(); toast(`${icon('check', 18)} Counter display saved`, 'ok'); renderSettings(c); } catch (err) { toast(esc(err.message), 'error'); } };
    document.getElementById('wpinF').onsubmit = async e => { e.preventDefault(); try { S.me.restaurant = await api('/api/admin/waiter-pin', { method: 'POST', body: { pin: e.target.pin.value } }); saveCache(); toast(`${icon('check', 18)} Waiter PIN saved`, 'ok'); renderSettings(document.getElementById('content')); } catch (err) { toast(esc(err.message), 'error'); } };
    svcF.onchange = async () => { const f = new FormData(svcF); try { S.me.restaurant = await api('/api/admin/settings', { method: 'PUT', body: { service: { autoAccept: !!f.get('autoAccept'), payFirst: !!f.get('payFirst') } } }); saveCache(); toast('Saved', 'ok'); } catch (err) { toast(esc(err.message), 'error'); } };
    const wifiF = document.getElementById('wifiF');
    wifiF.onsubmit = async e => { e.preventDefault(); const f = new FormData(wifiF); try { S.me.restaurant = await api('/api/admin/settings', { method: 'PUT', body: { wifi: { on: !!f.get('on'), ssid: f.get('ssid'), pass: f.get('pass') } } }); saveCache(); toast('WiFi saved', 'ok'); } catch (err) { toast(esc(err.message), 'error'); } };
    const loyF = document.getElementById('loyF');
    const loyEx = () => { const f = new FormData(loyF), sp = Number(f.get('spend')) || 100, v = Number(f.get('value')) || 1, mn = Number(f.get('min')) || 0; document.getElementById('loyEx').innerHTML = `Example: a ₹1,000 bill earns <b>${Math.floor(1000 / sp)} points</b>. ${mn} points take <b>${cur(Math.round(mn * v))}</b> off a later bill. Points are added when the order is served or the table is cleared, and used from the bill at the counter.`; };
    loyF.oninput = loyEx; loyEx();
    loyF.onsubmit = async e => { e.preventDefault(); const f = new FormData(loyF); try { S.me.restaurant = await api('/api/admin/settings', { method: 'PUT', body: { loyalty: { on: !!f.get('on'), spend: f.get('spend'), value: f.get('value'), min: f.get('min') } } }); saveCache(); toast('Loyalty rules saved', 'ok'); renderSettings(c); } catch (err) { toast(esc(err.message), 'error'); } };
    const cb = document.getElementById('custBtn'); if (cb) cb.onclick = customers;
    const gbb = document.getElementById('gbBtn'); if (gbb) gbb.onclick = gameBoard;
    const gameF = document.getElementById('gameF');
    gameF.onsubmit = async e => { e.preventDefault(); const f = new FormData(gameF); try { S.me.restaurant = await api('/api/admin/settings', { method: 'PUT', body: { games: { on: !!f.get('on'), reward: f.get('reward'), ...(f.get('points') != null ? { points: f.get('points') } : {}) } } }); saveCache(); toast('Games saved', 'ok'); renderTab(); } catch (err) { toast(esc(err.message), 'error'); } };
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
      body { width: ${w}mm; margin: 0 auto; padding: 3mm ${narrow ? 2.5 : 4}mm 8mm; font: ${narrow ? 11 : 12.5}px/1.35 "Segoe UI", Arial, sans-serif; color: #000 }
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
    const M = { cash: 'Cash', upi: 'UPI', card: 'Card', points: 'Points' };
    let qr = '';
    if (c.showUpi && r.upiId && left > 0 && !B.when) { try { qr = await (await fetch(`/api/admin/upi-qr?am=${left}&n=${encodeURIComponent(B.table.name + ' bill')}`)).text(); } catch {} }
    const html = receiptDoc(`${billHeader()}<hr>
      <div class="c b">BILL · ${esc(B.table.name)}</div>${B.when ? '<div class="c sm">(Reprint)</div>' : ''}
      <div class="r sm"><span>${stamp(B.when)}</span><span>${B.orders.length ? 'Order ' + B.orders.map(o => '#' + o.number).join(', ') : ''}</span></div>
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
    const M = { cash: 'Cash', upi: 'UPI', card: 'Card' }, ML = { ...M, points: 'Points' };
    let off = false, cust = null, lastLeft = null;
    onGone(o, () => { if (lastLeft) toDisplay({ mode: 'idle' }, true); });
    const load = async () => {
      try { B = await api(`/api/admin/tables/${tableId}/bill`); off = false; }
      catch (err) { if (!err.offline) throw err; B = offlineBill(tableId); off = true; }
      if (mode === 'equal' && n < 2) n = Math.max(2, B.people.length); draw();
    };
    function draw() {
      const paidTotal = B.paid.reduce((a, p) => a + p.amount, 0), left = Math.max(0, Math.round(B.total - paidTotal));
      const paidBy = gid => B.paid.filter(p => p.gid === gid).reduce((a, p) => a + p.amount, 0);
      const rows = mode === 'person'
        ? B.people.map(p => ({ gid: p.gid, name: p.name, amount: p.amount, due: Math.max(0, p.amount - paidBy(p.gid)), items: B.lines.filter(l => !l.shared && l.gid === p.gid) }))
        : Array.from({ length: n }, (_, i) => { const gid = 'eq' + (i + 1), each = Math.ceil(B.total / n), amt = i < n - 1 ? each : Math.max(0, Math.round(B.total) - each * (n - 1)); return { gid, name: 'Person ' + (i + 1), amount: amt, due: Math.max(0, amt - paidBy(gid)), items: [] }; });
      const Lc = S.me.restaurant.loyalty;
      if (mode !== 'person' || !rows.some(r => r.gid === sel && r.due)) sel = null;
      const selRow = sel && rows.find(r => r.gid === sel);
      if (!off && B.lines.length) { lastLeft = left; toDisplay({ mode: 'bill', tableId, ...(mode === 'equal' && left ? { split: n, amount: Math.min(left, Math.ceil(B.total / n)) } : selRow ? { amount: selRow.due, who: selRow.name } : {}) }); }
      o.querySelector('.sheet').innerHTML = `<div class="sheet-head"><h3>${esc(B.table.name)} · Bill</h3><button class="icon-btn" data-close>${icon('x', 20)}</button></div>
      <div class="sheet-body cbill">
        ${off ? `<div class="hint" style="margin:0 0 12px;background:#FEF3C7;color:#78350F">${icon('wifi', 18)}<div><b>Offline.</b> This bill is made from the orders on this screen. Payments and clearing the table are saved and sync when the internet is back.</div></div>` : ''}
        ${Lc && !off && B.lines.length ? `<div class="loy">
          <div class="loy-h">${icon('star', 16)} <b>Loyalty points</b><span class="muted">₹${Lc.spend} = 1 point · 1 point = ₹${Lc.value}</span></div>
          ${cust ? `<div class="loy-c"><div><b>${esc(cust.name || 'Customer')}</b> <span class="muted">${cust.phone.replace(/(\d{5})(\d{5})/, '$1 $2')}</span><small>${cust.points} points (worth ${cur(Math.round(cust.points * Lc.value))})${cust.visits ? ' · ' + cust.visits + ' visits' : ' · new customer'}</small></div>
              <div class="loy-b">${cust.points >= Lc.min && left ? `<button class="btn btn-sm btn-primary" id="useP">Use ${Math.min(cust.points, Math.floor(left / Lc.value))} points · ${cur(Math.round(Math.min(cust.points, Math.floor(left / Lc.value)) * Lc.value))} off</button>` : `<small class="muted">${cust.points < Lc.min ? `Can use points from ${Lc.min}` : ''}</small>`}<button class="btn btn-sm btn-ghost" id="chgP">Change</button></div></div>
              <small class="muted">This customer gets points for this bill when the table is cleared (₹${Lc.spend} = 1 point).</small>`
            : `<div class="loy-f"><input class="input" id="lph" inputmode="tel" maxlength="14" placeholder="Customer mobile number"><button class="btn" id="lgo">Add</button></div>`}
        </div>` : ''}
        ${!B.lines.length ? `<div class="empty">${icon('receipt', 40)}<div>No open bill on this table.</div></div>` : `
        <div class="cb-top"><div><small>Total</small><b>${cur(B.total)}</b>${B.discount ? `<span class="muted">after ${cur(B.discount)} coupon</span>` : ''}</div><div><small>Paid</small><b>${cur(paidTotal)}</b></div><div><small>Still to pay</small><b class="${left ? 'due' : 'ok'}">${left ? cur(left) : 'All paid'}</b></div></div>
        <div class="seg cb-seg"><button class="${mode === 'person' ? 'on' : ''}" data-m="person">By what each ate</button><button class="${mode === 'equal' ? 'on' : ''}" data-m="equal">Split equally</button><button class="${mode === 'one' ? 'on' : ''}" data-m="one">One payment</button></div>
        ${mode === 'equal' ? `<div class="cb-n">Split between <button class="btn btn-sm" data-n="-1">−</button><b>${n}</b><button class="btn btn-sm" data-n="1">+</button> people · ${cur(Math.ceil(B.total / n))} each</div>` : ''}
        ${mode === 'one' ? `<div class="cb-row sel"><div class="cb-who"><b>Whole table</b><small>${B.lines.map(l => `${l.qty}× ${esc(l.name)}`).join(', ')}</small></div><div class="cb-amt">${cur(left)}</div>
            ${left ? `<div class="cb-pay">${Object.entries(M).map(([k, l]) => `<button class="btn btn-sm" data-pay="${k}" data-gid="table" data-name="Table" data-amt="${left}">${l}</button>`).join('')}</div>` : `<span class="badge badge-green">${icon('check', 13)} Paid</span>`}</div>`
          : rows.map(r => `<div class="cb-row ${DISP() && r.gid === sel ? 'sel' : ''}"><div class="cb-who" ${DISP() && mode === 'person' && r.due && rows.length > 1 ? `data-show="${esc(r.gid)}" style="cursor:pointer"` : ''}><b>${esc(r.name)}</b>${r.items.length ? `<small>${r.items.map(l => `${l.qty}× ${esc(l.name)}`).join(', ')}</small>` : ''}${B.paid.filter(p => p.gid === r.gid).map(p => `<small class="pd">${icon('check', 12)} ${cur(p.amount)} ${ML[p.method] || 'UPI'}${p.counter ? '' : ' (guest says paid)'}</small>`).join('')}</div>
            <div class="cb-amt">${cur(r.amount)}</div>
            ${r.due ? `<div class="cb-pay">${Object.entries(M).map(([k, l]) => `<button class="btn btn-sm" data-pay="${k}" data-gid="${esc(r.gid)}" data-name="${esc(r.name)}" data-amt="${r.due}">${l}${r.due !== r.amount ? ' ' + cur(r.due) : ''}</button>`).join('')}</div>` : `<span class="badge badge-green">${icon('check', 13)} Paid</span>`}</div>`).join('')}
        ${DISP() && !off && mode === 'person' && rows.filter(r => r.due).length > 1 ? `<p class="muted" style="font-size:13px;margin:4px 0 0">${icon('mobile', 14)} The customer screen shows the whole amount. Tap a name to show only that person's share${sel ? ', tap it again for the whole table' : ''}.</p>` : ''}
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
      o.querySelectorAll('[data-show]').forEach(b => b.onclick = () => { sel = sel === b.dataset.show ? null : b.dataset.show; draw(); });
      const lgo = o.querySelector('#lgo'); if (lgo) { const lph = o.querySelector('#lph'); lph.onkeydown = e => { if (e.key === 'Enter') lgo.click(); };
        lgo.onclick = async () => { try { const x = await api(`/api/admin/tables/${tableId}/loyalty`, { method: 'POST', body: { phone: lph.value } }); cust = x.customer; B = x; draw(); } catch (err) { toast(esc(err.message), 'error'); } }; }
      const chg = o.querySelector('#chgP'); if (chg) chg.onclick = () => { cust = null; draw(); };
      const useP = o.querySelector('#useP'); if (useP) useP.onclick = async () => { useP.disabled = true; try { const x = await api(`/api/admin/tables/${tableId}/redeem`, { method: 'POST', body: { phone: cust.phone, points: cust.points } }); cust = x.customer; B = x; toast(`${icon('check', 18)} Points used`, 'ok'); draw(); } catch (err) { useP.disabled = false; toast(esc(err.message), 'error'); } };
      o.querySelectorAll('[data-pay]').forEach(b => b.onclick = async () => {
        b.disabled = true;
        if (off) { B.paid.push({ gid: b.dataset.gid, name: b.dataset.name, amount: Number(b.dataset.amt), method: b.dataset.pay, counter: true }); queue({ kind: 'payment', tableId, body: { gid: b.dataset.gid, name: b.dataset.name, amount: b.dataset.amt, method: b.dataset.pay } }); (S.offPaid[tableId] = S.offPaid[tableId] || []).push(B.paid[B.paid.length - 1]); draw(); return; }
        try { const x = await api(`/api/admin/tables/${tableId}/payment`, { method: 'POST', body: { gid: b.dataset.gid, name: b.dataset.name, amount: b.dataset.amt, method: b.dataset.pay } }); B = x; toast(`${icon('check', 18)} ${esc(b.dataset.name)} paid ${cur(b.dataset.amt)} by ${M[b.dataset.pay]}`, 'ok'); draw(); }
        catch (err) { b.disabled = false; toast(esc(err.message), 'error'); }
      });
      const pb = o.querySelector('#pbill'); if (pb) pb.onclick = () => printBill(B);
      const st = o.querySelector('#settle'); if (st) st.onclick = async () => {
        if (left && !(await confirmBox('Clear table with money still due?', `${cur(left)} is not marked as paid yet.`, 'Clear table'))) return;
        if (off) { queue({ kind: 'settle', tableId }); delete S.offPaid[tableId]; S.orders = S.orders.filter(x => x.tableId !== tableId || x.status === 'new' || x.status === 'preparing'); saveCache(); }
        else await api(`/api/admin/tables/${tableId}/settle`, { method: 'POST' });
        if (!left) lastLeft = 0; o.close();
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
    try { S.me = await api('/api/admin/me'); try { localStorage.setItem('vd_off_last', S.me.restaurant.slug); } catch {} }
    catch (err) {
      if (!err.offline) return;
      const last = lsGet('vd_off_last'); let cch = null; try { cch = JSON.parse(localStorage.getItem('vd_off_' + last) || 'null'); } catch {}
      if (!cch || !cch.me) { document.body.innerHTML = '<div style="font:16px system-ui;padding:60px 24px;text-align:center"><h2>No internet</h2><p>Open the admin once while online, then it keeps working offline.</p><button onclick="location.reload()" style="font:inherit;padding:12px 22px;border:0;border-radius:12px;background:#E4572E;color:#fff">Try again</button></div>'; return; }
      Object.assign(S, { me: cch.me, orders: cch.orders || [], requests: cch.requests || [], stats: cch.stats, menu: cch.menu, tables: cch.tables });
      S.offline = false; goOffline(); renderShell(); return;
    }
    if (window.vdDesktop) { window.vdDesktop.ready({ name: S.me.restaurant.name, access: S.me.restaurant.access }); unlockAudio(); }
    if (!S.me.restaurant.access.active) return renderActivate();
    const h = location.hash.slice(1); if (TABS.some(t => t[0] === h)) S.tab = h;
    await loadLive().catch(() => {});
    renderShell(); connect(); saveCache();
    Promise.all([S.menu ? S.menu : api('/api/admin/menu'), api('/api/admin/tables')]).then(([mn, tb]) => { S.menu = mn; S.tables = tb; saveCache(); }).catch(() => {});
    if (outbox().length) goOffline(true);
    if ('serviceWorker' in navigator && window.isSecureContext && location.protocol === 'https:') navigator.serviceWorker.register('/admin-sw.js', { scope: '/' }).then(r => { S.swReg = r; }).catch(() => {});
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
