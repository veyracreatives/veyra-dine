// Veyra website stats: our own counter, no cookies, nothing stored in the browser, no third parties.
(function () {
  if (navigator.webdriver || /bot|crawl|spider|headless|preview/i.test(navigator.userAgent)) return;
  var send = function (d) { var b = JSON.stringify(d); if (navigator.sendBeacon) navigator.sendBeacon('/api/t', new Blob([b], { type: 'application/json' })); else fetch('/api/t', { method: 'POST', body: b, headers: { 'Content-Type': 'application/json' }, keepalive: true }); };
  var q = new URLSearchParams(location.search);
  send({ p: location.pathname, r: document.referrer || '', s: q.get('utm_source') || q.get('ref') || '', w: window.innerWidth });
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a'); if (!a) return;
    var h = a.getAttribute('href') || '', ev = /\/download\/|\.exe$/.test(h) ? 'download' : /wa\.me/.test(h) ? (/buy|Lifetime|Yearly/i.test(decodeURIComponent(h)) ? 'buy_whatsapp' : 'whatsapp') : /\/signup/.test(h) ? 'signup_click' : /\/admin/.test(h) ? 'login_click' : /^#pricing/.test(h) ? 'pricing_click' : '';
    if (ev) send({ p: location.pathname, e: ev });
  }, true);
})();
