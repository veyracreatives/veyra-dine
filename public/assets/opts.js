// Dish options (spice level, Jain, portion, add-ons): the same rules as the server, plus the picker people see.
// Used by the guest menu, the admin "Take order" screen and the waiter app.
(function () {
  const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const groups = it => (it && Array.isArray(it.options) ? it.options.filter(g => g && g.name && Array.isArray(g.choices) && g.choices.length) : []);
  const has = it => groups(it).length > 0;
  // sel: chosen choice ids. Returns { ids, label, extra, error }.
  function pick(it, sel) {
    const want = Array.isArray(sel) ? sel.map(String) : [];
    const ids = [], names = []; let extra = 0;
    for (const g of groups(it)) {
      let got = g.choices.filter(c => want.includes(c.id));
      if (!g.multi) got = got.slice(0, 1); else if (g.max) got = got.slice(0, g.max);
      if (g.req && !got.length) return { ids: [], label: '', extra: 0, error: `Choose ${g.name.toLowerCase()} for ${it.name}` };
      for (const c of got) { ids.push(c.id); names.push(c.name); extra += Number(c.price) || 0; }
    }
    return { ids, label: names.join(', '), extra: r2(extra) };
  }
  const unit = (it, sel) => Math.max(0, r2((Number(it.price) || 0) + pick(it, sel).extra));
  const key = (id, ids) => id + (ids && ids.length ? '~' + ids.join('.') : '');
  const fromKey = k => { const [id, o] = String(k).split('~'); return { id, ids: o ? o.split('.') : [] }; };
  // the first choice of a "pick one" group is ticked to start with, so a quick order is two taps
  const defaults = it => groups(it).filter(g => !g.multi && g.req).map(g => g.choices[0].id);
  const plus = (p, cur) => { p = Number(p) || 0; return p > 0 ? '+' + cur(p) : p < 0 ? '−' + cur(-p) : ''; };
  // the picker: one block per group, radio buttons for "pick one", tick boxes for "pick any"
  function html(it, sel, cur) {
    const on = Array.isArray(sel) ? sel : defaults(it);
    return groups(it).map(g => `<fieldset class="vo-g" data-g="${esc(g.id)}"><legend><b>${esc(g.name)}</b><small>${g.multi ? (g.max ? `Pick up to ${g.max}` : 'Pick any') : 'Pick one'}${g.req ? ' · Required' : ''}</small></legend>
      ${g.choices.map(c => `<label class="vo-c"><input type="${g.multi ? 'checkbox' : 'radio'}" name="vo_${esc(g.id)}" value="${esc(c.id)}" ${on.includes(c.id) ? 'checked' : ''}><span class="vo-n">${esc(c.name)}</span><span class="vo-p">${plus(c.price, cur)}</span></label>`).join('')}</fieldset>`).join('');
  }
  function read(root, it) {
    const out = [];
    for (const g of groups(it)) {
      const box = root.querySelector(`.vo-g[data-g="${g.id}"]`); if (!box) continue;
      const got = [...box.querySelectorAll('input:checked')].map(i => i.value);
      if (g.multi && g.max && got.length > g.max) got.length = g.max;
      out.push(...got);
    }
    return out;
  }
  // "pick up to N": stop more ticks once the limit is reached
  function bindLimits(root, it, onChange) {
    root.addEventListener('change', e => {
      const box = e.target.closest('.vo-g'); if (!box) return;
      const g = groups(it).find(x => x.id === box.dataset.g);
      if (g && g.multi && g.max && box.querySelectorAll('input:checked').length > g.max) { e.target.checked = false; }
      if (onChange) onChange();
    });
  }
  // a small pop-up to choose options and how many (admin and waiter). Resolves to { ids, qty } or null.
  function choose(it, { cur, title, qty = 1, sel } = {}) {
    return new Promise(resolve => {
      const o = document.createElement('div'); o.className = 'overlay center vo-ov';
      o.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" style="max-width:480px"><div class="sheet-head"><div><h3>${esc(title || it.name)}</h3><small class="muted vo-base">${cur(it.price)}</small></div><button type="button" class="icon-btn" data-x aria-label="Close">${window.icon ? icon('x', 20) : '×'}</button></div>
        <div class="sheet-body vo-body">${html(it, sel, cur)}</div>
        <div class="sheet-foot vo-foot"><div class="vo-qty"><button type="button" data-q="-1" aria-label="One less">${window.icon ? icon('minus', 18) : '−'}</button><b>${qty}</b><button type="button" data-q="1" aria-label="One more">${window.icon ? icon('plus', 18) : '+'}</button></div><button type="button" class="btn btn-primary btn-lg vo-add"></button></div></div>`;
      const body = o.querySelector('.vo-body'), add = o.querySelector('.vo-add');
      const done = v => { o.remove(); resolve(v); };
      const draw = () => { const ids = read(body, it), p = pick(it, ids); add.textContent = `Add ${qty} · ${cur(unit(it, ids) * qty)}`; add.dataset.err = p.error || ''; o.querySelector('.vo-qty b').textContent = qty; };
      bindLimits(body, it, draw);
      o.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { qty = Math.max(1, Math.min(99, qty + Number(b.dataset.q))); draw(); });
      o.addEventListener('click', e => { if (e.target === o || e.target.closest('[data-x]')) done(null); });
      add.onclick = () => {
        const ids = read(body, it), p = pick(it, ids);
        if (p.error) { const g = groups(it).find(x => x.req && !ids.some(i => x.choices.some(c => c.id === i))); const box = g && body.querySelector(`.vo-g[data-g="${g.id}"]`); if (box) { box.classList.add('vo-miss'); box.scrollIntoView({ block: 'center', behavior: 'smooth' }); } return; }
        done({ ids: p.ids, qty });
      };
      document.body.appendChild(o); draw();
    });
  }
  window.VDOpt = { groups, has, pick, unit, key, fromKey, defaults, html, read, bindLimits, choose, plus };
})();
