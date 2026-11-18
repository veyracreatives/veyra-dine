/* Veyra Dine In mini games: three original one-thumb games guests play while the food is cooking.
   VDGames.play(el, id, { accent, onOver(score, ms) }) draws the game into el and returns { stop() }.
   Used by the guest menu (scores go to the restaurant's leaderboard) and by the landing page demo. */
(function () {
  const LIST = [
    { id: 'stack', name: 'Chai Stack', how: 'Tap to drop each layer. Only the part that lands on the stack stays. It gets faster every layer. 5 perfect drops in a row make the layer grow back.' },
    { id: 'catch', name: 'Roti Catch', how: 'Slide the plate to catch rotis and laddoos. Dodge the chillies. Miss a roti or catch a chilli and you lose a life.' },
    { id: 'tap', name: 'Spice Rush', how: 'Tap the glowing jar before it fades. Never tap a red chilli jar. Every hit makes the next one quicker.' },
  ];
  const css = `.vg-wrap{position:relative;width:100%;max-width:380px;margin:0 auto;aspect-ratio:3/4;border-radius:18px;overflow:hidden;background:#1B1714;touch-action:none;user-select:none;-webkit-user-select:none}
.vg-wrap canvas{width:100%;height:100%;display:block}
.vg-hud{position:absolute;left:0;right:0;top:0;display:flex;justify-content:space-between;padding:10px 14px;color:#fff;font:800 15px/1 system-ui,sans-serif;pointer-events:none;text-shadow:0 1px 3px rgba(0,0,0,.4)}
.vg-hud b{font-size:26px}
.vg-msg[hidden]{display:none}
.vg-msg{position:absolute;inset:0;display:grid;place-items:center;text-align:center;color:#fff;font:700 17px/1.4 system-ui,sans-serif;padding:24px;background:rgba(27,23,20,.55);pointer-events:none}
.vg-msg big{display:block;font-size:30px;font-weight:800;margin-bottom:6px}`;
  if (!document.getElementById('vg-css')) { const s = document.createElement('style'); s.id = 'vg-css'; s.textContent = css; document.head.appendChild(s); }

  function shade(hex, f) { const n = parseInt(hex.slice(1), 16); let r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255; const t = f < 0 ? 0 : 255, p = Math.abs(f); r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b); return `rgb(${r},${g},${b})`; }

  function play(el, gameId, opt = {}) {
    const accent = /^#[0-9a-f]{6}$/i.test(opt.accent || '') ? opt.accent : '#E4572E';
    el.innerHTML = '<div class="vg-wrap"><canvas></canvas><div class="vg-hud"><span>Score <b data-s>0</b></span><span data-x></span></div><div class="vg-msg" data-m hidden></div></div>';
    const wrap = el.firstChild, cv = wrap.querySelector('canvas'), ctx = cv.getContext('2d');
    const sEl = wrap.querySelector('[data-s]'), xEl = wrap.querySelector('[data-x]'), mEl = wrap.querySelector('[data-m]');
    let W = 0, H = 0, dpr = 1;
    const size = () => { const r = wrap.getBoundingClientRect(); dpr = Math.min(devicePixelRatio || 1, 2); W = r.width; H = r.height; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    size();
    let raf = 0, last = 0, over = false, score = 0, t0 = performance.now(), stopped = false;
    const setScore = v => { score = v; sEl.textContent = v; };
    const msg = h => { mEl.innerHTML = h; mEl.hidden = !h; };
    const end = () => { if (over) return; over = true; const ms = Math.round(performance.now() - t0); msg(`<div><big>${score}</big>Game over</div>`); try { navigator.vibrate && navigator.vibrate(120); } catch (e) {} setTimeout(() => !stopped && opt.onOver && opt.onOver(score, ms), 700); };
    const game = GAMES[gameId](ctx, () => ({ W, H }), { accent, setScore, getScore: () => score, end, xEl });
    const loop = now => { const dt = Math.min(50, now - (last || now)) / 16.667; last = now; if (!over) game.step(dt); game.draw(); if (!over) raf = requestAnimationFrame(loop); };
    const down = e => { if (over) return; e.preventDefault(); const r = cv.getBoundingClientRect(); game.down && game.down(e.clientX - r.left, e.clientY - r.top); };
    const move = e => { if (over) return; const r = cv.getBoundingClientRect(); game.move && game.move(e.clientX - r.left, e.clientY - r.top); };
    cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move);
    const key = e => { if (e.code === 'Space' && !over && game.down && gameId === 'stack') { e.preventDefault(); game.down(0, 0); } };
    addEventListener('keydown', key);
    const ro = 'ResizeObserver' in window ? new ResizeObserver(() => { size(); game.resize && game.resize(); }) : null; ro && ro.observe(wrap);
    raf = requestAnimationFrame(loop);
    return { stop() { stopped = true; over = true; cancelAnimationFrame(raf); removeEventListener('keydown', key); ro && ro.disconnect(); } };
  }

  const GAMES = {
    // ---- Chai Stack: timing game, the moving layer gets faster and narrower ----
    stack(ctx, dim, g) {
      const LH = 22; let blocks, cur, dir, cam, camT, perfect, flash, chips, w0, grew;
      const reset = () => { const { W } = dim(); const w = W * 0.62; w0 = w; grew = 0; blocks = [{ x: (W - w) / 2, w }]; dir = 1; cam = 0; camT = 0; perfect = 0; flash = 0; chips = []; next(); };
      const speed = () => Math.min(11, 2.6 + g.getScore() * 0.32);
      const next = () => { const top = blocks[blocks.length - 1]; const { W } = dim(); dir = blocks.length % 2 ? 1 : -1; cur = { x: dir > 0 ? -top.w : W, w: top.w }; };
      reset();
      return {
        step(dt) {
          const { W } = dim(); cur.x += dir * speed() * dt;
          if (cur.x > W) dir = -1; if (cur.x + cur.w < 0) dir = 1;
          cam += (camT - cam) * 0.12 * dt; flash = Math.max(0, flash - 0.05 * dt);
          chips.forEach(c => { c.vy += 0.5 * dt; c.y += c.vy * dt; }); chips = chips.filter(c => c.y < 2000);
        },
        down() {
          const top = blocks[blocks.length - 1]; const l = Math.max(cur.x, top.x), r = Math.min(cur.x + cur.w, top.x + top.w);
          const { H } = dim(); const yTop = H - 40 - blocks.length * LH + cam;
          if (r - l <= 0) { chips.push({ x: cur.x, w: cur.w, y: yTop, vy: 0 }); g.end(); return; }
          if (Math.abs(cur.x - top.x) < 4) { cur.x = top.x; perfect++; flash = 1; grew = 0;
            // combo: every 5 perfect drops in a row, the layer grows back by half of what was cut off (never wider than the first layer)
            if (perfect % 5 === 0 && cur.w < w0) { const add = Math.min(w0 - cur.w, Math.max(14, (w0 - cur.w) * 0.5)); const { W } = dim(); cur.x = Math.max(0, Math.min(W - (cur.w + add), cur.x - add / 2)); cur.w += add; grew = add; flash = 1.6; } }
          else { perfect = 0; grew = 0; const cutX = cur.x < top.x ? cur.x : r; chips.push({ x: cutX, w: cur.w - (r - l), y: yTop, vy: 0 }); cur.x = l; cur.w = r - l; }
          blocks.push({ x: cur.x, w: cur.w }); g.setScore(blocks.length - 1);
          if (blocks.length > 8) camT = (blocks.length - 8) * LH;
          try { navigator.vibrate && navigator.vibrate(8); } catch (e) {}
          next();
        },
        draw() {
          const { W, H } = dim(); const grd = ctx.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, '#2A211C'); grd.addColorStop(1, '#1B1714'); ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
          const base = H - 40 + cam;
          const layer = (b, i, y) => { ctx.fillStyle = i % 2 ? shade(g.accent, 0.25) : g.accent; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(b.x, y, b.w, LH - 2, 5) : ctx.rect(b.x, y, b.w, LH - 2); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(b.x + 3, y + 3, Math.max(0, b.w - 6), 3); };
          blocks.forEach((b, i) => { const y = base - (i + 1) * LH; if (y < H + LH) layer(b, i, y); });
          ctx.fillStyle = '#3A2F28'; ctx.fillRect(0, base, W, H);
          if (cur) layer(cur, blocks.length, base - (blocks.length + 1) * LH);
          ctx.globalAlpha = .6; chips.forEach(c => { ctx.fillStyle = shade(g.accent, -0.3); ctx.fillRect(c.x, c.y + cam * 0, c.w, LH - 2); }); ctx.globalAlpha = 1;
          if (flash > 0) { ctx.fillStyle = grew ? `rgba(255,214,120,${Math.min(1, flash * 0.7)})` : `rgba(255,255,255,${flash * 0.5})`; ctx.font = '800 18px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.fillText(grew ? `${perfect} PERFECT! Layer grows` : 'PERFECT', W / 2, 70); }
          g.xEl.textContent = perfect ? `Perfect ×${perfect}${perfect % 5 ? ` · ${5 - perfect % 5} to grow` : ''}` : '';
        },
        resize() {},
      };
    },
    // ---- Roti Catch: move the plate, catch good food, avoid chillies, 3 lives ----
    catch(ctx, dim, g) {
      let px = dim().W / 2, items = [], spawnT = 0, lives = 3, hitFx = 0, pop = [], elapsed = 0;
      const lvl = () => g.getScore();
      const drawRoti = (x, y, r) => { ctx.fillStyle = '#E8B66B'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.fillStyle = '#B9803A'; [[-.4, -.2], [.3, .1], [-.1, .4], [.35, -.35]].forEach(([a, b]) => { ctx.beginPath(); ctx.arc(x + a * r, y + b * r, r * .12, 0, 7); ctx.fill(); }); };
      const drawLaddoo = (x, y, r) => { const gr = ctx.createRadialGradient(x - r * .3, y - r * .3, 1, x, y, r); gr.addColorStop(0, '#FFD27A'); gr.addColorStop(1, '#E08A1E'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, r * .8, 0, 7); ctx.fill(); };
      const drawChilli = (x, y, r, t) => { ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t / 8) * .5); ctx.fillStyle = '#D72222'; ctx.beginPath(); ctx.ellipse(0, 0, r * .35, r, .3, 0, 7); ctx.fill(); ctx.fillStyle = '#1F8A3B'; ctx.fillRect(-r * .1 + r * .3, -r * 1.1, r * .2, r * .35); ctx.restore(); };
      return {
        step(dt) {
          const { W, H } = dim(); elapsed += dt;
          spawnT -= dt * 16.667; const every = Math.max(330, 900 - lvl() * 14);
          if (spawnT <= 0) { spawnT = every; const rnd = Math.random(); const bad = Math.min(.42, .14 + lvl() * .006); const type = rnd < bad ? 'chilli' : rnd < bad + .08 ? 'laddoo' : 'roti'; items.push({ type, x: 24 + Math.random() * (W - 48), y: -20, v: (2.2 + lvl() * .055) * (type === 'chilli' ? 1.15 : 1) * (.9 + Math.random() * .3), drift: type === 'chilli' && lvl() > 15 ? (Math.random() - .5) * 1.4 : 0 }); }
          const plateY = H - 46, pw = Math.max(54, 92 - lvl() * .5);
          items.forEach(it => { it.y += it.v * dt; it.x += it.drift * dt; if (it.x < 18 || it.x > W - 18) it.drift *= -1;
            if (!it.done && it.y > plateY - 10 && it.y < plateY + 14 && Math.abs(it.x - px) < pw / 2 + 10) { it.done = true;
              if (it.type === 'chilli') { lives--; hitFx = 1; try { navigator.vibrate && navigator.vibrate(60); } catch (e) {} } else { g.setScore(g.getScore() + (it.type === 'laddoo' ? 3 : 1)); pop.push({ x: it.x, y: plateY - 20, t: 1, s: it.type === 'laddoo' ? '+3' : '+1' }); } }
            if (!it.done && it.y > H + 20) { it.done = true; if (it.type !== 'chilli') { lives--; hitFx = 1; } } });
          items = items.filter(it => !it.done); pop.forEach(p => { p.t -= .03 * dt; p.y -= 1 * dt; }); pop = pop.filter(p => p.t > 0);
          hitFx = Math.max(0, hitFx - .05 * dt); if (lives <= 0) g.end();
        },
        down(x) { px = x; }, move(x) { px = x; },
        draw() {
          const { W, H } = dim(); ctx.fillStyle = '#1B1714'; ctx.fillRect(0, 0, W, H);
          if (hitFx) { ctx.fillStyle = `rgba(215,34,34,${hitFx * .35})`; ctx.fillRect(0, 0, W, H); }
          items.forEach(it => it.type === 'roti' ? drawRoti(it.x, it.y, 17) : it.type === 'laddoo' ? drawLaddoo(it.x, it.y, 16) : drawChilli(it.x, it.y, 16, it.y));
          const plateY = H - 46, pw = Math.max(54, 92 - lvl() * .5);
          ctx.fillStyle = '#F3EBDD'; ctx.beginPath(); ctx.ellipse(px, plateY, pw / 2 + 8, 11, 0, 0, 7); ctx.fill(); ctx.fillStyle = g.accent; ctx.beginPath(); ctx.ellipse(px, plateY, pw / 2, 6, 0, 0, 7); ctx.fill();
          ctx.font = '800 16px system-ui,sans-serif'; ctx.textAlign = 'center'; pop.forEach(p => { ctx.fillStyle = `rgba(255,214,140,${p.t})`; ctx.fillText(p.s, p.x, p.y); });
          g.xEl.textContent = '♥'.repeat(Math.max(0, lives)) + '♡'.repeat(3 - Math.max(0, lives));
        },
      };
    },
    // ---- Spice Rush: reflex grid, window shrinks after each hit, decoy chilli jars later ----
    tap(ctx, dim, g) {
      let target = -1, decoys = [], left = 0, windowMs = 1150, fx = [], wait = 400;
      const cell = () => { const { W, H } = dim(); const s = Math.min(W, H - 60) / 3; return { s, ox: (W - s * 3) / 2, oy: 60 + (H - 60 - s * 3) / 2 }; };
      const pick = () => { const n = g.getScore(); target = Math.floor(Math.random() * 9); decoys = []; const nd = n >= 30 ? 2 : n >= 10 ? 1 : 0; while (decoys.length < nd) { const d = Math.floor(Math.random() * 9); if (d !== target && !decoys.includes(d)) decoys.push(d); } left = windowMs; };
      return {
        step(dt) { const ms = dt * 16.667; if (target < 0) { wait -= ms; if (wait <= 0) pick(); return; } left -= ms; if (left <= 0) { fx.push({ i: target, c: '#D72222', t: 1 }); g.end(); } fx.forEach(f => f.t -= .06 * dt); fx = fx.filter(f => f.t > 0); },
        down(x, y) {
          if (target < 0) return; const { s, ox, oy } = cell(); const cx = Math.floor((x - ox) / s), cy = Math.floor((y - oy) / s); if (cx < 0 || cx > 2 || cy < 0 || cy > 2) return; const i = cy * 3 + cx;
          if (i === target) { fx.push({ i, c: '#FFD27A', t: 1 }); g.setScore(g.getScore() + 1); windowMs = Math.max(300, windowMs * .955); target = -1; wait = 90 + Math.random() * 260; try { navigator.vibrate && navigator.vibrate(8); } catch (e) {} }
          else { fx.push({ i, c: '#D72222', t: 1 }); g.end(); }
        },
        draw() {
          const { W, H } = dim(); ctx.fillStyle = '#1B1714'; ctx.fillRect(0, 0, W, H); const { s, ox, oy } = cell();
          for (let i = 0; i < 9; i++) { const x = ox + (i % 3) * s, y = oy + Math.floor(i / 3) * s, cx = x + s / 2, cy = y + s / 2, r = s * .34;
            ctx.fillStyle = '#2C241F'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
            if (i === target) { const k = Math.max(0, left / windowMs); ctx.fillStyle = g.accent; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill(); ctx.strokeStyle = '#FFD27A'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(cx, cy, r + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); ctx.stroke(); }
            if (decoys.includes(i)) { ctx.fillStyle = '#7A1414'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill(); ctx.fillStyle = '#D72222'; ctx.beginPath(); ctx.ellipse(cx, cy, r * .2, r * .6, .5, 0, 7); ctx.fill(); }
            fx.forEach(f => { if (f.i === i) { ctx.strokeStyle = f.c; ctx.globalAlpha = f.t; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy, r + (1 - f.t) * 20, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; } }); }
          g.xEl.textContent = target < 0 ? '' : (left / 1000).toFixed(2) + 's';
        },
      };
    },
  };
  window.VDGames = { list: LIST, play };
})();
