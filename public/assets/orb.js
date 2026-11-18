// Fluid orb: WebGL shader adapted from rare-ui "fluid-orb". Light on phones: low pixel ratio, pauses off-screen,
// and a still frame for weak devices, data saver or reduced motion.
(function () {
  const VERT = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  const FRAG = 'precision mediump float;uniform vec2 r;uniform float t;uniform vec3 c;uniform vec3 w;' +
    'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}' +
    'float n(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),u.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),u.x),u.y);}' +
    'float fb(vec2 p){float v=0.,a=.6;for(int i=0;i<3;i++){v+=a*n(p);p*=2.;a*=.5;}return v;}' +
    'void main(){vec2 uv=gl_FragCoord.xy/r;float s=t*.22;vec2 d=vec2(sin(s)+.6*sin(s*1.7+1.3),cos(s*.8)+.6*cos(s*1.3+2.1));' +
    'vec2 p=vec2(uv.x*1.8,uv.y)+d*.7;vec2 q=vec2(fb(p+d),fb(p+vec2(3.2,1.5)-d));float f=fb(p+1.2*q);' +
    'float g=clamp(1.-uv.y,0.,1.);float an=smoothstep(0.,.3,uv.y);float sh=clamp(g+(f-.5)*.8*an,0.,1.);' +
    'vec3 col=w;col=mix(col,mix(w,c,.5),smoothstep(.28,.52,sh));col=mix(col,c,smoothstep(.58,.88,sh));' +
    'float e=smoothstep(.5,.49,distance(uv,vec2(.5)));gl_FragColor=vec4(col*e,e);}';
  const nv = navigator, weak = (nv.hardwareConcurrency && nv.hardwareConcurrency <= 4) || (nv.deviceMemory && nv.deviceMemory <= 3) || (nv.connection && nv.connection.saveData);
  const reduce = (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) || weak;
  const rgb = hx => { const v = parseInt(String(hx || '#E4572E').replace('#', '').slice(0, 6), 16); return [(v >> 16 & 255) / 255, (v >> 8 & 255) / 255, (v & 255) / 255]; };
  const orbs = []; const t0 = performance.now(); let raf = 0, io = null;
  const loop = now => { raf = 0; let any = false; for (let i = orbs.length - 1; i >= 0; i--) { const o = orbs[i]; if (!o.el.isConnected) { o.gl.getExtension('WEBGL_lose_context') && o.gl.getExtension('WEBGL_lose_context').loseContext(); orbs.splice(i, 1); continue; } if (o.on) { o.draw((now - t0) / 1000); any = true; } } if (any && !document.hidden) raf = requestAnimationFrame(loop); };
  const kick = () => { if (!raf && !reduce && orbs.length) raf = requestAnimationFrame(loop); };
  document.addEventListener('visibilitychange', kick);
  function mount(el, opts = {}) {
    if (!el || el.dataset.orbOn) return; el.dataset.orbOn = '1';
    el.style.setProperty('--orb-c', opts.color || '#E4572E');
    const cv = document.createElement('canvas'); el.appendChild(cv);
    let gl = null; try { gl = cv.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: 'low-power' }); } catch {}
    const fail = () => { el.classList.add('noGL'); cv.remove(); };
    if (!gl) return fail();
    const sh = (type, src) => { const x = gl.createShader(type); gl.shaderSource(x, src); gl.compileShader(x); return gl.getShaderParameter(x, gl.COMPILE_STATUS) ? x : null; };
    const pr = gl.createProgram(), v = sh(gl.VERTEX_SHADER, VERT), f = sh(gl.FRAGMENT_SHADER, FRAG);
    if (!v || !f) return fail();
    gl.attachShader(pr, v); gl.attachShader(pr, f); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return fail();
    gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const a = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    gl.uniform3f(gl.getUniformLocation(pr, 'c'), ...rgb(opts.color));
    gl.uniform3f(gl.getUniformLocation(pr, 'w'), ...rgb(opts.light || '#FFF4E6'));
    const o = { el, gl, uR: gl.getUniformLocation(pr, 'r'), uT: gl.getUniformLocation(pr, 't'), on: true, px: 0 };
    o.draw = tm => { const d = Math.min(devicePixelRatio || 1, innerWidth < 700 ? 1.25 : 2), px = Math.round(el.clientWidth * d); if (px && px !== o.px) { o.px = cv.width = cv.height = px; gl.viewport(0, 0, px, px); gl.uniform2f(o.uR, px, px); } gl.uniform1f(o.uT, tm); gl.drawArrays(gl.TRIANGLES, 0, 6); };
    orbs.push(o); o.draw(reduce ? 4 : (performance.now() - t0) / 1000);
    if (reduce) return;
    if ('IntersectionObserver' in window) { io = io || new IntersectionObserver(es => { es.forEach(e => { const x = orbs.find(y => y.el === e.target); if (x) x.on = e.isIntersecting; }); kick(); }); io.observe(el); }
    kick();
  }
  window.VDOrb = { mount };
})();
