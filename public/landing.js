/* Veyra Academy landing page. Plain function so the server can pre-render it for search engines. */
(function (root) {
'use strict';
const SPORT_INTRO = {"football": "Morning and evening batches on the turf. Coaches rate passing, dribbling and shooting, and parents see match results and goals.", "cricket": "Nets, throwdowns and match days. Coaches rate batting, bowling, fielding and catching after each term.", "badminton": "Court slots, shuttle stock and singles or doubles practice. Coaches track footwork, serve, smash and net play.", "tennis": "Court batches from mini tennis to match play. Coaches rate forehand, backhand, serve and volley.", "basketball": "Court sessions, team drills and tournaments. Coaches track shooting, dribbling, passing and defence.", "swimming": "Pool batches by level and time slot. Coaches track each stroke, breathing and endurance as swimmers move up.", "skating": "Rink or road batches for beginners to racers. Coaches track balance, stride, turns and stopping.", "athletics": "Track and field groups for sprints, jumps and throws. Coaches track speed, starts and technique.", "martial": "Karate, taekwondo, judo and more. Coaches track technique, forms and sparring before each belt test.", "other": "Yoga, chess, gymnastics or any coaching class. You get general skills you can use for any activity."};
const coreC = () => { try { return root.VFC || require('./core.js'); } catch (_) { return null; } };
const sportsData = () => { const c = coreC(); return c && c.SPORTS ? c.SPORTS : {}; };
function sportsSection(ic) {
  const S = sportsData(); const keys = Object.keys(S); if (!keys.length) return '';
  const same = ['Batches, attendance and coach attendance', 'UPI fees, cash, receipts and reminders', 'Breaks and holidays: no fee while away', 'Coach leave and salaries', 'Tournaments, results and certificates', 'Parent app in English, हिंदी and मराठी'];
  return `<section class="sec" id="sports" style="padding-top:0"><div class="wrap">
    <div class="sec-head"><span class="eyebrow" style="justify-self:start">Made for your sport</span><h2 class="disp">One app, <em>every sport</em></h2><p>Pick your sport when you sign up. Progress cards, the drill library and the kit list change to match it. Tap a sport to see what you get.</p></div>
    <div class="sp-tabs rv">${keys.map((k, i) => `<input class="sp-r" type="radio" name="sp" id="sp-${k}" ${i ? '' : 'checked'}>`).join('')}
      <div class="sp-chips" role="tablist">${keys.map(k => `<label for="sp-${k}" class="sp-chip">${S[k].name === 'Other' ? 'Any other sport' : S[k].name}</label>`).join('')}</div>
      ${keys.map(k => { const s = S[k]; const nm = s.name === 'Other' ? 'any coaching class' : s.name.toLowerCase() + ' academies'; return `<div class="sp-panel sp-${k}"><div class="sp-intro between" style="flex-wrap:wrap;gap:12px;align-items:flex-end"><div><h3>Veyra Academy for ${nm}</h3><p>${SPORT_INTRO[k] || ''}</p></div><a class="btn btn-primary" href="?sport=${k}#signup">Start free trial${k === 'other' ? '' : ' for ' + s.name.toLowerCase()}</a></div>
        <div class="sp-grid"><div class="sp-box"><span class="label">Progress card skills</span><ul class="sp-skills">${s.skills.map((x, j) => `<li><span>${x}</span><i style="--w:${[82, 68, 74, 60, 88, 70][j % 6]}%"></i></li>`).join('')}</ul></div>
        <div class="sp-box"><span class="label">Ready-made drills</span><ul class="sp-list">${coreC().drillsFor(k).slice(0, 6).map(d => `<li><b>${d.name}</b><small>${d.cat} · ${d.mins} min</small></li>`).join('')}</ul><small class="faint">Add your own drills any time.</small></div>
        <div class="sp-box"><span class="label">Same for every sport</span><ul class="sp-list sp-ok">${same.map(x => `<li>${ic('ok')}<span>${x}</span></li>`).join('')}<li>${ic('ok')}<span>Kit stock: ${s.ball.split(",")[0].toLowerCase()} and more</span></li></ul></div></div></div>`; }).join('')}
    </div>
  </div></section>`;
}
const AREAS = ['Vashi', 'Nerul', 'Seawoods', 'CBD Belapur', 'Kharghar', 'Kamothe', 'Panvel', 'Ulwe', 'Sanpada', 'Airoli', 'Ghansoli', 'Koparkhairane', 'Thane West', 'Ghodbunder Road', 'Majiwada', 'Kalwa', 'Mulund', 'Dombivli', 'Kalyan'];
function faqs(P) {
  const r = n => '₹' + Math.round(n).toLocaleString('en-IN');
  return [['Does it work for cricket, badminton, swimming and other sports?', 'Yes. Pick your sport when you sign up (football, cricket, badminton, tennis, basketball, swimming, skating, athletics, martial arts or other). Progress cards, the drill library and the words in the app follow your sport. You can change it later in Settings.'],
    ['What is sports academy management software?', 'It is one app that replaces the attendance register, fee notebook and WhatsApp groups. Veyra Academy keeps players, batches, coaches, attendance, UPI fees, reminders, tournaments and parent updates together, on phone and laptop.'],
    ['Do parents need to download anything?', 'Parents open a link and tap Add to Home Screen. It works like an app on Android and iPhone, and it also works in a normal browser.'],
    ['How do parents pay fees?', 'They pay to your academy UPI ID from any UPI app, then paste the 12-digit transaction ID or upload the payment screenshot. You approve it and the receipt goes out. Cash paid at the turf counts too: you record it in one tap. Money goes to your bank, not to us.'],
    ['What if a player takes a break or goes on holiday?', 'Put the player on a break for those months. There is no fee for those months, the player is not on the attendance list, and the parent sees it in their app. Remove the break when they come back.'],
    ['Can I track coach salaries and leave?', 'Yes. You mark coach attendance, add holidays as paid or unpaid leave, and the salary is worked out for you. When you pay, you can change the amount for an advance or bonus and add a note.'],
    ['Can I bring my players in from Excel?', 'Yes. Download the template in the Players page, fill one row per player, save it as CSV and import everyone at once. Parents get their app login by email.'],
    ['Is the app in Hindi or Marathi?', 'Yes. Parents and coaches can switch the app to हिंदी or मराठी from the language button. Admin screens stay in English.'],
    ['How do I get help?', 'Email marketing@veyracreatives.com. We reply the same day, and every plan gets a free setup call to add your batches and players with you.'],
    ['Do the apps update for everyone at once?', 'Yes. When a coach saves attendance or you approve a fee, the admin, manager and parent apps update within seconds.'],
    ['Can coaches mark attendance with weak signal?', 'Yes. If the turf has no signal, the marks wait on the phone and send as soon as the network is back.'],
    ['Can I manage tournaments and match results?', 'Yes. Pick squads, add fixtures and scores, track scorers and send player of the match certificates to parents.'],
    ['Is Veyra Academy available in Navi Mumbai and Thane?', 'Yes. Veyra Academy is made for academies in Navi Mumbai, Thane and Mumbai, and it works the same for academies anywhere in India.'],
    [`What happens after the ${P.trial}-day trial?`, `Pick Monthly at ${r(P.monthly)} or Yearly at ${r(P.yearly)} and pay through Razorpay by UPI, card or net banking. If you do not, your data stays safe and you can still log in to pay.`],
    ['Is GST added?', 'No. The price you see is the price you pay.']];
}
/* Schema for Google: organisation, the app with prices and areas served, and the FAQ shown on the page */
function ld(cfg, base) {
  const P = cfg.plans || { monthly: 1450, yearly: 8500, trial: 10 };
  const area = [{ '@type': 'City', name: 'Navi Mumbai' }, { '@type': 'City', name: 'Thane' }, { '@type': 'City', name: 'Mumbai' }, { '@type': 'Country', name: 'India' }];
  const org = { '@type': 'Organization', '@id': 'https://veyracreatives.com/#org', name: 'Veyra Creatives', url: 'https://veyracreatives.com', email: 'marketing@veyracreatives.com', logo: base + '/icon-512.png', sameAs: ['https://www.instagram.com/veyralab.in/'], areaServed: area };
  const app = { '@type': 'SoftwareApplication', '@id': base + '/#app', name: 'Veyra Academy', alternateName: 'Veyra Academy sports academy app', applicationCategory: 'BusinessApplication', applicationSubCategory: 'Sports academy management', operatingSystem: 'Android, iOS, Windows, macOS, Web', url: base + '/', image: base + '/og.png', inLanguage: 'en-IN', description: 'Sports academy management software for India (football, cricket, badminton, swimming and more): player and coach attendance, UPI fee collection with reminders, admissions, tournaments, training plans and a parent app.', featureList: 'Player attendance, Coach attendance, UPI fee collection, Fee reminders, Receipts and late fees, Admissions board, Tournaments, Training planner, Parent app, Reports', areaServed: area, publisher: { '@id': 'https://veyracreatives.com/#org' },
    offers: [{ '@type': 'Offer', name: 'Monthly', price: String(P.monthly), priceCurrency: 'INR', url: base + '/#pricing' }, { '@type': 'Offer', name: 'Yearly', price: String(P.yearly), priceCurrency: 'INR', url: base + '/#pricing' }] };
  const site = { '@type': 'WebSite', '@id': base + '/#site', name: 'Veyra Academy', url: base + '/', inLanguage: 'en-IN', publisher: { '@id': 'https://veyracreatives.com/#org' } };
  const faq = { '@type': 'FAQPage', mainEntity: faqs(P).map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) };
  return '<script type="application/ld+json">' + JSON.stringify({ '@context': 'https://schema.org', '@graph': [org, site, app, faq] }).replace(/</g, '\\u003c') + '</script>';
}
function render(cfg, IC) {
  const { ic, logo } = IC;
  const P = cfg.plans || { monthly: 1450, yearly: 8500, trial: 10 };
  const r = n => '₹' + Math.round(n).toLocaleString('en-IN');
  const save = P.monthly * 12 - P.yearly, perMo = Math.round(P.yearly / 12), free = Math.max(0, Math.round(save / P.monthly));
  const demo = cfg.demoBase || '';
  const chev = (n, of = 4) => `<span class="chev" aria-hidden="true">${Array.from({ length: of }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;
  const markMini = () => {
    const rows = [['Aarav Patil', 7, 'P'], ['Kabir Shaikh', 10, 'P'], ['Reyansh Kulkarni', 11, 'A'], ['Krish Naik', 13, 'L']];
    return `<div class="card glow"><div class="card-h"><div><h3>U-10 Kickers · 7:30 AM</h3><div class="sub">Turf 1 · Coach Farhan</div></div><span class="pill p-ok">Saved</span></div>
    <div class="mark-list">${rows.map(([n, no, v]) => `<div class="mark"><div class="who"><span class="jersey" style="background:#1F7A55">${no}</span><div><b>${n}</b><small>#${no}</small></div></div><div class="pal">${['P', 'L', 'A'].map(x => `<button type="button" tabindex="-1" aria-hidden="true" ${x === v ? `data-on="${x}"` : ''}>${x}</button>`).join('')}</div></div>`).join('')}</div></div>`;
  };
  const upiMini = () => `<div class="card glow"><div class="card-h"><div><h3>UPI payments to check</h3><div class="sub">Match the ID in your bank app</div></div><span class="pill p-info">3 new</span></div>
    <div class="list">${[['Kabir Shaikh', 10, '#1F7A55', 'U-10 Kickers', '434512908761', 2500], ['Sara Fernandes', 14, '#5A6070', 'Girls Weekend', '611203984457', 2000], ['Aryan Thakur', 22, '#B07A16', 'U-15 Elite', '502918334610', 3500]].map(([n, no, c, b, utr, a]) => `<div class="row"><div class="who grow"><span class="jersey" style="background:${c}">${no}</span><div><b>${n}</b><small>${b}</small></div></div><div class="end"><span class="utr hide-sm">${utr}</span><b class="tnum">${r(a)}</b></div></div>`).join('')}</div>
    <div class="card-f"><span class="btn btn-quiet btn-sm" aria-hidden="true">Reject</span><span class="btn btn-primary btn-sm" aria-hidden="true">${ic('ok')}Approve</span></div></div>`;
  const feats = [['check', 'Player attendance', 'P, L or A in one tap. Parents told about absences.'], ['whistle', 'Coach attendance', 'Check-in with arrival time for every coach.'], ['upi', 'UPI fee collection', 'Parents pay your UPI ID and paste the transaction ID.'], ['swap', 'All apps connected', 'A coach marks, the admin and parents see it at once.'], ['bell', 'Fee reminders', 'In the app, by email, and WhatsApp text ready to send.'], ['receipt', 'Receipts and late fees', 'Receipts go out on their own. Late fee after your date.'], ['board', 'Admissions board', 'Drag enquiries to trial, first fee and joined.'], ['trophy', 'Tournaments', 'Squads, fixtures, results, scorers and stats.'], ['star', 'Certificates', 'Player of the match certificates for parents.'], ['calendar', 'Training planner', 'Plan per batch from a drill library.'], ['shield', 'Health and injuries', 'Injury list, allergies and blood group for coaches.'], ['copy', 'Player documents', 'Birth certificate, photo, medical and consent forms.'], ['gift', 'Kit and equipment', 'Stock of balls, bibs and jerseys. Low stock alerts.'], ['rupee', 'Expenses and salaries', 'Coach pay from attendance. See what is left over.'], ['pin', 'Ground booking', 'Who is on which turf, and book free slots.'], ['parent', 'Parent app', 'Attendance, fees, matches, progress and notices.'], ['chart', 'Reports', 'Fees, attendance and trial-to-joined. Export CSV.'], ['google', 'Google sign-in', 'Coaches and parents log in with one tap.'], ['cloud', 'Works on weak signal', 'Attendance waits on the phone and sends when online.'], ['phone', 'Installs as an app', 'Android, iPhone, tablet and laptop.']];
  const flows = [
    ['Coach', 'check', 'marks U-10 absent list', 'Parent', 'bell', 'gets “Kabir was marked absent”', 'Admin', 'chart', 'sees today’s attendance update'],
    ['Parent', 'upi', 'pays by UPI, pastes the ID', 'Admin', 'ok', 'approves it in Fees', 'Parent', 'receipt', 'gets the receipt in the app'],
    ['Coach', 'trophy', 'saves the match result', 'Parents', 'star', 'of the squad see the score', 'Player', 'star', 'gets a certificate'],
    ['Academy', 'shield', 'buys a plan with Razorpay', 'Veyra HQ', 'key', 'logs the sale', 'Academy', 'ok', 'plan is active at once']];
  return `<div class="lp">
  <header class="lp-head"><div class="wrap">
    <a class="brand" href="#">${logo()}<div><b>VEYRA ACADEMY</b><small>Academy app</small></div></a>
    <nav class="lp-nav" aria-label="Main"><a href="#features" data-scroll="features">Features</a><a href="#apps" data-scroll="apps">Apps</a><a href="#connected" data-scroll="connected">How it connects</a><a href="#pricing" data-scroll="pricing">Pricing</a><a href="#get-app" data-scroll="get-app">Install</a><a href="#faq" data-scroll="faq">FAQ</a></nav>
    <div class="lp-cta"><button class="btn btn-ghost get-app" type="button" data-act="install" aria-label="Install the app">${ic('phone')}<span>Get the app</span></button><a class="btn btn-ghost login" href="#login">Log in</a><a class="btn btn-primary" href="#signup">Free trial</a></div>
  </div></header>
  <main>
  <section class="hero"><div class="wrap">
    <div>
      <span class="eyebrow">Sports academy management software</span>
      <h1 class="disp"><span class="ln">Run your academy</span><span class="ln"><em>like a pro club</em></span></h1>
      <p class="lead">Attendance, fees, coaches and parents in one app. Coaches mark a session in 30 seconds. Parents pay by UPI and see every session. You see everything, live.</p>
      <div class="hstack"><a class="btn btn-primary btn-lg" href="#signup">Start ${P.trial}-day free trial ${ic('arrow')}</a><a class="btn btn-ghost btn-lg" href="${demo}#admin">Try the live demo</a></div>
      <div class="sports-row">${['Football', 'Cricket', 'Badminton', 'Tennis', 'Basketball', 'Swimming', 'Skating', 'Athletics', 'Martial arts'].map(x => `<a class="pill p-mute plain" href="#sports">${x}</a>`).join('')}<a class="pill p-brand plain" href="#sports">any sport</a></div>
      <div class="trust"><span>${ic('ok')}No card needed</span><span>${ic('ok')}Phone, tablet and laptop</span><span>${ic('ok')}Sign in with Google</span></div>
    </div>
    <div class="vis" aria-label="Preview of the admissions board">
      <div class="demo-board">
        <div class="bh"><b>Admissions · this month</b><span class="pill p-brand plain mono">LIVE</span></div>
        <div class="demo-cols">
          <div class="dcol tint-blue"><h4><i></i>Enquiry<span>3</span></h4><div class="dcard"><b>Kiaan Malhotra</b><small>U-12 · Walk-in</small>${chev(1)}</div><div class="dcard drag-demo"><b>Atharv Jadhav</b><small>U-10 · Instagram</small>${chev(1)}</div></div>
          <div class="dcol tint-green"><h4><i></i>Trial<span>3</span></h4><div class="dcard"><b>Shaurya Pawar</b><small>Sat 6:30 AM</small>${chev(2)}</div></div>
          <div class="dcol tint-slate"><h4><i></i>Joined<span>2</span></h4><div class="dcard"><b>Ayaan Qureshi</b><small>Joined this week</small>${chev(4)}</div><div class="dcard"><b>Tara Lobo</b><small>Joined last week</small>${chev(4)}</div></div>
        </div>
        <div class="float-card"><span class="tag">Fee paid by UPI</span><span class="amt tnum">₹2,500</span>${chev(3)}</div>
        <div class="bubble">Drag the player!</div>
      </div>
    </div>
  </div></section>
  <section class="strip" id="features"><div class="wrap">
    <div class="it">${ic('check')}<b>Attendance in 30 sec</b><small>Big tap buttons for coaches</small></div>
    <div class="it">${ic('upi')}<b>UPI fees</b><small>Parent pastes the transaction ID</small></div>
    <div class="it">${ic('bell')}<b>Auto reminders</b><small>Before, on and after due date</small></div>
    <div class="it">${ic('trophy')}<b>Tournaments</b><small>Squads, scores and certificates</small></div>
  </div></section>
  <section class="sec" id="apps"><div class="wrap">
    <div class="sec-head"><span class="eyebrow" style="justify-self:start">Four apps, one academy</span><h2 class="disp">Everyone gets <em>their own app</em></h2><p>Each person logs in and sees only what they need. The admin can do everything.</p></div>
    <div class="roles rv">
      ${[['tint-lime', 'Admin', 'shield', 'Owner of the academy', ['Players, batches, coaches', 'Fees, UPI checks, receipts', 'Reminders to parents', 'Breaks, coach leave and salaries'], 'admin'],
        ['tint-blue', 'Manager', 'whistle', 'Runs the day', ['Coach attendance with times', 'Player attendance for any batch', 'Admissions board', 'Tournaments, grounds and kit'], 'manager'],
        ['tint-green', 'Coach', 'check', 'On the pitch', ['Today’s sessions and batches', 'Mark a batch in 30 seconds', 'Training plan and match results', 'Rate player skills'], 'coach'],
        ['tint-red', 'Parent', 'parent', 'At home', ['Every session, present or absent', 'Pay fees by UPI', 'Progress card and certificates', 'Matches and notices'], 'parent']]
      .map(([t, n, i, s, li, h]) => `<article class="role ${t}" style="--c:${t === 'tint-lime' ? 'var(--brand)' : t === 'tint-blue' ? 'var(--blue)' : t === 'tint-green' ? 'var(--green)' : 'var(--red)'}"><span class="ri">${ic(i)}</span><div><h3>${n}</h3><p>${s}</p></div><ul>${li.map(x => `<li>${ic('ok')}${x}</li>`).join('')}</ul><a class="btn btn-ghost btn-sm" href="${demo}#${h}">Open ${n.toLowerCase()} demo ${ic('arrow')}</a></article>`).join('')}
    </div>
  </div></section>
  <section class="sec" style="padding-top:0"><div class="wrap">
    <div class="feat rv"><div><span class="label">Attendance</span><h3 class="disp" style="margin-top:12px">Mark a batch <em>before the warm-up ends</em></h3><p>Coaches open today's session and tap P, L or A next to each player. Parents see it the same minute. Managers mark coaches in with the time they arrived.</p>
      <ul><li>${ic('ok')}Mark all present in one tap, then change the few who missed</li><li>${ic('ok')}Coach attendance with arrival time, marked by you</li><li>${ic('ok')}Low attendance list for players below 65%</li></ul></div>
      <div class="vis">${markMini()}</div></div>
    <div class="feat rev rv"><div><span class="label">Fees</span><h3 class="disp" style="margin-top:12px">Fees by UPI, <em>no chasing</em></h3><p>Parents pay to your own UPI ID, then paste the 12-digit transaction ID in the app. You check it against your bank app and tap Approve. A receipt goes to the parent.</p>
      <ul><li>${ic('ok')}Money goes straight to your bank, no commission</li><li>${ic('ok')}Reminders before, on and after the due date</li><li>${ic('ok')}Late fee added for you after the date you choose</li></ul></div>
      <div class="vis">${upiMini()}</div></div>
  </div></section>
  ${sportsSection(ic)}
  <section class="sec" id="connected" style="padding-top:0"><div class="wrap">
    <div class="sec-head"><span class="eyebrow" style="justify-self:start">How it connects</span><h2 class="disp">One tap, <em>everyone knows</em></h2><p>Every app reads the same academy. When one person does something, the right people see it straight away, on any phone.</p></div>
    <div class="flows rv">${flows.map(f => `<div class="flow">${[0, 3, 6].map(k => `<div class="fstep"><span class="fi">${ic(f[k + 1])}</span><div><b>${f[k]}</b><small>${f[k + 2]}</small></div></div>`).join(`<span class="farrow" aria-hidden="true">${ic('arrow')}</span>`)}</div>`).join('')}</div>
  </div></section>
  <section class="sec" id="all-features" style="padding-top:0"><div class="wrap">
    <div class="sec-head"><span class="eyebrow" style="justify-self:start">Every feature</span><h2 class="disp">Everything your academy needs, <em>in one place</em></h2><p>No spreadsheets, no WhatsApp groups for fees, no paper registers.</p></div>
    <div class="fgrid rv">${feats.map(([i, h, p]) => `<div class="fitem">${ic(i)}<div><h3>${h}</h3><p>${p}</p></div></div>`).join('')}</div>
  </div></section>
  <section class="sec" id="get-app" style="padding-top:0"><div class="wrap">
    <div class="sec-head"><span class="eyebrow" style="justify-self:start">Install the app</span><h2 class="disp">On every phone, <em>no app store</em></h2><p>Admin, manager, coach and parent apps install straight from this page. They open full screen like any app and update on their own.</p></div>
    <div class="get-grid rv">${[['Android', 'Chrome: tap Install below, or ⋮ menu › Install app.'], ['iPhone and iPad', 'Safari: tap Share, then Add to Home Screen.'], ['Laptop and PC', 'Chrome or Edge: tap Install below, or the install icon in the address bar.']].map(([h, p]) => `<div class="get-card"><b>${h}</b><p>${p}</p></div>`).join('')}</div>
    <div class="hstack" style="margin-top:24px"><button class="btn btn-primary btn-lg" type="button" data-act="install">${ic('phone')}Install Veyra Academy</button><span class="faint" style="font-size:13.5px">Always the latest version. Nothing to download from a store.</span></div>
  </div></section>
  <section class="sec" id="near-you" style="padding-top:0"><div class="wrap">
    <div class="sec-head"><span class="eyebrow" style="justify-self:start">Navi Mumbai · Thane · all of India</span><h2 class="disp">Made for academies <em>near you</em></h2><p>Veyra Academy is made for football and cricket academies, badminton and swimming coaching, skating and martial arts classes, turf coaching centres and school programmes in Navi Mumbai, Thane and Mumbai. It suits owners who run morning and evening batches across more than one turf, collect monthly fees by UPI and want parents updated without a WhatsApp group for every batch.</p></div>
    <div class="areas rv">${AREAS.map(a => `<span class="pill p-mute plain">${a}</span>`).join('')}<span class="pill p-brand plain">and anywhere in India</span></div>
    <p class="muted" style="max-width:760px;margin-top:20px">Whether you coach U-8 beginners on a box turf in Kharghar or run a U-17 squad on a full ground in Thane, the app works the same way: add your batches and players, give coaches the coach app, and send parents one link. Setup takes an afternoon, and we help by email.</p>
  </div></section>
  <section class="sec" id="pricing" style="background:var(--surface);border-block:1px solid var(--line)"><div class="wrap">
    <div class="sec-head"><span class="eyebrow" style="justify-self:start">Pricing</span><h2 class="disp">One plan. <em>Everything in it.</em></h2><p>Unlimited players, coaches and parents. Start with ${P.trial} days free, then pay securely with Razorpay.</p></div>
    <div class="price-wrap rv">
      <div class="price"><span class="label">Monthly</span><div class="amt">${r(P.monthly)}<small>per month</small></div><p class="muted">Cancel any time.</p><a class="btn btn-ghost btn-lg btn-block" href="#signup">Start free trial</a>
        <ul>${((P.points && P.points.monthly && P.points.monthly.length) ? P.points.monthly : coreC().PLAN_POINTS.monthly).map(x => `<li>${ic('ok')}${x}</li>`).join('')}</ul></div>
      <div class="price best"><div class="between"><span class="label" style="color:var(--brand)">Yearly</span>${save > 0 ? `<span class="pill p-brand plain">Save ₹${save.toLocaleString('en-IN')}</span>` : ''}</div><div class="amt">${r(P.yearly)}<small>per year</small></div><p class="muted">Works out to ${r(perMo)} a month.</p><a class="btn btn-primary btn-lg btn-block" href="#signup">Start free trial</a>
        <ul>${(() => { const y = (P.points && P.points.yearly && P.points.yearly.length) ? P.points.yearly : coreC().PLAN_POINTS.yearly; return [y[0], save > 0 ? `Saves ${r(save)} a year` : 'Best value', ...y.slice(1)]; })().map(x => `<li>${ic('ok')}${x}</li>`).join('')}</ul></div>
    </div>
    <div class="rzp-strip rv">${ic('shield')}<div><b>Pay for your plan with Razorpay</b><small>UPI, debit and credit cards, net banking and wallets. Your plan turns on the moment the payment goes through. No GST added.</small></div><div class="hstack rzp-tags"><span class="pill p-mute plain">UPI</span><span class="pill p-mute plain">Cards</span><span class="pill p-mute plain">Net banking</span><span class="pill p-mute plain">Wallets</span></div></div>
  </div></section>
  <section class="sec" id="faq"><div class="wrap">
    <div class="sec-head"><h2 class="disp">Questions</h2></div>
    <div class="faq rv">
      ${faqs(P).map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('')}
    </div>
  </div></section>
  <section class="sec" style="padding-top:0"><div class="wrap"><div class="final rv"><h2 class="disp">Your academy, <em>sorted by Monday</em></h2><p class="muted" style="max-width:520px">Set up batches, invite coaches and send the parent link in one afternoon.</p><div class="hstack" style="justify-content:center"><a class="btn btn-primary btn-lg" href="#signup">Start free trial</a><a class="btn btn-ghost btn-lg" href="#login">Log in</a></div></div></div></section>
  </main>
  <footer class="lp-foot"><div class="wrap"><a class="brand" href="#">${logo()}<div><b>VEYRA ACADEMY</b><small>by Veyra Creatives</small></div></a><span>Questions? <a href="mailto:marketing@veyracreatives.com" style="color:inherit">marketing@veyracreatives.com</a> · same-day reply</span><span><a href="/privacy" style="color:inherit">Privacy policy</a></span><span>© ${new Date().getFullYear()} Veyra Creatives</span></div></footer>
  </div>`;
}
const L = { render, ld, faqs };
if (typeof module !== 'undefined' && module.exports) module.exports = L; else root.VFL = L;
})(typeof window !== 'undefined' ? window : globalThis);
