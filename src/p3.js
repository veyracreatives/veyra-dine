
function batchesView(role) {
  return `<div class="page-head"><div><h2>Batches</h2><p>${B.batches.length} batch${B.batches.length === 1 ? '' : 'es'} across ${B.grounds.length} ground${B.grounds.length === 1 ? '' : 's'}.</p></div>${role === 'admin' ? `<button class="btn btn-primary" type="button" data-act="addBatch">${ic('plus')}New batch</button>` : ''}</div>
  ${B.batches.length ? `<div class="grid g3">${B.batches.map(b => { const n = B.players.filter(p => p.batch === b.id); const v = n.filter(p => p.att != null); const avg = v.length ? Math.round(v.reduce((t, p) => t + p.att, 0) / v.length) : null; return `<article class="card" style="overflow:hidden"><div style="height:6px;background:${TINT[b.tint]}"></div><div class="card-b" style="display:grid;gap:14px">
    <div class="between"><div><h3 style="font-size:20px">${esc(b.name)}</h3><span class="faint" style="font-size:13px">${esc(b.age || '')}</span></div><span class="pill p-mute plain tnum">${n.length} players</span></div>
    <dl class="kv" style="font-size:13.5px"><dt>Days</dt><dd>${C.daysText(b.days)}</dd><dt>Time</dt><dd>${T.t12(b.time)} · ${b.mins || 60} min</dd><dt>Ground</dt><dd>${esc(ground(b.ground).name)}</dd><dt>Coach</dt><dd>${esc(coachName(b))}</dd><dt>Fee</dt><dd>${inr(b.fee)}/mo</dd><dt>Attendance</dt><dd>${avg == null ? '—' : avg + '%'}</dd></dl>
    ${(b.off || []).filter(d => d >= B.today).length ? `<div class="note">${ic('calendar')}<span>No session on ${(b.off || []).filter(d => d >= B.today).map(T.dayShort).join(', ')}</span></div>` : ''}
    <div class="hstack"><a class="btn btn-ghost btn-sm" href="#${role}-attendance" data-act="pickBatchGo" data-b="${b.id}">${ic('check')}Attendance</a>${role === 'admin' ? `<button class="btn btn-quiet btn-sm" type="button" data-act="editBatch" data-b="${b.id}">Edit</button>` : ''}<button class="btn btn-quiet btn-sm" type="button" data-act="cancelSession" data-b="${b.id}">Cancel a session</button></div></div></article>`; }).join('')}</div>` : `<div class="card"><div class="card-b">${empty('batch', 'No batches yet. A batch is a group that trains together, like U-10 on Mon, Wed and Fri at 7:30 AM.', role === 'admin' ? `<button class="btn btn-primary btn-sm" type="button" data-act="addBatch">${ic('plus')}Add your first batch</button>` : '')}</div></div>`}`;
}
const STAGES = [{ id: 'enquiry', name: 'Enquiry', t: 'blue' }, { id: 'trial', name: 'Trial booked', t: 'green' }, { id: 'fees', name: 'First fee pending', t: 'red' }, { id: 'enrolled', name: 'Joined', t: 'slate' }];
function admissionsView() {
  const c = s => B.adm.filter(a => a.s === s); const thisM = a => T.date(a.at).slice(0, 7) === B.month;
  return `<div class="page-head"><div><h2 class="disp" style="font-size:clamp(30px,4vw,44px)">From first call <em>to the pitch</em></h2><p>Every enquiry, trial and first fee on one board. Drag a card to move a player.</p></div>
    <div class="toolbar"><label class="search" for="aq">${ic('search')}<input class="input" id="aq" type="search" placeholder="Search" value="${esc(U.aq)}"></label><button class="btn btn-primary" type="button" data-act="addEnq">${ic('plus')}Add enquiry</button></div></div>
  <div class="kpis">${[['Enquiries', c('enquiry').length, 'Waiting for a trial'], ['Trials booked', c('trial').length, 'Coming up'], ['First fees pending', inr(c('fees').reduce((t, a) => t + a.fee, 0)), c('fees').length + ' players'], ['Joined this month', c('enrolled').filter(thisM).length, 'From this board']].map(([l, v, d]) => `<div class="card kpi"><span class="label">${l}</span><span class="v">${v}</span><span class="d">${d}</span></div>`).join('')}</div>
  <section class="card glow" style="padding:14px;border-radius:20px"><div class="between" style="padding:2px 4px 12px"><h3 style="font-size:17px">Admissions pipeline</h3><span class="faint" style="font-size:12.5px">Drag, or focus a card and press ← →. Tap a card to edit or enrol.</span></div><div class="board" id="board">${boardHTML()}</div></section>`;
}
function boardHTML(dropId) {
  return STAGES.map((st, k) => { const list = B.adm.filter(a => a.s === st.id && (!U.aq || (a.n + ' ' + a.parent).toLowerCase().includes(U.aq.toLowerCase())));
    return `<div class="col" data-stage="${st.id}" style="--c:${TINT[st.t]}"><div class="col-head"><span class="bar"></span><h3>${st.name}</h3><span class="n">${list.length}</span><span class="sum">${inr(list.reduce((t, a) => t + a.fee, 0))}</span></div>
    <div class="drop">${list.length ? list.map(a => `<article class="adm ${dropId === a.id ? 'dropped' : ''}" tabindex="0" data-id="${a.id}" style="--c:${TINT[st.t]}" aria-label="${esc(a.n)}, ${st.name}"><div class="top-r"><div class="who"><div><b>${esc(a.n)}</b><small>${esc(a.parent ? 'Parent: ' + a.parent : a.phone || '')}</small></div></div><span class="age">${esc(a.age)}</span></div><div class="meta"><span class="fee">${inr(a.fee)}<small>/mo</small></span>${chev(k + 1)}</div><div class="meta"><span>${esc(a.src)} · ${st.id === 'trial' && a.trial ? esc(a.trial) : when(a.at)}</span>${k < 3 ? `<button class="next" type="button" data-act="nextStage" data-id="${a.id}">Next ${ic('arrow')}</button>` : a.pid ? '' : `<button class="next" type="button" data-act="enrol" data-id="${a.id}">Add ${ic('plus')}</button>`}</div></article>`).join('') : `<div class="empty">${U.aq ? 'No match' : 'Drop a player here'}</div>`}</div></div>`; }).join('');
}
function noticesView(canPost) {
  const role = B.me.role;
  const opts = role === 'coach' ? B.batches.filter(b => B.myBatches.includes(b.id)) : B.batches;
  const upcoming = [];
  B.tournaments.forEach(t => t.matches.forEach(m => { if (m.date >= B.today && !m.score) upcoming.push({ t, m }); }));
  upcoming.sort((a, b) => (a.m.date + a.m.time).localeCompare(b.m.date + b.m.time));
  const toName = n => n.to === 'all' ? 'All parents' : n.to === 'coaches' ? 'Coaches' : batch(n.to).name;
  return `${canPost ? `<div class="card"><div class="card-h"><h3>Post a notice</h3></div><form class="card-b" id="noticeForm" style="display:grid;gap:14px">
    <div class="grid g2"><label class="field" for="n-title"><span>Title</span><input class="input" id="n-title" placeholder="e.g. Kit day on Saturday" required></label>
    <label class="field" for="n-to"><span>Send to</span><select class="select" id="n-to">${role === 'coach' ? '' : '<option value="all">All parents</option>'}${opts.map(b => `<option value="${b.id}">${esc(b.name)} parents</option>`).join('')}${role === 'coach' ? '' : '<option value="coaches">Coaches only</option>'}</select></label></div>
    <label class="field" for="n-body"><span>Message</span><textarea class="textarea" id="n-body" placeholder="What should they know?"></textarea></label>
    <div class="between"><span class="faint" style="font-size:13px">It shows in their app straight away${B.academy.settings.chan && B.academy.settings.chan.email ? ' and goes by email' : ''}.</span><button class="btn btn-primary" type="submit" ${B.plan.active ? '' : 'disabled'}>${ic('megaphone')}Post notice</button></div></form></div>` : ''}
  <div class="grid g-main"><div class="card"><div class="card-h"><h3>Notices</h3><span class="faint mono" style="font-size:12px">${B.notices.length}</span></div><div class="list">${B.notices.length ? B.notices.map(n => `<div class="notice"><div class="hstack"><span class="pill p-brand plain">${esc(n.tag)}</span><span>${when(n.at)} · ${esc(toName(n))} · ${esc(n.by)}</span>${(role === 'admin' || role === 'manager') ? `<button class="btn btn-quiet btn-sm" type="button" data-act="delNotice" data-id="${n.id}" style="margin-left:auto">Remove</button>` : ''}</div><b>${esc(n.title)}</b>${n.body ? `<p>${esc(n.body)}</p>` : ''}</div>`).join('') : '<div class="empty">No notices yet.</div>'}</div></div>
  <div class="card"><div class="card-h"><h3>Coming up</h3>${ic('trophy')}</div><div class="list">${upcoming.length ? upcoming.slice(0, 6).map(({ t, m }) => `<div class="session" style="grid-template-columns:76px minmax(0,1fr)"><time>${T.dayShort(m.date).replace(' ', '<br>')}</time><div style="min-width:0"><b>vs ${esc(m.vs)}</b><small>${esc(t.name)}${m.time ? ' · ' + T.t12(m.time) : ''} · ${esc(m.venue)}</small></div></div>`).join('') : '<div class="empty">No matches coming up.</div>'}</div></div></div>`;
}
function reportsView() {
  const max = Math.max(1, ...B.revenue.map(r => r[1]));
  const first_ = B.revenue.find(r => r[1] > 0), last = B.revenue[B.revenue.length - 1];
  const growth = first_ && first_ !== last && first_[1] ? Math.round((last[1] - first_[1]) / first_[1] * 100) : null;
  return `<div class="page-head"><div><h2>Reports</h2><p>${T.monthName(B.revenue[0][0])} to ${T.monthName(B.month)}</p></div><div class="hstack"><button class="btn btn-ghost" type="button" data-act="exportFees">${ic('down')}Fees CSV</button><button class="btn btn-ghost" type="button" data-act="exportAtt">${ic('down')}Attendance CSV</button></div></div>
  <div class="grid g2"><div class="card"><div class="card-h"><div><h3>Fees collected</h3><div class="sub">By the month the money came in</div></div>${growth != null ? `<span class="pill ${growth >= 0 ? 'p-ok' : 'p-bad'} plain">${growth >= 0 ? '+' : ''}${growth}% since ${T.monthShort(first_[0])}</span>` : ''}</div><div class="card-b"><div class="bars" style="height:200px">${B.revenue.map(([m, v], i) => `<div class="b"><i style="height:${Math.max(2, v / max * 100)}%;${i === B.revenue.length - 1 ? 'box-shadow:0 0 18px var(--brand)' : ''}" title="${inr(v)}"></i><small>${T.monthShort(m)} · ${v >= 100000 ? (v / 100000).toFixed(1) + 'L' : v >= 1000 ? Math.round(v / 1000) + 'k' : v}</small></div>`).join('')}</div></div></div>
  <div class="card"><div class="card-h"><div><h3>Attendance by batch</h3><div class="sub">${T.monthName(B.month)} average</div></div></div><div class="card-b" style="display:grid;gap:16px">${B.batches.length ? B.batches.map(b => { const n = B.players.filter(p => p.batch === b.id && p.att != null); const v = n.length ? Math.round(n.reduce((t, p) => t + p.att, 0) / n.length) : 0; return `<div class="hbar"><span>${esc(b.name)}</span><span class="track"><i style="width:${v}%;background:${TINT[b.tint]}"></i></span><b>${n.length ? v + '%' : '—'}</b></div>`; }).join('') : '<div class="empty">No batches yet.</div>'}</div></div></div>
  <div class="grid g3">${[['Paid on time', B.onTimeRate == null ? '—' : B.onTimeRate + '%', 'Last month, by the late-fee date'], ['Active players', B.players.length, (B.pastPlayers || []).length + ' have left'], ['Trial to joined', B.trialRate == null ? '—' : B.trialRate + '%', 'From the admissions board']].map(([l, v, d]) => `<div class="card kpi"><span class="label">${l}</span><span class="v">${v}</span><span class="d">${d}</span></div>`).join('')}</div>`;
}
function setupView() {
  const y = U.planSel === 'yearly', P = B.plan, pr = CFG.plans;
  const save = pr.monthly * 12 - pr.yearly;
  return `<div class="page-head"><div><h2>Settings & plan</h2><p>${esc(B.academy.name)}</p></div></div>
  <section class="card glow"><div class="card-h"><div><h3>Your plan</h3><div class="sub">${P.type === 'trial' ? 'Free trial' : P.type === 'yearly' ? 'Yearly plan' : 'Monthly plan'} · ${P.active ? `${P.daysLeft} day${P.daysLeft === 1 ? '' : 's'} left · ends ${T.full(T.date(P.until))}` : 'ended ' + T.full(T.date(P.until))}</div></div><span class="pill ${!P.active ? 'p-bad' : P.type === 'trial' ? 'p-warn' : 'p-ok'}">${!P.active ? 'Ended' : P.type === 'trial' ? 'Trial' : 'Active'}</span></div>
  <div class="card-b" style="display:grid;gap:16px"><div class="grid g2">
    <button class="plan-opt" type="button" data-act="plan" data-v="monthly" aria-pressed="${!y}"><span class="between"><span class="label">Monthly</span></span><span class="amt">${inr(pr.monthly)}<small>/month</small></span><span class="faint" style="font-size:13px">30 days, pay again when it ends</span></button>
    <button class="plan-opt" type="button" data-act="plan" data-v="yearly" aria-pressed="${y}"><span class="between"><span class="label">Yearly</span>${save > 0 ? `<span class="pill p-brand plain">Save ${inr(save)}</span>` : ''}</span><span class="amt">${inr(pr.yearly)}<small>/year</small></span><span class="faint" style="font-size:13px">${inr(Math.round(pr.yearly / 12))} a month</span></button></div>
    <div class="between"><span class="faint" style="font-size:13px">${ic('shield', '')} Secure payment by Razorpay: UPI, cards, net banking. No GST added.${P.active && P.type !== 'trial' ? ' Days are added on top of what you have left.' : ''}</span><button class="btn btn-primary btn-lg" type="button" data-act="buyPlan">Pay ${y ? inr(pr.yearly) : inr(pr.monthly)} with Razorpay</button></div>
    <div class="divider"></div><div class="between"><label class="field" for="lic" style="flex:1;min-width:220px"><span>Have a licence key from Veyra?</span><input class="input mono" id="lic" placeholder="VFB-XXXX-XXXX-XXXX" autocomplete="off"></label><button class="btn btn-ghost" type="button" data-act="lic" style="align-self:end">${ic('key')}Activate key</button></div></div></section>
  <div class="grid g2 g2-wide"><div class="card"><div class="card-h"><h3>Fee collection</h3></div><div class="card-b" style="display:grid;gap:14px">
    <label class="field" for="s-upi"><span>Academy UPI ID</span><input class="input mono" id="s-upi" value="${esc(B.academy.upi)}" placeholder="yourname@okaxis"></label>
    <label class="field" for="s-payee"><span>Name parents see</span><input class="input" id="s-payee" value="${esc(B.academy.payee)}"></label>
    <div class="grid g3"><label class="field" for="s-due"><span>Due on day</span><input class="input" id="s-due" inputmode="numeric" value="${B.academy.dueDay}"></label><label class="field" for="s-lateafter"><span>Late after day</span><input class="input" id="s-lateafter" inputmode="numeric" value="${B.academy.lateAfter}"></label><label class="field" for="s-late"><span>Late fee (₹)</span><input class="input" id="s-late" inputmode="numeric" value="${B.academy.lateFee}"></label></div>
    <div class="note">${ic('upi')}<span>Parents pay this UPI ID and paste the transaction ID. You approve it under Fees. Money never passes through Veyra.</span></div>
  </div><div class="card-f"><button class="btn btn-primary btn-sm" type="button" data-act="saveFees">Save</button></div></div>
  <div class="stack"><div class="card"><div class="card-h"><h3>Academy</h3></div><div class="card-b" style="display:grid;gap:14px"><label class="field" for="s-name"><span>Academy name</span><input class="input" id="s-name" value="${esc(B.academy.name)}"></label><label class="field" for="s-place"><span>Area</span><input class="input" id="s-place" value="${esc(B.academy.place)}"></label></div><div class="card-f"><button class="btn btn-primary btn-sm" type="button" data-act="saveAcademy">Save</button></div></div>
  <div class="card"><label class="rule" for="s-google"><div class="grow"><b>Sign in with Google</b><small>Coaches and parents can log in with their Google account</small></div><span class="switch"><input type="checkbox" id="s-google" ${B.academy.settings.google ? 'checked' : ''}><i></i></span></label>
  <div class="rule"><div class="grow"><b>Grounds</b><small>${B.grounds.map(g => esc(g.name)).join(', ')}</small></div><a class="btn btn-ghost btn-sm" href="#admin-grounds">${ic('pin')}Manage</a></div>
  <div class="rule"><div class="grow"><b>Install on your phone</b><small>Works like an app on Android, iPhone and laptop</small></div><button class="btn btn-ghost btn-sm" type="button" data-act="install">${ic('phone')}Install</button></div>
  <div class="rule"><div class="grow"><b>Your data</b><small>${LIVE ? 'Backed up every night. Download a full copy any time.' : 'In this preview, data lives in this browser.'}</small></div><button class="btn btn-ghost btn-sm" type="button" data-act="exportAll">${ic('down')}Download all data</button></div></div></div></div>`;
}

/* ---------- manager ---------- */
function managerHome() {
  const notIn = B.staff.filter(s => !s.today && B.batches.some(b => b.coach === s.id && B.sessionsToday.includes(b.id))).length;
  const me = myStaff();
  return `<div class="page-head"><div><h2>${hello()}, ${esc(first(B.me.name))}</h2><p>${T.long(B.today)} · ${esc(B.academy.name)}</p></div><div class="hstack">${me && !(me.today && me.today.t) ? `<button class="btn btn-ghost" type="button" data-act="checkin">${ic('clock')}Check in</button>` : ''}<a class="btn btn-primary" href="#manager-staffatt">${ic('whistle')}Mark coaches</a></div></div>
  <div class="kpis">${[['Coaches in today', B.staff.filter(s => s.today && s.today.t).length + ' of ' + B.staff.filter(s => !s.today || s.today.s !== 'off').length, notIn ? notIn + ' with a session not in yet' : 'Everyone needed is in'], ['Sessions today', B.sessionsToday.length, B.sessionsToday.filter(b => todayMarks(b)).length + ' marked'], ['Trials booked', B.adm.filter(a => a.s === 'trial').length, 'On the admissions board'], ['Low attendance', B.players.filter(p => p.att != null && p.attN >= 3 && p.att < 65).length, 'players below 65%']].map(([l, v, d]) => `<div class="card kpi"><span class="label">${l}</span><span class="v">${v}</span><span class="d">${d}</span></div>`).join('')}</div>
  <div class="grid g-main"><div class="stack">${sessionsCard('manager')}${feedCard()}</div><div class="stack">${staffTodayCard('#manager-staffatt')}${lowCard()}${birthdaysCard()}</div></div>`;
}

/* ---------- coach ---------- */
function coachHome() {
  const me = myStaff() || { today: null }; const a = me.today;
  const mineToday = B.sessionsToday.filter(id => B.myBatches.includes(id));
  const out = B.injuries.filter(i => i.status !== 'fit' && B.myBatches.includes((player(i.pid) || {}).batch));
  const nxt = [];
  B.tournaments.filter(t => B.myBatches.includes(t.batch)).forEach(t => t.matches.forEach(m => { if (!m.score && m.date >= B.today) nxt.push({ t, m }); }));
  nxt.sort((x, y) => (x.m.date + x.m.time).localeCompare(y.m.date + y.m.time));
  return `<div class="hero-card glow"><div class="between"><div><span class="label">${T.long(B.today)}</span><h2 class="disp" style="font-size:40px;margin-top:8px">Hi <em>${esc(first(B.me.name))}</em></h2></div>${av(B.me.name, 'lg')}</div>
  <div class="checkin"><button class="big ${a && a.t ? 'done' : ''}" type="button" data-act="checkin" ${a && a.t ? 'disabled' : ''}>${a && a.t ? `In at<br>${a.t}` : 'Check in'}</button><span class="faint" style="font-size:13px">${a && a.t ? `The manager can see you are in${a.s === 'L' ? ' (late)' : ''}.` : mineToday.length ? `Tap when you reach ${esc(ground(batch(mineToday[0]).ground).name)}. The time is saved for the manager.` : 'No sessions for you today.'}</span></div></div>
  ${sessionsCard('coach')}
  ${out.length ? `<div class="card"><div class="card-h"><h3>Injured players</h3><span class="pill p-bad plain">${out.length}</span></div><div class="list">${out.map(i => { const p = player(i.pid); return `<div class="row"><div class="who grow">${jersey(p)}<div><b>${esc(p.name)}</b><small>${esc(i.what)}${i.back ? ' · back ' + T.short(i.back) : ''}</small></div></div>${i.status === 'out' ? '<span class="pill p-bad">Out</span>' : '<span class="pill p-warn">Light only</span>'}</div>`; }).join('')}</div></div>` : ''}
  ${nxt.length ? `<div class="card"><div class="card-h"><h3>Next match</h3>${ic('trophy')}</div><div class="list"><div class="session" style="grid-template-columns:76px minmax(0,1fr) auto"><time>${T.dayShort(nxt[0].m.date).replace(' ', '<br>')}</time><div style="min-width:0"><b>vs ${esc(nxt[0].m.vs)}</b><small>${esc(nxt[0].t.name)} · ${esc(nxt[0].m.venue)}</small></div><a class="btn btn-quiet btn-sm" href="#coach-matches" data-act="tourn" data-v="${nxt[0].t.id}">Open</a></div></div></div>` : ''}
  <div class="card"><div class="card-h"><h3>Latest notice</h3><a class="btn btn-quiet btn-sm" href="#coach-notices">All</a></div><div class="list">${B.notices.slice(0, 1).map(n => `<div class="notice"><b>${esc(n.title)}</b><p>${esc(n.body)}</p></div>`).join('') || '<div class="empty">No notices.</div>'}</div></div>`;
}
function coachMark() {
  const mine = B.myBatches;
  if (!mine.includes(U.attBatch)) U.attBatch = mine.find(id => B.sessionsToday.includes(id) && !todayMarks(id)) || mine.find(id => B.sessionsToday.includes(id)) || mine[0];
  return `<div class="between"><div><h2 style="font-size:24px">Take attendance</h2><p class="muted" style="margin-top:4px">Tap All present, then change the few who missed.</p></div></div>${mine.length ? batchPicker(U.attBatch, mine) + markCard(U.attBatch, 'coach', 'today') : `<div class="card"><div class="card-b">${empty('batch', 'You have no batches yet. The academy admin gives you batches.')}</div></div>`}`;
}
function calendarHTML(m, cal, days, offs) {
  const [y, mo] = m.split('-').map(Number); const firstDow = new Date(Date.UTC(y, mo - 1, 1)).getUTCDay(); const off = (firstDow + 6) % 7; const cells = [];
  for (let i = 0; i < off; i++) cells.push('<span></span>');
  for (let d = 1; d <= T.days(m); d++) { const iso = `${m}-${String(d).padStart(2, '0')}`; const v = cal[iso]; const train = days.includes(T.dow(iso)) && !(offs || []).includes(iso);
    cells.push(`<span class="d ${v || (train ? (iso < B.today ? 'x' : '') : 'off')} ${iso === B.today ? 'today' : ''}" title="${T.dayShort(iso)}${v ? ': ' + { P: 'Present', L: 'Late', A: 'Absent' }[v] : train ? (iso < B.today ? ': not marked' : ': session') : ''}">${d}</span>`); }
  return `<div class="cal">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(x => `<span class="dow">${x}</span>`).join('')}${cells.join('')}</div>
  <div class="legend"><span><i class="dot" style="background:var(--brand)"></i>Present</span><span><i class="dot" style="background:var(--warn)"></i>Late</span><span><i class="dot" style="background:var(--bad)"></i>Absent</span><span><i class="dot" style="background:var(--surface-2)"></i>No session</span></div>`;
}
function coachMyAtt() {
  const st = B.myMonth || { worked: 0, expected: 0, cal: {}, list: [] };
  const me = myStaff(); const days = me && me.role === 'manager' ? [1, 2, 3, 4, 5, 6] : [...new Set(B.batches.filter(b => b.coach === B.me.sid).flatMap(b => b.days))];
  return `<div class="between"><div><h2 style="font-size:24px">My attendance</h2><p class="muted" style="margin-top:4px">${T.monthName(B.month)} · ${st.worked} of ${st.expected} days</p></div>${attPill(st.expected ? Math.round(st.worked / st.expected * 100) : null)}</div>
  <div class="card"><div class="card-b" style="display:grid;gap:16px">${calendarHTML(B.month, st.cal, days)}</div></div>
  <div class="card"><div class="card-h"><h3>Recent check-ins</h3></div><div class="list">${st.list.length ? st.list.slice(0, 10).map(([d, r]) => `<div class="row"><div class="grow"><b>${T.dayShort(d)}</b></div><span class="pill ${r.s === 'L' ? 'p-warn' : r.s === 'A' ? 'p-bad' : 'p-ok'} tnum">${r.s === 'A' ? 'Absent' : (r.s === 'L' ? 'Late · ' : '') + (r.t || '')}</span></div>`).join('') : '<div class="empty">No check-ins yet this month.</div>'}</div></div>`;
}
function coachProgress() {
  const mine = B.players.filter(p => B.me.role !== 'coach' || B.myBatches.includes(p.batch));
  if (!mine.length) return `<div class="card"><div class="card-b">${empty('star', 'No players in your batches yet.')}</div></div>`;
  if (!mine.some(p => p.id === U.progP)) U.progP = mine[0].id;
  const p = player(U.progP); const saved = B.progress[p.id];
  const sc = U.prog[p.id] || (U.prog[p.id] = { scores: saved ? [...saved.scores] : [3, 3, 3, 3, 3, 3], note: saved ? saved.note : '' });
  return `<div><h2 style="font-size:24px">Player progress</h2><p class="muted" style="margin-top:4px">Parents see these ratings and your note in their app.</p></div>
  <label class="field" for="progP"><span>Player</span><select class="select" id="progP">${mine.map(x => `<option value="${x.id}" ${x.id === p.id ? 'selected' : ''}>${esc(x.name)} · ${esc(batch(x.batch).name)}${B.progress[x.id] && B.progress[x.id].m === B.month ? ' ✓' : ''}</option>`).join('')}</select></label>
  <div class="card"><div class="card-h"><div class="who">${jersey(p)}<div><b>${esc(p.name)}</b><small>${esc(batch(p.batch).name)} · ${p.att == null ? 'new' : p.att + '% attendance'}</small></div></div><span class="faint mono" style="font-size:12px">${saved ? 'SHARED ' + T.short(T.date(saved.at)).toUpperCase() : 'NOT SHARED YET'}</span></div>
  <div class="card-b" style="display:grid;gap:16px">${B.skills.map((s, i) => `<div class="skill"><span>${s}</span><span class="pips edit" role="group" aria-label="${s}">${[1, 2, 3, 4, 5].map(n => `<i class="${n <= sc.scores[i] ? 'on' : ''}" data-act="pip" data-k="${i}" data-n="${n}" role="button" tabindex="0" aria-label="${s} ${n} of 5"></i>`).join('')}</span><b class="tnum">${sc.scores[i]}/5</b></div>`).join('')}
  <label class="field" for="progNote"><span>Note for parents</span><textarea class="textarea" id="progNote" placeholder="What went well, what to work on next">${esc(sc.note)}</textarea></label></div>
  <div class="card-f"><button class="btn btn-primary" type="button" data-act="saveProg">${ic('ok')}Save and share</button></div></div>`;
}

/* ---------- parent ---------- */
function kids() { return B.players.filter(p => B.kids.includes(p.id)); }
function childTabs() {
  const k = kids(); if (!k.some(p => p.id === U.child)) U.child = (k[0] || {}).id;
  return k.length > 1 ? `<div class="child-tabs" role="group" aria-label="Child">${k.map(x => `<button type="button" data-act="child" data-p="${x.id}" aria-pressed="${U.child === x.id}">${jersey(x)}${esc(first(x.name))}</button>`).join('')}</div>` : '';
}
function noKids() { return `<div class="card"><div class="card-b">${empty('parent', 'Your academy has not linked a child to this email yet. Ask them to add your email to your child.')}</div></div>`; }
function nextSession(p) { const b = batch(p.batch); for (const [d, ids] of B.week) { if (!ids.includes(b.id)) continue; if (d === B.today && (todayMarks(b.id))) continue; return d; } return null; }
function openBills(p) { return (p.bills || []).filter(b => b.st === 'due' || b.st === 'overdue' || b.st === 'verify'); }
function feeCard(p, big) {
  const ob = openBills(p); const pay = ob.filter(b => b.st !== 'verify'); const ver = ob.filter(b => b.st === 'verify');
  if (!ob.length) { const last = (B.payments || []).find(x => x.pid === p.id); return `<div class="card"><div class="card-b" style="display:grid;gap:10px"><div class="between"><span class="label">Fees</span><span class="pill p-ok">All paid</span></div><span class="disp tnum" style="font-size:${big ? 48 : 40}px">${inr(0)}</span><p class="faint" style="font-size:13px">${last ? `Last paid ${T.short(T.date(last.at))} · ${T.monthOnly(last.m)} fee` : 'Nothing due right now.'}</p></div></div>`; }
  const b = pay[0] || ver[0]; const total = pay.reduce((t, x) => t + x.amt, 0);
  return `<div class="card ${pay.length ? 'glow' : ''}"><div class="card-b" style="display:grid;gap:10px"><div class="between"><span class="label">${pay.length > 1 ? pay.length + ' months due' : T.monthOnly(b.m) + ' fee'}</span>${b.st === 'verify' ? '<span class="pill p-info">Being checked</span>' : b.st === 'overdue' ? '<span class="pill p-bad">Overdue</span>' : `<span class="pill p-warn">Due ${T.short(b.due)}</span>`}</div><span class="disp tnum" style="font-size:${big ? 48 : 40}px">${inr(pay.length ? total : b.amt)}</span>${b.late ? `<span class="faint" style="font-size:13px">Includes ${inr(b.late)} late fee</span>` : ''}${pay.length ? `<button class="btn btn-primary ${big ? 'btn-lg' : ''} btn-block" type="button" data-act="pay" data-p="${p.id}" data-m="${pay[0].m}">${ic('upi')}Pay ${T.monthOnly(pay[0].m)} by UPI</button>` : '<p class="faint" style="font-size:13px">The academy is matching your transaction ID. You will get the receipt here.</p>'}</div></div>`;
}
function parentHome() {
  const k = kids(); if (!k.length) return noKids();
  const tabs = childTabs(); const p = player(U.child), b = batch(p.batch);
  const nx = nextSession(p); const tm = todayMarks(b.id); const mk = tm && tm.marks[p.id];
  const inj = B.injuries.find(i => i.pid === p.id && i.status !== 'fit');
  const ups = []; B.tournaments.forEach(t => t.matches.forEach(m => { if (!m.score && m.date >= B.today && (t.squad.includes(p.id) || t.batch === p.batch)) ups.push({ t, m }); })); ups.sort((x, y) => (x.m.date + x.m.time).localeCompare(y.m.date + y.m.time));
  return `${tabs}
  <div class="hero-card glow"><div class="who">${jersey(p, 'lg')}<div><span class="label">${esc(b.name)}</span><h2 class="disp" style="font-size:36px;margin-top:6px">${esc(p.name)}</h2><small style="font-size:13px">${/^coach\b/i.test(coachName(b)) ? "" : "Coach "}${esc(coachName(b))} · ${esc(ground(b.ground).name)}</small></div></div>
  <div class="divider"></div><div class="between"><div><span class="label">Next session</span><b style="display:block;font-size:17px;margin-top:6px">${nx ? (nx === B.today ? 'Today' : T.dayShort(nx)) + ', ' + T.t12(b.time) : 'Not scheduled'}</b></div>${mk ? `<span class="pill ${mk === 'A' ? 'p-bad' : mk === 'L' ? 'p-warn' : 'p-ok'}">${{ P: 'Present today', L: 'Late today', A: 'Absent today' }[mk]}</span>` : ''}</div></div>
  ${inj ? `<div class="banner warn">${ic('shield')}<span class="grow"><b>${esc(inj.what)}.</b> ${inj.status === 'out' ? 'Resting from training' : 'Light training only'}${inj.back ? ', back around ' + T.short(inj.back) : ''}.</span></div>` : ''}
  <div class="grid g2"><div class="card"><div class="card-b" style="display:flex;align-items:center;gap:20px"><span class="ring" style="--v:${p.att || 0}"><b>${p.att == null ? '—' : p.att + '%'}</b></span><div><span class="label">${T.monthOnly(B.month)} attendance</span><p style="margin-top:8px;font-size:14px" class="muted">${p.attN ? `${Object.values(p.cal[B.month] || {}).filter(v => v !== 'A').length} of ${p.attN} sessions` : 'No sessions marked yet'}</p><a href="#parent-attendance" style="color:var(--brand);font-weight:600;font-size:14px;display:inline-block;margin-top:6px">See calendar</a></div></div></div>
  ${feeCard(p)}</div>
  <div class="card"><div class="card-h"><h3>Coming up</h3>${ic('trophy')}</div><div class="list">${ups.length ? ups.slice(0, 3).map(({ t, m }) => `<div class="session" style="grid-template-columns:76px minmax(0,1fr)"><time>${T.dayShort(m.date).replace(' ', '<br>')}</time><div style="min-width:0"><b>vs ${esc(m.vs)}</b><small>${esc(t.name)}${m.time ? ' · ' + T.t12(m.time) : ''} · ${esc(m.venue)}${t.squad.includes(p.id) ? ' · in the squad' : ''}</small></div></div>`).join('') : '<div class="empty">No matches coming up.</div>'}</div></div>
  <div class="card"><div class="card-h"><h3>Latest notice</h3><a class="btn btn-quiet btn-sm" href="#parent-notices">All</a></div><div class="list">${B.notices.slice(0, 1).map(n => `<div class="notice"><b>${esc(n.title)}</b><p>${esc(n.body)}</p></div>`).join('') || '<div class="empty">No notices.</div>'}</div></div>`;
}
function parentAtt() {
  if (!kids().length) return noKids();
  const tabs = childTabs(); const p = player(U.child), b = batch(p.batch);
  const months = Object.keys(p.cal || {}).sort().reverse(); if (!months.includes(U.calM)) U.calM = B.month;
  const cal = (p.cal || {})[U.calM] || {}; const v = Object.values(cal); const pc = v.length ? Math.round(v.filter(x => x !== 'A').length / v.length * 100) : null;
  return `${tabs}<div class="between"><div><h2 style="font-size:24px">Attendance</h2><p class="muted" style="margin-top:4px">${esc(b.name)} · ${C.daysText(b.days)} · ${T.t12(b.time)}</p></div>${attPill(pc)}</div>
  <div class="card"><div class="card-h"><h3>${T.monthName(U.calM)}</h3><div class="seg" role="group" aria-label="Month">${months.slice().reverse().map(m => `<button type="button" data-act="calM" data-v="${m}" aria-pressed="${m === U.calM}">${T.monthShort(m)}</button>`).join('')}</div></div><div class="card-b" style="display:grid;gap:16px">${calendarHTML(U.calM, cal, b.days, b.off)}
  <div class="hstack" style="gap:16px;font-size:14px"><span>Present <b>${v.filter(x => x === 'P').length}</b></span><span>Late <b>${v.filter(x => x === 'L').length}</b></span><span>Absent <b>${v.filter(x => x === 'A').length}</b></span></div></div></div>
  <div class="note">${ic('bell')}<span>You get a notification in this app as soon as the coach marks ${esc(first(p.name))} absent or late.</span></div>`;
}
function parentFees() {
  if (!kids().length) return noKids();
  const tabs = childTabs(); const p = player(U.child);
  const ob = openBills(p); const paid = (B.payments || []).filter(x => x.pid === p.id);
  return `${tabs}<div><h2 style="font-size:24px">Fees</h2><p class="muted" style="margin-top:4px">${inr(p.fee)} a month · due on the ${ord(B.academy.dueDay)} · late fee ${inr(B.academy.lateFee)} after the ${ord(B.academy.lateAfter)}</p></div>
  ${feeCard(p, true)}
  <div class="note">${ic('rupee')}<span>Paid in cash to the coach or the office? That counts too. The academy marks it paid and you get a receipt here.</span></div>
  ${ob.length > 1 ? `<div class="card"><div class="card-h"><h3>Open bills</h3></div><div class="list">${ob.map(b => `<div class="row"><div class="grow"><b>${T.monthName(b.m)}</b><small class="faint" style="display:block;font-size:12.5px">${b.st === 'verify' ? (b.utr ? 'Being checked · ID ' + esc(b.utr) : 'Being checked · screenshot sent') : b.st === 'overdue' ? 'Overdue' : 'Due ' + T.short(b.due)}</small></div><b class="tnum">${inr(b.amt)}</b>${b.st === 'verify' ? feePill('verify') : `<button class="btn btn-primary btn-sm" type="button" data-act="pay" data-p="${p.id}" data-m="${b.m}">Pay</button>`}</div>`).join('')}</div></div>` : ''}
  <div class="card"><div class="card-h"><h3>Past payments</h3></div><div class="list">${paid.length ? paid.map(x => `<div class="row"><div class="grow"><b>${T.monthName(x.m)}</b><small class="faint" style="display:block;font-size:12.5px">Paid ${T.short(T.date(x.at))} · ${esc(x.via)} · ${x.receipt}</small></div><span class="tnum" style="font-weight:600">${inr(x.amt)}</span><button class="btn btn-quiet btn-sm" type="button" data-act="receipt" data-p="${p.id}" data-m="${x.m}" aria-label="Receipt ${x.receipt}">${ic('receipt')}</button></div>`).join('') : '<div class="empty">No payments yet.</div>'}</div></div>`;
}
function parentProgress() {
  if (!kids().length) return noKids();
  const tabs = childTabs(); const p = player(U.child), pr = B.progress[p.id];
  const st = statsFor(p.id);
  const badges = []; if (p.att === 100 && p.attN >= 4) badges.push('🏅 Full attendance this month'); if (st.g) badges.push(`⚽ ${st.g} goal${st.g === 1 ? '' : 's'}`); if (st.potm) badges.push(`⭐ Player of the match ×${st.potm}`); if (pr && pr.scores[5] >= 5) badges.push('🤝 Team player');
  return `${tabs}<div><h2 style="font-size:24px">Progress card</h2><p class="muted" style="margin-top:4px">${pr ? `${T.monthName(pr.m || T.date(pr.at).slice(0, 7))} · by ${esc(pr.by)}` : 'The coach has not shared a card yet'}</p></div>
  ${pr ? `<div class="card glow"><div class="card-b" style="display:grid;gap:16px">${B.skills.map((s, i) => `<div class="skill"><span>${s}</span><span class="pips">${[1, 2, 3, 4, 5].map(n => `<i class="${n <= pr.scores[i] ? 'on' : ''}"></i>`).join('')}</span><b class="tnum">${pr.scores[i]}/5</b></div>`).join('')}
  ${pr.note ? `<div class="divider"></div><div class="who" style="align-items:flex-start">${av(pr.by, 'sm')}<div><b>Coach's note</b><p class="muted" style="font-size:14px;margin-top:4px;white-space:normal">${esc(pr.note)}</p></div></div>` : ''}</div></div>` : `<div class="card"><div class="card-b">${empty('star', 'You get a notification when the coach shares the first progress card.')}</div></div>`}
  ${badges.length ? `<div class="card"><div class="card-h"><h3>Badges</h3></div><div class="card-b hstack" style="gap:10px">${badges.map(b => `<span class="pill p-brand plain" style="height:30px;font-size:13px">${b}</span>`).join('')}</div></div>` : ''}
  ${parentHealth(p)}`;
}
function parentHealth(p) {
  const m = p.med || {};
  return `<div class="card"><div class="card-h"><h3>Health & forms</h3><button class="btn btn-quiet btn-sm" type="button" data-act="editMed" data-p="${p.id}">Edit</button></div><div class="card-b" style="display:grid;gap:14px"><dl class="kv"><dt>Blood group</dt><dd>${esc(m.blood || 'Not added')}</dd><dt>Allergies</dt><dd>${esc(m.allergy || 'None')}</dd><dt>Note for coach</dt><dd>${esc(m.note || 'None')}</dd><dt>Emergency contact</dt><dd>${esc([m.ename, m.ephone].filter(Boolean).join(' · ') || 'Not added')}</dd></dl>
  <div class="divider"></div><span class="label">Forms</span><div class="list" style="margin:0 -20px">${B.docs.map(([k, l]) => { const d = (p.docs || {})[k]; return `<div class="row"><div class="grow"><b style="font-size:14px">${l}</b><small class="faint" style="display:block;font-size:12.5px">${d ? 'Added ' + T.short(T.date(d.at)) + (d.name ? ' · ' + esc(d.name) : '') : 'Not added yet'}</small></div>${d ? `<span class="pill p-ok">Added</span>${d.file ? `<a class="btn btn-quiet btn-sm" href="/api/file/${d.file}" target="_blank" rel="noopener">View</a>` : ''}` : `<label class="btn btn-ghost btn-sm" style="cursor:pointer">${ic('down')}Upload<input type="file" accept="image/*,application/pdf" data-up="${k}" data-p="${p.id}" style="position:absolute;width:1px;height:1px;opacity:0"></label>`}</div>`; }).join('')}</div></div></div>`;
}
