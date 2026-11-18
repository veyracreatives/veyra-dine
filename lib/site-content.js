// Landing page content edited in Veyra HQ. The built page (public/site/index.html) marks editable text and
// images with data-k="..."; content.json lists them. Edits are stored in the database (data/), so they
// survive app updates, and are applied every time the page is served.
'use strict';
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const PREFIX = /^(\s*(?:<span class="bi">[\s\S]*?<\/span>|<svg\b[\s\S]*?<\/svg>)\s*)/;
const inr = n => '₹' + Number(n).toLocaleString('en-IN');
const safeUrl = u => /^(https?:\/\/|\/|#|mailto:|tel:)/.test(String(u || '')) ? String(u) : '';

function render(html, C, stock) {
  if (!C) return html;
  const T = C.texts || {};
  for (const k of Object.keys(T)) {
    if (!/^[a-z0-9]+$/.test(k)) continue;
    const v = T[k] || {};
    if (!v.hidden && (v.text == null || v.text === '')) continue;
    const re = new RegExp(`(<(\\w+)\\b[^>]*\\sdata-k="${k}"[^>]*>)([\\s\\S]*?)(</\\2>)`, 'g');
    html = html.replace(re, (all, open, tag, inner, close) => {
      if (v.hidden) return '';
      if (k === 'hero') return open + String(v.text).trim().split(/\s+/).map((w, i) => `<span class="w" style="--i:${i}">${esc(w)}</span>`).join(' ') + close;
      const pre = (inner.match(PREFIX) || [''])[0];
      return open + pre + esc(v.text).replace(/\n/g, '<br>') + close;
    });
  }
  for (const [k, url] of Object.entries(C.images || {})) {
    if (!/^[a-z0-9]+$/.test(k) || !safeUrl(url)) continue;
    html = html.replace(new RegExp(`<img data-k="${k}"[^>]*>`, 'g'), tag => tag.replace(/\ssrc="[^"]*"/, ` src="${esc(url)}"`).replace(/\s(width|height)="\d+"/g, ''));
  }
  const P = C.prices || {}, S = (stock && stock.prices) || { lifetime: 14999, yearly: 5999 };
  for (const plan of ['lifetime', 'yearly']) {
    const from = Number(S[plan]), to = Number(P[plan]);
    if (!(to > 0) || to === from) continue;
    html = html.split(inr(from)).join(inr(to)).split(encodeURIComponent(inr(from))).join(encodeURIComponent(inr(to))).split(`"price": "${from}"`).join(`"price": "${to}"`);
  }
  const B = C.banner || {};
  if (B.on && B.text) html = html.replace('<div id="vd-banner" hidden></div>', `<div id="vd-banner">${esc(B.text)}${safeUrl(B.link) ? `<a href="${esc(B.link)}">${esc(B.linkText || 'Learn more')}</a>` : ''}</div>`);
  const TS = (C.testimonials || []).filter(t => t && t.quote);
  if (TS.length) html = html.replace('<!--VD:TESTIMONIALS-->', `<section id="reviews"><div class="wrap"><div class="center rv"><div class="kicker">Restaurants using it</div><h2>${esc(C.testimonialsTitle || 'What owners say')}</h2></div><div class="testi">${TS.map(t => `<figure class="rv"><blockquote>“${esc(t.quote)}”</blockquote><figcaption><b>${esc(t.name)}</b>${esc(t.place || '')}</figcaption></figure>`).join('')}</div></div></section>`);
  const FQ = (C.faqs || []).filter(f => f && f.q && f.a);
  if (FQ.length) html = html.replace('<!--VD:FAQ-->', FQ.map(f => `<details class="rv"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('\n'));
  if (C.logo && safeUrl(C.logo)) {
    html = html.replace(/(<span class="mark" data-logo>)[\s\S]*?(<\/span>)/, `$1<img src="${esc(C.logo)}" alt="">$2`);
    html = html.replace(/<link rel="icon"[^>]*>/g, '').replace('</head>', `<link rel="icon" href="${esc(C.logo)}">\n</head>`);
  }
  return html;
}
module.exports = { render };
