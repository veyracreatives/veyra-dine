/* stroke icons, 24px grid */
(typeof window!=="undefined"?window:globalThis).IC = (function(){
  const p = {
    home:'<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    board:'<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="10" rx="1.5"/><rect x="17" y="4" width="4" height="13" rx="1.5"/>',
    players:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.6c1.9.7 3.1 2.5 3.5 5.4"/>',
    batch:'<circle cx="12" cy="12" r="9"/><path d="m12 7 4 3-1.5 4.5h-5L8 10z"/><path d="M12 3v4M21 10l-5 0M3 10h5M7 20l2.5-5.5M17 20l-2.5-5.5"/>',
    check:'<rect x="3" y="4" width="18" height="17" rx="2.5"/><path d="M3 9h18M8 2v4M16 2v4"/><path d="m8.5 15 2.5 2.5 4.5-5"/>',
    rupee:'<path d="M7 4h11M7 9h11M7 4c6 0 6 5 0 5l8 11"/>',
    bell:'<path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    whistle:'<circle cx="9" cy="14" r="5"/><path d="M13 10.5 21 7v4l-6 2"/><path d="M5 5l2 2M9 3v2.5"/>',
    parent:'<circle cx="8" cy="7" r="3"/><circle cx="17" cy="10" r="2.2"/><path d="M2.5 20c.6-3.8 2.6-6 5.5-6s4.9 2.2 5.5 6"/><path d="M13.6 20c.4-2.7 1.6-4.4 3.4-4.4s3 1.7 3.4 4.4"/>',
    megaphone:'<path d="M3 10v4a1 1 0 0 0 1 1h3l9 5V4L7 9H4a1 1 0 0 0-1 1z"/><path d="M19.5 9a4 4 0 0 1 0 6"/>',
    chart:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    star:'<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    ok:'<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    x:'<path d="M6 6l12 12M18 6 6 18"/>',
    arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>',
    down:'<path d="M12 4v12M6 11l6 6 6-6M5 20h14"/>',
    copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    swap:'<path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
    phone:'<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
    bolt:'<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    code:'<path d="m8 7-5 5 5 5M16 7l5 5-5 5"/>',
    spark:'<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
    shield:'<path d="M12 3 20 6v6c0 5-3.5 8.3-8 9.5C7.5 20.3 4 17 4 12V6z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
    key:'<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M16 7l3 3M14 9l2 2"/>',
    receipt:'<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
    logout:'<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4"/><path d="M10 17l5-5-5-5M15 12H3"/>',
    menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',
    upi:'<path d="m7 3 5 9-5 9M13 3l5 9-5 9"/>',
    mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    chat:'<path d="M4 5h16v11H9l-5 4z"/>',
    trophy:'<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4"/>',
    pin:'<path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>',
    cloud:'<path d="M7 18h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.5 1.5A3.5 3.5 0 0 0 7 18z"/>',
    gift:'<rect x="3" y="8" width="18" height="5" rx="1"/><path d="M5 13v8h14v-8M12 8v13"/><path d="M12 8C10 4 6.5 4.5 7.5 7c.5 1 4.5 1 4.5 1s4 0 4.5-1c1-2.5-2.5-3-4.5 1z"/>',
    eye:'<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    filter:'<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
    calendar:'<rect x="3" y="4" width="18" height="17" rx="2.5"/><path d="M3 9h18M8 2v4M16 2v4"/>',
    google:''
  };
  const ic = (n, cls) => n==='google'
    ? '<svg viewBox="0 0 24 24" aria-hidden="true" class="'+(cls||'')+'"><path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.5c2.1-1.9 3.3-4.7 3.3-8z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.2-2.7l-3.5-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.6H2.2v2.8A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.2a11 11 0 0 0 0 9.8z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3 .6 4.2 1.6l3.1-3.1A11 11 0 0 0 2.2 7.1l3.6 2.8C6.7 7.3 9.1 5.4 12 5.4z"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="'+(cls||'')+'">'+(p[n]||'')+'</svg>';
  const logo = (cls) => '<svg viewBox="0 0 40 40" class="'+(cls||'mk')+'" aria-hidden="true"><rect width="40" height="40" rx="11" style="fill:var(--brand)"/><path d="M20 8.5 29.6 15.3 26 26.6H14L10.4 15.3z" fill="none" style="stroke:var(--brand-ink)" stroke-width="2.4" stroke-linejoin="round"/><path d="m15.6 15.4 4.4 9.6 4.4-9.6" fill="none" style="stroke:var(--brand-ink)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 26.6V31.5M29.6 15.3l3.4-1.4M10.4 15.3 7 13.9" style="stroke:var(--brand-ink)" stroke-width="2.4" stroke-linecap="round"/></svg>';
  return { ic, logo };
})();
