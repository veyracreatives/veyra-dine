/* SEO data for HQ, all free:
   - Google Search Console API (keywords, clicks, impressions, position, pages, sitemaps, "is this page on Google")
     via a Google Cloud service account (JSON key pasted in HQ). Signed with Node crypto, no packages.
   - Bing Webmaster Tools API (backlinks: which outside pages link to us, plus Bing keywords) with a free API key.
   - Google PageSpeed Insights (speed + SEO score for phone and computer), free, key optional.
   - Our own page check: title, description, headings, schema, local words. */
'use strict';
const https = require('https'), crypto = require('crypto'), fs = require('fs'), path = require('path');

function req(method, url, { headers, body, timeout } = {}) {
  return new Promise((ok, no) => {
    const u = new URL(url); const data = body == null ? '' : typeof body === 'string' ? body : JSON.stringify(body);
    const r = https.request({ host: u.hostname, path: u.pathname + u.search, method, headers: Object.assign({ 'user-agent': 'veyra-hq', 'content-length': Buffer.byteLength(data) }, body != null && typeof body !== 'string' ? { 'content-type': 'application/json' } : {}, headers || {}), timeout: timeout || 30000 }, res => {
      let s = ''; res.setEncoding('utf8'); res.on('data', c => s += c); res.on('end', () => { let j = null; try { j = s ? JSON.parse(s) : {}; } catch (_) { j = { raw: s.slice(0, 300) }; } if (res.statusCode >= 300) { const m = (j && j.error && (j.error.message || j.error_description || j.error)) || (j && (j.Message || j.message)) || ('HTTP ' + res.statusCode); const e = new Error(typeof m === 'string' ? m : JSON.stringify(m)); e.status = res.statusCode; return no(e); } ok(j); });
    });
    r.on('timeout', () => r.destroy(new Error('Timed out'))); r.on('error', no); r.end(data);
  });
}
const b64u = b => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

function SEO(opts) {
  const S = () => opts.settings(); // { gsc: { sa, site }, bing: { key }, psi: { key } }
  const cacheF = path.join(opts.dataDir, 'analytics', 'seo-cache.json'); let C = {}; try { C = JSON.parse(fs.readFileSync(cacheF, 'utf8')); } catch (_) {}
  const keep = (k, v) => { C[k] = { at: Date.now(), v }; try { fs.writeFileSync(cacheF, JSON.stringify(C)); } catch (_) {} return v; };
  const cached = (k, ms) => C[k] && Date.now() - C[k].at < ms ? C[k].v : null;
  let tok = null;
  function sa() { const raw = S().gsc.sa; if (!raw) return null; try { const j = JSON.parse(raw); if (!j.client_email || !j.private_key) throw 0; return j; } catch (_) { throw new Error('The Google key file is not valid. Paste the whole JSON file.'); } }
  async function token() {
    const k = sa(); if (!k) throw new Error('Google Search Console is not connected yet');
    if (tok && tok.email === k.client_email && tok.exp > Date.now() + 60e3) return tok.t;
    const now = Math.floor(Date.now() / 1000);
    const unsigned = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) + '.' + b64u(JSON.stringify({ iss: k.client_email, scope: 'https://www.googleapis.com/auth/webmasters', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
    const sig = crypto.sign('RSA-SHA256', Buffer.from(unsigned), k.private_key);
    const j = await req('POST', 'https://oauth2.googleapis.com/token', { headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + unsigned + '.' + b64u(sig) });
    tok = { t: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000, email: k.client_email }; return tok.t;
  }
  const g = async (method, url, body) => req(method, url, { headers: { authorization: 'Bearer ' + await token() }, body });
  const site = () => S().gsc.site || 'sc-domain:' + opts.host.split('.').slice(-2).join('.');
  const W = 'https://www.googleapis.com/webmasters/v3/sites/';
  const day = t => new Date(t + 19800000).toISOString().slice(0, 10);

  async function sites() { const j = await g('GET', 'https://www.googleapis.com/webmasters/v3/sites'); return (j.siteEntry || []).map(s => ({ url: s.siteUrl, level: s.permissionLevel })); }
  async function google(days, force) {
    days = Math.max(7, Math.min(480, +days || 28)); const key = 'g' + days + site();
    if (!force) { const c = cached(key, 6 * 3600e3); if (c) return c; }
    const end = day(Date.now() - 2 * 864e5), start = day(Date.now() - (days + 2) * 864e5);
    const filt = [{ filters: [{ dimension: 'page', operator: 'contains', expression: opts.host }] }];
    const q = (dims, n) => g('POST', W + encodeURIComponent(site()) + '/searchAnalytics/query', { startDate: start, endDate: end, dimensions: dims, rowLimit: n || 250, dimensionFilterGroups: filt, dataState: 'all' }).then(j => j.rows || []);
    const [tot, queries, pages, countries, devices, dates, sm] = await Promise.all([q([], 1), q(['query'], 500), q(['page'], 100), q(['country'], 30), q(['device'], 5), q(['date'], 500), g('GET', W + encodeURIComponent(site()) + '/sitemaps').catch(() => ({}))]);
    const r = { at: Date.now(), site: site(), start, end,
      totals: tot[0] ? { clicks: tot[0].clicks, impressions: tot[0].impressions, ctr: tot[0].ctr, position: tot[0].position } : { clicks: 0, impressions: 0, ctr: 0, position: 0 },
      queries: queries.map(x => ({ k: x.keys[0], clicks: x.clicks, imp: x.impressions, ctr: x.ctr, pos: x.position })),
      pages: pages.map(x => ({ k: x.keys[0], clicks: x.clicks, imp: x.impressions, ctr: x.ctr, pos: x.position })),
      countries: countries.map(x => ({ k: x.keys[0].toUpperCase(), clicks: x.clicks, imp: x.impressions })), devices: devices.map(x => ({ k: x.keys[0], clicks: x.clicks, imp: x.impressions })),
      dates: dates.map(x => ({ d: x.keys[0], clicks: x.clicks, imp: x.impressions, pos: x.position })),
      sitemaps: (sm.sitemap || []).filter(s => s.path.includes(opts.host)).map(s => ({ path: s.path, last: s.lastSubmitted, read: s.lastDownloaded, errors: +s.errors || 0, warnings: +s.warnings || 0, pending: !!s.isPending, urls: ((s.contents || [])[0] || {}).submitted || '' })) };
    return keep(key, r);
  }
  async function submitSitemap() { const sm = opts.base + '/sitemap.xml'; await g('PUT', W + encodeURIComponent(site()) + '/sitemaps/' + encodeURIComponent(sm)); delete C['g28' + site()]; return 'Sitemap sent to Google: ' + sm; }
  async function inspect(url) {
    url = url || opts.base + '/';
    const j = await g('POST', 'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', { inspectionUrl: url, siteUrl: site(), languageCode: 'en-IN' });
    const x = (j.inspectionResult || {}).indexStatusResult || {}; const m = (j.inspectionResult || {}).mobileUsabilityResult || {};
    return keep('inspect' + url, { url, verdict: x.verdict, coverage: x.coverageState, lastCrawl: x.lastCrawlTime, robots: x.robotsTxtState, indexing: x.indexingState, canonical: x.googleCanonical, mobile: m.verdict || '', link: (j.inspectionResult || {}).inspectionResultLink || '' });
  }
  /* Bing: backlinks + keywords. siteUrl must match the site added in Bing Webmaster Tools. */
  const B = 'https://ssl.bing.com/webmaster/api.svc/json/';
  const bsite = () => opts.base + '/';
  const bing = (fn, qs) => { const k = S().bing.key; if (!k) throw new Error('Bing is not connected yet'); return req('GET', B + fn + '?' + new URLSearchParams(Object.assign({ siteUrl: bsite(), apikey: k }, qs || {})).toString()).then(j => j.d); };
  async function backlinks(force) {
    if (!force) { const c = cached('bl', 12 * 3600e3); if (c) return c; }
    const counts = await bing('GetLinkCounts', { page: 0 }); const ours = ((counts && counts.Links) || []).map(l => ({ url: l.Url, count: l.Count })).sort((a, b) => b.count - a.count);
    const detail = []; for (const o of ours.slice(0, 5)) { try { const d = await bing('GetUrlLinks', { link: o.url, page: 0 }); ((d && d.Details) || []).forEach(x => detail.push({ to: o.url, from: x.Url, anchor: x.AnchorText || '' })); } catch (_) {} }
    let queries = []; try { const q = await bing('GetQueryStats'); queries = (q || []).map(x => ({ k: x.Query, clicks: x.Clicks, imp: x.Impressions })).sort((a, b) => b.imp - a.imp).slice(0, 100); } catch (_) {}
    const domains = {}; detail.forEach(x => { let h = ''; try { h = new URL(x.from).hostname.replace(/^www\./, ''); } catch (_) { h = x.from; } domains[h] = (domains[h] || 0) + 1; });
    return keep('bl', { at: Date.now(), total: ours.reduce((t, o) => t + o.count, 0), pages: ours, links: detail, domains: Object.entries(domains).sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ k, n })), queries });
  }
  async function pagespeed(strategy) {
    strategy = strategy === 'desktop' ? 'desktop' : 'mobile';
    const qs = new URLSearchParams({ url: opts.base + '/', strategy }); ['performance', 'seo', 'accessibility', 'best-practices'].forEach(c => qs.append('category', c)); if (S().psi.key) qs.set('key', S().psi.key);
    const j = await req('GET', 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed?' + qs, { timeout: 90000 });
    const L = j.lighthouseResult || {}; const cat = L.categories || {}; const A = L.audits || {};
    const sc = k => cat[k] ? Math.round(cat[k].score * 100) : null;
    const fix = []; for (const k of ['seo', 'performance', 'accessibility']) ((cat[k] || {}).auditRefs || []).forEach(r => { const a = A[r.id]; if (a && a.score !== null && a.score < 0.9 && a.scoreDisplayMode !== 'notApplicable' && a.scoreDisplayMode !== 'informative' && r.weight > 0) fix.push({ cat: k, title: a.title, value: a.displayValue || '' }); });
    const m = id => (A[id] || {}).displayValue || '';
    const fe = (j.loadingExperience || {}).metrics || {};
    return keep('psi' + strategy, { at: Date.now(), strategy, scores: { performance: sc('performance'), seo: sc('seo'), accessibility: sc('accessibility'), best: sc('best-practices') }, metrics: { lcp: m('largest-contentful-paint'), cls: m('cumulative-layout-shift'), tbt: m('total-blocking-time'), fcp: m('first-contentful-paint'), si: m('speed-index') }, field: fe.LARGEST_CONTENTFUL_PAINT_MS ? { lcp: fe.LARGEST_CONTENTFUL_PAINT_MS.category, cls: (fe.CUMULATIVE_LAYOUT_SHIFT_SCORE || {}).category, inp: (fe.INTERACTION_TO_NEXT_PAINT || {}).category } : null, fix: fix.slice(0, 15) });
  }
  /* Our own check of the page HTML */
  function check(html, words) {
    const ent = s => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    const one = re => { const m = re.exec(html); return m ? ent(m[1].trim()) : ''; };
    const strip = s => s.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
    const title = one(/<title>([^<]*)<\/title>/i), desc = one(/<meta name="description" content="([^"]*)"/i);
    const h1 = (html.match(/<h1[\s>]/gi) || []).length, h2 = (html.match(/<h2[\s>]/gi) || []).length;
    const body = strip(html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<head[\s\S]*?<\/head>/i, ''));
    const wc = body.split(' ').filter(Boolean).length; const low = (title + ' ' + desc + ' ' + body).toLowerCase();
    const imgs = (html.match(/<img\b[^>]*>/gi) || []); const noAlt = imgs.filter(i => !/\balt="[^"]+"/i.test(i)).length;
    const R = [];
    const add = (ok, label, detail, warn) => R.push({ ok: ok ? 'ok' : warn ? 'warn' : 'bad', label, detail });
    add(title.length >= 30 && title.length <= 62, 'Page title', `${title.length} characters: "${title}"`, title.length > 0);
    add(desc.length >= 110 && desc.length <= 165, 'Search description', `${desc.length} characters`, desc.length > 0);
    add(h1 === 1, 'One main heading (H1)', `${h1} found`); add(h2 >= 3, 'Section headings (H2)', `${h2} found`, h2 > 0);
    add(/<link rel="canonical"/i.test(html), 'Canonical link', ''); add(/application\/ld\+json/i.test(html), 'Schema for Google (JSON-LD)', (html.match(/"@type":"(\w+)"/g) || []).map(s => s.slice(9, -1)).filter((v, i, a) => a.indexOf(v) === i && /^(Organization|LocalBusiness|WebSite|SoftwareApplication|Product|FAQPage|BreadcrumbList|Restaurant|SportsActivityLocation)$/.test(v)).join(', '));
    add(/property="og:image"/i.test(html), 'Share preview (Open Graph)', ''); add(/name="viewport"/i.test(html), 'Works on phones (viewport)', '');
    add(wc >= 600, 'Words on the page', `${wc} words`, wc >= 300); add(!noAlt, 'Image descriptions (alt)', noAlt ? `${noAlt} of ${imgs.length} images have none` : `${imgs.length} images`);
    add(opts.base.startsWith('https'), 'HTTPS', opts.base); add(!/noindex/i.test(one(/<meta name="robots" content="([^"]*)"/i)), 'Google allowed to index', '');
    (words || []).forEach(w => add(low.includes(w.toLowerCase()), `Mentions "${w}"`, low.includes(w.toLowerCase()) ? 'found' : 'missing', true));
    return { score: Math.round(R.filter(r => r.ok === 'ok').length * 100 / R.length), items: R, title, desc, words: wc };
  }
  const last = () => ({ google: C['g28' + (S().gsc.sa ? site() : '')] ? C['g28' + site()].v : null, backlinks: C.bl ? C.bl.v : null, psiMobile: C.psimobile ? C.psimobile.v : null, psiDesktop: C.psidesktop ? C.psidesktop.v : null, inspect: C['inspect' + opts.base + '/'] ? C['inspect' + opts.base + '/'].v : null });
  return { sites, google, submitSitemap, inspect, backlinks, pagespeed, check, last, site, clientEmail: () => { try { const k = sa(); return k ? k.client_email : ''; } catch (_) { return 'invalid'; } } };
}
module.exports = { SEO };
