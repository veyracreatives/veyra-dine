// Sign in with Google (Google Identity Services). Shows the button only when the server has a Google Client ID,
// and not inside the Windows app (Google blocks sign-in in embedded app windows).
(function () {
  let cfg = null, lib = null;
  const config = () => cfg || (cfg = fetch('/api/auth/config').then(r => r.json()).catch(() => ({})));
  const load = () => lib || (lib = new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = ok; s.onerror = no; document.head.append(s); }));
  window.VDGoogle = {
    async mount(el, onCredential, opts) {
      opts = opts || {};
      if (!el || /Electron/i.test(navigator.userAgent)) return false;
      const c = await config(); if (!c.googleClientId) return false;
      try { await load(); } catch { return false; }
      google.accounts.id.initialize({ client_id: c.googleClientId, callback: r => onCredential(r.credential), ux_mode: 'popup' });
      el.hidden = false;
      const box = el.querySelector('.gbtn') || el;
      google.accounts.id.renderButton(box, { theme: 'outline', size: 'large', shape: 'pill', text: opts.text || 'continue_with', width: Math.min(360, (box.clientWidth || 320)), logo_alignment: 'center' });
      return true;
    },
  };
})();
