const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader','--enable-unsafe-swiftshader'] });
  const file = process.argv[2] || 'samples/bracket.step';
  for (const [w,h] of (process.argv[3]? JSON.parse(process.argv[3]) : [[1600,900],[1280,800],[1000,760],[420,860]])) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    const errs=[]; p.on('pageerror', e=>errs.push(e.message)); p.on('console', m=>{ if(m.type()==='error') errs.push(m.text()); });
    await p.goto('http://localhost:8765/index.html');
    await p.setInputFiles('#fileIn', file);
    await p.waitForFunction(() => document.querySelector('#btnPdf') && !document.querySelector('#btnPdf').disabled, null, { timeout: 60000 }).catch(e=>errs.push('timeout'));
    if (process.argv[4]) await p.evaluate(s=>{document.querySelector('#selClampView').value=s; document.querySelector('#selClampView').dispatchEvent(new Event('change'));}, process.argv[4]);
    await p.waitForTimeout(800);
    await p.screenshot({ path: `/tmp/claude-0/shot-${w}.png`, fullPage: w < 800 });
    console.log(w, errs.join(' | ') || 'ok');
    await p.close();
  }
  await b.close();
})();
