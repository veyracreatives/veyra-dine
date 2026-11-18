// Tiny SMTP sender (no extra packages). Port 465 = TLS from the start, 587/25 = STARTTLS.
// Used for password reset codes. Settings come from /platform > Email (host, port, user, password, from).
const net = require('net');
const tls = require('tls');
const os = require('os');

function send(cfg, { to, subject, text, html }) {
  return new Promise((resolve, reject) => {
    const port = Number(cfg.port) || 465, secure = cfg.secure != null ? !!cfg.secure : port === 465;
    let sock, buf = '', step = 0, done = false;
    const fromAddr = (/<([^>]+)>/.exec(cfg.from || '') || [])[1] || cfg.from || cfg.user;
    const fail = e => { if (done) return; done = true; try { sock.destroy(); } catch {} reject(e instanceof Error ? e : new Error(String(e))); };
    const timer = setTimeout(() => fail(new Error('Email server did not answer in time')), 20000);
    const write = l => sock.write(l + '\r\n');
    const b64 = s => Buffer.from(String(s), 'utf8').toString('base64');
    const hdr = s => /^[\x20-\x7e]*$/.test(s) ? s : '=?UTF-8?B?' + b64(s) + '?=';
    const boundary = 'vd' + Date.now().toString(36);
    const body = [
      `From: ${cfg.from || cfg.user}`, `To: ${to}`, `Subject: ${hdr(subject)}`, `Date: ${new Date().toUTCString()}`,
      `Message-ID: <${Date.now().toString(36)}.${Math.random().toString(36).slice(2)}@${(fromAddr.split('@')[1] || 'localhost')}>`,
      'MIME-Version: 1.0', `Content-Type: multipart/alternative; boundary="${boundary}"`, '',
      `--${boundary}`, 'Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: base64', '', b64(text).replace(/.{76}/g, '$&\r\n'),
      ...(html ? [`--${boundary}`, 'Content-Type: text/html; charset=utf-8', 'Content-Transfer-Encoding: base64', '', b64(html).replace(/.{76}/g, '$&\r\n')] : []),
      `--${boundary}--`, '',
    ].join('\r\n');
    const helo = 'EHLO ' + (os.hostname() || 'localhost');
    // each step: what to send after a reply with the expected code
    const steps = [
      [220, () => write(helo)],
      [250, () => { if (!secure && !(sock instanceof tls.TLSSocket)) { write('STARTTLS'); return 'tls'; } write('AUTH LOGIN'); }],
      [334, () => write(b64(cfg.user))],
      [334, () => write(b64(cfg.pass))],
      [235, () => write(`MAIL FROM:<${fromAddr}>`)],
      [250, () => write(`RCPT TO:<${to}>`)],
      [250, () => write('DATA')],
      [354, () => { sock.write(body.replace(/^\./gm, '..') + '\r\n.\r\n'); }],
      [250, () => { write('QUIT'); done = true; clearTimeout(timer); resolve(true); }],
    ];
    const onLine = line => {
      if (/^\d{3}-/.test(line)) return; // more lines follow
      const code = +line.slice(0, 3), [want, act] = steps[step] || [];
      if (code !== want) return fail(new Error(code === 535 ? 'Email login failed. Check the email address and app password.' : 'Email server said: ' + line.slice(0, 160)));
      const r = act(); step++;
      if (r === 'tls') { // wait for 220 to STARTTLS, then upgrade and say hello again
        steps.splice(step, 0, [220, () => { const raw = sock; raw.removeAllListeners('data'); sock = tls.connect({ socket: raw, servername: cfg.host }, () => write(helo)); attach(); }], [250, () => { write('AUTH LOGIN'); }]);
      }
    };
    const attach = () => { buf = ''; sock.on('data', d => { buf += d.toString('utf8'); let i; while ((i = buf.indexOf('\r\n')) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 2); onLine(l); } }); sock.on('error', fail); };
    sock = secure ? tls.connect({ host: cfg.host, port, servername: cfg.host }) : net.connect({ host: cfg.host, port });
    attach();
  });
}

module.exports = { send };
