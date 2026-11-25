
/* ---------- taps ---------- */
function openModal(m) { U.modal = m; U.menu = false; rerender(); setTimeout(() => { const f = document.querySelector('.modal input:not([type=checkbox]):not([type=file]), .modal select, .modal textarea'); if (f && !('ontouchstart' in window)) f.focus(); }, 30); }
function closeModal() { U.modal = null; if (U.stale) { U.stale = false; refresh(true).then(rerender); } else rerender(); }
function armed(a, label) { if (a.dataset.armed) return true; a.dataset.armed = '1'; const old = a.innerHTML; a.innerHTML = label || 'Tap again to confirm'; setTimeout(() => { if (a.isConnected) { a.innerHTML = old; delete a.dataset.armed; } }, 3500); return false; }
const showCreds = r => { if (r && r.data && r.data.login && r.data.login.temp) openModal({ t: 'creds', login: r.data.login, name: r.data.name }); };
function copy(text, msg) { try { navigator.clipboard.writeText(text).then(() => toast(msg || 'Copied'), () => toast(text)); } catch (_) { toast(text); } }
let installEvt = null; window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });

document.addEventListener('click', async e => {
  const a = e.target.closest('[data-act]');
  if (!a) { if (U.menu && !e.target.closest('.menu')) { U.menu = false; rerender(); } return; }
  const d = a.dataset, act_ = d.act, M = U.modal || {};
  if (act_ === 'scrim' && e.target !== a) return;
  const role = B && B.me.role;
  const H = {
    menu: () => { U.menu = !U.menu; rerender(); },
    close: closeModal, scrim: closeModal,
    more: () => { e.preventDefault(); openModal({ t: 'more' }); },
    bell: () => { U.seenBefore = B.feedSeenAt; openModal({ t: 'bell' }); act('feed.seen', {}, { quiet: true, keep: true }); },
    goto: () => { U.modal = null; go(d.h); },
    account: () => openModal({ t: 'account' }),
    logout: async () => { await API.logout(); B = null; U.modal = null; U.menu = false; U.draft = {}; toast('Logged out'); go('login'); },
    resetDemo: async () => { if (!armed(a, 'Tap again to reset')) return; await DemoAPI.reset(); U.draft = {}; U.prog = {}; await DemoAPI.loginAs(role || 'admin'); await refresh(); U.menu = false; rerender(); toast('Demo data reset'); },
    switchTo: async () => { try { await API.switchTo(d.aid, d.role); await refresh(); U.menu = false; go(d.role); } catch (er) { fail(er); } },
    install: async () => { U.menu = false; if (installEvt) { installEvt.prompt(); installEvt = null; rerender(); } else openModal({ t: 'install' }); },
    google: () => LIVE ? showAuthErr('Google sign-in is still loading. Try again in a moment, or use your email.') : API.google().catch(er => showAuthErr(er.message)),
    openMark: () => { U.attBatch = d.b; U.attDay = 'today'; U.attMode = 'players'; go(role === 'coach' ? 'coach-mark' : role + '-attendance'); },
    pickBatch: () => { U.attBatch = d.b; rerender(); },
    pickBatchGo: () => { U.attBatch = d.b; U.attMode = 'players'; U.attDay = 'today'; },
    attDay: () => { U.attDay = d.v; rerender(); }, attMode: () => { U.attMode = d.v; rerender(); },
    mark: () => { (U.draft[d.k] = U.draft[d.k] || {})[d.p] = d.v; rerender(); },
    allP: () => { const m = U.draft[d.k] = U.draft[d.k] || {}; B.players.filter(p => p.batch === d.b).forEach(p => m[p.id] = 'P'); rerender(); },
    saveAtt: async () => { const r = await act('att.save', { bid: d.b, marks: U.draft[d.k] || {}, date: d.d }, { offline: true, link: role === 'coach' ? null : null }); if (r) delete U.draft[d.k]; rerender(); },
    smark: () => act('staff.mark', { sid: d.s, s: d.v }, { quiet: true }),
    checkin: () => act('coach.checkin', {}),
    approve: () => act('fee.approve', { id: d.id }),
    reject: () => openModal({ t: 'reject', id: d.id }),
    saveReject: () => act('fee.reject', { id: M.id, why: val('rj-w') }),
    feeFilter: () => { U.feeFilter = d.v; rerender(); },
    markPaid: () => openModal({ t: 'cash', p: d.p, m: d.m }),
    cash: () => openModal({ t: 'cash' }),
    saveCash: () => act('fee.record', { pid: val('c-p'), m: val('c-m'), via: val('c-how'), amt: val('c-amt') }),
    waive: () => act('fee.waive', { pid: d.p, m: d.m }),
    receipt: () => openModal({ t: 'receipt', p: d.p, m: d.m }),
    print: () => window.print(),
    sendNow: async () => { const r = await act('fee.remind', {}); if (r && r.data && r.data.wa && r.data.wa.length) openModal({ t: 'wa', list: r.data.wa }); },
    remindOne: async () => { const r = await act('fee.remind', { pid: d.p }); if (r && r.data && r.data.wa && r.data.wa.length) openModal({ t: 'wa', list: r.data.wa }); },
    saveTpl: () => act('reminders.save', { tpl: val('tpl') }),
    parentReset: async () => showCreds(await act('parent.reset', { id: d.p })),
    addPlayer: () => openModal({ t: 'addPlayer', b: d.b }),
    editPlayer: () => openModal({ t: 'addPlayer', p: d.p }),
    viewPlayer: () => openModal({ t: 'player', p: d.p }),
    savePlayer: async () => { const f = { name: val('ap-n'), dob: val('ap-dob'), batch: val('ap-b'), no: val('ap-no'), parentName: val('ap-p'), parentPhone: val('ap-ph'), parentEmail: val('ap-e'), fee: role === 'admin' ? val('ap-fee') : null, joined: val('ap-j') };
      if (M.p) f.id = M.p; if (M.pre && M.pre.admId) f.admId = M.pre.admId;
      const r = await act(M.p ? 'player.update' : 'player.add', f); showCreds(r); },
    leave: () => { if (armed(a, 'Tap again: move to past players')) act('player.leave', { id: d.p }); },
    importPlayers: () => openModal({ t: 'import' }),
    importReset: () => { U.modal = { t: 'import' }; rerender(); },
    importTpl: () => download('veyra-academy-players.csv', '\ufeff' + csv([IMPORT_COLS.map(c => c[0]), ['Aarav Patil', (B.batches[0] || { name: 'U-10' }).name, '7', '14/03/2016', 'Sneha Patil', 'sneha@example.com', '9876543210', '', '']])),
    importGo: async () => { const M = U.modal; const r = await act('player.import', { rows: M.rows }, { quiet: true }); if (r && r.data) { U.modal = { t: 'import', done: r.data }; rerender(); } },
    exportPlayers: () => download('players.csv', csv([['Name', 'Jersey', 'Batch', 'Date of birth', 'Parent', 'Parent email', 'Parent phone', 'Attendance %', 'Monthly fee', 'Owes', 'Joined'], ...B.players.map(p => [p.name, p.no, batch(p.batch).name, p.dob, p.parentName, p.parentEmail, p.parentPhone, p.att == null ? '' : p.att, p.fee, p.owes || 0, p.joined])])),
    exportFees: () => download('fees.csv', csv([['Receipt', 'Paid on', 'Player', 'For month', 'Amount', 'Paid by', 'UPI ID'], ...(B.payments || []).map(x => [x.receipt, T.date(x.at), (player(x.pid) || { name: 'Past player' }).name, x.m, x.amt, x.via, x.utr])])),
    exportAtt: () => { const rows = [['Date', 'Batch', 'Player', 'Mark', 'Marked by']]; Object.keys(B.attHistory || {}).sort().forEach(dt => Object.entries(B.attHistory[dt]).forEach(([bid, r]) => Object.entries(r.marks).forEach(([pid, v]) => rows.push([dt, batch(bid).name, (player(pid) || { name: 'Past player' }).name, { P: 'Present', L: 'Late', A: 'Absent' }[v], r.by])))); download('attendance.csv', csv(rows)); },
    exportAll: async () => { if (LIVE) { location.href = '/api/export'; return; } download('veyra-academy-data.json', JSON.stringify(B, null, 2), 'application/json'); },
    addStaff: () => openModal({ t: 'staff' }),
    editStaff: () => openModal({ t: 'staff', s: d.s }),
    saveStaff: async () => { const f = { name: val('st-n'), title: val('st-t'), phone: val('st-ph'), payType: val('st-pt'), payAmt: val('st-pa') }; if (d.s) { f.id = d.s; act('staff.update', f); } else { f.email = val('st-e'); f.role = val('st-r'); showCreds(await act('staff.add', f)); } },
    removeStaff: () => { if (armed(a, 'Tap again: remove')) act('staff.remove', { id: d.s }); },
    staffReset: async () => showCreds(await act('staff.reset', { id: d.s })),
    addBatch: () => { if (role !== 'admin') return; openModal({ t: 'batch' }); },
    editBatch: () => openModal({ t: 'batch', b: d.b }),
    saveBatch: () => act('batch.save', { id: M.b, name: val('b-n'), age: val('b-a'), days: $$('[data-day]').filter(x => x.checked).map(x => +x.dataset.day), time: val('b-t'), mins: val('b-m'), fee: val('b-f'), ground: val('b-g'), coach: val('b-c'), tint: val('b-tint') }),
    delBatch: () => { if (armed(a, 'Tap again: remove')) act('batch.delete', { id: d.b }); },
    cancelSession: () => openModal({ t: 'cancel', b: d.b }),
    saveCancel: () => act('batch.off', { id: M.b, date: val('cx-d'), why: val('cx-w') }),
    undoOff: () => act('batch.off', { id: d.b, date: d.d }),
    addEnq: () => openModal({ t: 'enq' }),
    saveEnq: () => { const f = { n: val('q-n'), age: val('q-a'), parent: val('q-p'), phone: val('q-ph'), src: val('q-s'), fee: val('q-f'), note: val('q-no'), trial: val('q-t') }; if (M.id) act('adm.update', { id: M.id, ...f }); else act('adm.add', f); },
    delEnq: () => { if (armed(a, 'Tap again: remove')) act('adm.delete', { id: d.id }); },
    nextStage: e2 => { const x = B.adm.find(y => y.id === d.id); const k = STAGES.findIndex(s => s.id === x.s); moveTo(d.id, STAGES[k + 1].id); },
    enrol: () => { const x = B.adm.find(y => y.id === d.id); const bb = B.batches.find(b => b.name === x.age) || B.batches.find(b => x.age && b.name.toLowerCase().includes(x.age.toLowerCase())); openModal({ t: 'addPlayer', pre: { n: x.n, parent: x.parent, phone: x.phone, batch: bb && bb.id, admId: x.id } }); },
    delNotice: () => { if (armed(a, 'Tap again')) act('notice.delete', { id: d.id }); },
    newTourn: () => openModal({ t: 'tourn' }),
    editTourn: () => openModal({ t: 'tourn', id: d.v }),
    saveTourn: () => act('tourn.save', { id: M.id, name: val('t-n'), cat: val('t-c'), batch: val('t-b'), start: val('t-s'), end: val('t-e'), venue: val('t-v'), format: val('t-f'), entry: val('t-x') }),
    delTourn: () => { if (armed(a, 'Tap again: remove')) act('tourn.delete', { id: d.v }); },
    tourn: () => { U.tourn = d.v; if (a.tagName !== 'A') rerender(); },
    addMatch: () => openModal({ t: 'match' }),
    saveMatch: () => act('match.save', { tid: U.tourn, vs: val('mt-vs'), date: val('mt-d'), time: val('mt-t'), venue: val('mt-v') }),
    squad: () => { const t = B.tournaments.find(x => x.id === U.tourn); U.sq = [...t.squad]; openModal({ t: 'squad' }); },
    sq: () => { const i = U.sq.indexOf(d.p); if (i > -1) U.sq.splice(i, 1); else U.sq.push(d.p); rerender(); },
    saveSquad: () => act('tourn.squad', { id: U.tourn, squad: U.sq }),
    result: () => openModal({ t: 'result', m: d.m }),
    scAdd: () => { readSc(); U.modal.sc.push(['', 1]); rerender(); },
    scDel: () => { readSc(); U.modal.sc.splice(+d.i, 1); if (!U.modal.sc.length) U.modal.sc.push(['', 1]); rerender(); },
    saveResult: () => { readSc(); const t = B.tournaments.find(x => x.matches.some(y => y.id === M.m)); if (val('r-us') === '' || val('r-them') === '') return toast('Add both scores'); act('match.result', { tid: t.id, mid: M.m, us: val('r-us'), them: val('r-them'), scorers: U.modal.sc.filter(s => s[0]), potm: val('r-potm') }); },
    cert: () => openModal({ t: 'cert', p: d.p, m: d.m }),
    tournResult: () => openModal({ t: 'tournResult', id: d.v }),
    saveTournResult: () => act('tourn.result', { id: M.id, result: val('tr-r') }),
    pickPlan: () => { U.planB = d.b; U.planEdit = null; rerender(); },
    planEdit: () => { const s = B.plans[U.planB] || { focus: '', note: '', drills: [] }; U.planEdit = { b: U.planB, focus: s.focus, note: s.note, drills: [...s.drills] }; rerender(); },
    planCancel: () => { U.planEdit = null; rerender(); },
    planSave: async () => { readPlan(); const r = await act('plan.save', { bid: U.planB, focus: U.planEdit.focus, note: U.planEdit.note, drills: U.planEdit.drills }); if (r) { U.planEdit = null; rerender(); } },
    addDrill: () => { if (!U.planEdit || U.planEdit.b !== U.planB) H.planEdit(); readPlan(); U.planEdit.drills.push(d.id); rerender(); },
    drillDel: () => { readPlan(); U.planEdit.drills.splice(+d.i, 1); rerender(); },
    drillUp: () => { readPlan(); const x = U.planEdit.drills, i = +d.i; [x[i - 1], x[i]] = [x[i], x[i - 1]]; rerender(); },
    newDrill: () => { readPlan(); openModal({ t: 'drill' }); },
    saveDrill: () => act('drill.add', { name: val('dr-n'), cat: val('dr-c'), mins: val('dr-m') }),
    logInjury: () => openModal({ t: 'injury', p: d.p }),
    saveInjury: () => act('injury.add', { pid: val('i-p'), what: val('i-w'), status: val('i-s'), back: val('i-b') }),
    editMed: () => openModal({ t: 'med', p: d.p }),
    saveMed: () => act('medical.save', { pid: M.p, blood: val('md-b'), allergy: val('md-a'), note: val('md-n'), ename: val('md-en'), ephone: val('md-ep') }),
    docToggle: () => act('doc.set', { pid: d.p, key: d.k, clear: !!d.on }, { quiet: true }),
    askDocs: () => act('docs.ask', {}),
    addStock: () => openModal({ t: 'stock' }), editStock: () => openModal({ t: 'stock', id: d.id }),
    saveStock: () => act('kit.save', { id: M.id, name: val('k-n'), have: val('k-h'), min: val('k-m') }),
    delStock: () => { if (armed(a, 'Tap again: remove')) act('kit.delete', { id: d.id }); },
    qty: () => act('kit.qty', { id: d.id, d: +d.d }, { quiet: true }),
    giveKit: () => openModal({ t: 'kitGive', p: d.p }),
    saveKit: () => act('kit.give', { pid: M.p, size: val('kg-s') }),
    kitUndo: () => act('kit.give', { pid: d.p }),
    addExp: () => openModal({ t: 'exp' }),
    saveExp: () => act('expense.add', { what: val('e-n'), amt: val('e-a'), cat: val('e-c'), date: val('e-d') }),
    delExp: () => { if (armed(a, '×?')) act('expense.delete', { id: d.id }); },
    paySal: () => act('salary.paid', { sid: d.s }),
    ground: () => { U.ground = d.v; rerender(); },
    addGround: () => openModal({ t: 'ground' }), editGround: () => openModal({ t: 'ground', id: d.v }),
    saveGround: () => act('ground.save', { id: M.id, name: val('g-n') }),
    delGround: () => { if (armed(a, 'Tap again: remove')) act('ground.delete', { id: d.v }); },
    book: () => openModal({ t: 'book', d: d.d, time: d.t }),
    saveBook: () => act('booking.add', { gid: U.ground, date: M.d, time: M.time, what: val('bk-w') }),
    unbook: () => { if (armed(a, 'Remove?')) act('booking.delete', { id: d.id }); },
    wish: () => act('wish', { pid: d.p }),
    child: () => { U.child = d.p; rerender(); },
    calM: () => { U.calM = d.v; rerender(); },
    pay: () => openModal({ t: 'pay', p: d.p, m: d.m }),
    payNext: () => { U.modal.step2 = true; rerender(); setTimeout(() => $('#utr') && $('#utr').focus(), 30); },
    payBack: () => { U.modal.step2 = false; rerender(); },
    paySubmit: async () => { const v = val('utr').replace(/\s/g, ''); if (!v && M.shot) return act('fee.pay', { pid: M.p, m: M.m, shot: M.shot.id }); if (!/^\d{12}$/.test(v)) { const er = $('#utrErr'); er.textContent = 'The ID has 12 digits. You typed ' + v.length + '.'; er.style.color = 'var(--bad)'; return; } act('fee.pay', { pid: M.p, m: M.m, utr: v }); },
    copyUpi: () => copy(B.academy.upi, 'UPI ID copied'),
    copyText: () => copy(d.t, 'Copied'),
    pip: () => { readProg(); U.prog[U.progP].scores[+d.k] = +d.n; rerender(); },
    saveProg: async () => { readProg(); const s = U.prog[U.progP]; const r = await act('progress.save', { pid: U.progP, scores: s.scores, note: s.note }); if (r) delete U.prog[U.progP]; rerender(); },
    plan: () => { U.planSel = d.v; rerender(); },
    buyPlan: async () => { if (!LIVE) return openModal({ t: 'buy', plan: U.planSel }); a.disabled = true; try { const r = await API.buyPlan(U.planSel); await refresh(); rerender(); toast(r.msg || 'Payment received. Your plan is on.'); } catch (er) { fail(er); } a.disabled = false; },
    buyTest: async () => { const r = await DemoAPI.buyPlan(M.plan); await refresh(); U.modal = null; rerender(); toast(r.msg, CFG.hosted ? undefined : { href: 'hq.html', label: 'See it in HQ' }); },
    lic: async () => { const code = val('lic'); if (!/^VFB-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(code)) return toast('Keys look like VFB-XXXX-XXXX-XXXX'); try { const r = await API.activateKey(code); await refresh(); rerender(); toast(r.msg || 'Key activated'); } catch (er) { fail(er); } },
    saveFees: () => act('academy.save', { upi: val('s-upi'), payee: val('s-payee'), dueDay: val('s-due'), lateAfter: val('s-lateafter'), lateFee: val('s-late') }),
    saveAcademy: () => act('academy.save', { name: val('s-name'), place: val('s-place') }),
    savePw: async () => { try { const r = await API.changePw(val('ac-old'), val('ac-new')); closeModal(); toast(r.msg || 'Password changed'); } catch (er) { fail(er); } },
    savePhone: () => act('parent.phone', { phone: val('ac-ph') })
  };
  if (H[act_]) { if (a.tagName === 'BUTTON' && a.closest('form') && a.type === 'submit') return; await H[act_](); }
});
function readSc() { if (!U.modal || !U.modal.sc) return; U.modal.sc = U.modal.sc.map((s, i) => { const sel = document.querySelector(`[data-sc="${i}"]`), n = document.querySelector(`[data-scn="${i}"]`); return [sel ? sel.value : s[0], n ? Math.max(1, +n.value || 1) : s[1]]; }); }
function readPlan() { if (!U.planEdit) return; const f = $('#pl-focus'), n = $('#pl-note'); if (f) U.planEdit.focus = f.value; if (n) U.planEdit.note = n.value; }
function readProg() { const n = $('#progNote'); if (n && U.prog[U.progP]) U.prog[U.progP].note = n.value; }

document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'pq') { U.pq = t.value; const pos = t.selectionStart; rerender(); const n = $('#pq'); n.focus(); n.setSelectionRange(pos, pos); }
  if (t.id === 'aq') { U.aq = t.value; $('#board').innerHTML = boardHTML(); }
  if (t.id === 'tpl') { const p = B.players.find(x => (x.bills || []).some(b => b.st === 'due' || b.st === 'overdue')); if (p) { const b = p.bills.find(x => x.st === 'due' || x.st === 'overdue'); $('#tplPrev').textContent = C.fillTpl({ settings: { tpl: t.value }, name: B.academy.name }, p, b, p.owes); } }
  if (t.id === 'utr') { t.value = t.value.replace(/\D/g, '').slice(0, 12); }
});
document.addEventListener('change', async e => {
  const t = e.target;
  if (t.id === 'pb') { U.pb = t.value; rerender(); }
  if (t.id === 'feeMonth') { U.feeMonth = t.value; rerender(); }
  if (t.id === 'progP') { readProg(); U.progP = t.value; rerender(); }
  if (t.id === 'c-p') { $('#c-months').innerHTML = cashMonths(t.value); }
  if (t.dataset.rule) act('reminders.save', { rules: { [t.dataset.rule]: t.checked } }, { quiet: true }).then(() => toast(t.checked ? 'Reminder on' : 'Reminder off'));
  if (t.dataset.chan) act('reminders.save', { chan: { [t.dataset.chan]: t.checked } }, { quiet: true });
  if (t.id === 's-google') act('academy.save', { google: t.checked }, { quiet: true }).then(() => toast(t.checked ? 'Google sign-in on' : 'Google sign-in off'));
  if (t.dataset.inj) act('injury.status', { id: t.dataset.inj, status: t.value });
  if (t.dataset.import && t.files && t.files[0]) { const f = t.files[0];
    if (/\.xlsx?$/i.test(f.name)) { U.modal = { t: 'import', err: 'This is an Excel file. In Excel, use File › Save as › CSV, then pick that file.' }; return rerender(); }
    const r = readImport(await f.text(), f.name); U.modal = Object.assign({ t: 'import' }, r); rerender(); }
  if (t.dataset.shot && t.files && t.files[0] && U.modal) {
    const M = U.modal; try { const f = await shrinkImg(t.files[0]); const r = await API.upload(f, M.p, 'payshot'); M.shot = { id: r.id || 'demo', name: t.files[0].name }; rerender(); } catch (er) { fail(er); }
  }
  if (t.dataset.up && t.files && t.files[0]) {
    const f = t.files[0]; if (f.size > 4 * 1024 * 1024) return toast('Please pick a file under 4 MB');
    try { const r = await API.upload(f, t.dataset.p, t.dataset.up); await act('doc.set', { pid: t.dataset.p, key: t.dataset.up, file: r.id || '', name: f.name }); } catch (er) { fail(er); }
  }
});
/* player import: CSV from Excel or Google Sheets */
const IMPORT_COLS = [['Player name', 'name', /^(player\s*)?name$|^player$|^child/], ['Batch', 'batch', /^batch|^group|^team/], ['Jersey no', 'no', /jersey|^no\.?$|^number/], ['Date of birth', 'dob', /birth|dob/], ['Parent name', 'parentName', /parent.*name|father|mother|guardian/], ['Parent email', 'parentEmail', /e-?mail/], ['Parent phone', 'parentPhone', /phone|mobile|whatsapp/], ['Monthly fee', 'fee', /fee/], ['Joined on', 'joined', /join/]];
function parseCSV(text) {
  text = text.replace(/^\ufeff/, ''); const rows = []; let row = [], f = '', q = false;
  const sep = (text.split('\n')[0].match(/;/g) || []).length > (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  for (let i = 0; i < text.length; i++) { const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; }
    else if (ch === '"') q = true; else if (ch === sep) { row.push(f); f = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(f); f = ''; if (row.some(c => c.trim())) rows.push(row); row = []; } else f += ch; }
  row.push(f); if (row.some(c => c.trim())) rows.push(row); return rows;
}
function isoDate(s) { s = String(s || '').trim(); if (!s) return ''; let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/); if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/); if (m) { const y = m[3].length === 2 ? (+m[3] > 40 ? '19' : '20') + m[3] : m[3]; return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; } return ''; }
function readImport(text, name) {
  const rows = parseCSV(text); if (rows.length < 2) return { err: 'This file has no player rows. Use the template and save it as CSV.' };
  const head = rows[0].map(h => h.trim().toLowerCase()); const map = {}; IMPORT_COLS.forEach(([, k, re]) => { const i = head.findIndex((h, j) => re.test(h) && !Object.values(map).includes(j)); if (i >= 0) map[k] = i; });
  if (map.name == null) return { err: 'Could not find a "Player name" column. Use the template headings.' };
  const out = rows.slice(1).map(r => { const o = {}; Object.entries(map).forEach(([k, i]) => { o[k] = String(r[i] || '').trim(); }); o.dob = isoDate(o.dob); o.joined = isoDate(o.joined); o.fee = o.fee.replace(/[^\d]/g, ''); o.no = o.no.replace(/[^\d]/g, ''); return o; }).filter(o => o.name);
  if (!out.length) return { err: 'No player names found in the file.' };
  if (out.length > 500) return { err: 'Please import up to 500 players at a time.' };
  return { rows: out, file: name };
}
/* phone screenshots can be big: shrink to a 1600px JPEG before sending */
function shrinkImg(file) {
  return new Promise(res => { if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) return res(file); const url = URL.createObjectURL(file); const im = new Image();
    im.onload = () => { const k = Math.min(1, 1600 / Math.max(im.width, im.height)); const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      c.toBlob(b => res(b ? new File([b], (file.name || 'screenshot').replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file), 'image/jpeg', 0.82); };
    im.onerror = () => { URL.revokeObjectURL(url); res(file); }; im.src = url; });
}
document.addEventListener('submit', async e => {
  e.preventDefault(); const f = e.target;
  if (f.id === 'authForm') {
    const kind = f.dataset.kind, em = val('f-em').toLowerCase(), pw = $('#f-pw') ? $('#f-pw').value : '';
    const btn = f.querySelector('[type=submit]'); showAuthErr('');
    if (kind !== 'reset' && !/^\S+@\S+\.\S+$/.test(em)) { showAuthErr('Enter your email'); $('#f-em').focus(); return; }
    if ((kind === 'signup' || kind === 'reset') && pw.length < 8) { showAuthErr('Use at least 8 characters for the password'); return; }
    if (kind === 'signup' && (!val('f-ac') || !val('f-nm'))) { showAuthErr('Add the academy name and your name'); return; }
    btn.disabled = true;
    try {
      if (kind === 'login') { const r = await API.login(em, pw); await afterLogin(r); }
      else if (kind === 'signup') { const r = await API.signup({ academy: val('f-ac'), name: val('f-nm'), city: val('f-city'), phone: val('f-ph'), email: em, pw }); await afterLogin(Object.assign({ created: true }, r)); toast(`Academy created. Your ${CFG.plans.trial}-day trial has started.`); }
      else if (kind === 'forgot') { const r = await API.forgot(em); showAuthErr(''); toast(r.msg || 'If this email has an account, a link is on its way.'); }
      else if (kind === 'reset') { await API.resetPw(f.dataset.token, pw); toast('Password saved. Log in now.'); go('login'); }
    } catch (er) { showAuthErr(er.message); }
    btn.disabled = false;
  }
  if (f.id === 'noticeForm') { const t = val('n-title'); if (!t) { $('#n-title').focus(); return; } const r = await act('notice.post', { title: t, body: val('n-body'), to: val('n-to') }); if (r) f.reset(); }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && (U.modal || U.menu)) { U.menu = false; closeModal(); }
  const c = e.target.closest && e.target.closest('.adm'); if (c && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { const x = B.adm.find(y => y.id === c.dataset.id), k = STAGES.findIndex(s => s.id === x.s);
    if (e.key === 'ArrowRight' && k < 3) { e.preventDefault(); moveTo(x.id, STAGES[k + 1].id); } if (e.key === 'ArrowLeft' && k > 0) { e.preventDefault(); moveTo(x.id, STAGES[k - 1].id); } }
  if (c && e.key === 'Enter' && e.target === c) openModal({ t: 'enq', id: c.dataset.id });
  if (e.target.dataset && e.target.dataset.act === 'pip' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.target.click(); }
});
document.addEventListener('click', e => { const s = e.target.closest('[data-scroll]'); if (s) { e.preventDefault(); const el = document.getElementById(s.dataset.scroll); if (el) el.scrollIntoView({ behavior: 'smooth' }); } });

/* ---------- admissions drag (mouse at once, touch after a short hold so the board still scrolls) ---------- */
function moveTo(id, stage) {
  const x = B.adm.find(y => y.id === id); if (!x) return; const was = x.s; x.s = stage; x.at = Date.now();
  const b = $('#board'); if (b) { b.innerHTML = boardHTML(id); const c = b.querySelector(`.adm[data-id="${id}"]`); c && c.focus({ preventScroll: true }); }
  if (was !== stage) { toast(`${first(x.n)} moved to ${STAGES.find(s => s.id === stage).name}`); API.act('adm.move', { id, s: stage }).catch(er => { fail(er); refresh(true).then(rerender); }); }
}
let drag = null, holdT = null, moved = false;
document.addEventListener('pointerdown', e => {
  const card = e.target.closest('.adm'); if (!card || e.target.closest('.next') || e.button > 0) return;
  const start = { x: e.clientX, y: e.clientY }; moved = false;
  const begin = () => { const r = card.getBoundingClientRect(); const g = card.cloneNode(true); g.classList.add('ghost'); g.style.width = r.width + 'px';
    const st = STAGES.find(s => s.id === B.adm.find(y => y.id === card.dataset.id).s); g.insertAdjacentHTML('afterbegin', `<span class="stagetag">${st.name}</span>`); document.body.appendChild(g);
    drag = { card, g, id: card.dataset.id, dx: start.x - r.left, dy: start.y - r.top, lx: start.x, rot: 0, over: null, sx: start.x, sy: start.y }; card.classList.add('lift'); place(start.x, start.y); };
  if (e.pointerType === 'touch') { holdT = setTimeout(() => { holdT = null; begin(); }, 260);
    const cancel = ev => { if (holdT && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 8) { clearTimeout(holdT); holdT = null; moved = true; } };
    card.addEventListener('pointermove', cancel); card.addEventListener('pointerup', () => { const tap = !!holdT && !moved; clearTimeout(holdT); holdT = null; card.removeEventListener('pointermove', cancel); if (tap) openModal({ t: 'enq', id: card.dataset.id }); }, { once: true });
  } else { e.preventDefault(); begin(); }
});
function place(x, y) { const d = drag, v = x - d.lx; d.lx = x; d.rot += (Math.max(-8, Math.min(8, v * .6)) - d.rot) * .3; if (Math.hypot(x - d.sx, y - d.sy) > 6) moved = true;
  d.g.style.transform = `translate(${x - d.dx}px,${y - d.dy}px) rotate(${-4 + d.rot}deg) scale(1.03)`;
  const el = document.elementFromPoint(x, y), col = el && el.closest('.col');
  $$('.col').forEach(c => c.classList.toggle('over', c === col));
  if (col) { const st = STAGES.find(s => s.id === col.dataset.stage); d.g.style.setProperty('--c', TINT[st.t]); d.g.querySelector('.stagetag').textContent = st.name; }
  d.over = col; const b = $('#board'); if (b && b.scrollWidth > b.clientWidth) { const r = b.getBoundingClientRect(); if (x > r.right - 36) b.scrollLeft += 10; else if (x < r.left + 36) b.scrollLeft -= 10; } }
window.addEventListener('pointermove', e => { if (drag) { e.preventDefault(); place(e.clientX, e.clientY); } }, { passive: false });
window.addEventListener('touchmove', e => { if (drag) e.preventDefault(); }, { passive: false });
const end = () => { if (!drag) return; const d = drag; drag = null; d.g.remove(); $$('.col').forEach(c => c.classList.remove('over'));
  if (!moved) { d.card.classList.remove('lift'); openModal({ t: 'enq', id: d.id }); return; }
  if (d.over) moveTo(d.id, d.over.dataset.stage); else d.card.classList.remove('lift'); if (U.stale) { U.stale = false; liveUpdate(); } };
window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end);

function reveal() {
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.remove('pre'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
  $$('.rv').forEach(el => { if (el.getBoundingClientRect().top > innerHeight) { el.classList.add('pre'); io.observe(el); } });
}

/* ---------- start ---------- */
(async function init() {
  U.outbox = outbox.get().length;
  window.addEventListener('hashchange', () => { U.menu = false; U.modal = null; U.planEdit = null; render(); window.scrollTo(0, 0); countUp(); reveal(); });
  await refresh(true);
  render(); countUp(); reveal();
  API.subscribe(liveUpdate);
  if (LIVE) { flush(); if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {}); }
  /* installed app opens the user's own app, not the website */
  if ((window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) && !location.hash) location.hash = '#app';
  /* new version on the server: reload by itself when the person is not in the middle of something */
  if (LIVE && CFG.version) { const check = () => fetch('/healthz', { cache: 'no-store' }).then(r => r.json()).then(j => { if (j.version && j.version !== CFG.version) { const busy = U.modal || (document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)); if (busy) U.newVersion = true; else location.reload(); } }).catch(() => {}); setInterval(check, 10 * 60e3); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); }); }
  setInterval(() => { if (B && !U.modal && !drag && !(document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))) { const t = B.today; refresh(true).then(() => { if (B && B.today !== t) { U.draft = {}; rerender(); } }); } }, 5 * 60 * 1000);
})();
