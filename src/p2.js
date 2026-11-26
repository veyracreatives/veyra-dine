
/* ---------- routes ---------- */
const ROLES = {
  admin: { label: 'Admin', tabs: [
    ['home', 'Dashboard', 'home', 'Academy'], ['admissions', 'Admissions', 'board', 'Academy'], ['players', 'Players', 'players', 'Academy'], ['batches', 'Batches', 'batch', 'Academy'],
    ['attendance', 'Attendance', 'check', 'Daily'], ['fees', 'Fees & billing', 'rupee', 'Daily'], ['reminders', 'Fee reminders', 'bell', 'Daily'],
    ['tournaments', 'Tournaments', 'trophy', 'Coaching'], ['training', 'Training plan', 'whistle', 'Coaching'], ['health', 'Health & documents', 'shield', 'Coaching'], ['kit', 'Kit & equipment', 'gift', 'Coaching'],
    ['staff', 'Coaches & staff', 'players', 'People'], ['parents', 'Parents', 'parent', 'People'], ['notices', 'Notices', 'megaphone', 'People'],
    ['money', 'Expenses & salaries', 'receipt', 'Money & setup'], ['grounds', 'Grounds', 'pin', 'Money & setup'], ['reports', 'Reports', 'chart', 'Money & setup'], ['setup', 'Settings & plan', 'gear', 'Money & setup']],
    bar: ['home', 'attendance', 'fees', 'players'] },
  manager: { label: 'Manager', tabs: [
    ['home', 'Today', 'home', 'Manage'], ['staffatt', 'Coach attendance', 'whistle', 'Manage'], ['attendance', 'Player attendance', 'check', 'Manage'], ['admissions', 'Admissions', 'board', 'Manage'], ['players', 'Players', 'players', 'Manage'], ['batches', 'Batches', 'batch', 'Manage'], ['notices', 'Notices', 'megaphone', 'Manage'],
    ['tournaments', 'Tournaments', 'trophy', 'Coaching'], ['training', 'Training plan', 'whistle', 'Coaching'], ['health', 'Health & documents', 'shield', 'Coaching'], ['grounds', 'Grounds', 'pin', 'Coaching'], ['kit', 'Kit & equipment', 'gift', 'Coaching']],
    bar: ['home', 'staffatt', 'attendance', 'admissions'] },
  coach: { label: 'Coach', tabs: [['home', 'Today', 'home', 'Coach'], ['mark', 'Take attendance', 'check', 'Coach'], ['training', 'Training plan', 'whistle', 'Coach'], ['matches', 'Matches', 'trophy', 'Coach'], ['progress', 'Player progress', 'star', 'Coach'], ['myatt', 'My attendance', 'clock', 'Coach'], ['notices', 'Notices', 'megaphone', 'Coach']],
    bar: ['home', 'mark', 'training', 'matches'] },
  parent: { label: 'Parent', tabs: [['home', 'Home', 'home', 'Parent'], ['attendance', 'Attendance', 'check', 'Parent'], ['fees', 'Fees', 'rupee', 'Parent'], ['matches', 'Matches', 'trophy', 'Parent'], ['progress', 'Progress & health', 'star', 'Parent'], ['notices', 'Notices', 'megaphone', 'Parent']],
    bar: ['home', 'attendance', 'fees', 'matches'] }
};
const SHORT = { mark: 'Mark', myatt: 'My days', progress: 'Progress', staffatt: 'Coaches', training: 'Training', admissions: 'Admissions', home: 'Home' };
function route() {
  const h = decodeURIComponent((location.hash || '').replace('#', ''));
  if (h.startsWith('reset-')) return { view: 'reset', token: h.slice(6) };
  const [r, t] = h.split('-');
  if (ROLES[r]) return { view: 'app', role: r, tab: ROLES[r].tabs.some(x => x[0] === t) ? t : 'home' };
  if (r === 'app') return { view: 'home' };
  if (['login', 'signup', 'forgot'].includes(r)) return { view: r };
  return { view: 'landing' };
}
const go = h => { if (location.hash === '#' + h) render(); else location.hash = h; };

/* ---------- auth ---------- */
function pitchSVG() { return `<svg class="pitch-lines" viewBox="0 0 600 400" fill="none" style="stroke:var(--brand)" stroke-opacity=".3" stroke-width="2" aria-hidden="true"><rect x="20" y="20" width="560" height="360" rx="6"/><path d="M300 20v360"/><circle cx="300" cy="200" r="60"/><rect x="20" y="110" width="80" height="180"/><rect x="500" y="110" width="80" height="180"/><rect x="20" y="160" width="30" height="80"/><rect x="550" y="160" width="30" height="80"/></svg>`; }
function auth(kind, token) {
  const up = kind === 'signup', fg = kind === 'forgot', rs = kind === 'reset';
  const head = up ? ['Start your academy', `Free for ${CFG.plans.trial} days. Then ${inr(CFG.plans.monthly)} a month or ${inr(CFG.plans.yearly)} a year.`] : fg ? ['Forgot password', 'We email you a link to make a new one.'] : rs ? ['Make a new password', 'Use at least 8 characters.'] : ['Log in', 'Use the email your academy added, or Google.'];
  const google = !fg && !rs && (LIVE ? CFG.googleClientId : true);
  return `<div class="auth">
  <aside class="auth-art"><a class="brand" href="#">${logo()}<div><b>VEYRA ACADEMY</b><small>Academy app</small></div></a>
    <div style="display:grid;gap:18px;position:relative"><h2 class="disp">${up ? `${['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen'][CFG.plans.trial] || CFG.plans.trial} days free.<br><em>No card.</em>` : 'Back on<br><em>the pitch</em>'}</h2><p class="muted" style="max-width:420px">${up ? 'Set up your batches, invite coaches and send parents the app link today.' : 'Admins, managers, coaches and parents all log in here. You land in your own app.'}</p></div>
    ${pitchSVG()}<a class="faint" href="mailto:marketing@veyracreatives.com" style="position:relative;font-size:13px">marketing@veyracreatives.com</a></aside>
  <main class="auth-form"><form class="auth-box" id="authForm" data-track-form="${kind}" data-kind="${kind}" data-token="${esc(token || '')}" novalidate>
    <a href="#" class="faint" style="font-size:14px;font-weight:600;text-decoration:none">← Back to home</a>
    <a class="brand auth-brand" href="#" style="padding:0">${logo()}<div><b>VEYRA ACADEMY</b><small>Academy app</small></div></a>
    <div><h1>${head[0]}</h1><p class="muted" style="margin-top:6px">${head[1]}</p></div>
    ${B && !up && !rs ? `<div class="banner">${ic('ok')}<span class="grow">You are logged in as <b>${esc(B.me.name)}</b>.</span><a class="btn btn-primary btn-sm" href="#${B.me.role}">Open my app</a></div>` : ''}
    ${google ? `<div id="gbtn" class="gwrap"><button class="btn btn-google btn-lg btn-block" type="button" data-act="google">${ic('google')}Continue with Google</button>${LIVE ? '<div class="glayer" aria-hidden="false"></div>' : ''}</div><div class="or">or with email</div>` : ''}
    ${up ? `<label class="field" for="f-ac"><span>Academy name</span><input class="input" id="f-ac" placeholder="e.g. Kickstart Sports Academy" autocomplete="organization" required></label>
    <label class="field" for="f-sport"><span>Sport</span><select class="select" id="f-sport">${[['football', 'Football'], ['cricket', 'Cricket'], ['badminton', 'Badminton'], ['tennis', 'Tennis'], ['basketball', 'Basketball'], ['swimming', 'Swimming'], ['skating', 'Skating'], ['athletics', 'Athletics'], ['martial', 'Martial arts'], ['other', 'Other sport']].map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select></label>
    <div class="grid g2"><label class="field" for="f-nm"><span>Your name</span><input class="input" id="f-nm" autocomplete="name" required></label><label class="field" for="f-city"><span>Area or city</span><input class="input" id="f-city" placeholder="Kharghar, Navi Mumbai"></label></div>
    <label class="field" for="f-ph"><span>Phone or WhatsApp <span class="faint" style="font-weight:500">(optional)</span></span><input class="input" id="f-ph" type="tel" inputmode="tel" autocomplete="tel" placeholder="So we can help you set up"></label>` : ''}
    ${rs ? '' : `<label class="field" for="f-em"><span>Email</span><input class="input" id="f-em" type="email" autocomplete="email" placeholder="you@academy.in" required></label>`}
    ${fg ? '' : `<label class="field" for="f-pw"><span class="between" style="width:100%"><span>${rs ? 'New password' : 'Password'}</span>${up || rs ? '' : '<a href="#forgot" class="faint" style="font-weight:500">Forgot password?</a>'}</span><input class="input" id="f-pw" type="password" autocomplete="${up || rs ? 'new-password' : 'current-password'}" placeholder="${up || rs ? 'At least 8 characters' : ''}" required></label>`}
    <p class="faint" id="authErr" role="alert" style="font-size:13.5px;color:var(--bad);min-height:0"></p>
    <button class="btn btn-primary btn-lg btn-block" type="submit">${up ? 'Create academy' : fg ? 'Email me a link' : rs ? 'Save password' : 'Log in'}</button>
    <p class="muted" style="text-align:center;font-size:14px">${up ? 'Already have an account? <a href="#login" style="color:var(--brand);font-weight:600">Log in</a>' : 'New academy? <a href="#signup" style="color:var(--brand);font-weight:600">Start free trial</a>'}</p>
    ${!up && !LIVE ? `<div class="divider"></div><span class="label">Try the apps (demo logins)</span><div class="demo-roles">${[['admin', 'Admin', 'shield'], ['manager', 'Manager', 'whistle'], ['coach', 'Coach', 'check'], ['parent', 'Parent', 'parent']].map(([h, n, i]) => `<a href="#${h}">${ic(i)}${n}</a>`).join('')}</div><span class="faint" style="font-size:12.5px">Or log in with owner@kickstart.demo and demo1234.</span>` : ''}
    ${!up && LIVE && CFG.demoBase ? `<div class="divider"></div><a class="btn btn-ghost btn-lg btn-block" href="${CFG.demoBase}#admin">See the demo academy</a>` : ''}
  </form></main></div>`;
}
function mountGoogle() {
  if (!LIVE || !CFG.googleClientId || !$('#gbtn')) return;
  const draw = () => { if (!window.google || !google.accounts) return; google.accounts.id.initialize({ client_id: CFG.googleClientId, callback: r => API.google(r.credential).then(afterLogin).catch(e => showAuthErr(e.message)) }); const L = $('#gbtn .glayer'); if (!L) return; L.innerHTML = ''; google.accounts.id.renderButton(L, { theme: 'outline', size: 'large', text: 'continue_with', width: 400 }); fitG(); setTimeout(fitG, 600); };
  if (!mountGoogle.rs) { mountGoogle.rs = 1; addEventListener('resize', fitG); }
  if (window.google && google.accounts) draw(); else { const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = draw; document.head.appendChild(s); }
}
/* Google's own button can't be wider than 400px, so our full-width button shows and Google's sits on top, invisible, stretched to the same size */
function fitG() { const w = $('#gbtn'), L = w && w.querySelector('.glayer'); if (!L || !L.firstElementChild) return; L.style.transform = ''; const r = L.firstElementChild.getBoundingClientRect(); if (!r.width || !r.height) return; L.style.transform = `scale(${w.clientWidth / r.width},${w.clientHeight / r.height})`; w.classList.add('g-ready'); }
const showAuthErr = m => { const e = $('#authErr'); if (e) e.textContent = m; else toast(m); };
async function afterLogin(r) { await refresh(); if (!B) return showAuthErr('Could not open your academy. Try again.'); toast(r && r.msg ? r.msg : `Welcome, ${first(B.me.name)}`); go(B.me.role + (r && r.created ? '-setup' : '')); }

/* ---------- app frame ---------- */
function shell(role, tab, body) {
  const R = ROLES[role], cur = R.tabs.find(t => t[0] === tab);
  const groups = [...new Set(R.tabs.map(t => t[3]))];
  const count = id => role === 'admin' && id === 'fees' && B.queue && B.queue.length ? `<span class="count">${B.queue.length}</span>` : role === 'admin' && id === 'admissions' && B.adm.filter(a => a.s === 'enquiry').length ? `<span class="count">${B.adm.filter(a => a.s === 'enquiry').length}</span>` : '';
  const navHTML = groups.map(g => `${groups.length > 1 ? `<div class="nav-g">${g}</div>` : ''}${R.tabs.filter(t => t[3] === g).map(([id, l, i]) => `<a href="#${role}-${id}" ${id === tab ? 'aria-current="page"' : ''}>${ic(i)}<span>${l}</span>${count(id)}</a>`).join('')}`).join('');
  const bar = R.bar.map(id => R.tabs.find(t => t[0] === id));
  const P = B.plan;
  const planBox = role === 'admin' ? `<div class="plan-box"><div class="between"><b>${P.type === 'trial' ? 'Free trial' : P.type === 'yearly' ? 'Yearly plan' : 'Monthly plan'}</b><span class="mono faint" style="font-size:11px">${P.active ? P.daysLeft + ' DAYS LEFT' : 'ENDED'}</span></div><div class="meter"><i style="width:${Math.max(4, Math.min(100, P.daysLeft / (P.type === 'yearly' ? 365 : P.type === 'monthly' ? 30 : CFG.plans.trial) * 100))}%"></i></div><small>${P.type === 'trial' ? `Then ${inr(CFG.plans.monthly)}/month or ${inr(CFG.plans.yearly)}/year.` : 'Paid until ' + T.full(T.date(P.until))}</small>${P.type === 'trial' || P.daysLeft < 8 ? `<a class="btn btn-primary btn-sm" href="#admin-setup">${P.type === 'trial' ? 'Choose a plan' : 'Renew'}</a>` : ''}</div>` : '';
  const ms = (B.memberships || []);
  const menuItems = !LIVE ? `${Object.entries(ROLES).map(([k, v]) => `<a href="#${k}" role="menuitem" ${k === role ? 'aria-current="true"' : ''}>${v.label} app<small>${{ admin: 'Nikhil (owner)', manager: 'Priya', coach: 'Arjun', parent: 'Sneha (parent)' }[k]}</small></a>`).join('')}${CFG.hosted ? '' : '<a href="hq.html" role="menuitem">Veyra HQ<small>Veyra only</small></a>'}<a href="#" role="menuitem">Website</a><a role="menuitem" data-act="account">${ic('key')}My account</a><a role="menuitem" data-act="resetDemo">${ic('swap')}Reset demo data</a><a role="menuitem" data-act="logout">${ic('logout')}Log out</a>`
    : `${ms.length > 1 ? ms.map(m => `<a role="menuitem" data-act="switchTo" data-aid="${m.aid}" data-role="${m.role}" ${m.aid === B.academy.id && m.role === role ? 'aria-current="true"' : ''}>${esc(m.name)}<small>${ROLES[m.role].label} app</small></a>`).join('') : ''}<a role="menuitem" data-act="account">${ic('key')}My account</a><a role="menuitem" data-act="install">${ic('phone')}Install the app</a><a href="#" role="menuitem">Website</a><a role="menuitem" data-act="logout">${ic('logout')}Log out</a>`;
  return `<div class="shell">
  <aside class="side"><a class="brand" href="#${role}">${logo()}<div><b>VEYRA ACADEMY</b><small>${R.label} app</small></div></a>
    ${role === 'parent' ? '' : `<div class="academy">${av(B.academy.name, 'sm')}<div><b>${esc(B.academy.name)}</b><small>${esc(B.academy.place)}</small></div></div>`}
    <nav class="nav" aria-label="${R.label}">${navHTML}</nav>
    <div class="side-foot">${planBox}<button class="who" type="button" data-act="account" style="padding:8px;border:0;background:none;text-align:left;width:100%;cursor:pointer;color:inherit">${av(B.me.name)}<div><b>${esc(B.me.name)}</b><small>${role === 'parent' ? 'Parent' : role === 'admin' ? 'Academy owner' : esc((myStaff() || {}).title || R.label)}</small></div></button></div>
  </aside>
  <div class="main">
    <header class="top">${logo('m-brand')}<h1>${cur[1]}</h1>
      <div class="top-actions">
        <div class="role-switch"><button class="btn btn-ghost btn-sm" type="button" data-act="menu" aria-expanded="${U.menu}">${ic(LIVE ? 'players' : 'swap')}<span class="hide-sm">${LIVE ? esc(first(B.me.name)) : 'Preview as ' + R.label}</span><span class="sr">Menu</span></button>
        ${U.menu ? `<div class="menu" role="menu">${menuItems}</div>` : ''}</div>
        ${langPicker()}<button class="icon-btn" type="button" data-act="bell" aria-label="Notifications${B.unread ? ', ' + B.unread + ' new' : ''}">${ic('bell')}${B.unread ? `<span class="dot-n">${B.unread > 9 ? '9+' : B.unread}</span>` : ''}</button>
      </div>
    </header>
    <main class="content ${role === 'parent' || role === 'coach' ? 'narrow' : ''}">${banners(role)}${body}</main>
  </div>
  <nav class="tabbar" aria-label="${R.label} tabs">${bar.map(([id, l, i]) => `<a href="#${role}-${id}" ${id === tab ? 'aria-current="page"' : ''}>${ic(i)}<span>${SHORT[id] || (role === 'manager' && id === 'attendance' ? 'Players' : l.split(' ')[0])}</span></a>`).join('')}<a data-act="more" href="javascript:void 0" ${R.bar.includes(tab) ? '' : 'aria-current="page"'}>${ic('menu')}<span>More</span></a></nav>
  ${U.outbox ? `<div class="offline-pill">${U.outbox} waiting to send</div>` : ''}
  </div>`;
}
function banners(role) {
  const P = B.plan; let h = '';
  if (P.suspended) h += `<div class="banner bad">${ic('shield')}<span class="grow">This academy is paused by Veyra. Email marketing@veyracreatives.com.</span></div>`;
  else if (!P.active) h += role === 'admin' ? `<div class="banner bad">${ic('rupee')}<span class="grow"><b>Your ${P.type === 'trial' ? 'free trial' : 'plan'} has ended.</b> Everything is saved. Pick a plan to keep using the apps.</span><a class="btn btn-primary btn-sm" href="#admin-setup">Choose a plan</a></div>` : `<div class="banner bad">${ic('rupee')}<span class="grow">The academy's plan has ended, so changes are paused. Ask the academy to renew.</span></div>`;
  else if (role === 'admin' && P.type === 'trial' && P.daysLeft <= 3) h += `<div class="banner warn">${ic('clock')}<span class="grow">Your free trial ends in ${P.daysLeft} day${P.daysLeft === 1 ? '' : 's'}.</span><a class="btn btn-primary btn-sm" href="#admin-setup">Choose a plan</a></div>`;
  return h;
}

/* ---------- shared cards ---------- */
const todayMarks = bid => (B.att[B.today] || {})[bid];
function tally(bid, marks) {
  const list = B.players.filter(p => p.batch === bid && !p.brk); const m = marks || {};
  const v = list.map(p => m[p.id]); return { P: v.filter(x => x === 'P').length, L: v.filter(x => x === 'L').length, A: v.filter(x => x === 'A').length, n: list.length };
}
function sessionsCard(role) {
  const ids = role === 'coach' ? B.sessionsToday.filter(id => B.myBatches.includes(id)) : B.sessionsToday;
  return `<div class="card glow"><div class="card-h"><div><h3>${role === 'coach' ? 'My sessions today' : "Today's sessions"}</h3><div class="sub">${T.long(B.today)}</div></div><span class="pill p-mute plain mono">${ids.length} SESSION${ids.length === 1 ? '' : 'S'}</span></div>
  <div class="list">${ids.length ? ids.map(bid => { const b = batch(bid), r = todayMarks(bid), t = tally(bid, r && r.marks); const n = B.players.filter(p => p.batch === bid).length;
    return `<div class="session"><time>${T.t12(b.time)}</time><div style="min-width:0"><b>${esc(b.name)}</b><small>${esc(ground(b.ground).name)} · ${role === 'coach' ? n + ' players' : esc(coachName(b))}</small></div>${r ? `<span class="pill p-ok">${t.P + t.L}/${t.n} present</span>` : n ? `<button class="btn ${role === 'coach' ? 'btn-primary' : 'btn-ghost'} btn-sm" type="button" data-act="openMark" data-b="${bid}">${role === 'coach' ? 'Take attendance' : 'Mark now'}</button>` : '<span class="pill p-mute plain">No players</span>'}</div>`; }).join('') : `<div class="empty">No sessions today${(B.batches.length ? '' : '. Add a batch to get started')}.</div>`}</div></div>`;
}
function queueCard(compact) {
  const q = B.queue || [];
  return `<div class="card ${compact ? '' : 'glow'}"><div class="card-h"><div><h3>UPI payments to check</h3><div class="sub">Match each ID in your bank app, then approve</div></div><span class="pill ${q.length ? 'p-info' : 'p-ok'}">${q.length ? q.length + ' waiting' : 'All clear'}</span></div>
  <div class="list">${q.length ? q.map(x => { const p = player(x.pid) || { name: 'Past player', batch: '', no: '' }; return `<div class="row qrow"><div class="who grow" style="min-width:180px">${jersey(p)}<div><b>${esc(p.name)}</b><small>${esc(p.parentName || x.by)} · ${T.monthOnly(x.m)} · ${when(x.at)}</small></div></div><div class="end"><span class="hstack" style="flex-wrap:nowrap">${x.utr ? `<span class="utr">${esc(x.utr)}</span>` : x.shot && x.shot !== 'demo' ? `<a class="btn btn-ghost btn-sm" href="/api/file/${x.shot}" target="_blank" rel="noopener">${ic('eye')}Screenshot</a>` : '<span class="pill plain">Screenshot</span>'}<b class="tnum" style="min-width:60px;text-align:right">${inr(x.amt)}</b></span><span class="hstack" style="flex-wrap:nowrap"><button class="btn btn-quiet btn-sm" type="button" data-act="reject" data-id="${x.id}">Reject</button><button class="btn btn-primary btn-sm" type="button" data-act="approve" data-id="${x.id}">${ic('ok')}Approve</button></span></div></div>`; }).join('') : `<div class="empty">No payments waiting. New ones show here the moment a parent sends one.</div>`}</div></div>`;
}
function staffTodayCard(link) {
  const list = B.staff;
  return `<div class="card"><div class="card-h"><div><h3>Coaches today</h3><div class="sub">Check-in times</div></div>${link ? `<a class="btn btn-quiet btn-sm" href="${link}">Open</a>` : ''}</div>
  <div class="list">${list.length ? list.map(s => { const a = s.today; return `<div class="row"><div class="who grow">${av(s.name, 'sm')}<div><b>${esc(s.name)}</b><small>${esc(s.title)}</small></div></div>${!a ? '<span class="pill p-mute plain">Not in yet</span>' : a.s === 'H' ? '<span class="pill p-info plain">On leave</span>' : a.s === 'off' ? '<span class="pill p-mute plain">Day off</span>' : a.s === 'A' ? '<span class="pill p-bad">Absent</span>' : `<span class="pill ${a.s === 'L' ? 'p-warn' : 'p-ok'} tnum">${a.s === 'L' ? 'Late · ' : ''}${a.t}</span>`}</div>`; }).join('') : `<div class="empty">No coaches added yet.</div>`}</div></div>`;
}
function lowCard() {
  const low = B.players.filter(p => p.att != null && p.attN >= 3 && p.att < 65);
  return `<div class="card"><div class="card-h"><div><h3>Low attendance</h3><div class="sub">Below 65% this month</div></div><span class="pill ${low.length ? 'p-bad' : 'p-ok'} plain">${low.length}</span></div>
  <div class="list">${low.length ? low.map(p => `<div class="row"><div class="who grow">${jersey(p)}<div><b>${esc(p.name)}</b><small>${esc(batch(p.batch).name)}</small></div></div>${attPill(p.att)}</div>`).join('') : '<div class="empty">Nobody below 65%.</div>'}</div></div>`;
}
function birthdaysCard() {
  const soon = B.players.filter(p => p.dob).map(p => { for (let i = 0; i < 8; i++) { const d = T.add(B.today, i); if (d.slice(5) === p.dob.slice(5)) return { p, d, age: +d.slice(0, 4) - +p.dob.slice(0, 4) }; } return null; }).filter(Boolean);
  if (!soon.length) return '';
  return `<div class="card"><div class="card-h"><h3>Birthdays this week</h3>${ic('gift')}</div><div class="list">${soon.map(({ p, d, age }) => `<div class="row"><div class="who grow">${jersey(p)}<div><b>${esc(p.name)}</b><small>Turns ${age} · ${d === B.today ? 'Today' : T.dayShort(d)}</small></div></div><button class="btn btn-quiet btn-sm" type="button" data-act="wish" data-p="${p.id}">Send wishes</button></div>`).join('')}</div></div>`;
}
function trendCard() {
  const vals = B.trend.filter(x => x[1] != null).map(x => x[1]); const avg = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  return `<div class="card"><div class="card-h"><div><h3>Attendance, last 14 days</h3><div class="sub">All batches</div></div><span class="mono faint" style="font-size:12px">${avg == null ? 'NO DATA YET' : 'AVG ' + avg + '%'}</span></div>
  <div class="card-b"><div class="bars">${B.trend.map(([d, v]) => `<div class="b"><i class="${v != null && v < 80 ? 'lo' : ''}" style="height:${v != null ? Math.max(8, (v - 50) * 2) : 4}%;${v != null ? '' : 'background:var(--line)'}" title="${T.dayShort(d)}: ${v != null ? v + '%' : 'no sessions'}"></i><small>${+d.slice(8)}</small></div>`).join('')}</div></div></div>`;
}
function markCard(bid, role, day) {
  const b = batch(bid), list = B.players.filter(p => p.batch === bid && !p.brk);
  const iso = day === 'yesterday' ? B.yesterday : B.today;
  const saved = day === 'yesterday' ? (B.attYesterday || {})[bid] : todayMarks(bid);
  const key = bid + '|' + iso;
  if (!U.draft[key]) U.draft[key] = Object.assign({}, saved ? saved.marks : {});
  const m = U.draft[key], t = tally(bid, m);
  const dirty = !saved || list.some(p => m[p.id] !== saved.marks[p.id]);
  const off = !C.isOn(b, iso);
  return `<div class="card"><div class="card-h"><div><h3>${esc(b.name)} · ${T.t12(b.time)}</h3><div class="sub">${T.dayShort(iso)} · ${esc(ground(b.ground).name)} · ${esc(coachName(b))}</div></div>${saved ? `<span class="pill ${dirty ? 'p-warn' : 'p-ok'}">${dirty ? 'Changed, not saved' : 'Saved ' + T.clock(saved.at) + ' · ' + esc(first(saved.by))}</span>` : '<span class="pill p-warn">Not saved</span>'}</div>
  ${off ? `<div class="note" style="margin:12px 20px 0">${ic('calendar')}<span>${esc(b.name)} has no session on ${T.dayShort(iso)}. You can still mark it if you trained.</span></div>` : ''}
  ${list.length ? `<div class="mark-list">${list.map(p => { const v = m[p.id]; return `<div class="mark"><div class="who">${jersey(p)}<div><b>${esc(p.name)}</b><small>#${p.no} · ${p.att == null ? 'new this month' : p.att + '% this month'}</small></div></div><div class="pal" role="group" aria-label="${esc(p.name)}">${['P', 'L', 'A'].map(x => `<button type="button" data-act="mark" data-k="${key}" data-p="${p.id}" data-v="${x}" aria-pressed="${v === x}" ${v === x ? `data-on="${x}"` : ''} aria-label="${{ P: 'Present', L: 'Late', A: 'Absent' }[x]}">${x}</button>`).join('')}</div></div>`; }).join('')}</div>
  <div class="sum-bar"><div class="tally"><span><span class="dot" style="background:var(--brand)"></span> Present <b>${t.P}</b></span><span><span class="dot" style="background:var(--warn)"></span> Late <b>${t.L}</b></span><span><span class="dot" style="background:var(--bad)"></span> Absent <b>${t.A}</b></span><span class="faint">of ${t.n}</span></div>
  <div class="hstack fill-sm"><button class="btn btn-ghost btn-sm" type="button" data-act="allP" data-k="${key}" data-b="${bid}">All present</button><button class="btn btn-primary btn-sm" type="button" data-act="saveAtt" data-k="${key}" data-b="${bid}" data-d="${iso}" ${B.plan.active ? '' : 'disabled'}>${ic('ok')}Save and tell parents</button></div></div>` : `<div class="card-b">${empty('players', 'No players in this batch yet.', role === 'admin' || role === 'manager' ? `<button class="btn btn-primary btn-sm" type="button" data-act="addPlayer" data-b="${bid}">${ic('plus')}Add player</button>` : '')}</div>`}</div>`;
}
function batchPicker(cur, ids, act) {
  if (!ids.length) return '';
  return `<div class="seg" role="group" aria-label="Batch" style="max-width:100%;overflow-x:auto">${ids.map(id => `<button type="button" data-act="${act || 'pickBatch'}" data-b="${id}" aria-pressed="${cur === id}">${esc(batch(id).name)}</button>`).join('')}</div>`;
}
function staffMark(canEdit) {
  const adm = B.me.role === 'admin'; const d = adm && U.sday && U.sday <= B.today && U.sday.slice(0, 7) === B.month ? U.sday : B.today; const past = d !== B.today;
  const rec = s => (past ? (s.cal || {})[d] : s.today) || {};
  return `<div class="card glow"><div class="card-h" style="flex-wrap:wrap"><div><h3>Coach & staff attendance</h3><div class="sub">${T.long(d)} · ${past ? 'changing an earlier day' : 'arrival time is saved with each mark'}</div></div>${adm ? `<input class="input" type="date" id="sday" aria-label="Day" value="${d}" min="${B.month}-01" max="${B.today}" style="width:auto">` : ''}</div>
  ${B.staff.length ? `<div class="mark-list">${B.staff.map(s => { const a = rec(s); return `<div class="mark"><div class="who">${av(s.name)}<div><b>${esc(s.name)}</b><small>${esc(s.title)} · ${a.s === 'H' ? 'On leave' + (a.paid ? ' (paid)' : '') : a.s === 'off' ? 'Day off' : a.t ? 'In at ' + a.t : a.s === 'P' || a.s === 'L' ? 'Present' : a.s === 'A' ? 'Absent' : past ? 'Not marked' : 'Not in yet'} · ${s.days}/${s.of} this month${s.leave ? ` · ${s.leave} leave` : ''}</small></div></div>${canEdit ? (a.s === 'H' ? `<span class="pill p-info plain">Leave</span>` : `<div class="pal pal4" role="group" aria-label="${esc(s.name)}">${['P', 'L', 'A'].map(x => `<button type="button" data-act="smark" data-s="${s.id}" data-d="${d}" data-v="${x}" aria-pressed="${a.s === x}" ${a.s === x ? `data-on="${x}"` : ''} aria-label="${{ P: 'Present', L: 'Late', A: 'Absent' }[x]}">${x}</button>`).join('')}<button type="button" data-act="smark" data-s="${s.id}" data-d="${d}" data-v="off" aria-pressed="${a.s === 'off'}" title="Day off" style="font-size:11px">Off</button></div>`) : ''}</div>`; }).join('')}</div>` : `<div class="card-b">${empty('whistle', 'Add your coaches and manager first.', B.me.role === 'admin' ? `<button class="btn btn-primary btn-sm" type="button" data-act="addStaff">${ic('plus')}Add coach or manager</button>` : '')}</div>`}
  <div class="sum-bar"><span class="faint" style="font-size:13px">Marks save as you tap.${B.academy.selfCheckin ? ' Coaches can also check in from their own app.' : ''}${adm ? ' For leave or holidays, open Manage on the coach.' : ''}</span></div></div>`;
}

/* ---------- admin ---------- */
function setupSteps() {
  const steps = [[!!B.batches.length, 'Add your batches', 'Days, time, ground and monthly fee', 'admin-batches', 'addBatch'], [!!B.staff.length, 'Add coaches and a manager', 'They get their own login', 'admin-staff', 'addStaff'], [!!B.players.length, 'Add players', 'Parents get the app by email', 'admin-players', 'addPlayer'], [!!B.academy.upi, 'Add your UPI ID', 'So parents can pay fees', 'admin-setup', '']];
  if (steps.every(s => s[0])) return '';
  return `<div class="card glow"><div class="card-h"><div><h3>Set up ${esc(B.academy.name)}</h3><div class="sub">${steps.filter(s => s[0]).length} of 4 done</div></div></div><div class="card-b steps">${steps.map(([done, t, s, href, a], i) => `<div class="step ${done ? 'done' : ''}"><span class="n">${done ? ic('ok') : i + 1}</span><div class="grow"><b>${t}</b><small>${s}</small></div>${done ? '' : a ? `<button class="btn btn-primary btn-sm" type="button" data-act="${a}">Start</button>` : `<a class="btn btn-primary btn-sm" href="#${href}">Start</a>`}</div>`).join('')}</div></div>`;
}
function money() {
  let paid = 0, ver = 0, due = 0, over = 0, nd = 0, no = 0;
  B.players.forEach(p => { const c = p.cur || {}; if (c.st === 'paid') paid += c.amt; else if (c.st === 'verify') ver += c.amt; else if (c.st === 'due') { due += c.amt; nd++; } else if (c.st === 'overdue') { over += c.amt; no++; } });
  B.players.forEach(p => (p.bills || []).forEach(b => { if (b.m < B.month && b.st === 'overdue') { over += b.amt; } }));
  return { paid, ver, due, over, nd, no, total: paid + ver + due + over };
}
function adminHome() {
  const m = money(); const marked = B.sessionsToday.filter(b => todayMarks(b)); let pres = 0, tot = 0; marked.forEach(b => { const t = tally(b, todayMarks(b).marks); pres += t.P + t.L; tot += t.n; });
  const owing = B.players.filter(p => p.owes > 0 && (p.bills || []).some(b => b.st === 'overdue')).length;
  const joined = B.players.filter(p => (p.joined || '').slice(0, 7) === B.month).length;
  return `<div class="page-head"><div><h2>${hello()}, ${esc(first(B.me.name))}</h2><p>${T.long(B.today)} · ${esc(B.academy.name)}</p></div><div class="hstack"><button class="btn btn-ghost" type="button" data-act="cash">${ic('rupee')}Record payment</button><button class="btn btn-primary" type="button" data-act="addPlayer">${ic('plus')}Add player</button></div></div>
  ${setupSteps()}
  <div class="kpis">
    <div class="card kpi"><span class="label">Active players</span><span class="v">${B.players.length}</span><span class="d">${joined ? `<span class="up">+${joined}</span> joined in ${T.monthOnly(B.month)}` : B.batches.length + ' batches'}</span></div>
    <div class="card kpi"><span class="label">Present today</span><span class="v">${tot ? Math.round(pres / tot * 100) : 0}%</span><span class="d">${tot ? `${pres} of ${tot} marked so far` : B.sessionsToday.length ? 'Nothing marked yet' : 'No sessions today'}</span><span class="bar"><i style="width:${tot ? pres / tot * 100 : 0}%"></i></span></div>
    <div class="card kpi"><span class="label">${T.monthOnly(B.month)} fees in</span><span class="v">${inr(m.paid)}</span><span class="d">of ${inr(m.paid + m.ver + m.due + (m.over))} · ${inr(m.ver)} to check</span><span class="bar"><i style="width:${m.total ? m.paid / m.total * 100 : 0}%"></i></span></div>
    <div class="card kpi"><span class="label">Overdue</span><span class="v" style="color:var(--bad)">${inr(m.over)}</span><span class="d">${owing} player${owing === 1 ? '' : 's'} · <a href="#admin-reminders" style="color:var(--brand);font-weight:600">Send reminder</a></span></div>
  </div>
  <div class="grid g-main"><div class="stack">${sessionsCard('admin')}${trendCard()}${feedCard()}</div><div class="stack">${queueCard(true)}${staffTodayCard('#admin-staff')}${lowCard()}${birthdaysCard()}</div></div>`;
}
function feedCard() {
  const f = B.feed.slice(0, 6);
  return `<div class="card"><div class="card-h"><div><h3>Live across your apps</h3><div class="sub">What coaches, the manager and parents just did</div></div><button class="btn btn-quiet btn-sm" type="button" data-act="bell">All</button></div><div class="list">${f.length ? f.map(feedRow).join('') : '<div class="empty">Nothing yet. Activity from every app shows here.</div>'}</div></div>`;
}
function feedRow(f) {
  const seen = U.modal && U.modal.t === 'bell' && U.seenBefore != null ? U.seenBefore : (B.feedSeenAt || 0);
  const tab = (f.href || {})[B.me.role];
  return `<button class="feed-row ${f.at > seen && f.by !== B.me.name ? 'new' : ''}" type="button" ${tab ? `data-act="goto" data-h="${B.me.role}-${tab}"` : ''}><span class="fi">${ic(f.ico || 'bell')}</span><span style="min-width:0"><b>${esc(f.title)}</b><small>${esc(f.sub)}${f.by && f.by !== 'Veyra' ? ' · ' + esc(f.by) : ''}</small></span><time>${when(f.at)}</time></button>`;
}
function playersView(role) {
  const list = B.players.filter(p => (U.pb === 'all' || p.batch === U.pb) && (!U.pq || (p.name + ' ' + (p.parentName || '') + ' ' + (p.parentEmail || '')).toLowerCase().includes(U.pq.toLowerCase())));
  const adm = role === 'admin';
  return `<div class="page-head"><div><h2>Players</h2><p>${B.players.length} active players in ${B.batches.length} batches.</p></div><div class="hstack">${adm ? `<button class="btn btn-ghost" type="button" data-act="importPlayers">${ic('up')}Import</button><button class="btn btn-ghost hide-sm" type="button" data-act="exportPlayers">${ic('down')}Export CSV</button>` : ''}<button class="btn btn-primary" type="button" data-act="addPlayer">${ic('plus')}Add player</button></div></div>
  <div class="card"><div class="card-h" style="flex-wrap:wrap"><div class="toolbar" style="flex:1"><label class="search" for="pq">${ic('search')}<input class="input input-sm" id="pq" type="search" placeholder="Search player or parent" value="${esc(U.pq)}"></label>
    <select class="select select-sm" id="pb" style="width:auto" aria-label="Batch"><option value="all">All batches</option>${B.batches.map(b => `<option value="${b.id}" ${U.pb === b.id ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select></div><span class="faint mono hide-sm" style="font-size:12px">${list.length} SHOWN</span></div>
  ${B.players.length ? `<div class="table-wrap"><table class="t"><thead><tr><th>Player</th><th class="hide-sm">Batch</th><th class="hide-sm">Parent</th><th class="hide-xs">Attend.</th>${adm ? `<th>${T.monthShort(B.month)} fee</th><th class="r hide-sm">Fee/mo</th>` : '<th>App</th>'}<th class="hide-sm"></th></tr></thead><tbody>
  ${list.map(p => `<tr data-act="viewPlayer" data-p="${p.id}" style="cursor:pointer"><td><div class="who">${jersey(p)}<div><b>${esc(p.name)}</b><small>${esc(batch(p.batch).name)} · #${p.no}</small></div></div></td><td class="hide-sm">${esc(batch(p.batch).name)}</td><td class="hide-sm">${esc(p.parentName)}</td><td class="hide-xs">${attPill(p.att)}</td>${adm ? `<td>${feePill((p.cur || {}).st || 'none')}</td><td class="r hide-sm">${inr(p.fee)}</td>` : `<td>${p.hasApp ? '<span class="pill p-ok">Has login</span>' : '<span class="pill p-mute">No email</span>'}</td>`}<td class="r hide-sm"><button class="btn btn-quiet btn-sm" type="button" data-act="viewPlayer" data-p="${p.id}">View</button></td></tr>`).join('') || '<tr><td colspan="7"><div class="empty">No players match.</div></td></tr>'}
  </tbody></table></div>` : `<div class="card-b">${empty('players', B.batches.length ? 'No players yet. Add your first player and their parent gets the app.' : 'Add a batch first, then add players to it.', B.batches.length ? `<button class="btn btn-primary btn-sm" type="button" data-act="addPlayer">${ic('plus')}Add player</button>` : `<button class="btn btn-primary btn-sm" type="button" data-act="addBatch">${ic('plus')}Add batch</button>`)}</div>`}</div>
  ${adm && B.pastPlayers && B.pastPlayers.length ? `<details class="card" style="padding:0"><summary class="card-h" style="cursor:pointer"><h3>Past players</h3><span class="faint mono" style="font-size:12px">${B.pastPlayers.length}</span></summary><div class="list">${B.pastPlayers.map(p => `<div class="row"><div class="grow"><b>${esc(p.name)}</b><small class="faint" style="display:block;font-size:12.5px">Left ${T.full(p.left)}</small></div></div>`).join('')}</div></details>` : ''}`;
}
function attendanceView(role) {
  const staffOk = role === 'admin'; const mode = staffOk ? U.attMode : 'players';
  const ids = B.batches.map(b => b.id);
  const dayIso = U.attDay === 'yesterday' ? B.yesterday : B.today;
  if (!ids.includes(U.attBatch)) U.attBatch = (B.batches.filter(b => C.isOn(b, dayIso)).find(b => !(U.attDay === 'yesterday' ? (B.attYesterday || {})[b.id] : todayMarks(b.id))) || B.batches.find(b => C.isOn(b, dayIso)) || B.batches[0] || {}).id || '';
  return `<div class="page-head"><div><h2>${role === 'manager' ? 'Player attendance' : 'Attendance'}</h2><p>${role === 'admin' ? 'You can mark or change any batch.' : 'Change any mark a coach got wrong.'}</p></div>
    <div class="hstack">${mode === 'players' ? `<div class="seg" role="group" aria-label="Day"><button type="button" data-act="attDay" data-v="today" aria-pressed="${U.attDay === 'today'}">Today</button><button type="button" data-act="attDay" data-v="yesterday" aria-pressed="${U.attDay === 'yesterday'}">Yesterday</button></div>` : ''}${staffOk ? `<div class="seg" role="group" aria-label="Who"><button type="button" data-act="attMode" data-v="players" aria-pressed="${mode === 'players'}">Players</button><button type="button" data-act="attMode" data-v="staff" aria-pressed="${mode === 'staff'}">Coaches & staff</button></div>` : ''}</div></div>
  ${mode === 'staff' ? staffMark(true) : B.batches.length ? `${batchPicker(U.attBatch, ids)}${markCard(U.attBatch, role, U.attDay)}` : `<div class="card"><div class="card-b">${empty('batch', 'Add a batch first.', role === 'admin' ? `<button class="btn btn-primary btn-sm" type="button" data-act="addBatch">${ic('plus')}Add batch</button>` : '')}</div></div>`}`;
}
function feeMonths() { const s = new Set([B.month]); B.players.forEach(p => (p.bills || []).forEach(b => s.add(b.m))); return [...s].sort().reverse().slice(0, 12); }
function feesView() {
  const months = feeMonths(); if (!months.includes(U.feeMonth)) U.feeMonth = B.month;
  const M = U.feeMonth; const f = U.feeFilter;
  const rows = B.players.map(p => ({ p, b: (p.bills || []).find(b => b.m === M) })).filter(x => x.b);
  const sum = s => rows.filter(x => x.b.st === s).reduce((t, x) => t + x.b.amt, 0);
  const tot = rows.reduce((t, x) => t + x.b.amt, 0) || 1;
  const list = rows.filter(x => f === 'all' || x.b.st === f);
  return `<div class="page-head"><div><h2>Fees & billing</h2><p>Due on the ${ord(B.academy.dueDay)} · late fee ${inr(B.academy.lateFee)} after the ${ord(B.academy.lateAfter)} · ${B.academy.upi ? 'UPI ' + esc(B.academy.upi) : '<a href="#admin-setup" style="color:var(--bad);font-weight:600">Add your UPI ID</a>'}</p></div><div class="hstack"><select class="select" id="feeMonth" aria-label="Month" style="width:auto">${months.map(m => `<option value="${m}" ${m === M ? 'selected' : ''}>${T.monthName(m)}</option>`).join('')}</select><button class="btn btn-primary" type="button" data-act="cash">${ic('rupee')}Record payment</button></div></div>
  <div class="kpis">${[['Collected', sum('paid'), 'var(--ok)'], ['To check (UPI)', sum('verify'), 'var(--info)'], ['Due', sum('due'), 'var(--warn)'], ['Overdue', sum('overdue'), 'var(--bad)']].map(([l, v, c]) => `<div class="card kpi"><span class="label">${l}</span><span class="v" style="color:${c}">${inr(v)}</span><span class="bar"><i style="width:${v / tot * 100}%;background:${c}"></i></span></div>`).join('')}</div>
  ${queueCard()}
  <div class="card"><div class="card-h" style="flex-wrap:wrap"><h3>${T.monthName(M)} bills</h3><div class="seg" role="group" aria-label="Filter" style="max-width:100%;overflow-x:auto">${[['all', 'All'], ['paid', 'Paid'], ['verify', 'To check'], ['due', 'Due'], ['overdue', 'Overdue']].map(([k, l]) => `<button type="button" data-act="feeFilter" data-v="${k}" aria-pressed="${f === k}">${l}</button>`).join('')}</div></div>
  ${rows.length ? `<div class="table-wrap"><table class="t"><thead><tr><th>Player</th><th class="hide-sm">Parent</th><th>Status</th><th class="r">Amount</th><th class="r"></th></tr></thead><tbody>
  ${list.map(({ p, b }) => `<tr><td><div class="who">${jersey(p)}<div><b>${esc(p.name)}</b><small>${esc(batch(p.batch).name)}${b.receipt ? ' · ' + b.receipt : ''}</small></div></div></td><td class="hide-sm">${esc(p.parentName)}</td><td>${feePill(b.st)}</td><td class="r tnum">${inr(b.amt)}${b.late ? '<small class="faint" style="display:block;font-size:11px">incl. late fee</small>' : ''}</td><td class="r"><div class="hstack" style="justify-content:flex-end;flex-wrap:nowrap">${b.st === 'paid' ? `<button class="btn btn-quiet btn-sm" type="button" data-act="receipt" data-p="${p.id}" data-m="${M}">${ic('receipt')}<span class="hide-sm">Receipt</span></button>` : b.st === 'verify' ? `<span class="faint" style="font-size:13px">See above</span>` : b.st === 'waived' ? `<button class="btn btn-quiet btn-sm" type="button" data-act="waive" data-p="${p.id}" data-m="${M}">Undo</button>` : `<button class="btn btn-ghost btn-sm" type="button" data-act="markPaid" data-p="${p.id}" data-m="${M}">Mark paid</button><button class="btn btn-quiet btn-sm hide-sm" type="button" data-act="waive" data-p="${p.id}" data-m="${M}">Waive</button>`}</div></td></tr>`).join('') || '<tr><td colspan="5"><div class="empty">Nothing here.</div></td></tr>'}
  </tbody></table></div>` : `<div class="card-b">${empty('rupee', 'No bills yet. Bills appear for every player each month.')}</div>`}</div>`;
}
function remindersView() {
  const S = B.academy.settings;
  const targets = B.players.filter(p => (p.bills || []).some(b => b.st === 'due' || b.st === 'overdue'));
  const p = targets[0]; const b = p && p.bills.find(x => x.st === 'due' || x.st === 'overdue');
  const prev = p ? C.fillTpl({ settings: S, name: B.academy.name }, { name: p.name, parentName: p.parentName }, b, p.owes) : 'Nobody owes anything right now.';
  return `<div class="page-head"><div><h2>Fee reminders</h2><p>Reminders go out on their own at 9:00 AM. You can also send them now.</p></div><button class="btn btn-primary" type="button" data-act="sendNow" ${targets.length ? '' : 'disabled'}>${ic('bell')}Remind ${targets.length} parent${targets.length === 1 ? '' : 's'} now</button></div>
  <div class="grid g2 g2-wide"><div class="stack">
    <div class="card"><div class="card-h"><h3>When to remind</h3></div>${[['before', '3 days before the due date', 'Gentle heads-up'], ['due', 'On the due date', '“Due today”'], ['after', '3 days after the due date', 'Mentions the late fee'], ['weekly', 'Every 7 days while overdue', 'Stops once paid']].map(([k, t, s]) => `<label class="rule" for="r-${k}"><div class="grow"><b>${t}</b><small>${s}</small></div><span class="switch"><input type="checkbox" id="r-${k}" data-rule="${k}" ${S.rules[k] ? 'checked' : ''}><i></i></span></label>`).join('')}</div>
    <div class="card"><div class="card-h"><h3>How to send</h3></div>${[['app', 'App notification', 'Shows in the parent app bell'], ['email', 'Email', LIVE && !CFG.mail ? 'Needs email set up by Veyra' : 'From Veyra Academy, in your academy name'], ['wa', 'WhatsApp message', 'Opens WhatsApp with the text ready, one parent at a time']].map(([k, t, s]) => `<label class="rule" for="c-${k}"><div class="grow"><b>${t}</b><small>${s}</small></div><span class="switch"><input type="checkbox" id="c-${k}" data-chan="${k}" ${S.chan[k] ? 'checked' : ''}><i></i></span></label>`).join('')}</div>
  </div><div class="stack">
    <div class="card"><div class="card-h"><h3>Message</h3><span class="faint" style="font-size:12.5px">{parent} {player} {month} {amount} {due}</span></div><div class="card-b" style="display:grid;gap:16px"><label class="field" for="tpl"><span class="sr">Message text</span><textarea class="textarea" id="tpl" rows="5">${esc(S.tpl)}</textarea></label><span class="label">Preview</span><div class="bubble-msg" id="tplPrev">${esc(prev)}</div></div><div class="card-f"><button class="btn btn-primary btn-sm" type="button" data-act="saveTpl">Save message</button></div></div>
    <div class="card"><div class="card-h"><h3>Who gets it now</h3><span class="pill p-warn plain">${targets.length}</span></div><div class="list">${targets.length ? targets.map(p => `<div class="row"><div class="who grow">${av(p.parentName, 'sm')}<div><b>${esc(p.parentName)}</b><small>for ${esc(p.name)} · ${inr(p.owes)}</small></div></div>${feePill(p.bills.find(x => x.st === 'overdue') ? 'overdue' : 'due')}<button class="btn btn-quiet btn-sm" type="button" data-act="remindOne" data-p="${p.id}">Remind</button></div>`).join('') : '<div class="empty">Everyone has paid.</div>'}</div></div>
  </div></div>`;
}
function staffView() {
  return `<div class="page-head"><div><h2>Coaches & staff</h2><p>Each person logs in with their own email or Google account.</p></div><button class="btn btn-primary" type="button" data-act="addStaff">${ic('plus')}Add coach or manager</button></div>
  <div class="card">${B.staff.length ? `<div class="table-wrap"><table class="t"><thead><tr><th>Name</th><th class="hide-sm">Role</th><th class="hide-sm">Batches</th><th>This month</th><th class="hide-xs">Today</th><th></th></tr></thead><tbody>
  ${B.staff.map(s => { const a = s.today; const bs = B.batches.filter(b => b.coach === s.id).map(b => b.name).join(', ') || (s.role === 'manager' ? 'All batches' : 'None yet'); return `<tr><td><div class="who">${av(s.name)}<div><b>${esc(s.name)}</b><small>${esc(s.email || '')}</small></div></div></td><td class="hide-sm"><span class="pill ${s.role === 'manager' ? 'p-info' : 'p-brand'} plain">${esc(s.title)}</span></td><td class="hide-sm">${esc(bs)}</td><td class="tnum">${s.days}/${s.of} days</td><td class="hide-xs">${!a ? '<span class="pill p-mute plain">Not in</span>' : a.s === 'H' ? '<span class="pill p-info plain">On leave</span>' : a.s === 'off' ? '<span class="pill p-mute plain">Day off</span>' : a.s === 'A' ? '<span class="pill p-bad">Absent</span>' : `<span class="pill ${a.s === 'L' ? 'p-warn' : 'p-ok'} tnum">${a.t}</span>`}</td><td class="r"><button class="btn btn-quiet btn-sm" type="button" data-act="editStaff" data-s="${s.id}">Manage</button></td></tr>`; }).join('')}
  </tbody></table></div>` : `<div class="card-b">${empty('whistle', 'No coaches yet. Add one and they get their own login.', `<button class="btn btn-primary btn-sm" type="button" data-act="addStaff">${ic('plus')}Add coach or manager</button>`)}</div>`}</div>${B.staff.length ? staffMark(true) : ''}`;
}
function parentsView() {
  const map = {}; B.players.forEach(p => { const k = p.parentEmail || 'n:' + p.parentName; (map[k] = map[k] || { name: p.parentName, email: p.parentEmail, phone: p.parentPhone, app: p.hasApp, kids: [] }).kids.push(p); });
  const rows = Object.values(map);
  return `<div class="page-head"><div><h2>Parents</h2><p>${rows.length} families · ${rows.filter(r => r.app).length} have a login</p></div></div>
  <div class="card">${rows.length ? `<div class="table-wrap"><table class="t"><thead><tr><th>Parent</th><th class="hide-sm">Children</th><th class="hide-xs">Login</th><th>Owes</th><th></th></tr></thead><tbody>
  ${rows.map(r => { const owe = r.kids.reduce((t, k) => t + (k.owes || 0), 0); return `<tr><td><div class="who">${av(r.name)}<div><b>${esc(r.name)}</b><small>${esc(r.email || 'No email yet')}</small></div></div></td><td class="hide-sm">${r.kids.map(k => esc(first(k.name))).join(', ')}</td><td class="hide-xs">${r.app ? '<span class="pill p-ok">Has login</span>' : '<span class="pill p-mute">No email</span>'}</td><td class="tnum">${owe ? `<b style="color:var(--bad)">${inr(owe)}</b>` : '<span class="faint">Nothing</span>'}</td><td class="r"><div class="hstack" style="justify-content:flex-end;flex-wrap:nowrap">${owe ? `<button class="btn btn-quiet btn-sm" type="button" data-act="remindOne" data-p="${r.kids[0].id}">Remind</button>` : ''}${r.app ? `<button class="btn btn-quiet btn-sm" type="button" data-act="parentReset" data-p="${r.kids[0].id}">New password</button>` : `<button class="btn btn-quiet btn-sm" type="button" data-act="viewPlayer" data-p="${r.kids[0].id}">Add email</button>`}</div></td></tr>`; }).join('')}
  </tbody></table></div>` : `<div class="card-b">${empty('parent', 'Parents appear here when you add players with a parent email.')}</div>`}</div>`;
}
