/* Veyra Academy HQ: private master admin for Veyra.
   Live: talks to /api/hq/* (password + 30-minute idle lock).
   Preview: reads and writes the same in-browser demo data the academy apps use, so a key made here works in the admin app. */
(function () {
  const C = window.VFC, T = C.T, { ic, logo } = IC; const $ = s => document.querySelector(s);
  const LIVE = (window.HQ_CFG || {}).mode === 'live';
  const DAY = 864e5;
  const inr = n => '₹' + Math.round(n || 0).toLocaleString('en-IN');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cap = s => s ? s[0].toUpperCase() + s.slice(1) : '';
  const day = t => T.full(T.date(t));
  const appUrl = LIVE ? '/' : './';

  /* ---------- data: live server or preview ---------- */
  const Live = {
    async req(url, body) { const r = await fetch(url, { method: body ? 'POST' : 'GET', headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' }); const j = await r.json().catch(() => ({})); if (!r.ok) { const e = new Error(j.error || 'Something went wrong'); e.status = r.status; throw e; } return j; },
    needsSetup() { return this.req('/api/hq/needs-setup').then(j => j.setup); },
    login(pw, code) { return this.req('/api/hq/login', { pw, code }); },
    state() { return this.req('/api/hq/state'); },
    act(p) { return this.req('/api/hq/act', p); },
    logout() { return this.req('/api/hq/logout', {}); },
    backup() { location.href = '/api/hq/backup'; }
  };
  const Demo = (() => {
    const KEY = 'vf-demo-v3'; let db;
    const load = () => { try { db = JSON.parse(localStorage.getItem(KEY)); } catch (_) { db = null; } if (!db || !db.ac || !db.hq) seed(); db.hq.others = db.hq.others || []; db.hq.activity = db.hq.activity || []; db.hq.keys = db.hq.keys || []; };
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (_) {} };
    function seed() {
      db = { users: {}, mem: [], ac: {}, ses: null, hq: { plans: { monthly: 999, yearly: 7999, trial: 10 }, sales: [], keys: [], activity: [], seq: 41, others: [] } };
      const env = { url: location.href, ensureUser({ email, name, pw }) { const ex = Object.values(db.users).find(u => u.email === email); if (ex) return { uid: ex.id }; const id = C.id('u'); db.users[id] = { id, email, name, pw: pw || 'demo1234' }; return { uid: id }; }, link(uid, aid, role, sid) { db.mem.push({ uid, aid, role, sid: sid || '' }); }, unlink() {}, resetPw() { return 'demo1234'; }, mail() { return false; } };
      const ac = C.demo(env, Date.now()); db.ac[ac.id] = ac; db.demoAid = ac.id;
      const now = Date.now();
      db.hq.sales = [['Thane Tigers Football School', 'yearly', 7999, 'Razorpay', 2], ['Vashi United Juniors', 'monthly', 999, 'Razorpay', 6], ['Belapur Ballers', 'yearly', 7999, 'Licence key', 12], ['Panvel Footie Kids', 'monthly', 999, 'Razorpay', 27]].map(([academy, plan, amt, via, d], i) => ({ id: 'VFR-' + new Date().getFullYear() + '-00' + (38 + i), at: now - d * DAY, academy, plan, amt, via }));
      db.hq.others = [['Thane Tigers Football School', 'Ghodbunder Rd, Thane', 'yearly', 142, 300], ['Vashi United Juniors', 'Vashi, Navi Mumbai', 'monthly', 68, 24], ['Belapur Ballers', 'CBD Belapur', 'yearly', 91, 200], ['Panvel Footie Kids', 'New Panvel', 'monthly', 37, 3], ['Airoli Strikers Academy', 'Airoli', 'monthly', 44, -9]].map(([name, place, type, players, days]) => ({ name, place, type, players, until: now + days * DAY }));
      save();
    }
    const log = text => { db.hq.activity.unshift({ at: Date.now(), text }); db.hq.activity.length = Math.min(db.hq.activity.length, 300); };
    function sale(acName, aid, plan, amt, via, ref) { db.hq.seq = (db.hq.seq || 41) + 1; db.hq.sales.unshift({ id: `VFR-${new Date().getFullYear()}-${String(db.hq.seq).padStart(4, '0')}`, at: Date.now(), academy: acName, aid: aid || '', plan, amt, via, ref: ref || '' }); }
    function state() {
      load(); const now = Date.now();
      const real = Object.values(db.ac).map(ac => { const owner = db.users[(ac.admins || [])[0]] || {}; return { id: ac.id, name: ac.name, place: ac.place, plan: ac.plan.type, until: ac.plan.until, active: C.planActive(ac, now), suspended: !!ac.suspended, players: ac.players.filter(p => !p.left).length, staff: ac.staff.length, batches: ac.batches.length, createdAt: ac.createdAt, owner: owner.name || '', email: owner.email || '' }; });
      const oth = db.hq.others.map((o, i) => ({ id: 'o' + i, name: o.name, place: o.place, plan: o.type, until: o.until, active: !o.suspended && o.until > now, suspended: !!o.suspended, players: o.players, staff: '', batches: '', createdAt: now - (60 + i * 40) * DAY, owner: '', email: '', sample: true }));
      return { academies: real.concat(oth), sales: db.hq.sales, keys: db.hq.keys, plans: db.hq.plans, activity: db.hq.activity, users: Object.keys(db.users).length, base: location.origin,
        settings: { razorpay: { keyId: '', hasSecret: false, hasWebhook: false, webhookUrl: 'https://your-domain/api/razorpay/webhook' }, googleClientId: '', smtp: { host: '', port: 465, user: '', from: '', hasPass: false } }, version: 'preview' };
    }
    function act(p) {
      load(); const real = p.aid && db.ac[p.aid]; const o = p.aid && p.aid[0] === 'o' ? db.hq.others[+p.aid.slice(1)] : null; const name = real ? real.name : o ? o.name : '';
      const bump = () => { if (real) real.v = (real.v || 0) + 1; };
      let msg;
      switch (p.type) {
        case 'plans.save': { const m = +p.monthly, y = +p.yearly, t = +p.trial; if (!(m > 0 && y > 0 && t >= 1 && t <= 60)) throw new Error('Check the prices'); db.hq.plans = { monthly: Math.round(m), yearly: Math.round(y), trial: Math.round(t) }; log(`Prices changed: ${inr(m)}/month, ${inr(y)}/year, ${t}-day trial`); msg = 'Prices saved. The academy apps show them now.'; break; }
        case 'key.make': { if (!C.PLAN_DAYS[p.plan]) throw new Error('Pick a plan'); const code = C.mkKey(); db.hq.keys.unshift({ code, plan: p.plan, made: Date.now(), note: String(p.note || '').slice(0, 120), forName: String(p.forName || '').slice(0, 80), paidBy: p.paidBy || '' }); if (p.paidBy && p.paidBy !== 'Free') sale(p.forName || 'Key ' + code, '', p.plan, Math.round(+p.amount || db.hq.plans[p.plan]), 'Licence key · ' + p.paidBy, code); log(`Licence key ${code} made (${p.plan})`); save(); return { msg: 'Key made', code, state: state() }; }
        case 'key.stop': { const k = db.hq.keys.find(x => x.code === p.code); if (!k) throw new Error('Key not found'); k.stopped = !k.stopped; log(`Key ${k.code} ${k.stopped ? 'stopped' : 'restarted'}`); msg = k.stopped ? 'Key stopped. It cannot be used now.' : 'Key works again'; break; }
        case 'academy.extend': { if (!name) throw new Error('Academy not found'); const d = Math.max(1, Math.min(365, +p.days || 10)); const t = real ? real.plan : o; t.until = Math.max(Date.now(), t.until) + d * DAY; bump(); log(`${name}: added ${d} days`); msg = `Added ${d} days to ${name}`; break; }
        case 'academy.paid': { if (!name) throw new Error('Academy not found'); if (!C.PLAN_DAYS[p.plan]) throw new Error('Pick a plan'); if (real) C.applyPlan(real, p.plan, Date.now()); else { o.until = Math.max(Date.now(), o.until) + C.PLAN_DAYS[p.plan] * DAY; o.type = p.plan; } sale(name, p.aid, p.plan, Math.round(+p.amount || db.hq.plans[p.plan]), 'Manual · ' + (p.via || 'UPI')); log(`${name} marked paid (${p.plan})`); msg = `${name} is on the ${p.plan} plan`; break; }
        case 'academy.suspend': { if (!name) throw new Error('Academy not found'); const t = real || o; t.suspended = !t.suspended; bump(); log(`${name} ${t.suspended ? 'paused' : 'restored'}`); msg = t.suspended ? `${name} is paused. Their apps show a notice.` : `${name} is back on`; break; }
        case 'sale.manual': { const amt = Math.round(+p.amount); if (!amt) throw new Error('Add the amount'); sale(name || p.forName || 'Other', p.aid, p.plan || 'other', amt, 'Manual · ' + (p.via || 'UPI')); log(`Manual sale ${inr(amt)}`); msg = 'Sale added'; break; }
        case 'settings.save': msg = 'In this preview, settings are not kept. On the live site they are saved on the server.'; break;
        case 'password': msg = 'In this preview there is no HQ password. On the live site this changes it.'; break;
        case 'mail.test': throw new Error('Email works on the live site once SMTP is filled in');
        default: throw new Error('Unknown action');
      }
      save(); return { msg, state: state() };
    }
    return {
      needsSetup: () => Promise.resolve(false), login: () => Promise.resolve({ ok: true }),
      state: () => Promise.resolve(state()), act: p => { try { return Promise.resolve(act(p)); } catch (e) { return Promise.reject(e); } },
      logout: () => Promise.resolve(), backup() { load(); const b = new Blob([JSON.stringify(db, null, 1)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `veyra-academy-preview-${T.date()}.json`; a.click(); },
      onChange(cb) { window.addEventListener('storage', e => { if (e.key === KEY) cb(); }); }
    };
  })();
  const API = LIVE ? Live : Demo;

  /* ---------- state ---------- */
  const S = { locked: true, setup: false, tab: 'home', st: null, q: '', filter: 'all', lastKey: null, modal: null, err: '', busy: false, saleMonth: '' };
  const TABS = [['home', 'Overview', 'home'], ['academies', 'Academies', 'batch'], ['keys', 'Licence keys', 'key'], ['sales', 'Sales', 'receipt'], ['plans', 'Plans & prices', 'rupee'], ['settings', 'Settings', 'gear'], ['activity', 'Activity', 'clock']];
  const PHONE_TABS = ['home', 'academies', 'keys', 'sales'];

  function toast(m) { const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = ic('ok') + '<span>' + esc(m) + '</span>'; $('#toasts').appendChild(t); setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.parentNode && t.parentNode.removeChild(t), 300); }, 2800); }
  const fail = e => { if (e && e.status === 401 && LIVE) { S.locked = true; S.err = 'HQ locked after 30 minutes. Log in again.'; render(); return; } toast(e && e.message ? e.message : String(e)); };
  async function load() { try { S.st = await API.state(); render(); } catch (e) { fail(e); } }
  async function act(p, done) { if (S.busy) return; S.busy = true; try { const r = await API.act(p); S.st = r.state || S.st; if (done) done(r); else S.modal = null; render(); if (r.msg) toast(r.msg); } catch (e) { fail(e); } finally { S.busy = false; } }

  /* ---------- helpers ---------- */
  const status = a => { const left = Math.ceil((a.until - Date.now()) / DAY); if (a.suspended) return ['suspended', 'Paused', 'p-mute']; if (!a.active) return ['lapsed', 'Ended', 'p-bad']; if (a.plan === 'trial') return ['trial', left <= 3 ? `Trial · ${left}d left` : 'Trial', left <= 3 ? 'p-warn' : 'p-info']; if (left <= 7) return ['expiring', `Ends in ${left}d`, 'p-warn']; return ['active', 'Active', 'p-ok']; };
  const pill = a => { const [, l, c] = status(a); return `<span class="pill ${c}">${l}</span>`; };
  const av = n => { let h = 0; for (const c of n) h = (h * 31 + c.charCodeAt(0)) % 360; return `<span class="av" style="background:hsl(${h} 38% 32%)">${esc(n.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase())}</span>`; };
  const plansOf = () => S.st.plans;
  const monthKey = t => T.date(t).slice(0, 7);
  const F = (id, label, v, o) => { o = o || {}; return `<label class="field" for="${id}"><span>${label}</span><input class="input ${o.cls || ''}" id="${id}" value="${esc(v == null ? '' : v)}" ${o.type ? `type="${o.type}"` : ''} ${o.im ? `inputmode="${o.im}"` : ''} ${o.ph ? `placeholder="${esc(o.ph)}"` : ''} ${o.ac ? `autocomplete="${o.ac}"` : 'autocomplete="off"'}></label>`; };
  const SEL = (id, label, opts, cur) => `<label class="field" for="${id}"><span>${label}</span><select class="select" id="${id}">${opts.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(cur) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
  const val = id => ($('#' + id) || {}).value || '';
  function csv(name, rows) { const s = rows.map(r => r.map(c => { c = String(c == null ? '' : c); return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(',')).join('\n'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + s], { type: 'text/csv' })); a.download = name; a.click(); }

  /* ---------- views ---------- */
  function home() {
    const st = S.st, now = Date.now(), P = plansOf();
    const paying = st.academies.filter(a => a.active && a.plan !== 'trial');
    const mrr = paying.reduce((t, a) => t + (a.plan === 'monthly' ? P.monthly : P.yearly / 12), 0);
    const mk = monthKey(now), thisMonth = st.sales.filter(s => monthKey(s.at) === mk);
    const trials = st.academies.filter(a => a.active && a.plan === 'trial');
    const attention = st.academies.filter(a => { const k = status(a)[0]; return k !== 'active'; }).sort((a, b) => a.until - b.until);
    return `<div class="page-head"><div><h2>Veyra Academy HQ</h2><p>Only Veyra sees this. Academies, keys and money in one place.</p></div><button class="btn btn-primary" type="button" data-act="tab" data-v="keys">${ic('key')}New licence key</button></div>
    <div class="kpis">${[['Paying academies', paying.length, `${st.academies.length} ${st.academies.length === 1 ? 'academy' : 'academies'} in all`], ['Monthly revenue', inr(mrr), 'yearly plans counted per month'], [`${T.monthOnly(mk)} sales`, inr(thisMonth.reduce((t, s) => t + s.amt, 0)), thisMonth.length + ' payment' + (thisMonth.length === 1 ? '' : 's')], ['On trial', trials.length, `${P.trial}-day free trial`]].map(([l, v, d]) => `<div class="card kpi"><span class="label">${l}</span><span class="v tnum">${v}</span><span class="d">${d}</span></div>`).join('')}</div>
    <div class="grid g-main"><div class="card glow"><div class="card-h"><div><h3>Needs attention</h3><div class="sub">Trials ending, plans ending and paused academies</div></div></div><div class="list">${attention.length ? attention.slice(0, 8).map(a => `<div class="row" style="flex-wrap:wrap"><div class="who grow" style="min-width:200px">${av(a.name)}<div><b>${esc(a.name)}</b><small>${esc(a.place || '')}${a.place ? ' · ' : ''}${a.active ? 'ends ' : 'ended '}${day(a.until)}</small></div></div><div class="acts">${pill(a)}<button class="btn btn-ghost btn-sm" type="button" data-act="open" data-id="${a.id}">Manage</button></div></div>`).join('') : '<div class="empty">Every academy is paid up.</div>'}</div></div>
    <div class="card"><div class="card-h"><h3>Latest sales</h3><button class="btn btn-quiet btn-sm" type="button" data-act="tab" data-v="sales">All</button></div><div class="list">${st.sales.length ? st.sales.slice(0, 5).map(s => `<div class="row"><div class="grow" style="min-width:0"><b style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(s.academy)}</b><small class="faint">${day(s.at)} · ${cap(s.plan)} · ${esc(s.via)}</small></div><b class="tnum">${inr(s.amt)}</b></div>`).join('') : '<div class="empty">No sales yet.</div>'}</div></div></div>
    <div class="card"><div class="card-h"><h3>Recent activity</h3><button class="btn btn-quiet btn-sm" type="button" data-act="tab" data-v="activity">All</button></div>${activityList(st.activity.slice(0, 6))}</div>`;
  }
  const activityList = l => l.length ? l.map(a => `<div class="act-row"><time>${esc(T.ago(a.at, Date.now()))}</time><span>${esc(a.text)}</span></div>`).join('') : '<div class="empty">Nothing yet.</div>';
  function academies() {
    const st = S.st, q = S.q.toLowerCase();
    const l = st.academies.filter(a => (!q || (a.name + ' ' + a.place + ' ' + a.email + ' ' + a.owner).toLowerCase().includes(q)) && (S.filter === 'all' || status(a)[0] === S.filter || (S.filter === 'active' && status(a)[0] === 'expiring')));
    const count = k => st.academies.filter(a => status(a)[0] === k || (k === 'active' && status(a)[0] === 'expiring')).length;
    return `<div class="page-head"><div><h2>Academies</h2><p>${st.academies.length} ${st.academies.length === 1 ? 'academy' : 'academies'} · ${st.users} ${st.users === 1 ? 'person' : 'people'} with logins</p></div><label class="search" for="aq" style="width:min(320px,100%)">${ic('search')}<input class="input" id="aq" type="search" placeholder="Search name, place or email" value="${esc(S.q)}"></label></div>
    <div class="seg" role="group" aria-label="Filter" style="flex-wrap:wrap;justify-self:start;max-width:100%">${[['all', 'All', st.academies.length], ['active', 'Paid', count('active')], ['trial', 'Trial', count('trial')], ['lapsed', 'Ended', count('lapsed')], ['suspended', 'Paused', count('suspended')]].map(([k, lb, n]) => `<button type="button" data-act="filter" data-v="${k}" aria-pressed="${S.filter === k}">${lb} <span class="faint tnum">${n}</span></button>`).join('')}</div>
    <div class="card"><div class="table-wrap"><table class="t"><thead><tr><th>Academy</th><th class="hide-sm">Plan</th><th class="hide-sm">Players</th><th class="hide-sm">Paid until</th><th class="hide-xs">Status</th><th class="r"><span class="sr">Actions</span></th></tr></thead><tbody>
    ${l.length ? l.map(a => `<tr><td style="width:100%;max-width:0"><div class="who">${av(a.name)}<div><b>${esc(a.name)}</b><small>${esc(a.owner ? a.owner + ' · ' + a.email : a.place || '')}</small><span class="only-xs" style="margin-top:6px">${pill(a)}</span></div></div></td><td class="hide-sm">${cap(a.plan)}</td><td class="tnum hide-sm">${a.players}</td><td class="hide-sm">${day(a.until)}</td><td class="hide-xs">${pill(a)}</td><td class="r"><button class="btn btn-ghost btn-sm" type="button" data-act="open" data-id="${a.id}">Manage</button></td></tr>`).join('') : `<tr><td colspan="6"><div class="empty">No academies match.</div></td></tr>`}
    </tbody></table></div></div>`;
  }
  function keys() {
    const st = S.st, P = plansOf();
    return `<div class="page-head"><div><h2>Licence keys</h2><p>For academies that pay you by UPI, bank or cash instead of Razorpay. They paste the key in Settings &amp; plan.</p></div></div>
    <div class="card glow"><div class="card-h"><h3>Make a key</h3></div><form class="card-b" id="keyForm" style="display:grid;gap:16px">
      <div class="grid g2">${F('k-for', 'Academy name', '', { ph: 'Who is this key for?' })}${SEL('k-plan', 'Plan', [['monthly', `Monthly · ${inr(P.monthly)} · 30 days`], ['yearly', `Yearly · ${inr(P.yearly)} · 365 days`]], 'yearly')}</div>
      <div class="grid g3">${SEL('k-paid', 'Paid by', [['UPI', 'UPI'], ['Bank transfer', 'Bank transfer'], ['Cash', 'Cash'], ['Free', 'Free (no sale)']], 'UPI')}${F('k-amt', 'Amount (₹)', '', { im: 'numeric', ph: 'Plan price' })}${F('k-note', 'Note', '', { ph: 'Optional' })}</div>
      ${S.lastKey ? `<div class="keybox"><div style="display:grid;gap:6px;min-width:0"><span class="label">New key${S.lastKeySale ? ' · logged as a sale' : ''}</span><code>${S.lastKey}</code></div><div class="hstack"><button class="btn btn-ghost" type="button" data-act="shareKey">${ic('chat')}WhatsApp</button><button class="btn btn-primary" type="button" data-act="copy" data-v="${S.lastKey}">${ic('copy')}Copy</button></div></div>` : ''}
      <div class="between"><span class="faint" style="font-size:13px">One key works once. Days add on top of any time the academy has left.</span><button class="btn btn-primary" type="submit">${ic('key')}Make key</button></div></form></div>
    <div class="card"><div class="card-h"><h3>Keys made</h3><span class="mono faint" style="font-size:12px">${st.keys.length}</span></div><div class="table-wrap"><table class="t"><thead><tr><th>Key</th><th>For</th><th class="hide-sm">Plan</th><th class="hide-sm">Made</th><th>Status</th><th class="r"><span class="sr">Actions</span></th></tr></thead><tbody>
    ${st.keys.length ? st.keys.map(k => `<tr><td class="mono" style="font-size:13px;white-space:nowrap">${k.code}</td><td>${esc(k.used ? k.used.name : k.forName || '-')}<small class="faint" style="display:block">${esc(k.note || '')}</small></td><td class="hide-sm">${cap(k.plan)}</td><td class="hide-sm">${day(k.made)}</td><td>${k.used ? `<span class="pill p-ok">Used ${day(k.used.at)}</span>` : k.stopped ? '<span class="pill p-mute">Stopped</span>' : '<span class="pill p-info">Not used</span>'}</td><td class="r"><div class="acts" style="flex-wrap:nowrap"><button class="btn btn-quiet btn-sm" type="button" data-act="copy" data-v="${k.code}" aria-label="Copy ${k.code}">${ic('copy')}</button>${k.used ? '' : `<button class="btn btn-ghost btn-sm" type="button" data-act="keyStop" data-v="${k.code}">${k.stopped ? 'Restart' : 'Stop'}</button>`}</div></td></tr>`).join('') : `<tr><td colspan="6"><div class="empty">No keys yet. Make one above.</div></td></tr>`}</tbody></table></div></div>`;
  }
  function sales() {
    const st = S.st; const months = [...new Set(st.sales.map(s => monthKey(s.at)))];
    const l = st.sales.filter(s => !S.saleMonth || monthKey(s.at) === S.saleMonth);
    const tot = l.reduce((t, s) => t + s.amt, 0);
    const by = k => l.filter(s => (s.via || '').startsWith(k)).reduce((t, s) => t + s.amt, 0);
    return `<div class="page-head"><div><h2>Sales</h2><p>Razorpay payments arrive on their own. Keys and manual payments are added when you make them. No GST.</p></div><div class="hstack"><button class="btn btn-ghost" type="button" data-act="csv">${ic('down')}CSV</button><button class="btn btn-primary" type="button" data-act="manual">${ic('plus')}Add sale</button></div></div>
    <div class="kpis">${[['Total', inr(tot), l.length + ' payments'], ['Razorpay', inr(by('Razorpay')), 'paid online'], ['Licence keys', inr(by('Licence')), 'paid to you directly'], ['Manual', inr(by('Manual')), 'marked paid in HQ']].map(([a, b, c]) => `<div class="card kpi"><span class="label">${a}</span><span class="v tnum">${b}</span><span class="d">${c}</span></div>`).join('')}</div>
    <div class="between"><label class="field" for="smonth" style="width:min(240px,100%)"><span class="sr">Month</span><select class="select" id="smonth"><option value="">All months</option>${months.map(m => `<option value="${m}" ${m === S.saleMonth ? 'selected' : ''}>${T.monthName(m)}</option>`).join('')}</select></label></div>
    <div class="card"><div class="table-wrap"><table class="t"><thead><tr><th class="hide-xs">Receipt</th><th>Date</th><th>Academy</th><th class="hide-sm">Plan</th><th class="hide-sm">Via</th><th class="r">Amount</th></tr></thead><tbody>
    ${l.length ? l.map(s => `<tr><td class="mono hide-xs" style="font-size:12.5px;white-space:nowrap">${esc(s.id)}</td><td style="white-space:nowrap">${day(s.at)}</td><td style="width:100%;max-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(s.academy)}</td><td class="hide-sm">${cap(s.plan)}</td><td class="hide-sm">${(s.via || '').startsWith('Razorpay') ? `<span class="pill p-info plain">${esc(s.via)}</span>` : `<span class="pill p-mute plain">${esc(s.via)}</span>`}</td><td class="r"><b class="tnum">${inr(s.amt)}</b></td></tr>`).join('') + `<tr><td class="hide-xs"></td><td colspan="2"><b>Total</b> <span class="faint">· no GST</span></td><td class="hide-sm"></td><td class="hide-sm"></td><td class="r"><b class="tnum">${inr(tot)}</b></td></tr>` : `<tr><td colspan="6"><div class="empty">No sales yet.</div></td></tr>`}</tbody></table></div></div>`;
  }
  function plans() {
    const P = plansOf();
    return `<div class="page-head"><div><h2>Plans &amp; prices</h2><p>Changes show on the website, the sign-up page and every academy's Settings &amp; plan.</p></div></div>
    <div class="grid g3">${[['monthly', 'Monthly', 'per month · 30 days'], ['yearly', 'Yearly', 'per year · 365 days'], ['trial', 'Free trial', 'days for new academies']].map(([k, l, u]) => `<div class="card"><div class="card-b" style="display:grid;gap:12px"><span class="label">${l}</span><div class="hstack" style="flex-wrap:nowrap">${k === 'trial' ? '' : '<span class="disp" style="font-size:30px">₹</span>'}<input class="input tnum" id="pl-${k}" inputmode="numeric" value="${P[k]}" style="font:900 30px/1 var(--f-display);height:56px" aria-label="${l}"></div><span class="faint" style="font-size:13px">${u}${k === 'yearly' ? ' · ' + inr(P.yearly / 12) + ' a month' : ''}</span></div></div>`).join('')}</div>
    <div class="note">${ic('rupee')}<span>Razorpay charges these prices. No GST is added. Academies already on a plan keep their days.</span></div>
    <div><button class="btn btn-primary" type="button" data-act="savePlans">${ic('ok')}Save prices</button></div>`;
  }
  function settings() {
    const s = S.st.settings, R = s.razorpay, M = s.smtp;
    const dot = on => on ? '<span class="ok-dot"></span>' : '<span class="no-dot"></span>';
    return `<div class="page-head"><div><h2>Settings</h2><p>${LIVE ? 'Secrets are saved on the server and never shown again. Leave a secret empty to keep the saved one.' : 'Preview only. On the live site these are saved on the server.'}</p></div></div>
    <div class="card">
      <div class="set-row"><div><h4>${dot(R.keyId && R.hasSecret)}Razorpay</h4><p>Only for academies buying a plan. Parents never pay through Razorpay.</p></div><div class="f">
        <div class="grid g2">${F('rz-id', 'Key ID', R.keyId, { ph: 'rzp_live_…' })}${F('rz-sec', 'Key secret', '', { type: 'password', ph: R.hasSecret ? 'Saved. Type to replace' : 'Paste key secret' })}</div>
        ${F('rz-wh', 'Webhook secret', '', { type: 'password', ph: R.hasWebhook ? 'Saved. Type to replace' : 'Optional, for payment.captured' })}
        <div class="field"><span>Webhook URL (add in Razorpay, event payment.captured)</span><div class="copyline"><code>${esc(R.webhookUrl)}</code><button class="btn btn-ghost btn-sm" type="button" data-act="copy" data-v="${esc(R.webhookUrl)}">${ic('copy')}Copy</button></div></div>
        <div><button class="btn btn-primary btn-sm" type="button" data-act="saveRzp">Save Razorpay</button></div></div></div>
      <div class="set-row"><div><h4>${dot(s.googleClientId)}Google sign-in</h4><p>OAuth client ID from Google Cloud. Add your site as an authorised JavaScript origin.</p></div><div class="f">${F('g-id', 'Client ID', s.googleClientId, { ph: '…apps.googleusercontent.com' })}<div><button class="btn btn-primary btn-sm" type="button" data-act="saveGoogle">Save Google</button></div></div></div>
      <div class="set-row"><div><h4>${dot(M.host && M.hasPass)}Email (SMTP)</h4><p>Sends fee reminders, receipts, password resets and trial emails. Sender should be marketing@veyracreatives.com.</p></div><div class="f">
        <div class="grid g2">${F('m-host', 'Host', M.host, { ph: 'smtp.hostinger.com' })}${F('m-port', 'Port', M.port, { im: 'numeric' })}</div>
        <div class="grid g2">${F('m-user', 'User', M.user, { ph: 'marketing@veyracreatives.com' })}${F('m-pass', 'Password', '', { type: 'password', ph: M.hasPass ? 'Saved. Type to replace' : '' })}</div>
        ${F('m-from', 'From', M.from, { ph: 'Veyra Academy <marketing@veyracreatives.com>' })}
        <div class="hstack"><button class="btn btn-primary btn-sm" type="button" data-act="saveMail">Save email</button><button class="btn btn-ghost btn-sm" type="button" data-act="testMail">${ic('mail')}Send test</button></div></div></div>
      <div class="set-row"><div><h4>HQ password</h4><p>Asked when HQ opens. HQ locks after 30 minutes idle.</p></div><div class="f"><div class="grid g2">${F('h-pw', 'New password', '', { type: 'password', ac: 'new-password', ph: 'At least 10 characters' })}${F('h-pw2', 'Type it again', '', { type: 'password', ac: 'new-password' })}</div><div><button class="btn btn-primary btn-sm" type="button" data-act="savePw">Change password</button></div></div></div>
      <div class="set-row"><div><h4>Backups</h4><p>Saved every day on the server, 60 days kept. Download one any time.</p></div><div class="f"><div><button class="btn btn-ghost btn-sm" type="button" data-act="backup">${ic('down')}Download backup</button></div><span class="faint" style="font-size:12.5px">Version ${esc(S.st.version)} · ${esc(S.st.base)}</span></div></div>
    </div>`;
  }
  function activity() { return `<div class="page-head"><div><h2>Activity</h2><p>Sign-ups, payments, keys and changes, newest first.</p></div></div><div class="card">${activityList(S.st.activity)}</div>`; }
  const V = { home, academies, keys, sales, plans, settings, activity };

  /* ---------- pop-ups ---------- */
  function modal() {
    const m = S.modal; if (!m) return ''; let title = '', h = '', foot = ''; const P = plansOf();
    if (m.t === 'ac') { const a = S.st.academies.find(x => x.id === m.id); if (!a) { S.modal = null; return ''; } title = a.name;
      h = `<div class="who">${av(a.name)}<div><b style="font-size:17px">${esc(a.name)}</b><small>${esc(a.place || '')}</small></div>${pill(a)}</div>
      <dl class="kv"><dt>Plan</dt><dd>${cap(a.plan)}</dd><dt>${a.active ? 'Paid until' : 'Ended'}</dt><dd>${day(a.until)}</dd>${a.owner ? `<dt>Owner</dt><dd>${esc(a.owner)}</dd><dt>Email</dt><dd style="word-break:break-all">${esc(a.email)}</dd>` : ''}<dt>Players</dt><dd>${a.players}</dd>${a.staff !== '' ? `<dt>Staff</dt><dd>${a.staff}</dd><dt>Batches</dt><dd>${a.batches}</dd>` : ''}<dt>Joined</dt><dd>${day(a.createdAt)}</dd></dl>
      ${a.sample ? '<div class="note">' + ic('eye') + '<span>Sample academy in this preview.</span></div>' : ''}
      <div class="card" style="box-shadow:none"><div class="card-b" style="display:grid;gap:12px"><span class="label">Add free days</span><div class="hstack">${[3, 10, 30].map(d => `<button class="btn btn-ghost btn-sm" type="button" data-act="extend" data-id="${a.id}" data-v="${d}">+${d} days</button>`).join('')}</div></div></div>
      <div class="card" style="box-shadow:none"><div class="card-b" style="display:grid;gap:12px"><span class="label">They paid you directly</span><div class="grid g2">${SEL('mp-plan', 'Plan', [['monthly', `Monthly · ${inr(P.monthly)}`], ['yearly', `Yearly · ${inr(P.yearly)}`]], 'yearly')}${SEL('mp-via', 'Paid by', [['UPI', 'UPI'], ['Bank transfer', 'Bank transfer'], ['Cash', 'Cash']], 'UPI')}</div><div><button class="btn btn-primary btn-sm" type="button" data-act="markPaid" data-id="${a.id}">${ic('ok')}Mark as paid</button></div></div></div>`;
      foot = `${a.email ? `<a class="btn btn-quiet" href="mailto:${esc(a.email)}?subject=${encodeURIComponent('Veyra Academy · ' + a.name)}">${ic('mail')}Email owner</a>` : ''}<button class="btn ${a.suspended ? 'btn-primary' : 'btn-danger'}" type="button" data-act="suspend" data-id="${a.id}">${a.suspended ? 'Restore academy' : 'Pause academy'}</button>`; }
    if (m.t === 'sale') { title = 'Add a sale';
      h = `${SEL('ms-ac', 'Academy', S.st.academies.map(a => [a.id, a.name]).concat([['', 'Someone else']]), '')}${F('ms-for', 'Name (if someone else)', '', {})}<div class="grid g2">${SEL('ms-plan', 'Plan', [['monthly', 'Monthly'], ['yearly', 'Yearly'], ['other', 'Other']], 'yearly')}${F('ms-amt', 'Amount (₹)', P.yearly, { im: 'numeric' })}</div>${SEL('ms-via', 'Paid by', [['UPI', 'UPI'], ['Bank transfer', 'Bank transfer'], ['Cash', 'Cash']], 'UPI')}<div class="note">${ic('rupee')}<span>This only records money. To give an academy days, use Mark as paid on the academy.</span></div>`;
      foot = `<button class="btn btn-ghost" type="button" data-act="close">Cancel</button><button class="btn btn-primary" type="button" data-act="saveSale">${ic('ok')}Add sale</button>`; }
    if (m.t === 'more') { title = 'More';
      h = `<nav class="more-list">${TABS.filter(t => !PHONE_TABS.includes(t[0])).map(([id, l, i]) => `<a data-act="tab" data-v="${id}">${ic(i)}${l}</a>`).join('')}<a href="${appUrl}">${ic('swap')}Academy apps</a><a data-act="lock">${ic('logout')}Lock HQ</a></nav>`; }
    return `<div class="scrim" data-act="scrim"><div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="card-h"><h3>${esc(title)}</h3><button class="icon-btn" type="button" data-act="close" aria-label="Close">${ic('x')}</button></div><div class="card-b">${h}</div>${foot ? `<div class="card-f" style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;padding:16px 20px;border-top:1px solid var(--line)">${foot}</div>` : ''}</div></div>`;
  }

  /* ---------- shell ---------- */
  function lockScreen() {
    return `<div class="lock"><form id="lockForm" autocomplete="on"><div class="hstack">${logo()}<span class="hq-badge">HQ</span></div><h1 class="disp" style="font-size:44px">Veyra <em>HQ</em></h1><p class="muted">${S.setup ? 'First time here. Enter the setup code from the server (data/hq-setup-code.txt) and choose the HQ password.' : 'Private admin for Veyra Academy. Only for Veyra.'}</p>
      ${S.setup ? F('hqcode', 'Setup code', '', { cls: 'mono', ph: '12 characters' }) : ''}
      <label class="field" for="hqpw"><span>${S.setup ? 'New HQ password' : 'HQ password'}</span><input class="input" id="hqpw" type="password" autocomplete="${S.setup ? 'new-password' : 'current-password'}" placeholder="${LIVE ? (S.setup ? 'At least 10 characters' : '') : 'Any password works in this preview'}" ${LIVE ? 'required' : ''}></label>
      ${S.err ? `<p class="err" role="alert">${esc(S.err)}</p>` : ''}
      <button class="btn btn-primary btn-lg btn-block" type="submit">${S.setup ? 'Set password and open' : 'Unlock'}</button><a class="btn btn-quiet btn-block" href="${appUrl}">← Back to academy apps</a></form></div>`;
  }
  function render() {
    if (S.locked || !S.st) { $('#app').innerHTML = lockScreen(); const f = $('#hqcode') || $('#hqpw'); if (f && window.innerWidth > 720) f.focus(); return; }
    const cur = TABS.find(t => t[0] === S.tab) || TABS[0]; const y = window.scrollY;
    const ae = document.activeElement && document.activeElement.id; const pos = ae && document.activeElement.selectionStart;
    $('#app').innerHTML = `${LIVE ? '' : `<div class="demo-strip">${ic('eye')}<span>Preview HQ. Shares data with the demo apps.</span></div>`}<div class="shell"><aside class="side"><div class="brand">${logo()}<div><b>VEYRA ACADEMY</b><small>HQ · Veyra only</small></div></div>
      <nav class="nav" aria-label="HQ">${TABS.map(([id, l, i]) => `<a data-act="tab" data-v="${id}" href="#${id}" ${id === S.tab ? 'aria-current="page"' : ''}>${ic(i)}<span>${l}</span></a>`).join('')}</nav>
      <div class="side-foot"><a class="btn btn-ghost btn-sm" href="${appUrl}">${ic('swap')}Academy apps</a><button class="btn btn-quiet btn-sm" type="button" data-act="lock">${ic('logout')}Lock HQ</button></div></aside>
    <div class="main"><header class="top">${S.tab !== 'home' ? `<button class="icon-btn m-back" type="button" data-act="tab" data-v="home" aria-label="Back to overview" style="transform:scaleX(-1)">${ic('arrow')}</button>` : logo('m-brand')}<h1>${cur[1]}</h1><div class="top-actions"><a class="btn btn-ghost btn-sm" href="${appUrl}" aria-label="Academy apps">${ic('swap')}<span class="hide-sm">Academy apps</span></a><button class="icon-btn" type="button" data-act="lock" aria-label="Lock HQ">${ic('logout')}</button></div></header>
    <main class="content">${V[cur[0]]()}</main></div>
    <nav class="tabbar" aria-label="HQ tabs">${PHONE_TABS.map(id => TABS.find(t => t[0] === id)).map(([id, l, i]) => `<a data-act="tab" data-v="${id}" ${id === S.tab ? 'aria-current="page"' : ''}>${ic(i)}<span>${l.split(' ')[0]}</span></a>`).join('')}<a data-act="more" ${PHONE_TABS.includes(S.tab) ? '' : 'aria-current="page"'}>${ic('menu')}<span>More</span></a></nav></div>${modal()}`;
    if (ae) { const n = document.getElementById(ae); if (n && n.tagName === 'INPUT' && n.type !== 'password') { n.focus(); try { n.setSelectionRange(pos, pos); } catch (_) {} } }
    window.scrollTo(0, y);
  }
  function go(tab) { S.tab = tab; S.modal = null; try { history.replaceState(null, '', '#' + tab); } catch (_) {} render(); window.scrollTo(0, 0); }

  /* ---------- events ---------- */
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-act]'); if (!a) return; const d = a.dataset;
    if (d.act === 'scrim' && e.target !== a) return;
    const H = {
      tab: () => { e.preventDefault(); go(d.v); }, more: () => { S.modal = { t: 'more' }; render(); }, close: () => { S.modal = null; render(); }, scrim: () => { S.modal = null; render(); },
      lock: async () => { try { await API.logout(); } catch (_) {} S.locked = true; S.st = null; S.err = ''; S.modal = null; render(); },
      filter: () => { S.filter = d.v; render(); },
      open: () => { S.modal = { t: 'ac', id: d.id }; render(); },
      extend: () => act({ type: 'academy.extend', aid: d.id, days: +d.v }, () => {}),
      markPaid: () => act({ type: 'academy.paid', aid: d.id, plan: val('mp-plan'), via: val('mp-via') }, () => {}),
      suspend: () => act({ type: 'academy.suspend', aid: d.id }, () => {}),
      copy: () => { const v = d.v; try { navigator.clipboard.writeText(v).then(() => toast('Copied'), () => toast(v)); } catch (_) { toast(v); } },
      shareKey: () => { const P = plansOf(); window.open('https://wa.me/?text=' + encodeURIComponent(`Your Veyra Academy licence key: ${S.lastKey}\n\nOpen your admin app, go to Settings & plan, and paste it under Licence key.\nQuestions: marketing@veyracreatives.com`), '_blank', 'noopener'); },
      keyStop: () => act({ type: 'key.stop', code: d.v }),
      csv: () => csv(`veyra-academy-sales-${T.date()}.csv`, [['Receipt', 'Date', 'Academy', 'Plan', 'Via', 'Amount (INR)']].concat(S.st.sales.map(s => [s.id, T.date(s.at), s.academy, s.plan, s.via, s.amt]))),
      manual: () => { S.modal = { t: 'sale' }; render(); },
      saveSale: () => { const aid = val('ms-ac'); act({ type: 'sale.manual', aid, forName: val('ms-for'), plan: val('ms-plan'), amount: +val('ms-amt').replace(/\D/g, ''), via: val('ms-via') }); },
      savePlans: () => act({ type: 'plans.save', monthly: +val('pl-monthly').replace(/\D/g, ''), yearly: +val('pl-yearly').replace(/\D/g, ''), trial: +val('pl-trial').replace(/\D/g, '') }),
      saveRzp: () => act({ type: 'settings.save', razorpay: { keyId: val('rz-id'), keySecret: val('rz-sec'), webhookSecret: val('rz-wh') } }),
      saveGoogle: () => act({ type: 'settings.save', googleClientId: val('g-id') }),
      saveMail: () => act({ type: 'settings.save', smtp: { host: val('m-host'), port: +val('m-port') || 465, user: val('m-user'), pass: val('m-pass'), from: val('m-from') } }),
      testMail: () => act({ type: 'mail.test' }),
      savePw: () => { if (val('h-pw') !== val('h-pw2')) return toast('The two passwords do not match'); act({ type: 'password', pw: val('h-pw') }, () => { if (LIVE) { S.locked = true; S.st = null; } }); },
      backup: () => API.backup()
    };
    (H[d.act] || (() => {}))();
  });
  document.addEventListener('submit', async e => {
    e.preventDefault();
    if (e.target.id === 'lockForm') { S.err = ''; try { await API.login(val('hqpw'), val('hqcode')); S.setup = false; S.locked = false; await load(); } catch (err) { S.err = err.message; render(); } }
    if (e.target.id === 'keyForm') { const forName = val('k-for').trim(); if (!forName) return toast('Add who the key is for'); const paidBy = val('k-paid');
      act({ type: 'key.make', plan: val('k-plan'), forName, paidBy, amount: +val('k-amt').replace(/\D/g, '') || undefined, note: val('k-note') }, r => { S.lastKey = r.code; S.lastKeySale = paidBy !== 'Free'; }); }
  });
  document.addEventListener('input', e => { if (e.target.id === 'aq') { S.q = e.target.value; render(); } });
  document.addEventListener('change', e => { if (e.target.id === 'smonth') { S.saleMonth = e.target.value; render(); } if (e.target.id === 'ms-plan') { const P = plansOf(); const v = e.target.value; if (P[v]) $('#ms-amt').value = P[v]; } });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && S.modal) { S.modal = null; render(); } });
  if (!LIVE) Demo.onChange(() => { if (!S.locked) load(); });
  let idle; ['click', 'keydown'].forEach(ev => document.addEventListener(ev, () => { clearTimeout(idle); idle = setTimeout(() => { if (!S.locked && LIVE) { S.locked = true; S.st = null; S.err = 'HQ locked after 30 minutes idle.'; render(); } }, 30 * 60e3); }));

  /* ---------- start ---------- */
  (async () => {
    const h = location.hash.slice(1); if (TABS.some(t => t[0] === h)) S.tab = h;
    if (LIVE) { try { S.st = await API.state(); S.locked = false; } catch (_) { try { S.setup = await API.needsSetup(); } catch (_) {} } }
    render();
  })();
})();
