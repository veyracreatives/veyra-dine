/* Veyra visitor stats (first-party, no cookies). Sends page views, button clicks, sections seen and time on page to /api/va.
   No names, emails or anything typed is ever sent. Open the site once with ?notrack to stop counting your own visits on that device. */
(function () {
  'use strict';
  if (window.VA || !navigator.sendBeacon) return;
  const LS = (() => { try { const k = '__va'; localStorage.setItem(k, 1); localStorage.removeItem(k); return localStorage; } catch (_) { return null; } })();
  const q = new URLSearchParams(location.search);
  if (LS && q.has('notrack')) LS.setItem('va_off', '1'); if (LS && q.has('track')) LS.removeItem('va_off');
  const off = LS && LS.getItem('va_off') === '1';
  const rnd = () => Array.from(crypto.getRandomValues(new Uint8Array(9)), b => b.toString(36).padStart(2, '0')).join('').slice(0, 16);
  let vid = LS && LS.getItem('va_vid'); if (!vid) { vid = rnd(); try { LS && LS.setItem('va_vid', vid); } catch (_) {} }
  let sid; try { const s = JSON.parse(sessionStorage.getItem('va_s') || 'null'); sid = s && Date.now() - s.t < 30 * 60e3 ? s.id : rnd(); sessionStorage.setItem('va_s', JSON.stringify({ id: sid, t: Date.now() })); } catch (_) { sid = rnd(); }
  const VA = window.VA = { vid: () => vid, track };
  if (off) { VA.off = true; return; }
  const ep = (document.currentScript && document.currentScript.dataset.endpoint) || '/api/va';
  let Q = [], T = null;
  function send() { clearTimeout(T); if (!Q.length) return; const b = JSON.stringify({ v: vid, s: sid, e: Q.splice(0) }); try { navigator.sendBeacon(ep, new Blob([b], { type: 'text/plain' })); } catch (_) {} try { sessionStorage.setItem('va_s', JSON.stringify({ id: sid, t: Date.now() })); } catch (_) {} }
  function track(t, o) { Q.push(Object.assign({ t, p: location.pathname, h: hashName() }, o || {})); clearTimeout(T); T = setTimeout(send, t === 'view' ? 50 : 1500); }
  const hashName = () => { const h = location.hash; return /^#[\w-]{1,40}$/.test(h) && !/^#reset-/.test(h) ? h : ''; };
  // page view (and again when the single-page app changes view by #hash)
  function view(first) { const u = first ? { s: q.get('utm_source') || '', m: q.get('utm_medium') || '', c: q.get('utm_campaign') || '' } : null;
    track('view', { r: first ? document.referrer : '', u: u && (u.s || u.c) ? u : undefined, w: Math.round(screen.width || innerWidth), l: navigator.language || '' }); }
  view(true);
  let lastHash = hashName(); addEventListener('hashchange', () => { const h = hashName(); if (h !== lastHash) { lastHash = h; view(false); seenReset(); } });
  // clicks on buttons and links
  const label = el => { const d = el.getAttribute('data-track'); if (d) return d; let s = el.getAttribute('aria-label') || el.innerText || el.textContent || el.getAttribute('title') || ''; s = s.replace(/\s+/g, ' ').trim(); if (el.tagName === 'SUMMARY') s = 'FAQ: ' + s; return s.slice(0, 80); };
  const section = el => { const s = el.closest('[data-track-section], section, header, footer, nav, form, [role=dialog]'); if (!s) return ''; return s.getAttribute('data-track-section') || s.id || (s.tagName === 'HEADER' ? 'header' : s.tagName === 'FOOTER' ? 'footer' : s.tagName === 'NAV' ? 'menu' : (s.classList[0] || s.tagName.toLowerCase())); };
  document.addEventListener('click', e => {
    const el = e.target.closest && e.target.closest('a, button, summary, [data-track], [role=button]'); if (!el || el.closest('[data-notrack]')) return;
    const n = label(el); if (!n) return; const href = el.getAttribute('href') || '';
    track('click', { n, sec: section(el), x: href && !/^javascript:/i.test(href) ? href.slice(0, 200) : undefined });
    if (href && !href.startsWith('#') && el.tagName === 'A') send();
  }, true);
  // first time someone starts typing in a form (only the form's name is sent, never what they type)
  const formsStarted = new Set();
  document.addEventListener('input', e => { const f = e.target.closest && e.target.closest('form, [data-track-form]'); if (!f) return; const n = f.getAttribute('data-track-form') || f.id || hashName().slice(1) || 'form'; const k = location.hash + n; if (formsStarted.has(k)) return; formsStarted.add(k); track('form', { n }); }, true);
  // sections people actually scrolled to (pages that redraw themselves are watched again)
  let seen = new Set(), io = null, obs = new WeakSet(), mT = null;
  function seenReset() { seen = new Set(); }
  function watch() { if (!('IntersectionObserver' in window)) return;
    if (!io) io = new IntersectionObserver(es => es.forEach(x => { if (!x.isIntersecting) return; const n = x.target.getAttribute('data-track-section') || x.target.id; if (n && !seen.has(n)) { seen.add(n); track('see', { n }); } }), { rootMargin: '-35% 0px -35% 0px', threshold: 0 });
    document.querySelectorAll('section[id], [data-track-section]').forEach(s => { if (!obs.has(s)) { obs.add(s); io.observe(s); } }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch); else setTimeout(watch, 0);
  try { new MutationObserver(() => { clearTimeout(mT); mT = setTimeout(watch, 300); }).observe(document.documentElement, { childList: true, subtree: true }); } catch (_) {}
  // installed app opens
  try { if (matchMedia('(display-mode: standalone)').matches || navigator.standalone) track('app', { n: 'Opened installed app' }); } catch (_) {}
  addEventListener('appinstalled', () => track('app', { n: 'Installed the app' }));
  // time on page and how far they scrolled
  let shown = Date.now(), active = 0, depth = 0;
  addEventListener('scroll', () => { const h = document.documentElement; const d = Math.round(((scrollY + innerHeight) / Math.max(1, h.scrollHeight)) * 100); if (d > depth) depth = Math.min(100, d); }, { passive: true });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { active += Date.now() - shown; track('leave', { ms: active, d: depth }); active = 0; send(); } else shown = Date.now(); });
  addEventListener('pagehide', send);
})();
