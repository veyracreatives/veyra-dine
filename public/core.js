/* Veyra Academy — shared business logic.
   Runs on the server (Node) and in the browser demo. Every change to an academy goes through C.act(),
   every screen is drawn from C.boot(). That is what keeps the admin, manager, coach and parent apps in step. */
(function (root) {
'use strict';
const C = {};
const DAY = 864e5, IST = 19800000;
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DOWL = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const pad = n => String(n).padStart(2, '0');

/* ---------- time (India) ---------- */
const T = C.T = {
  date: t => new Date((t == null ? Date.now() : t) + IST).toISOString().slice(0, 10),
  clock: t => { const d = new Date((t == null ? Date.now() : t) + IST); let h = d.getUTCHours(); const m = d.getUTCMinutes(), ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return `${h}:${pad(m)} ${ap}`; },
  dow: iso => new Date(iso + 'T00:00:00Z').getUTCDay(),
  add: (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10),
  addMonth: (m, n) => { let [y, mo] = m.split('-').map(Number); mo += n; while (mo > 12) { mo -= 12; y++; } while (mo < 1) { mo += 12; y--; } return `${y}-${pad(mo)}`; },
  short: iso => { const [, m, d] = iso.split('-'); return `${+d} ${MON[+m - 1]}`; },
  dayShort: iso => `${DOW[T.dow(iso)]} ${T.short(iso)}`,
  long: iso => { const [, m, d] = iso.split('-'); return `${DOWL[T.dow(iso)]}, ${+d} ${MONL[+m - 1]}`; },
  full: iso => { const [y, m, d] = iso.split('-'); return `${+d} ${MON[+m - 1]} ${y}`; },
  monthName: m => { const [y, mo] = m.split('-'); return `${MONL[+mo - 1]} ${y}`; },
  monthShort: m => MON[+m.split('-')[1] - 1],
  monthOnly: m => MONL[+m.split('-')[1] - 1],
  days: m => { const [y, mo] = m.split('-').map(Number); return new Date(Date.UTC(y, mo, 0)).getUTCDate(); },
  t12: hhmm => { if (!hhmm) return ''; let [h, m] = hhmm.split(':').map(Number); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return `${h}:${pad(m)} ${ap}`; },
  ago: (t, now) => { const s = Math.max(0, (now - t) / 1000); if (s < 60) return 'Just now'; if (s < 3600) return Math.floor(s / 60) + ' min ago'; if (T.date(t) === T.date(now)) return 'Today, ' + T.clock(t); if (T.date(t) === T.add(T.date(now), -1)) return 'Yesterday, ' + T.clock(t); return T.short(T.date(t)); }
};
C.MON = MON; C.DOW = DOW;
C.daysText = days => { const s = [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)); if (s.join() === '1,2,3,4,5') return 'Mon to Fri'; if (s.join() === '1,2,3,4,5,6') return 'Mon to Sat'; return s.map(d => DOW[d]).join(' · '); };
C.id = p => p + Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 7);

C.SKILLS = ['Passing', 'Dribbling', 'Shooting', 'First touch', 'Fitness', 'Teamwork'];
C.DOCS = [['birth', 'Birth certificate'], ['photo', 'Photo'], ['medical', 'Medical form'], ['consent', 'Parent consent']];
C.TINTS = ['blue', 'green', 'red', 'lime', 'slate'];
C.DRILLS = [
  ['Dynamic warm-up', 'Warm-up', 10], ['Rondo 4 v 1', 'Passing', 12], ['Cone dribble slalom', 'Dribbling', 10], ['1 v 1 to small goals', 'Attacking', 15],
  ['Finishing from cut-backs', 'Shooting', 15], ['Shadow defending', 'Defending', 10], ['Small-sided game 5 v 5', 'Game', 25], ['Agility ladder', 'Fitness', 8],
  ['Rondo 5 v 2 transition', 'Passing', 15], ['Passing gates in pairs', 'Passing', 10], ['Headers and volleys', 'Shooting', 10], ['Goalkeeper handling', 'Goalkeeping', 15]
];

/* ---------- new academy ---------- */
/* ---------- sports: each academy picks one; skills, drills and kit words follow it ---------- */
const D_ = (...a) => a;
C.SPORTS = {
  football: { name: 'Football', skills: ['Passing', 'Dribbling', 'Shooting', 'First touch', 'Fitness', 'Teamwork'], drills: C.DRILLS, ball: 'Footballs, size 4' },
  cricket: { name: 'Cricket', skills: ['Batting', 'Bowling', 'Fielding', 'Catching', 'Fitness', 'Teamwork'], ball: 'Cricket balls', drills: [D_('Dynamic warm-up', 'Warm-up', 10), D_('Throwdowns: front-foot drives', 'Batting', 15), D_('Net session', 'Batting', 25), D_('Spot bowling to cones', 'Bowling', 15), D_('Run-up and action work', 'Bowling', 10), D_('High catches', 'Fielding', 10), D_('Ground fielding and throw', 'Fielding', 12), D_('Running between wickets', 'Batting', 8), D_('Slip catching', 'Fielding', 10), D_('Wicket-keeping basics', 'Keeping', 12), D_('Match simulation', 'Game', 30), D_('Agility ladder', 'Fitness', 8)] },
  badminton: { name: 'Badminton', skills: ['Footwork', 'Serve', 'Smash', 'Net play', 'Fitness', 'Game sense'], ball: 'Shuttlecocks', drills: [D_('Skipping warm-up', 'Warm-up', 8), D_('Six-corner footwork', 'Footwork', 12), D_('Short and long serves', 'Serve', 10), D_('Clear and drop rally', 'Strokes', 15), D_('Smash and defend', 'Smash', 12), D_('Net kills and lifts', 'Net play', 10), D_('Multi-shuttle feeding', 'Strokes', 15), D_('Doubles rotation', 'Game', 15), D_('Singles practice game', 'Game', 20), D_('Agility ladder', 'Fitness', 8)] },
  tennis: { name: 'Tennis', skills: ['Forehand', 'Backhand', 'Serve', 'Volley', 'Footwork', 'Fitness'], ball: 'Tennis balls', drills: [D_('Mini tennis warm-up', 'Warm-up', 10), D_('Cross-court forehands', 'Forehand', 15), D_('Down-the-line backhands', 'Backhand', 15), D_('Serve targets', 'Serve', 12), D_('Volley at the net', 'Volley', 10), D_('Split-step footwork', 'Footwork', 8), D_('Approach and finish', 'Game', 15), D_('Practice sets', 'Game', 30)] },
  basketball: { name: 'Basketball', skills: ['Dribbling', 'Shooting', 'Passing', 'Defence', 'Fitness', 'Teamwork'], ball: 'Basketballs, size 6', drills: [D_('Dynamic warm-up', 'Warm-up', 10), D_('Two-ball dribbling', 'Dribbling', 10), D_('Form shooting', 'Shooting', 12), D_('Layup lines', 'Shooting', 10), D_('Chest and bounce passes', 'Passing', 8), D_('Defensive slides', 'Defence', 10), D_('3 v 3 half court', 'Game', 20), D_('Free throws', 'Shooting', 10)] },
  swimming: { name: 'Swimming', skills: ['Freestyle', 'Backstroke', 'Breaststroke', 'Butterfly', 'Starts and turns', 'Endurance'], ball: 'Kickboards', drills: [D_('Easy warm-up swim', 'Warm-up', 10), D_('Kick with board', 'Kick', 10), D_('Catch-up freestyle', 'Freestyle', 12), D_('Backstroke rotation', 'Backstroke', 10), D_('Breaststroke timing', 'Breaststroke', 12), D_('Butterfly kick', 'Butterfly', 8), D_('Dive starts', 'Starts', 10), D_('Flip turns', 'Turns', 10), D_('Interval sets', 'Endurance', 20), D_('Cool-down swim', 'Cool-down', 5)] },
  skating: { name: 'Skating', skills: ['Balance', 'Stride', 'Turns', 'Stopping', 'Speed', 'Confidence'], ball: 'Cones', drills: [D_('Stretch and balance', 'Warm-up', 8), D_('Duck walk and glide', 'Stride', 10), D_('T-stop and plough stop', 'Stopping', 10), D_('Crossovers on the circle', 'Turns', 12), D_('Cone slalom', 'Turns', 10), D_('Speed laps', 'Speed', 12), D_('Relay game', 'Game', 15)] },
  athletics: { name: 'Athletics', skills: ['Sprint start', 'Speed', 'Endurance', 'Jumps', 'Throws', 'Technique'], ball: 'Hurdles', drills: [D_('Dynamic warm-up', 'Warm-up', 10), D_('A-skips and B-skips', 'Technique', 8), D_('Block starts', 'Sprint', 12), D_('Flying 30 m', 'Speed', 10), D_('Hurdle mobility', 'Technique', 10), D_('Long jump approach', 'Jumps', 15), D_('Shot put basics', 'Throws', 12), D_('Tempo runs', 'Endurance', 20)] },
  martial: { name: 'Martial arts', skills: ['Technique', 'Forms', 'Sparring', 'Flexibility', 'Fitness', 'Discipline'], ball: 'Kick pads', drills: [D_('Warm-up and stretching', 'Warm-up', 10), D_('Basic stances and blocks', 'Technique', 12), D_('Kicks on pads', 'Technique', 12), D_('Forms practice', 'Forms', 15), D_('Controlled sparring', 'Sparring', 15), D_('Flexibility routine', 'Flexibility', 10), D_('Conditioning circuit', 'Fitness', 10)] },
  other: { name: 'Other', skills: ['Technique', 'Fitness', 'Focus', 'Teamwork', 'Discipline', 'Progress'], ball: 'Equipment', drills: [D_('Warm-up', 'Warm-up', 10), D_('Skill practice', 'Technique', 20), D_('Fitness circuit', 'Fitness', 12), D_('Game or performance', 'Game', 20), D_('Cool-down', 'Cool-down', 5)] }
};
C.sportOf = ac => C.SPORTS[(ac && ac.sport) || 'football'] || C.SPORTS.football;
C.PLAN_POINTS = { monthly: ['Admin, manager, coach and parent apps', 'Attendance for players and coaches', 'UPI fee collection and receipts', 'Player breaks, coach leave and salaries', 'Tournaments, training and kit', 'Fee reminders', 'Excel / CSV player import', 'Hindi and Marathi for parents and coaches', 'Free setup call for your batches'], yearly: ['Everything in Monthly', 'Priority help by email', 'One payment for the whole year'] };
C.cleanPoints = a => (Array.isArray(a) ? a : String(a || '').split('\n')).map(x => String(x).trim().slice(0, 90)).filter(Boolean).slice(0, 12);
C.drillsFor = sport => (C.SPORTS[sport] || C.SPORTS.football).drills.map((d, i) => ({ id: 'd' + (i + 1), name: d[0], cat: d[1], mins: d[2] }));
C.newAcademy = ({ name, place, now, trialDays, sport }) => {
  sport = C.SPORTS[sport] ? sport : 'football';
  now = now || Date.now();
  const id = C.id('a');
  return {
    id, v: 1, name: name.trim(), place: (place || '').trim(), createdAt: now, sport,
    upi: '', payee: name.trim(), dueDay: 5, lateAfter: 10, lateFee: 100,
    settings: { google: true, rules: { before: true, due: true, after: true, weekly: true }, chan: { app: true, email: true, wa: true },
      tpl: 'Hi {parent}, {player}\'s {month} fee of {amount} is due on {due}. Pay by UPI in the Veyra Academy app and paste the transaction ID. Thank you, {academy}' },
    plan: { type: 'trial', until: now + (trialDays || 10) * DAY }, suspended: false,
    admins: [], batches: [], staff: [], players: [], grounds: [{ id: 'g1', name: 'Main ground' }], bookings: [],
    att: {}, staffAtt: {}, queue: [], payments: [], receiptSeq: 0, notices: [], adm: [], tournaments: [],
    drills: C.drillsFor(sport), plans: {}, progress: {}, injuries: [],
    kit: [], kitGiven: {}, expenses: [], salaries: {}, feed: [], seen: {}, reminded: {}
  };
};

/* ---------- lookups ---------- */
const batch = (ac, id) => ac.batches.find(b => b.id === id);
const staffOf = (ac, id) => ac.staff.find(s => s.id === id);
const playerOf = (ac, id) => ac.players.find(p => p.id === id && !p.left);
const active = ac => ac.players.filter(p => !p.left);
C.isOn = (b, iso) => b && (b.days || []).includes(T.dow(iso)) && !(b.off || []).includes(iso);
C.sessionsOn = (ac, iso) => ac.batches.filter(b => C.isOn(b, iso)).sort((a, b) => a.time.localeCompare(b.time));
const feeOf = (ac, p) => p.fee != null && p.fee !== '' ? +p.fee : ((batch(ac, p.batch) || {}).fee || 0);

/* ---------- breaks (player on holiday / break: no fee, not on the attendance list) ---------- */
C.breakIn = (p, m) => (p.breaks || []).find(b => b.from <= m && (!b.to || b.to >= m)) || null;
/* ---------- fees ---------- */
C.billFor = (ac, p, m, today) => {
  const f = (p.fees || {})[m] || {};
  const base = f.amt0 != null ? f.amt0 : feeOf(ac, p);
  if (f.st === 'paid') return { m, st: 'paid', amt: f.amt, at: f.at, via: f.via, receipt: f.receipt };
  if (f.st === 'waived') return { m, st: 'waived', amt: 0 };
  const br = C.breakIn(p, m); if (br) return { m, st: 'break', amt: 0, why: br.why || '' };
  let due = `${m}-${pad(Math.min(ac.dueDay, T.days(m)))}`, late = `${m}-${pad(Math.min(ac.lateAfter, T.days(m)))}`;
  // a player who joins after the due date: their first bill is due the day they join, and the late fee only starts after the same grace period
  if (p.joined && p.joined.slice(0, 7) === m && p.joined > due) { late = T.add(p.joined, Math.max(0, late < due ? 0 : (Date.parse(late) - Date.parse(due)) / 864e5)); due = p.joined; }
  const over = today > late;
  const amt = base + (over ? +ac.lateFee || 0 : 0);
  if (f.st === 'verify') return { m, st: 'verify', amt: f.amt || amt, utr: f.utr, shot: f.shot, due };
  return { m, st: over ? 'overdue' : 'due', amt, due, late: over ? +ac.lateFee || 0 : 0 };
};
C.billMonths = (ac, p, today) => {
  const cur = today.slice(0, 7); let first = (p.joined || today).slice(0, 7); const start = ac.createdAt ? T.date(ac.createdAt).slice(0, 7) : first; if (start > first) first = start;
  const out = []; let m = first; let guard = 0;
  while (m <= cur && guard++ < 60) { out.push(m); m = T.addMonth(m, 1); }
  if (+today.slice(8) >= 25) out.push(T.addMonth(cur, 1));
  return out;
};
C.bills = (ac, p, today) => C.billMonths(ac, p, today).map(m => C.billFor(ac, p, m, today));
C.openBills = (ac, p, today) => C.bills(ac, p, today).filter(b => b.st === 'due' || b.st === 'overdue' || b.st === 'verify');

/* ---------- attendance maths ---------- */
C.playerMonth = (ac, p, m, today) => {
  let P = 0, L = 0, A = 0; const cal = {};
  Object.keys(ac.att).forEach(d => { if (d.slice(0, 7) !== m) return; const r = ac.att[d][p.batch]; const v = r && r.marks && r.marks[p.id]; if (v) { cal[d] = v; if (v === 'P') P++; else if (v === 'L') L++; else A++; } });
  const n = P + L + A;
  return { P, L, A, n, pct: n ? Math.round((P + L) / n * 100) : null, cal };
};
C.staffMonth = (ac, s, m, today) => {
  let worked = 0, late = 0, absent = 0, expected = 0, leave = 0, paidLeave = 0; const cal = {}, list = [];
  const end = m === today.slice(0, 7) ? +today.slice(8) : T.days(m);
  for (let d = 1; d <= T.days(m); d++) { const iso = `${m}-${pad(d)}`; const r = (ac.staffAtt[iso] || {})[s.id]; if (r && r.s === 'H') { leave++; if (r.paid) paidLeave++; cal[iso] = 'H'; } }
  for (let d = 1; d <= end; d++) {
    const iso = `${m}-${pad(d)}`; const r = (ac.staffAtt[iso] || {})[s.id]; if (r && r.s === 'H') continue;
    const has = s.role === 'manager' ? T.dow(iso) !== 0 : ac.batches.some(b => b.coach === s.id && C.isOn(b, iso));
    if (has && (!r || r.s !== 'off')) expected++;
    if (r && r.s !== 'off') { cal[iso] = r.s; list.push([iso, r]); if (r.s === 'P') worked++; else if (r.s === 'L') { worked++; late++; } else absent++; }
  }
  return { worked, late, absent, leave, paidLeave, expected: Math.max(expected, worked + absent), cal, list: list.reverse() };
};
C.salaryFor = (ac, s, m, today) => {
  const pay = s.pay || { type: 'month', amt: 0 };
  const st = C.staffMonth(ac, s, m, today);
  const rate = +pay.amt || 0, unpaid = st.leave - st.paidLeave;
  // per day: days worked + paid leave days. Monthly: full pay minus one day's pay for each unpaid leave day
  const cut = pay.type === 'session' ? 0 : Math.round(rate / T.days(m) * unpaid);
  const amt = pay.type === 'session' ? (st.worked + st.paidLeave) * rate : Math.max(0, rate - cut);
  const paid = ((ac.salaries[m] || {})[s.id]) || null;
  return { amt, cut, how: pay.type === 'session' ? `Per day · ₹${rate.toLocaleString('en-IN')}` : 'Monthly', paid, days: st.worked, of: st.expected, leave: st.leave, paidLeave: st.paidLeave };
};

/* ---------- feed ---------- */
function post(ac, ctx, e) {
  ac.feed.unshift({ id: C.id('f'), at: ctx.now, by: ctx.name, ico: e.ico || 'bell', title: e.title, sub: e.sub || '', href: e.href || {}, aud: e.aud || { roles: ['admin'] } });
  if (ac.feed.length > 400) ac.feed.length = 400;
}
const seesFeed = (ac, me, kids, f) => {
  const a = f.aud || {};
  if ((a.roles || []).includes(me.role)) return true;
  if (me.role === 'parent' && (a.pids || []).some(id => kids.includes(id))) return true;
  if ((me.role === 'coach' || me.role === 'manager') && (a.sids || []).includes(me.sid)) return true;
  return false;
};
const parentsOf = (ac, pids) => pids;

/* ---------- permissions ---------- */
const ALL = ['admin', 'manager', 'coach', 'parent'], STAFF = ['admin', 'manager', 'coach'], AM = ['admin', 'manager'], AD = ['admin'];
function err(msg, code) { const e = new Error(msg); e.code = code || 400; throw e; }
const need = (v, msg) => { if (v == null || v === '' || (typeof v === 'number' && isNaN(v))) err(msg); return v; };
const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max || 200);
const num = (v, min, max) => { const n = Math.round(+String(v).replace(/[^\d.-]/g, '')); if (isNaN(n)) return null; return Math.max(min == null ? 0 : min, Math.min(max == null ? 1e9 : max, n)); };
const isDate = v => /^\d{4}-\d{2}-\d{2}$/.test(v || '');
const myKids = (ac, ctx) => active(ac).filter(p => p.parentUid === ctx.uid).map(p => p.id);
const coachOwns = (ac, ctx, bid) => ctx.role !== 'coach' || ac.batches.some(b => b.id === bid && (b.coach === ctx.sid || (b.coach2 && b.coach2 === ctx.sid)));
C.planActive = (ac, now) => !ac.suspended && ac.plan && ac.plan.until > now;

/* ---------- actions ---------- */
const A = {};
const def = (name, roles, fn) => { A[name] = { roles, fn }; };

/* academy & settings */
def('academy.save', AD, (ac, ctx, p) => {
  if (p.name != null) ac.name = need(str(p.name, 80), 'Add the academy name');
  if (p.place != null) ac.place = str(p.place, 80);
  if (p.upi != null) { const u = str(p.upi, 60); if (u && !/^[\w.\-]{2,}@[\w]{2,}$/.test(u)) err('UPI IDs look like name@bank'); ac.upi = u; }
  if (p.payee != null) ac.payee = str(p.payee, 80);
  if (p.dueDay != null) ac.dueDay = num(p.dueDay, 1, 28);
  if (p.lateAfter != null) ac.lateAfter = num(p.lateAfter, 1, 28);
  if (p.lateFee != null) ac.lateFee = num(p.lateFee, 0, 100000);
  if (ac.lateAfter < ac.dueDay) ac.lateAfter = ac.dueDay;
  if (p.google != null) ac.settings.google = !!p.google;
  if (p.selfCheckin != null) ac.selfCheckin = !!p.selfCheckin;
  if (p.sport != null && C.SPORTS[p.sport] && p.sport !== (ac.sport || 'football')) {
    // new sport: swap the starter drills (keep any the academy added or used in a plan)
    const used = new Set(Object.values(ac.plans).flatMap(x => x.drills || []));
    const starter = new Set(C.sportOf(ac).drills.map(d => d[0]));
    ac.drills = ac.drills.filter(d => used.has(d.id) || !starter.has(d.name));
    C.SPORTS[p.sport].drills.forEach(d => { if (!ac.drills.some(x => x.name === d[0])) ac.drills.push({ id: C.id('d'), name: d[0], cat: d[1], mins: d[2] }); });
    ac.sport = p.sport; return { msg: `Sport set to ${C.SPORTS[p.sport].name}. Skills and drills now match.` };
  }
  return { msg: 'Saved' };
});
def('reminders.save', AD, (ac, ctx, p) => {
  if (p.rules) Object.keys(ac.settings.rules).forEach(k => { if (k in p.rules) ac.settings.rules[k] = !!p.rules[k]; });
  if (p.chan) Object.keys(ac.settings.chan).forEach(k => { if (k in p.chan) ac.settings.chan[k] = !!p.chan[k]; });
  if (p.tpl != null) ac.settings.tpl = str(p.tpl, 600) || ac.settings.tpl;
  return { msg: 'Saved' };
});

/* grounds */
def('ground.save', AD, (ac, ctx, p) => {
  const name = need(str(p.name, 80), 'Add the ground name');
  if (p.id) { const g = ac.grounds.find(x => x.id === p.id) || err('Ground not found'); g.name = name; }
  else ac.grounds.push({ id: C.id('g'), name });
  return { msg: 'Ground saved' };
});
def('ground.delete', AD, (ac, ctx, p) => {
  if (ac.batches.some(b => b.ground === p.id)) err('Move the batches on this ground first');
  ac.grounds = ac.grounds.filter(g => g.id !== p.id); ac.bookings = ac.bookings.filter(b => b.gid !== p.id);
  return { msg: 'Ground removed' };
});
def('booking.add', AM, (ac, ctx, p) => {
  const g = ac.grounds.find(x => x.id === p.gid) || err('Pick a ground');
  if (!isDate(p.date)) err('Pick a date'); if (!/^\d\d:\d\d$/.test(p.time || '')) err('Pick a time');
  const what = need(str(p.what, 80), 'Say what the booking is for');
  const clash = ac.bookings.find(b => b.gid === g.id && b.date === p.date && b.time === p.time) || ac.batches.find(b => b.ground === g.id && b.time === p.time && C.isOn(b, p.date));
  if (clash) err('That slot is taken');
  ac.bookings.push({ id: C.id('k'), gid: g.id, date: p.date, time: p.time, what, by: ctx.name });
  post(ac, ctx, { ico: 'pin', title: `${g.name} booked`, sub: `${T.dayShort(p.date)}, ${T.t12(p.time)} · ${what}`, aud: { roles: ['admin', 'manager', 'coach'] }, href: { admin: 'grounds', manager: 'grounds' } });
  return { msg: 'Slot booked' };
});
def('booking.delete', AM, (ac, ctx, p) => { ac.bookings = ac.bookings.filter(b => b.id !== p.id); return { msg: 'Booking removed' }; });

/* batches */
def('batch.save', AD, (ac, ctx, p) => {
  const name = need(str(p.name, 40), 'Add the batch name');
  const days = (p.days || []).map(Number).filter(d => d >= 0 && d <= 6); if (!days.length) err('Pick the training days');
  if (!/^\d\d:\d\d$/.test(p.time || '')) err('Pick the start time');
  const fee = num(p.fee, 0, 1000000); if (fee == null) err('Add the monthly fee');
  const g = ac.grounds.find(x => x.id === p.ground) || ac.grounds[0];
  const data = { name, age: str(p.age, 40), days: [...new Set(days)], time: p.time, mins: num(p.mins, 30, 240) || 60, ground: g ? g.id : '', coach: p.coach || '', fee, tint: C.TINTS.includes(p.tint) ? p.tint : C.TINTS[ac.batches.length % 5] };
  if (p.id) Object.assign(batch(ac, p.id) || err('Batch not found'), data);
  else ac.batches.push({ id: C.id('b'), ...data });
  return { msg: p.id ? 'Batch saved' : 'Batch added' };
});
def('batch.delete', AD, (ac, ctx, p) => {
  if (active(ac).some(x => x.batch === p.id)) err('Move the players in this batch first');
  ac.batches = ac.batches.filter(b => b.id !== p.id); delete ac.plans[p.id];
  return { msg: 'Batch removed' };
});
def('batch.off', AM, (ac, ctx, p) => {
  const b = batch(ac, p.id) || err('Batch not found'); if (!isDate(p.date)) err('Pick a date');
  b.off = b.off || []; const on = b.off.includes(p.date);
  b.off = on ? b.off.filter(d => d !== p.date) : [...b.off, p.date].slice(-60);
  if (!on) post(ac, ctx, { ico: 'calendar', title: `No ${b.name} session on ${T.dayShort(p.date)}`, sub: str(p.why, 120) || 'Session cancelled', aud: { roles: ['admin', 'manager'], pids: active(ac).filter(x => x.batch === b.id).map(x => x.id), sids: [b.coach] }, href: { parent: 'home', coach: 'home' } });
  return { msg: on ? 'Session back on' : 'Session cancelled. Parents told.' };
});

/* staff */
def('staff.add', AD, (ac, ctx, p, env) => {
  const name = need(str(p.name, 60), 'Add the name'); const email = str(p.email, 120).toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) err('Add a real email. They log in with it.');
  if (ac.staff.some(s => s.email === email)) err('This email is already on your staff');
  const role = p.role === 'manager' ? 'manager' : 'coach';
  const u = env.ensureUser({ email, name });
  const s = { id: C.id('s'), uid: u.uid, name, email, phone: str(p.phone, 20), role, title: str(p.title, 40) || (role === 'manager' ? 'Manager' : 'Coach'), pay: { type: p.payType === 'session' ? 'session' : 'month', amt: num(p.payAmt, 0) || 0 }, joined: T.date(ctx.now) };
  ac.staff.push(s); env.link(u.uid, ac.id, role, s.id);
  const login = { email, temp: u.temp };
  env.mail(email, `You are on ${ac.name} in Veyra Academy`, `Hi ${name},\n\n${ac.name} added you as ${s.title}.\nLog in: ${env.url}/#login\nEmail: ${email}\n${u.temp ? 'Password: ' + u.temp + '\n(Change it after you log in.)' : 'Use your existing Veyra Academy password or Google.'}\n`);
  return { msg: `${name} added`, data: { login, name } };
});
def('staff.update', AD, (ac, ctx, p) => {
  const s = staffOf(ac, p.id) || err('Not found');
  if (p.name != null) s.name = need(str(p.name, 60), 'Add the name');
  if (p.phone != null) s.phone = str(p.phone, 20);
  if (p.title != null) s.title = str(p.title, 40) || s.title;
  if (p.payType) s.pay = { type: p.payType === 'session' ? 'session' : 'month', amt: num(p.payAmt, 0) || 0 };
  return { msg: 'Saved' };
});
def('staff.remove', AD, (ac, ctx, p, env) => {
  const s = staffOf(ac, p.id) || err('Not found');
  ac.batches.forEach(b => { if (b.coach === s.id) b.coach = ''; });
  ac.staff = ac.staff.filter(x => x.id !== s.id); env.unlink(s.uid, ac.id, s.role);
  return { msg: `${s.name} removed. They can no longer log in to your academy.` };
});
def('staff.reset', AD, (ac, ctx, p, env) => {
  const s = staffOf(ac, p.id) || err('Not found'); const temp = env.resetPw(s.uid);
  env.mail(s.email, 'Your new Veyra Academy password', `Hi ${s.name},\n\nYour new password is ${temp}\nLog in: ${env.url}/#login\n`);
  return { msg: 'New password made', data: { login: { email: s.email, temp }, name: s.name } };
});
def('staff.mark', AM, (ac, ctx, p) => {
  const s = staffOf(ac, p.sid) || err('Not found'); const today = T.date(ctx.now);
  const d = p.d && /^\d{4}-\d\d-\d\d$/.test(p.d) ? p.d : today;
  if (d !== today && ctx.role !== 'admin') err('Only the admin can change other days');
  if (d > today) err('Pick today or an earlier day');
  if (!['P', 'L', 'A', 'off', ''].includes(p.s)) err('Bad mark');
  const day = ac.staffAtt[d] = ac.staffAtt[d] || {}; const was = day[s.id];
  if (p.s === '') { delete day[s.id]; return {}; }
  day[s.id] = { s: p.s, t: p.s === 'P' || p.s === 'L' ? (was && was.t) || (d === today ? T.clock(ctx.now) : null) : null, by: ctx.name };
  if (p.s === 'A' && d === today) post(ac, ctx, { ico: 'whistle', title: `${s.name} marked absent today`, sub: 'By ' + ctx.name, aud: { roles: ['admin', 'manager'] }, href: { admin: 'staff', manager: 'staffatt' } });
  return {};
});
def('staff.leave', AD, (ac, ctx, p) => {
  const s = staffOf(ac, p.sid) || err('Not found'); const ok = x => /^\d{4}-\d\d-\d\d$/.test(x || '');
  if (!ok(p.from)) err('Pick the first day of leave'); const to = ok(p.to) ? p.to : p.from; if (to < p.from) err('The last day is before the first day');
  const n = Math.round((Date.parse(to) - Date.parse(p.from)) / 864e5) + 1; if (n > 62) err('Leave can be at most 62 days at a time');
  for (let i = 0; i < n; i++) { const d = T.add(p.from, i); const day = ac.staffAtt[d] = ac.staffAtt[d] || {};
    if (p.clear) { if (day[s.id] && day[s.id].s === 'H') delete day[s.id]; } else day[s.id] = { s: 'H', paid: !!p.paid, why: str(p.why, 80), by: ctx.name }; }
  if (p.clear) return { msg: `Leave removed for ${s.name}` };
  post(ac, ctx, { ico: 'whistle', title: `${s.name} on leave`, sub: `${T.short(p.from)}${to !== p.from ? ' to ' + T.short(to) : ''}${p.paid ? ' · paid' : ' · unpaid'}`, aud: { roles: ['admin', 'manager'], sids: [s.id] }, href: { admin: 'staff', manager: 'staffatt' } });
  return { msg: `${s.name} on leave for ${n} day${n === 1 ? '' : 's'}${p.paid ? ' (paid)' : ' (unpaid)'}` };
});
def('coach.checkin', ['coach', 'manager'], (ac, ctx) => {
  if (!ac.selfCheckin) err('Your admin marks attendance for coaches');
  const s = staffOf(ac, ctx.sid) || err('Not found'); const d = T.date(ctx.now);
  const day = ac.staffAtt[d] = ac.staffAtt[d] || {};
  if (day[s.id] && day[s.id].t) err('You are already checked in');
  const first = C.sessionsOn(ac, d).find(b => b.coach === s.id);
  let st = 'P'; if (first) { const [h, m] = first.time.split(':').map(Number); const now = new Date(ctx.now + IST); if (now.getUTCHours() * 60 + now.getUTCMinutes() > h * 60 + m) st = 'L'; }
  day[s.id] = { s: st, t: T.clock(ctx.now), by: s.name };
  post(ac, ctx, { ico: 'whistle', title: `${s.name} checked in${st === 'L' ? ' late' : ''}`, sub: `${T.clock(ctx.now)}${first ? ' · ' + first.name + ' at ' + T.t12(first.time) : ''}`, aud: { roles: ['admin', 'manager'] }, href: { admin: 'staff', manager: 'staffatt' } });
  return { msg: `Checked in at ${T.clock(ctx.now)}` };
});
def('salary.paid', AD, (ac, ctx, p) => {
  const s = staffOf(ac, p.sid) || err('Not found'); const m = p.m || T.date(ctx.now).slice(0, 7);
  const sal = C.salaryFor(ac, s, m, T.date(ctx.now));
  ac.salaries[m] = ac.salaries[m] || {}; if (ac.salaries[m][s.id]) { delete ac.salaries[m][s.id]; return { msg: 'Marked unpaid' }; }
  const amt = p.amt != null && p.amt !== '' ? num(p.amt, -1) : sal.amt; if (amt < 0) err('Enter the amount paid');
  ac.salaries[m][s.id] = { amt, at: ctx.now, note: str(p.note, 80) };
  return { msg: `${s.name}'s salary marked paid` };
});

/* players */
function savePlayer(ac, ctx, p, env, existing) {
  const name = need(str(p.name, 60), 'Add the player name');
  const b = batch(ac, p.batch) || err('Pick a batch');
  const data = { name, batch: b.id, no: num(p.no, 0, 999) || 0, dob: isDate(p.dob) ? p.dob : '', fee: p.fee === '' || p.fee == null ? null : num(p.fee, 0) };
  let login = null;
  const pe = str(p.parentEmail, 120).toLowerCase();
  if (pe && !/^\S+@\S+\.\S+$/.test(pe)) err('Parent email does not look right');
  if (existing) Object.assign(existing, data);
  const pl = existing || { id: C.id('p'), ...data, joined: isDate(p.joined) ? p.joined : T.date(ctx.now), fees: {}, med: {}, docs: {} };
  pl.parentName = str(p.parentName, 60) || pl.parentName || 'Parent';
  pl.parentPhone = str(p.parentPhone, 20);
  if (pe && pe !== pl.parentEmail) {
    const u = env.ensureUser({ email: pe, name: pl.parentName });
    if (pl.parentUid && pl.parentUid !== u.uid && !active(ac).some(x => x !== pl && x.parentUid === pl.parentUid)) env.unlink(pl.parentUid, ac.id, 'parent');
    pl.parentUid = u.uid; pl.parentEmail = pe; env.link(u.uid, ac.id, 'parent');
    login = { email: pe, temp: u.temp };
    env.mail(pe, `${ac.name}: your parent app`, `Hi ${pl.parentName},\n\n${name} is now in ${b.name} at ${ac.name}.\nSee attendance, pay fees by UPI and get notices in the Veyra Academy app.\nOpen: ${env.url}/#login\nEmail: ${pe}\n${u.temp ? 'Password: ' + u.temp : 'Use your existing password or Google.'}\nOn your phone, tap Add to Home Screen to install it.\n`);
  }
  if (!existing) ac.players.push(pl);
  return { pl, login };
}
def('player.add', AM, (ac, ctx, p, env) => {
  const { pl, login } = savePlayer(ac, ctx, p, env, null);
  if (p.admId) { const a = ac.adm.find(x => x.id === p.admId); if (a) { a.s = 'enrolled'; a.pid = pl.id; a.at = ctx.now; } }
  const b = batch(ac, pl.batch);
  post(ac, ctx, { ico: 'players', title: `${pl.name} joined ${b.name}`, sub: 'Added by ' + ctx.name, aud: { roles: ['admin', 'manager'], sids: [b.coach] }, href: { admin: 'players', coach: 'home' } });
  return { msg: `${pl.name} added`, data: { login, name: pl.parentName, pid: pl.id } };
});
def('player.import', AD, (ac, ctx, p, env) => {
  const rows = Array.isArray(p.rows) ? p.rows.slice(0, 500) : []; if (!rows.length) err('No players found in the file');
  const byName = n => { const k = String(n || '').trim().toLowerCase(); return ac.batches.find(b => b.name.toLowerCase() === k) || (!k && ac.batches.length === 1 ? ac.batches[0] : null); };
  let added = 0; const bad = []; const logins = [];
  rows.forEach((r, i) => {
    try { const b = byName(r.batch) || err(r.batch ? `No batch called "${str(r.batch, 40)}"` : 'Batch is empty');
      const { pl, login } = savePlayer(ac, ctx, Object.assign({}, r, { batch: b.id }), env, null); added++; if (login) logins.push(login.email); }
    catch (e) { bad.push({ row: i + 2, name: str(r.name, 60), why: e.message }); }
  });
  if (added) post(ac, ctx, { ico: 'players', title: `${added} players imported`, sub: 'Added by ' + ctx.name, aud: { roles: ['admin', 'manager'] }, href: { admin: 'players' } });
  return { msg: added ? `${added} player${added === 1 ? '' : 's'} added${bad.length ? `, ${bad.length} skipped` : ''}` : 'No players added', data: { added, bad, parents: logins.length } };
});
def('player.update', AD, (ac, ctx, p, env) => { const ex = playerOf(ac, p.id) || err('Player not found'); const { login } = savePlayer(ac, ctx, p, env, ex); return { msg: 'Player saved', data: login && login.temp ? { login, name: ex.parentName } : null }; });
def('player.break', AD, (ac, ctx, p) => {
  const pl = playerOf(ac, p.id) || err('Player not found'); pl.breaks = pl.breaks || [];
  if (p.remove != null) { pl.breaks.splice(+p.remove, 1); return { msg: `Break removed. ${pl.name} is back on fees and attendance.` }; }
  const mm = x => /^\d{4}-\d\d$/.test(x || ''); if (!mm(p.from)) err('Pick the first month of the break');
  const to = mm(p.to) ? p.to : ''; if (to && to < p.from) err('The last month is before the first month');
  if (pl.breaks.some(b => b.from <= (to || '9999-12') && (!b.to || b.to >= p.from))) err('This overlaps a break already added');
  if (Object.entries(pl.fees || {}).some(([m, f]) => f.st === 'paid' && m >= p.from && (!to || m <= to))) err('A month in this break is already paid. Pick other months.');
  pl.breaks.push({ from: p.from, to, why: str(p.why, 80), by: ctx.name, at: ctx.now }); pl.breaks.sort((a, b) => a.from.localeCompare(b.from));
  ac.queue = ac.queue.filter(x => !(x.pid === pl.id && x.m >= p.from && (!to || x.m <= to)));
  Object.keys(pl.fees || {}).forEach(m => { if (pl.fees[m].st === 'verify' && m >= p.from && (!to || m <= to)) delete pl.fees[m]; });
  post(ac, ctx, { ico: 'players', title: `${pl.name} is on a break`, sub: `${T.monthOnly(p.from)}${to ? (to !== p.from ? ' to ' + T.monthOnly(to) : '') : ' until further notice'} · no fee for these months`, aud: { pids: [pl.id], roles: ['admin'] }, href: { parent: 'fees', admin: 'players' } });
  return { msg: `${pl.name} is on a break. No fee for those months.` };
});
def('player.leave', AD, (ac, ctx, p, env) => {
  const pl = playerOf(ac, p.id) || err('Player not found'); pl.left = T.date(ctx.now);
  if (pl.parentUid && !active(ac).some(x => x.parentUid === pl.parentUid)) env.unlink(pl.parentUid, ac.id, 'parent');
  return { msg: `${pl.name} moved to past players` };
});
def('parent.reset', AD, (ac, ctx, p, env) => {
  const pl = playerOf(ac, p.id) || err('Player not found'); if (!pl.parentUid) err('This player has no parent email yet');
  const temp = env.resetPw(pl.parentUid);
  env.mail(pl.parentEmail, 'Your new Veyra Academy password', `Hi ${pl.parentName},\n\nYour new password is ${temp}\nLog in: ${env.url}/#login\n`);
  return { msg: 'New password made', data: { login: { email: pl.parentEmail, temp }, name: pl.parentName } };
});

/* attendance */
def('att.save', STAFF, (ac, ctx, p) => {
  const b = batch(ac, p.bid) || err('Batch not found');
  if (!coachOwns(ac, ctx, b.id)) err('Only the coach of this batch can mark it', 403);
  const d = isDate(p.date) && ctx.role !== 'coach' ? p.date : T.date(ctx.now);
  if (d > T.date(ctx.now)) err('You cannot mark a future session');
  const list = active(ac).filter(x => x.batch === b.id); const marks = {};
  list.forEach(x => { const v = (p.marks || {})[x.id]; if (['P', 'L', 'A'].includes(v)) marks[x.id] = v; });
  const left = list.length - Object.keys(marks).length; if (left > 0) err(`Mark all ${list.length} players first (${left} left)`);
  const day = ac.att[d] = ac.att[d] || {}; const first = !day[b.id];
  const prev = (day[b.id] || {}).marks || {};
  day[b.id] = { marks, at: ctx.now, by: ctx.name };
  const A_ = list.filter(x => marks[x.id] === 'A'), L_ = list.filter(x => marks[x.id] === 'L');
  const pres = list.length - A_.length;
  post(ac, ctx, { ico: 'check', title: `${b.name} ${first ? 'marked' : 'updated'}: ${pres} of ${list.length} present`, sub: `${T.dayShort(d)} · by ${ctx.name}`, aud: { roles: ['admin', 'manager'], sids: [b.coach] }, href: { admin: 'attendance', manager: 'attendance' } });
  list.forEach(x => {
    const v = marks[x.id]; if (prev[x.id] === v) return;
    if (v === 'A') post(ac, ctx, { ico: 'bell', title: `${x.name} was marked absent`, sub: `${b.name}, ${T.dayShort(d)} at ${T.t12(b.time)}`, aud: { pids: [x.id] }, href: { parent: 'attendance' } });
    else if (v === 'L') post(ac, ctx, { ico: 'clock', title: `${x.name} came late`, sub: `${b.name}, ${T.dayShort(d)}`, aud: { pids: [x.id] }, href: { parent: 'attendance' } });
    else if (prev[x.id]) post(ac, ctx, { ico: 'check', title: `${x.name} is now marked present`, sub: `${b.name}, ${T.dayShort(d)}`, aud: { pids: [x.id] }, href: { parent: 'attendance' } });
  });
  return { msg: `Saved. ${A_.length} parent${A_.length === 1 ? '' : 's'} told about an absence.` };
});

/* fees */
def('fee.pay', ['parent'], (ac, ctx, p) => {
  const pl = playerOf(ac, p.pid) || err('Player not found'); if (pl.parentUid !== ctx.uid) err('Not your child', 403);
  const utr = String(p.utr || '').replace(/\s/g, ''); const shot = !utr && /^([a-f0-9]{24}|demo)$/.test(String(p.shot || '')) ? String(p.shot) : '';
  if (!shot && !/^\d{12}$/.test(utr)) err(`The transaction ID has 12 digits. You typed ${utr.length}.`);
  if (utr && (ac.queue.some(q => q.utr === utr) || ac.payments.some(x => x.utr === utr))) err('This transaction ID was already sent');
  const today = T.date(ctx.now); const bill = C.billFor(ac, pl, p.m, today);
  if (!C.billMonths(ac, pl, today).includes(p.m) || !['due', 'overdue'].includes(bill.st)) err('This bill is not open');
  pl.fees[p.m] = { st: 'verify', amt: bill.amt, utr, shot };
  ac.queue.unshift({ id: C.id('q'), pid: pl.id, m: p.m, amt: bill.amt, utr, shot, at: ctx.now, by: ctx.name });
  post(ac, ctx, { ico: 'upi', title: `UPI payment from ${pl.parentName}`, sub: `₹${bill.amt.toLocaleString('en-IN')} for ${pl.name} · ${T.monthOnly(p.m)} · ${utr ? 'ID ' + utr : 'screenshot sent'}`, aud: { roles: ['admin'] }, href: { admin: 'fees' } });
  return { msg: 'Sent. The academy will confirm soon.' };
});
function receipt(ac, ctx, pl, m, amt, via, utr, env) {
  ac.receiptSeq = (ac.receiptSeq || 0) + 1;
  const no = `R-${T.date(ctx.now).slice(0, 4)}-${pad(ac.receiptSeq).padStart(4, '0')}`;
  pl.fees[m] = { st: 'paid', amt, at: ctx.now, via, receipt: no };
  ac.payments.unshift({ id: C.id('r'), pid: pl.id, m, amt, via, utr: utr || '', at: ctx.now, receipt: no, by: ctx.name });
  post(ac, ctx, { ico: 'receipt', title: `${T.monthOnly(m)} fee received for ${pl.name}`, sub: `₹${amt.toLocaleString('en-IN')} · ${via} · receipt ${no}`, aud: { pids: [pl.id] }, href: { parent: 'fees' } });
  if (pl.parentEmail && ac.settings.chan.email) env.mail(pl.parentEmail, `Receipt ${no} from ${ac.name}`, `Hi ${pl.parentName},\n\nWe received ₹${amt.toLocaleString('en-IN')} for ${pl.name}'s ${T.monthName(m)} fee (${via}).\nReceipt: ${no}\nNo GST charged.\n\n${ac.name}\n`);
  return no;
}
def('fee.approve', AD, (ac, ctx, p, env) => {
  const q = ac.queue.find(x => x.id === p.id) || err('Already handled');
  const pl = ac.players.find(x => x.id === q.pid) || err('Player not found');
  ac.queue = ac.queue.filter(x => x.id !== q.id);
  const no = receipt(ac, ctx, pl, q.m, q.amt, 'UPI', q.utr, env);
  return { msg: `Approved ₹${q.amt.toLocaleString('en-IN')}. Receipt ${no} sent to ${pl.parentName}.` };
});
def('fee.reject', AD, (ac, ctx, p) => {
  const q = ac.queue.find(x => x.id === p.id) || err('Already handled');
  const pl = ac.players.find(x => x.id === q.pid);
  ac.queue = ac.queue.filter(x => x.id !== q.id);
  if (pl) { delete pl.fees[q.m]; post(ac, ctx, { ico: 'x', title: `We could not find your payment for ${pl.name}`, sub: `${q.utr ? 'ID ' + q.utr + '. ' : ''}${str(p.why, 120) || (q.utr ? 'Please check the ID in your UPI app and send it again.' : 'Please check the payment in your UPI app and send it again.')}`, aud: { pids: [pl.id] }, href: { parent: 'fees' } }); }
  return { msg: `Rejected. ${pl ? pl.parentName : 'The parent'} is asked to check the payment.` };
});
def('fee.record', AD, (ac, ctx, p, env) => {
  const pl = playerOf(ac, p.pid) || err('Pick a player'); const today = T.date(ctx.now);
  const m = p.m || (C.openBills(ac, pl, today)[0] || {}).m || err('Nothing due for this player'); if (!/^\d{4}-\d\d$/.test(m)) err('Pick a month');
  const bill = C.billFor(ac, pl, m, today); if (bill.st === 'paid') err('Already paid'); if (bill.st === 'break') err(`${pl.name} is on a break in ${T.monthOnly(m)}. Remove the break first.`);
  const amt = num(p.amt, 0) || bill.amt;
  ac.queue = ac.queue.filter(x => !(x.pid === pl.id && x.m === m));
  const no = receipt(ac, ctx, pl, m, amt, str(p.via, 30) || 'Cash', '', env);
  return { msg: `Saved. Receipt ${no} sent.` };
});
def('fee.waive', AD, (ac, ctx, p) => {
  if (!/^\d{4}-\d\d$/.test(String(p.m || ''))) err('Pick a month'); const pl = playerOf(ac, p.pid) || err('Player not found'); const f = pl.fees[p.m] || {};
  if (f.st === 'paid') err('Already paid');
  if (f.st === 'waived') { delete pl.fees[p.m]; return { msg: 'Fee is due again' }; }
  pl.fees[p.m] = { st: 'waived' }; ac.queue = ac.queue.filter(x => !(x.pid === pl.id && x.m === p.m));
  return { msg: `${T.monthOnly(p.m)} fee waived for ${pl.name}` };
});
def('fee.remind', AD, (ac, ctx, p, env) => {
  const today = T.date(ctx.now);
  const targets = active(ac).filter(pl => (!p.pid || pl.id === p.pid)).map(pl => ({ pl, open: C.openBills(ac, pl, today).filter(b => b.st !== 'verify') })).filter(x => x.open.length);
  if (!targets.length) err('Nobody owes anything right now');
  const out = [];
  targets.forEach(({ pl, open }) => {
    const b = open[0], amt = open.reduce((t, x) => t + x.amt, 0);
    const text = C.fillTpl(ac, pl, b, amt);
    if (ac.settings.chan.app) post(ac, ctx, { ico: 'bell', title: `Fee reminder: ₹${amt.toLocaleString('en-IN')} for ${pl.name}`, sub: open.map(x => T.monthOnly(x.m)).join(', ') + (b.st === 'overdue' ? ' · overdue' : ' · due ' + T.short(b.due)), aud: { pids: [pl.id] }, href: { parent: 'fees' } });
    if (ac.settings.chan.email && pl.parentEmail) env.mail(pl.parentEmail, `Fee reminder from ${ac.name}`, text);
    out.push({ pid: pl.id, name: pl.parentName, phone: pl.parentPhone || '', text });
  });
  ac.reminded[today] = (ac.reminded[today] || 0) + targets.length;
  return { msg: `Reminder sent to ${targets.length} parent${targets.length === 1 ? '' : 's'}`, data: { wa: ac.settings.chan.wa ? out : [] } };
});
C.fillTpl = (ac, pl, b, amt) => ac.settings.tpl.replace(/{parent}/g, (pl.parentName || 'Parent').split(' ')[0]).replace(/{player}/g, pl.name.split(' ')[0]).replace(/{month}/g, T.monthOnly(b.m)).replace(/{amount}/g, '₹' + (amt || b.amt).toLocaleString('en-IN')).replace(/{due}/g, T.short(b.due || b.m + '-05')).replace(/{academy}/g, ac.name);

/* notices */
def('notice.post', STAFF, (ac, ctx, p, env) => {
  const title = need(str(p.title, 100), 'Add a title'); const body = str(p.body, 1500);
  let to = p.to || 'all';
  if (ctx.role === 'coach' && !(to !== 'all' && to !== 'coaches' && coachOwns(ac, ctx, to))) err('Coaches can post to their own batches');
  const b = batch(ac, to);
  if (to !== 'all' && to !== 'coaches' && !b) err('Pick who gets it');
  const n = { id: C.id('n'), title, body, to, tag: str(p.tag, 20) || 'Notice', at: ctx.now, by: ctx.name };
  ac.notices.unshift(n); if (ac.notices.length > 200) ac.notices.length = 200;
  const pids = to === 'coaches' ? [] : active(ac).filter(x => to === 'all' || x.batch === to).map(x => x.id);
  post(ac, ctx, { ico: 'megaphone', title, sub: (body || '').slice(0, 90), aud: { roles: to === 'coaches' ? ['admin', 'manager', 'coach'] : ['admin', 'manager', 'coach'], pids }, href: { admin: 'notices', manager: 'notices', coach: 'notices', parent: 'notices' } });
  if (ac.settings.chan.email && to !== 'coaches') { const seen = new Set(); active(ac).filter(x => pids.includes(x.id) && x.parentEmail).forEach(x => { if (seen.has(x.parentEmail)) return; seen.add(x.parentEmail); env.mail(x.parentEmail, `${ac.name}: ${title}`, `${body}\n\n${ac.name}`); }); }
  return { msg: `Notice posted to ${to === 'all' ? 'all parents' : to === 'coaches' ? 'coaches' : b.name}` };
});
def('notice.delete', AM, (ac, ctx, p) => { ac.notices = ac.notices.filter(n => n.id !== p.id); return { msg: 'Notice removed' }; });

/* admissions */
def('adm.add', AM, (ac, ctx, p) => {
  const n = need(str(p.n, 60), 'Add the child\'s name');
  ac.adm.push({ id: C.id('e'), n, age: str(p.age, 20), parent: str(p.parent, 60), phone: str(p.phone, 20), src: str(p.src, 30) || 'Walk-in', fee: num(p.fee, 0) || 0, s: 'enquiry', note: str(p.note, 200), at: ctx.now });
  post(ac, ctx, { ico: 'board', title: `New enquiry: ${n}`, sub: `${str(p.age, 20)} · ${str(p.src, 30) || 'Walk-in'}`, aud: { roles: ['admin', 'manager'] }, href: { admin: 'admissions', manager: 'admissions' } });
  return { msg: `${n} added to Enquiry` };
});
def('adm.move', AM, (ac, ctx, p) => {
  const a = ac.adm.find(x => x.id === p.id) || err('Not found');
  if (!['enquiry', 'trial', 'fees', 'enrolled', 'lost'].includes(p.s)) err('Bad stage');
  a.s = p.s; a.at = ctx.now; if (p.trial) a.trial = str(p.trial, 40);
  return {};
});
def('adm.update', AM, (ac, ctx, p) => { const a = ac.adm.find(x => x.id === p.id) || err('Not found'); ['n', 'age', 'parent', 'phone', 'src', 'note', 'trial'].forEach(k => { if (p[k] != null) a[k] = str(p[k], 200); }); if (p.fee != null) a.fee = num(p.fee, 0) || 0; return { msg: 'Saved' }; });
def('adm.delete', AM, (ac, ctx, p) => { ac.adm = ac.adm.filter(x => x.id !== p.id); return { msg: 'Removed from the board' }; });

/* tournaments */
def('tourn.save', AM, (ac, ctx, p) => {
  const name = need(str(p.name, 80), 'Add the tournament name');
  if (!isDate(p.start)) err('Pick the start date');
  const data = { name, cat: str(p.cat, 20) || 'Cup', batch: (batch(ac, p.batch) || {}).id || '', start: p.start, end: isDate(p.end) ? p.end : p.start, venue: str(p.venue, 80), entry: num(p.entry, 0) || 0, format: str(p.format, 60) };
  if (p.id) Object.assign(ac.tournaments.find(t => t.id === p.id) || err('Not found'), data);
  else { ac.tournaments.unshift({ id: C.id('t'), ...data, squad: [], matches: [], result: '' }); if (data.entry) ac.expenses.unshift({ id: C.id('x'), what: name + ' entry', cat: 'Tournament', amt: data.entry, date: T.date(ctx.now) }); }
  return { msg: 'Tournament saved' };
});
def('tourn.result', AM, (ac, ctx, p) => { const t = ac.tournaments.find(x => x.id === p.id) || err('Not found'); t.result = str(p.result, 40); return { msg: 'Saved' }; });
def('tourn.delete', AD, (ac, ctx, p) => { ac.tournaments = ac.tournaments.filter(t => t.id !== p.id); return { msg: 'Tournament removed' }; });
def('tourn.squad', STAFF, (ac, ctx, p) => {
  const t = ac.tournaments.find(x => x.id === p.id) || err('Not found');
  if (ctx.role === 'coach' && !coachOwns(ac, ctx, t.batch)) err('Only the coach of this batch can pick the squad', 403);
  const before = new Set(t.squad); t.squad = (p.squad || []).filter(id => playerOf(ac, id)).slice(0, 40);
  const added = t.squad.filter(id => !before.has(id));
  if (added.length) post(ac, ctx, { ico: 'trophy', title: `Picked for ${t.name}`, sub: `${T.full(t.start)} · ${t.venue}`, aud: { pids: added, roles: ['admin', 'manager'] }, href: { parent: 'matches', admin: 'tournaments', manager: 'tournaments' } });
  return { msg: `Squad saved: ${t.squad.length} players. Parents told.` };
});
def('match.save', AM, (ac, ctx, p) => {
  const t = ac.tournaments.find(x => x.id === p.tid) || err('Not found');
  const vs = need(str(p.vs, 60), 'Add the other team'); if (!isDate(p.date)) err('Pick the date');
  const data = { vs, date: p.date, time: /^\d\d:\d\d$/.test(p.time || '') ? p.time : '', venue: str(p.venue, 80) || t.venue };
  if (p.id) Object.assign(t.matches.find(m => m.id === p.id) || err('Not found'), data);
  else t.matches.push({ id: C.id('m'), ...data, score: null, scorers: [], potm: '' });
  t.matches.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  if (t.squad.length && !p.id) post(ac, ctx, { ico: 'trophy', title: `Match added: vs ${vs}`, sub: `${t.name} · ${T.dayShort(p.date)}${data.time ? ', ' + T.t12(data.time) : ''}`, aud: { pids: t.squad }, href: { parent: 'matches' } });
  return { msg: 'Match saved' };
});
def('match.delete', AM, (ac, ctx, p) => { const t = ac.tournaments.find(x => x.id === p.tid) || err('Not found'); t.matches = t.matches.filter(m => m.id !== p.id); return { msg: 'Match removed' }; });
def('match.result', STAFF, (ac, ctx, p) => {
  const t = ac.tournaments.find(x => x.id === p.tid) || err('Not found');
  if (ctx.role === 'coach' && !coachOwns(ac, ctx, t.batch)) err('Only the coach of this batch can add results', 403);
  const m = t.matches.find(x => x.id === p.mid) || err('Match not found');
  const us = num(p.us, 0, 99), them = num(p.them, 0, 99); if (us == null || them == null) err('Add both scores');
  m.score = [us, them];
  m.scorers = (p.scorers || []).filter(s => s && t.squad.includes(s[0]) && +s[1] > 0).map(s => [s[0], Math.min(20, +s[1])]);
  m.assists = (p.assists || []).filter(s => s && t.squad.includes(s[0]) && +s[1] > 0).map(s => [s[0], Math.min(20, +s[1])]);
  m.potm = t.squad.includes(p.potm) ? p.potm : '';
  const res = us > them ? 'won' : us < them ? 'lost' : 'drew';
  post(ac, ctx, { ico: 'trophy', title: `${ac.name.split(' ')[0]} ${res} ${us}–${them} vs ${m.vs}`, sub: t.name + (m.potm ? ` · Player of the match: ${(playerOf(ac, m.potm) || {}).name}` : ''), aud: { roles: ['admin', 'manager', 'coach'], pids: t.squad }, href: { parent: 'matches', admin: 'tournaments', manager: 'tournaments', coach: 'matches' } });
  if (m.potm) post(ac, ctx, { ico: 'star', title: `${(playerOf(ac, m.potm) || {}).name} is player of the match!`, sub: 'Open Matches to see the certificate', aud: { pids: [m.potm] }, href: { parent: 'matches' } });
  return { msg: `Result saved: ${us}–${them}. Parents told.` };
});

/* training */
def('plan.save', STAFF, (ac, ctx, p) => {
  const b = batch(ac, p.bid) || err('Batch not found'); if (!coachOwns(ac, ctx, b.id)) err('Only the coach of this batch can change its plan', 403);
  const drills = (p.drills || []).filter(id => ac.drills.some(d => d.id === id)).slice(0, 12);
  ac.plans[b.id] = { focus: str(p.focus, 80) || 'Training', note: str(p.note, 300), drills, at: ctx.now, by: ctx.name };
  post(ac, ctx, { ico: 'whistle', title: `New training plan for ${b.name}`, sub: ac.plans[b.id].focus, aud: { roles: ['admin', 'manager'], sids: [b.coach] }, href: { coach: 'training', admin: 'training', manager: 'training' } });
  return { msg: 'Plan shared with the coach' };
});
def('drill.add', STAFF, (ac, ctx, p) => { const name = need(str(p.name, 60), 'Add the drill name'); ac.drills.push({ id: C.id('d'), name, cat: str(p.cat, 20) || 'Other', mins: num(p.mins, 1, 120) || 10 }); return { msg: 'Drill added to the library' }; });

/* progress & health */
def('progress.save', STAFF, (ac, ctx, p) => {
  const pl = playerOf(ac, p.pid) || err('Player not found'); if (!coachOwns(ac, ctx, pl.batch)) err('Only the coach of this batch can rate this player', 403);
  const skills = C.sportOf(ac).skills; const scores = skills.map((_, i) => num((p.scores || [])[i], 1, 5) || 3);
  ac.progress[pl.id] = { skills, scores, note: str(p.note, 500), at: ctx.now, by: ctx.name, m: T.date(ctx.now).slice(0, 7) };
  post(ac, ctx, { ico: 'star', title: `New progress card for ${pl.name}`, sub: 'From ' + ctx.name, aud: { pids: [pl.id] }, href: { parent: 'progress' } });
  return { msg: 'Progress shared with the parent' };
});
def('injury.add', STAFF, (ac, ctx, p) => {
  const pl = playerOf(ac, p.pid) || err('Pick a player');
  const i = { id: C.id('i'), pid: pl.id, what: need(str(p.what, 100), 'Say what happened'), status: ['out', 'light', 'fit'].includes(p.status) ? p.status : 'out', back: isDate(p.back) ? p.back : '', since: T.date(ctx.now), by: ctx.name };
  ac.injuries.unshift(i);
  const b = batch(ac, pl.batch);
  post(ac, ctx, { ico: 'shield', title: `${pl.name}: ${i.what}`, sub: i.status === 'out' ? 'Out of training' + (i.back ? ' until ' + T.short(i.back) : '') : 'Light training only', aud: { roles: ['admin', 'manager'], pids: [pl.id], sids: [b && b.coach] }, href: { parent: 'progress', admin: 'health', coach: 'home' } });
  return { msg: 'Injury logged. Coach and parent told.' };
});
def('injury.status', STAFF, (ac, ctx, p) => {
  const i = ac.injuries.find(x => x.id === p.id) || err('Not found'); if (!['out', 'light', 'fit'].includes(p.status)) err('Bad status');
  i.status = p.status; if (p.status === 'fit') i.fitOn = T.date(ctx.now);
  const pl = playerOf(ac, i.pid);
  if (pl && p.status === 'fit') post(ac, ctx, { ico: 'ok', title: `${pl.name} is fit to train again`, sub: 'Cleared by ' + ctx.name, aud: { pids: [pl.id], roles: ['admin', 'manager'] }, href: { parent: 'progress' } });
  return { msg: 'Saved' };
});
def('medical.save', ['admin', 'manager', 'parent'], (ac, ctx, p) => {
  const pl = playerOf(ac, p.pid) || err('Player not found'); if (ctx.role === 'parent' && pl.parentUid !== ctx.uid) err('Not your child', 403);
  pl.med = { blood: str(p.blood, 5), allergy: str(p.allergy, 100), note: str(p.note, 200), ename: str(p.ename, 60), ephone: str(p.ephone, 20) };
  if (ctx.role === 'parent') post(ac, ctx, { ico: 'shield', title: `${pl.name}'s medical details updated`, sub: 'By ' + ctx.name, aud: { roles: ['admin', 'manager'], sids: [(batch(ac, pl.batch) || {}).coach] }, href: { admin: 'health' } });
  return { msg: 'Medical details saved' };
});
def('doc.set', ['admin', 'manager', 'parent'], (ac, ctx, p) => {
  const pl = playerOf(ac, p.pid) || err('Player not found'); if (ctx.role === 'parent' && pl.parentUid !== ctx.uid) err('Not your child', 403);
  if (!C.DOCS.some(d => d[0] === p.key)) err('Unknown form');
  pl.docs = pl.docs || {};
  if (p.file) pl.docs[p.key] = { file: str(p.file, 80), name: str(p.name, 80), at: ctx.now, by: ctx.name };
  else if (p.clear) delete pl.docs[p.key];
  else pl.docs[p.key] = { at: ctx.now, by: ctx.name };
  if (ctx.role === 'parent') post(ac, ctx, { ico: 'copy', title: `${pl.parentName} uploaded ${C.DOCS.find(d => d[0] === p.key)[1].toLowerCase()}`, sub: 'For ' + pl.name, aud: { roles: ['admin', 'manager'] }, href: { admin: 'health' } });
  return { msg: p.clear ? 'Removed' : 'Saved' };
});
def('docs.ask', AM, (ac, ctx) => {
  const miss = active(ac).filter(pl => C.DOCS.some(d => !(pl.docs || {})[d[0]]));
  if (!miss.length) err('Every form is in');
  miss.forEach(pl => post(ac, ctx, { ico: 'copy', title: `Please upload ${pl.name}'s forms`, sub: C.DOCS.filter(d => !(pl.docs || {})[d[0]]).map(d => d[1]).join(', '), aud: { pids: [pl.id] }, href: { parent: 'progress' } }));
  return { msg: `Asked ${miss.length} parents` };
});

/* kit */
def('kit.save', AM, (ac, ctx, p) => {
  const name = need(str(p.name, 60), 'Add the item name');
  const data = { name, have: num(p.have, 0) || 0, min: num(p.min, 0) || 0 };
  if (p.id) Object.assign(ac.kit.find(k => k.id === p.id) || err('Not found'), data); else ac.kit.push({ id: C.id('k'), ...data });
  return { msg: 'Stock saved' };
});
def('kit.qty', AM, (ac, ctx, p) => { const k = ac.kit.find(x => x.id === p.id) || err('Not found'); k.have = Math.max(0, k.have + (+p.d || 0)); return {}; });
def('kit.delete', AM, (ac, ctx, p) => { ac.kit = ac.kit.filter(k => k.id !== p.id); return { msg: 'Removed' }; });
def('kit.give', AM, (ac, ctx, p) => {
  const pl = playerOf(ac, p.pid) || err('Pick a player');
  if (ac.kitGiven[pl.id] && !p.size) { delete ac.kitGiven[pl.id]; return { msg: 'Marked not given' }; }
  ac.kitGiven[pl.id] = { size: str(p.size, 6) || 'M', at: ctx.now };
  return { msg: `Kit given to ${pl.name}` };
});

/* money */
def('expense.add', AD, (ac, ctx, p) => {
  const what = need(str(p.what, 80), 'Add what it was for'); const amt = num(p.amt, 1); if (!amt) err('Add the amount');
  ac.expenses.unshift({ id: C.id('x'), what, cat: str(p.cat, 20) || 'Other', amt, date: isDate(p.date) ? p.date : T.date(ctx.now) });
  return { msg: 'Expense added' };
});
def('expense.delete', AD, (ac, ctx, p) => { ac.expenses = ac.expenses.filter(x => x.id !== p.id); return { msg: 'Expense removed' }; });

/* misc */
def('feed.seen', ALL, (ac, ctx) => { ac.seen[ctx.uid] = ctx.now; return {}; });
def('wish', AM, (ac, ctx, p) => { const pl = playerOf(ac, p.pid) || err('Not found'); post(ac, ctx, { ico: 'gift', title: `Happy birthday, ${pl.name.split(' ')[0]}!`, sub: `From everyone at ${ac.name}`, aud: { pids: [pl.id] }, href: { parent: 'home' } }); return { msg: 'Wishes sent to the family' }; });
def('parent.phone', ['parent'], (ac, ctx, p) => { active(ac).filter(x => x.parentUid === ctx.uid).forEach(x => { x.parentPhone = str(p.phone, 20); }); return { msg: 'Saved' }; });

C.ACTIONS = Object.keys(A);
C.canDo = (type, role) => !!A[type] && A[type].roles.includes(role);
/* ctx = { uid, role, sid, name, now }. env = { ensureUser, link, unlink, resetPw, mail, url } */
C.act = (ac, ctx, type, payload, env) => {
  const a = A[type]; if (!a) err('Unknown action');
  if (!a.roles.includes(ctx.role)) err('Your login cannot do this', 403);
  if (!C.planActive(ac, ctx.now) && type !== 'feed.seen') err(ac.suspended ? 'This academy is paused. Contact marketing@veyracreatives.com' : 'Your plan has ended. Pick a plan in Settings & plan to keep going.', 402);
  const r = a.fn(ac, ctx, payload || {}, env) || {};
  ac.v = (ac.v || 0) + 1; ac.updatedAt = ctx.now;
  return r;
};
C.err = err;

/* ---------- boot: what each person is allowed to see ---------- */
C.boot = (ac, me, now, extra) => {
  const today = T.date(now), month = today.slice(0, 7), role = me.role;
  const kids = role === 'parent' ? active(ac).filter(p => p.parentUid === me.uid).map(p => p.id) : [];
  const myBatches = role === 'coach' ? ac.batches.filter(b => b.coach === me.sid).map(b => b.id) : ac.batches.map(b => b.id);
  const seeAllPlayers = role !== 'parent';
  const players = active(ac).filter(p => seeAllPlayers || kids.includes(p.id)).map(p => {
    const mo = C.playerMonth(ac, p, month, today);
    const o = { id: p.id, name: p.name, no: p.no, batch: p.batch, dob: p.dob, joined: p.joined, parentName: p.parentName, att: mo.pct, attN: mo.n, med: p.med || {}, docs: p.docs || {}, brk: C.breakIn(p, month), breaks: role === 'admin' ? (p.breaks || []) : undefined };
    if (role === 'admin' || role === 'manager' || role === 'parent') { o.parentEmail = p.parentEmail || ''; o.parentPhone = p.parentPhone || ''; o.hasApp = !!p.parentUid; }
    if (role === 'coach' && myBatches.includes(p.batch)) o.parentPhone = p.parentPhone || '';
    if (role === 'admin' || role === 'parent') { o.bills = C.bills(ac, p, today); o.fee = feeOf(ac, p); o.feeCustom = p.fee != null; }
    if (role === 'admin') { const cur = o.bills.find(b => b.m === month) || { st: 'none' }; o.cur = cur; o.owes = C.openBills(ac, p, today).filter(b => b.st !== 'verify' && (!b.due || b.due <= today)).reduce((t, b) => t + b.amt, 0); }
    if (role === 'parent') { o.cal = {}; for (let i = 0; i < 3; i++) { const m = T.addMonth(month, -i); o.cal[m] = C.playerMonth(ac, p, m, today).cal; } }
    return o;
  });
  const staff = ac.staff.map(s => {
    const o = { id: s.id, name: s.name, role: s.role, title: s.title };
    if (role !== 'parent') { const st = C.staffMonth(ac, s, month, today); o.today = (ac.staffAtt[today] || {})[s.id] || null; o.days = st.worked; o.of = st.expected; o.leave = st.leave; o.phone = s.phone || ''; }
    if (role === 'admin') { o.email = s.email; o.pay = s.pay; o.sal = C.salaryFor(ac, s, month, today); o.hist = []; for (let i = 1; i <= 6; i++) { const m = T.addMonth(month, -i); const x = C.salaryFor(ac, s, m, today); if (x.paid || x.days || x.leave) o.hist.push({ m, amt: x.amt, paid: x.paid, days: x.days, leave: x.leave }); }
      o.cal = {}; Object.keys(ac.staffAtt).forEach(d => { if (d.slice(0, 7) === month && ac.staffAtt[d][s.id]) o.cal[d] = ac.staffAtt[d][s.id]; }); }
    return o;
  });
  const visibleTo = n => role !== 'parent' ? (role !== 'coach' || n.to === 'all' || n.to === 'coaches' || myBatches.includes(n.to)) : (n.to === 'all' || players.some(p => p.batch === n.to));
  const feed = ac.feed.filter(f => seesFeed(ac, me, kids, f)).slice(0, 60);
  const seen = ac.seen[me.uid] || 0;
  const att = {}; [today].forEach(d => { att[d] = {}; Object.entries(ac.att[d] || {}).forEach(([bid, r]) => { if (role === 'parent') { const m = {}; kids.forEach(k => { if (r.marks[k]) m[k] = r.marks[k]; }); att[d][bid] = { marks: m, at: r.at, by: r.by }; } else att[d][bid] = r; }); });
  const B = {
    v: ac.v, now, today, month, me: { uid: me.uid, role, sid: me.sid || '', name: me.name, email: me.email || '' },
    academy: { id: ac.id, name: ac.name, place: ac.place, sport: ac.sport || 'football', upi: ac.upi, payee: ac.payee || ac.name, dueDay: ac.dueDay, lateAfter: ac.lateAfter, lateFee: ac.lateFee, selfCheckin: !!ac.selfCheckin, settings: role === 'admin' ? ac.settings : { google: ac.settings.google } },
    plan: { type: ac.plan.type, until: ac.plan.until, active: C.planActive(ac, now), suspended: !!ac.suspended, daysLeft: Math.max(0, Math.ceil((ac.plan.until - now) / DAY)) },
    batches: ac.batches.map(b => ({ ...b, off: (b.off || []).filter(d => d >= T.add(today, -7)) })), grounds: ac.grounds, staff, players, kids, myBatches,
    att, sessionsToday: C.sessionsOn(ac, today).map(b => b.id),
    notices: ac.notices.filter(visibleTo).slice(0, 60),
    tournaments: ac.tournaments.filter(t => role !== 'parent' || !t.batch || players.some(p => p.batch === t.batch) || t.squad.some(id => kids.includes(id))),
    drills: role === 'parent' ? [] : ac.drills, plans: role === 'parent' ? {} : ac.plans,
    progress: Object.fromEntries(Object.entries(ac.progress).filter(([pid]) => role !== 'parent' || kids.includes(pid))),
    injuries: ac.injuries.filter(i => role !== 'parent' || kids.includes(i.pid)),
    feed, unread: feed.filter(f => f.at > seen && f.by !== me.name).length, feedSeenAt: seen,
    skills: C.sportOf(ac).skills, sport: ac.sport || 'football', sports: Object.entries(C.SPORTS).map(([k, v]) => [k, v.name]), sportInfo: { name: C.sportOf(ac).name, ball: C.sportOf(ac).ball }, docs: C.DOCS,
    bookings: role === 'parent' ? [] : ac.bookings.filter(b => b.date >= T.add(today, -1))
  };
  // upcoming 7 days of sessions for coach / parent
  B.week = []; for (let i = 0; i < 8; i++) { const d = T.add(today, i); B.week.push([d, C.sessionsOn(ac, d).map(b => b.id)]); }
  if (role === 'admin' || role === 'manager') {
    B.adm = ac.adm; B.kit = ac.kit; B.kitGiven = ac.kitGiven;
    B.trend = []; for (let i = 13; i >= 0; i--) { const d = T.add(today, -i); let P = 0, n = 0; Object.values(ac.att[d] || {}).forEach(r => Object.values(r.marks).forEach(v => { n++; if (v !== 'A') P++; })); B.trend.push([d, n ? Math.round(P / n * 100) : null]); }
    const yd = T.add(today, -1); B.attYesterday = ac.att[yd] || {}; B.yesterday = yd;
  }
  if (role === 'coach') { B.kit = ac.kit; const me_ = staffOf(ac, me.sid); if (me_) { const st = C.staffMonth(ac, me_, month, today); B.myMonth = st; } }
  if (role === 'manager') { const me_ = staffOf(ac, me.sid); if (me_) B.myMonth = C.staffMonth(ac, me_, month, today); }
  if (role === 'admin') {
    B.queue = ac.queue; B.payments = ac.payments.slice(0, 300); B.expenses = ac.expenses; B.salaries = ac.salaries[month] || {};
    B.attHistory = Object.fromEntries(Object.entries(ac.att).filter(([d]) => d >= T.add(today, -62)));
    const rev = []; for (let i = 5; i >= 0; i--) { const m = T.addMonth(month, -i); rev.push([m, ac.payments.filter(x => T.date(x.at).slice(0, 7) === m).reduce((t, x) => t + x.amt, 0)]); }
    B.revenue = rev;
    let billed = 0, onTime = 0; const pm = T.addMonth(month, -1);
    active(ac).forEach(p => { if ((p.joined || today).slice(0, 7) > pm) return; const b = C.billFor(ac, p, pm, today); if (b.st === 'waived') return; billed++; if (b.st === 'paid' && T.date(b.at) <= `${pm}-${pad(ac.lateAfter)}`) onTime++; });
    B.onTimeRate = billed ? Math.round(onTime / billed * 100) : null;
    const won = ac.adm.filter(a => a.s === 'enrolled').length, closed = won + ac.adm.filter(a => a.s === 'lost').length;
    B.trialRate = closed ? Math.round(won / closed * 100) : null;
    B.pastPlayers = ac.players.filter(p => p.left).map(p => ({ id: p.id, name: p.name, left: p.left, batch: p.batch }));
    B.reminded = ac.reminded;
  }
  if (role === 'parent') B.payments = ac.payments.filter(x => kids.includes(x.pid));
  if (role === 'parent' || role === 'coach') B.queueMine = role === 'parent' ? ac.queue.filter(q => kids.includes(q.pid)) : [];
  return Object.assign(B, extra || {});
};

/* ---------- demo academy (fictional people, built around today's date) ---------- */
C.demo = (env, now) => {
  now = now || Date.now();
  const today = T.date(now); let seed = 11; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const ac = C.newAcademy({ name: 'Kickstart FC Academy', place: 'Kharghar, Navi Mumbai', now: now - 4 * DAY });
  Object.assign(ac, { upi: 'kickstartfc@okaxis', payee: 'Kickstart FC Academy', createdAt: now - 200 * DAY });
  ac.plan = { type: 'trial', until: now + 7 * DAY };
  ac.grounds = [{ id: 'g1', name: 'Turf 1, Sector 21' }, { id: 'g2', name: 'Turf 2, Sector 19' }];
  const owner = env.ensureUser({ email: 'owner@kickstart.demo', name: 'Nikhil Deshpande', pw: 'demo1234' }); ac.admins.push(owner.uid); env.link(owner.uid, ac.id, 'admin');
  const S = [['s1', 'Priya Menon', 'manager', 'Manager', 'month', 18000], ['s2', 'Arjun Nair', 'coach', 'Head coach', 'month', 22000], ['s3', 'Farhan Shaikh', 'coach', 'Coach', 'session', 600], ['s4', 'Meghna Rao', 'coach', 'Coach', 'session', 600], ['s5', 'Rohan D\'Souza', 'coach', 'Coach', 'session', 500]];
  S.forEach(([id, name, role, title, pt, pa]) => { const email = name.split(' ')[0].toLowerCase().replace(/[^a-z]/g, '') + '@kickstart.demo'; const u = env.ensureUser({ email, name, pw: 'demo1234' }); ac.staff.push({ id, uid: u.uid, name, email, phone: '', role, title, pay: { type: pt, amt: pa }, joined: T.add(today, -300) }); env.link(u.uid, ac.id, role, id); });
  ac.batches = [
    { id: 'b1', name: 'U-8 Minis', age: '6 to 8 yrs', days: [1, 3, 5], time: '06:30', mins: 60, ground: 'g1', coach: 's2', fee: 2000, tint: 'blue' },
    { id: 'b2', name: 'U-10 Kickers', age: '8 to 10 yrs', days: [1, 3, 5], time: '07:30', mins: 60, ground: 'g1', coach: 's3', fee: 2500, tint: 'green' },
    { id: 'b3', name: 'U-12 Strikers', age: '10 to 12 yrs', days: [2, 4, 6], time: '06:30', mins: 75, ground: 'g2', coach: 's4', fee: 2500, tint: 'red' },
    { id: 'b4', name: 'U-15 Elite', age: '13 to 15 yrs', days: [1, 2, 3, 4, 5], time: '17:30', mins: 90, ground: 'g2', coach: 's2', fee: 3500, tint: 'lime' },
    { id: 'b5', name: 'Girls Weekend', age: '8 to 14 yrs', days: [6, 0], time: '08:00', mins: 90, ground: 'g1', coach: 's5', fee: 2000, tint: 'slate' }];
  const kidsList = [['Aarav Patil', 7, 'b2', 'Sneha Patil'], ['Kabir Shaikh', 10, 'b2', 'Imtiaz Shaikh'], ['Myra Nair', 4, 'b1', 'Divya Nair'], ['Vihaan Joshi', 9, 'b3', 'Amit Joshi'], ['Reyansh Kulkarni', 11, 'b2', 'Pooja Kulkarni'], ['Ishaan Desai', 8, 'b3', 'Ketan Desai'], ['Aditya Rao', 5, 'b4', 'Meera Rao'], ['Sara Fernandes', 14, 'b5', 'Leon Fernandes'], ['Arjun Menon', 6, 'b2', 'Rahul Menon'], ['Zoya Khan', 3, 'b1', 'Sana Khan'], ['Dev Sawant', 17, 'b4', 'Nikhil Sawant'], ['Anaya Pillai', 2, 'b5', 'Ritu Pillai'], ['Rudra Mhatre', 19, 'b4', 'Sagar Mhatre'], ['Tanay Gupta', 12, 'b3', 'Neha Gupta'], ['Om Bhosale', 1, 'b2', 'Vikas Bhosale'], ['Kiara D\'Mello', 21, 'b5', 'Joanna D\'Mello'], ['Yash Chavan', 23, 'b3', 'Mahesh Chavan'], ['Ved Iyer', 15, 'b1', 'Lakshmi Iyer'], ['Aryan Thakur', 22, 'b4', 'Deepak Thakur'], ['Riya Kamat', 8, 'b5', 'Kavita Kamat'], ['Anvi Patil', 16, 'b5', 'Sneha Patil'], ['Krish Naik', 13, 'b2', 'Sunil Naik'], ['Ira Kulkarni', 5, 'b1', 'Pooja Kulkarni'], ['Neel Bhatt', 20, 'b3', 'Harsh Bhatt']];
  const month = today.slice(0, 7), pm = T.addMonth(month, -1), ppm = T.addMonth(month, -2);
  const parentUids = {};
  kidsList.forEach(([name, no, b, parent], i) => {
    const id = 'p' + (i + 1); const email = parent.toLowerCase().replace(/[^a-z ]/g, '').replace(' ', '.') + '@parent.demo';
    if (!parentUids[parent]) { const u = env.ensureUser({ email, name: parent, pw: 'demo1234' }); parentUids[parent] = u.uid; env.link(u.uid, ac.id, 'parent'); }
    const dob = `${2026 - 7 - (b === 'b1' ? 0 : b === 'b2' ? 2 : b === 'b3' ? 4 : b === 'b4' ? 7 : 3)}-${pad(1 + (i * 5) % 12)}-${pad(1 + (i * 7) % 27)}`;
    ac.players.push({ id, name, no, batch: b, parentName: parent, parentEmail: email, parentUid: parentUids[parent], parentPhone: '', dob, joined: i % 9 === 4 ? T.add(today, -20) : `${T.addMonth(month, -(1 + i % 5))}-${pad(1 + (i * 3) % 25)}`, fees: {}, med: {}, docs: {}, fee: null });
  });
  // a birthday this week
  ac.players[9].dob = '2018-' + T.add(today, 3).slice(5); ac.players[23].dob = '2014-' + T.add(today, 6).slice(5);
  // attendance history (last ~40 days, up to yesterday) + this morning's early batches
  const weak = { p5: .38, p11: .32, p17: .4, p23: .3 };
  for (let k = 40; k >= 0; k--) {
    const d = T.add(today, -k);
    C.sessionsOn(ac, d).forEach(b => {
      if (k === 0 && !['b1', 'b2', 'b3'].includes(b.id)) return; if (k === 0 && b.id === 'b1') return;
      const marks = {}; ac.players.filter(p => p.batch === b.id && p.joined <= d).forEach(p => { const r = rnd(); const w = weak[p.id] || .06; marks[p.id] = r < w ? 'A' : r < w + .06 ? 'L' : 'P'; });
      if (Object.keys(marks).length) { ac.att[d] = ac.att[d] || {}; ac.att[d][b.id] = { marks, at: now - k * DAY - 3600e3, by: (ac.staff.find(s => s.id === b.coach) || {}).name || 'Coach' }; }
      const sd = ac.staffAtt[d] = ac.staffAtt[d] || {}; if (!sd[b.coach] && k > 0) { const r = rnd(); sd[b.coach] = { s: r < .05 ? 'A' : r < .14 ? 'L' : 'P', t: T.t12(b.time).replace(/:(\d\d)/, (m, mm) => ':' + pad(Math.max(0, +mm - 15 + Math.floor(rnd() * 14)))), by: 'Priya Menon' }; }
    });
    if (k > 0 && T.dow(d) !== 0) { const sd = ac.staffAtt[d] = ac.staffAtt[d] || {}; sd.s1 = { s: 'P', t: '6:0' + Math.floor(rnd() * 9) + ' AM', by: 'Priya Menon' }; }
  }
  ac.staffAtt[today] = { s1: { s: 'P', t: '6:05 AM', by: 'Priya Menon' }, s3: { s: 'P', t: '7:12 AM', by: 'Farhan Shaikh' } };
  // fees: older months paid, this month mixed
  let seq = 0; const rec = (p, m, amt, via, at) => { seq++; const no = `R-${m.slice(0, 4)}-${pad(seq).padStart(4, '0')}`; p.fees[m] = { st: 'paid', amt, at, via, receipt: no }; ac.payments.push({ id: 'r' + seq, pid: p.id, m, amt, via, utr: via === 'UPI' ? String(400000000000 + Math.floor(rnd() * 99999999999)) : '', at, receipt: no, by: 'Nikhil Deshpande' }); };
  ac.players.forEach((p, i) => {
    const fee = feeOf(ac, p);
    for (let back = 5; back >= 1; back--) { const m = T.addMonth(month, -back); if (p.joined.slice(0, 7) > m) continue; if (back === 1 && ['p5', 'p17'].includes(p.id)) continue; rec(p, m, fee, i % 4 === 0 ? 'Cash' : 'UPI', Date.parse(`${m}-${pad(2 + (i % 8))}T04:30:00Z`)); }
    if (+today.slice(8) >= 3 && [0, 2, 5, 8, 9, 11, 13, 14, 17, 19, 21].includes(i)) rec(p, month, fee, i % 3 === 0 ? 'Cash' : 'UPI', Math.min(now - 3600e3, Date.parse(`${month}-${pad(Math.min(+today.slice(8) - 1, 2 + (i % 5)))}T05:00:00Z`)));
  });
  ac.payments.sort((a, b) => b.at - a.at); ac.receiptSeq = seq;
  [['p2', '434512908761', 3 * 3600e3], ['p8', '611203984457', 5 * 3600e3], ['p19', '502918334610', 14 * 3600e3]].forEach(([pid, utr, ago], i) => { const p = ac.players.find(x => x.id === pid); const b = C.billFor(ac, p, month, today); p.fees[month] = { st: 'verify', amt: b.amt, utr }; ac.queue.push({ id: 'q' + i, pid, m: month, amt: b.amt, utr, at: now - ago, by: p.parentName }); });
  // admissions
  const AD_ = [['Atharv Jadhav', 'U-10', 'Swati Jadhav', 'Instagram', 2500, 'enquiry', 2], ['Kiaan Malhotra', 'U-12', 'Rohit Malhotra', 'Walk-in', 2500, 'enquiry', 30], ['Mira Sequeira', 'U-8', 'Ann Sequeira', 'Referral', 2000, 'enquiry', 50], ['Shaurya Pawar', 'U-15', 'Ajit Pawar', 'Google', 3500, 'trial', 70], ['Avni Deshmukh', 'Girls', 'Rekha Deshmukh', 'School camp', 2000, 'trial', 80], ['Laksh Wagh', 'U-10', 'Ganesh Wagh', 'Instagram', 2500, 'trial', 90], ['Parth Gokhale', 'U-15', 'Medha Gokhale', 'Referral', 3500, 'fees', 100], ['Siya Rane', 'U-12', 'Nitin Rane', 'Instagram', 2500, 'fees', 110], ['Ayaan Qureshi', 'U-10', 'Farah Qureshi', 'Walk-in', 2500, 'enrolled', 200], ['Tara Lobo', 'U-8', 'Glen Lobo', 'Referral', 2000, 'enrolled', 300], ['Rehan Ali', 'U-12', 'Salim Ali', 'Instagram', 2500, 'lost', 400]];
  AD_.forEach(([n, age, parent, src, fee, s, h], i) => ac.adm.push({ id: 'e' + i, n, age, parent, phone: '', src, fee, s, note: '', at: now - h * 3600e3, trial: s === 'trial' ? ['Sat 6:30 AM', 'Sat 8:00 AM', 'Sun 7:30 AM'][i % 3] : '' }));
  // notices
  ac.notices = [
    { id: 'n1', title: 'Friendly vs Thane Tigers on Sunday', body: 'U-12 Strikers play on Sunday at 8:00 AM on Turf 2. Report by 7:30 AM in the white kit.', to: 'b3', tag: 'Fixture', at: now - 5 * 3600e3, by: 'Priya Menon' },
    { id: 'n2', title: 'Turf maintenance next Thursday', body: 'Turf 2 is closed for maintenance next Thursday. Sessions move to Saturday, same time.', to: 'all', tag: 'Schedule', at: now - 26 * 3600e3, by: 'Nikhil Deshpande' },
    { id: 'n3', title: 'Fees open for next month', body: `Fees are due by the ${ac.dueDay}th. Pay by UPI in the app and paste the transaction ID.`, to: 'all', tag: 'Fees', at: now - 3 * DAY, by: 'Nikhil Deshpande' }];
  // tournaments
  const sun = k => { let d = today; while (T.dow(d) !== 0) d = T.add(d, 1); return T.add(d, 7 * k); };
  ac.tournaments = [
    { id: 't1', name: 'Thane Junior League', cat: 'League', batch: 'b3', start: sun(-3), end: T.add(sun(-3), 80), venue: 'Home and away, Thane and Navi Mumbai', entry: 4000, format: 'League, 8 teams', squad: ['p4', 'p6', 'p14', 'p17', 'p24'], result: '',
      matches: [{ id: 'm1', date: sun(-3), time: '08:00', vs: 'Belapur Ballers', venue: 'Turf 2, Sector 19', score: [1, 1], scorers: [['p24', 1]], assists: [['p6', 1]], potm: 'p24' }, { id: 'm2', date: sun(-2), time: '08:00', vs: 'Vashi United Juniors', venue: 'Sector 10 Ground, Vashi', score: [3, 1], scorers: [['p4', 2], ['p14', 1]], assists: [['p24', 2]], potm: 'p4' }, { id: 'm3', date: sun(-1), time: '08:30', vs: 'Airoli Strikers', venue: 'Turf 2, Sector 19', score: [2, 0], scorers: [['p14', 1], ['p6', 1]], assists: [['p4', 1]], potm: 'p14' }, { id: 'm4', date: sun(0), time: '08:00', vs: 'Thane Tigers', venue: 'Turf 2, Sector 19', score: null, scorers: [], potm: '' }, { id: 'm5', date: sun(1), time: '09:00', vs: 'Panvel Footie Kids', venue: 'New Panvel Turf', score: null, scorers: [], potm: '' }] },
    { id: 't2', name: 'Navi Mumbai Youth Cup', cat: 'Cup', batch: 'b4', start: T.add(sun(1), -1), end: T.add(sun(2), 0), venue: 'CIDCO Ground, Vashi', entry: 3000, format: 'Groups, then knockouts', squad: ['p7', 'p11', 'p13', 'p19'], result: '',
      matches: [{ id: 'm6', date: T.add(sun(1), -1), time: '09:00', vs: 'Ghansoli FC', venue: 'CIDCO Ground, Vashi', score: null, scorers: [], potm: '' }, { id: 'm7', date: sun(1), time: '11:00', vs: 'Nerul Rangers', venue: 'CIDCO Ground, Vashi', score: null, scorers: [], potm: '' }] },
    { id: 't3', name: 'Kharghar Kids Festival', cat: 'Festival', batch: 'b2', start: T.add(sun(-5), -1), end: T.add(sun(-5), -1), venue: 'Central Park, Kharghar', entry: 1500, format: 'One day, 5-a-side', squad: ['p1', 'p2', 'p9', 'p15', 'p22'], result: 'Runners-up',
      matches: [{ id: 'm8', date: T.add(sun(-5), -1), time: '08:00', vs: 'Seawoods Kickers', venue: 'Central Park', score: [2, 0], scorers: [['p1', 2]], assists: [['p9', 1]], potm: 'p1' }, { id: 'm9', date: T.add(sun(-5), -1), time: '10:30', vs: 'Vashi United (final)', venue: 'Central Park', score: [1, 2], scorers: [['p1', 1]], assists: [['p15', 1]], potm: 'p9' }] }];
  ac.plans = { b1: { focus: 'Dribbling with both feet', drills: ['d1', 'd3', 'd7'], note: 'Lots of touches. Keep groups of 3.' }, b2: { focus: 'Passing and moving', drills: ['d1', 'd2', 'd9', 'd7'], note: 'Praise the pass before the goal.' }, b3: { focus: 'Finishing before Sunday\'s match', drills: ['d1', 'd5', 'd4', 'd7'], note: 'Set-piece walk-through at the end.' }, b4: { focus: 'Pressing as a unit', drills: ['d1', 'd6', 'd9', 'd7'], note: 'Cup squad stays 10 minutes extra on Thursday.' }, b5: { focus: 'First touch and confidence', drills: ['d1', 'd2', 'd3', 'd7'], note: 'Mini match at the end every week.' } };
  Object.values(ac.plans).forEach(p => { p.at = now - 2 * DAY; p.by = 'Arjun Nair'; });
  ac.progress = { p1: { scores: [4, 5, 3, 4, 4, 5], note: 'Aarav reads the game well and his passing is sharp. Next month we work on shooting with the left foot.', at: now - 6 * DAY, by: 'Farhan Shaikh', m: month }, p21: { scores: [3, 4, 3, 3, 4, 5], note: 'Anvi is a great team player and never misses a session. Working on first touch under pressure.', at: now - 4 * DAY, by: 'Rohan D\'Souza', m: month }, p7: { scores: [4, 4, 4, 3, 5, 4], note: 'Strong engine. Keep working on the first touch when pressed.', at: now - 8 * DAY, by: 'Arjun Nair', m: month } };
  const pm_ = id => ac.players.find(p => p.id === id);
  pm_('p1').med = { blood: 'B+', allergy: '', note: '', ename: 'Sneha Patil', ephone: '' }; pm_('p11').med = { blood: 'O+', allergy: 'Peanuts', note: 'Carries an EpiPen in the kit bag', ename: '', ephone: '' }; pm_('p21').med = { blood: 'O-', allergy: 'Dust', note: 'Mild, no medicine', ename: '', ephone: '' };
  ac.players.forEach((p, i) => { C.DOCS.forEach(([k], j) => { if ((i * 7 + j * 3) % 5 !== 0) p.docs[k] = { at: now - 30 * DAY, by: p.parentName }; }); });
  ac.injuries = [{ id: 'i1', pid: 'p11', what: 'Ankle sprain (left)', status: 'out', back: T.add(today, 7), since: T.add(today, -7), by: 'Arjun Nair' }, { id: 'i2', pid: 'p5', what: 'Bruised knee', status: 'light', back: T.add(today, 2), since: T.add(today, -4), by: 'Farhan Shaikh' }, { id: 'i3', pid: 'p16', what: 'Hamstring tightness', status: 'fit', back: '', since: T.add(today, -15), by: 'Rohan D\'Souza', fitOn: T.add(today, -3) }];
  ac.kit = [['Footballs, size 4', 38, 20], ['Footballs, size 5', 24, 15], ['Training cones', 120, 50], ['Bibs, orange', 14, 30], ['Bibs, blue', 31, 30], ['Goalkeeper gloves', 6, 6], ['First-aid kit', 2, 3], ['Training jersey, size S', 8, 10], ['Training jersey, size M', 19, 10], ['Match kit sets', 22, 20]].map(([name, have, min], i) => ({ id: 'k' + i, name, have, min }));
  ac.players.forEach((p, i) => { if (i % 5 !== 0) ac.kitGiven[p.id] = { size: ['XS', 'S', 'S', 'M', 'M', 'L'][p.no % 6], at: now - 60 * DAY }; });
  ac.expenses = [['Turf rent, Turf 1 and 2', 'Rent', 15000, 1], ['New footballs (10)', 'Equipment', 4200, 6], ['Thane Junior League entry', 'Tournament', 4000, 2], ['First-aid refill', 'Medical', 900, 14], ['Bus to Vashi match', 'Travel', 2500, 16]].map(([what, cat, amt, d], i) => ({ id: 'x' + i, what, cat, amt, date: `${month}-${pad(Math.min(d, +today.slice(8)))}` }));
  ac.salaries[month] = { s1: { amt: 18000, at: now - 2 * DAY } };
  ac.bookings = [{ id: 'k1', gid: 'g2', date: T.add(today, 3), time: '17:30', what: 'Birthday party rental', by: 'Priya Menon' }];
  // a recent feed so every app has something in the bell
  const ctxOf = (name) => ({ name, now: now - 3600e3 });
  post(ac, ctxOf('Farhan Shaikh'), { ico: 'check', title: 'U-10 Kickers marked', sub: 'This morning · by Farhan Shaikh', aud: { roles: ['admin', 'manager'] }, href: { admin: 'attendance', manager: 'attendance' } });
  ac.queue.forEach(q => { const p = pm_(q.pid); ac.feed.unshift({ id: C.id('f'), at: q.at, by: p.parentName, ico: 'upi', title: `UPI payment from ${p.parentName}`, sub: `₹${q.amt.toLocaleString('en-IN')} for ${p.name} · ID ${q.utr}`, href: { admin: 'fees' }, aud: { roles: ['admin'] } }); });
  ac.feed.unshift({ id: C.id('f'), at: now - 2 * 3600e3, by: 'Arjun Nair', ico: 'star', title: 'New progress card for Aarav Patil', sub: 'From Farhan Shaikh', href: { parent: 'progress' }, aud: { pids: ['p1'] } });
  // one player on a break this month and one paid leave day, so the demo shows both
  { const m = today.slice(0, 7); const pb = ac.players.find(p => !(p.fees[m] && p.fees[m].st === 'paid') && !ac.queue.some(q => q.pid === p.id)); if (pb) { pb.breaks = [{ from: m, to: m, why: 'School exams', by: 'Kickstart admin', at: now }]; delete pb.fees[m]; }
    const lv = T.add(today, -3); const co = ac.staff.find(s => s.role === 'coach' && s.pay && s.pay.type === 'month'); if (co && lv.slice(0, 7) === m) { (ac.staffAtt[lv] = ac.staffAtt[lv] || {})[co.id] = { s: 'H', paid: true, why: 'Family function', by: 'Kickstart admin' }; } }
  ac.feed.sort((a, b) => b.at - a.at);
  return ac;
};

/* ---------- plans (bought with Razorpay, a licence key, or set by HQ) ---------- */
C.PLAN_DAYS = { monthly: 30, yearly: 365 };
C.applyPlan = (ac, type, now, days) => {
  if (!C.PLAN_DAYS[type]) err('Unknown plan');
  const from = Math.max(now, ac.plan && ac.plan.type !== 'trial' ? ac.plan.until : now);
  ac.plan = { type, until: from + (days || C.PLAN_DAYS[type]) * DAY, since: now };
  ac.v = (ac.v || 0) + 1;
  ac.feed.unshift({ id: C.id('f'), at: now, by: 'Veyra', ico: 'ok', title: `${type === 'yearly' ? 'Yearly' : 'Monthly'} plan is active`, sub: 'Paid until ' + T.full(T.date(ac.plan.until)), href: { admin: 'setup' }, aud: { roles: ['admin'] } });
  return ac.plan;
};
C.mkKey = () => { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const g = () => Array.from({ length: 4 }, () => a[Math.floor(Math.random() * a.length)]).join(''); return `VFB-${g()}-${g()}-${g()}`; };

if (typeof module !== 'undefined' && module.exports) module.exports = C; else root.VFC = C;
})(typeof window !== 'undefined' ? window : globalThis);
