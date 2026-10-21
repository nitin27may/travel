// Behaviour checks against the fixture. Setup as in shoot.mjs; run the dev server with NEXT_PUBLIC_GOOGLE_MAPS_KEY=fake-key.
// Covers: Google facade loads no script before the click, links use our points, embed iframe, mixed-family errors, theme switch keeps the camera.
import { chromium } from '@playwright/test';
const b = await chromium.launch({ args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const base='http://localhost:3402/map-fixture-lm/';
async function open(q, opts={}) { const ctx = await b.newContext({viewport:{width:1280,height:800}, ...opts}); const p = await ctx.newPage(); const reqs=[]; p.on('request', r=>reqs.push(r.url())); const errs=[]; p.on('pageerror', e=>errs.push(e.message)); p.on('console', m=>{ if(m.type()==='error') errs.push(m.text()); }); await p.goto(base+q); return {p, reqs, errs, ctx}; }

// 5: facade
let {p, reqs} = await open('?scene=dolomites&family=google-js&theme=light');
await p.waitForTimeout(2500);
console.log('facade shown', await p.locator('[data-map-facade]').count(), 'google reqs before click', reqs.filter(u=>/googleapis|google\.com\/maps/.test(u)).length, 'maplibre canvas', await p.locator('canvas').count());
console.log('links', await p.locator('[data-map-links] a').evaluateAll(a=>a.map(x=>x.href)));
await p.screenshot({path:'map-shots/facade-light.png'});
await p.click('text=Load Google map'); await p.waitForTimeout(2500);
console.log('google reqs after click', reqs.filter(u=>/maps\/api\/js/.test(u)).length);
await p.context().close();
// embed
({p, reqs} = await open('?scene=trail&family=google-embed&theme=dark')); await p.waitForTimeout(2500);
console.log('embed iframe', await p.locator('iframe').getAttribute('src'), await p.locator('iframe').getAttribute('title'), await p.locator('iframe').getAttribute('loading'));
await p.screenshot({path:'map-shots/embed-dark.png'}); await p.context().close();
// mix
for (const s of ['mix','mix2']) { let r = await open('?scene='+s); await r.p.waitForTimeout(3000); const txt = await r.p.locator('body').innerText(); console.log(s, 'errors:', r.errs.some(e=>/map famil|MapFamilyProvider/.test(e)) || /map famil|MapFamilyProvider/i.test(txt)); await r.ctx.close(); }
// theme switch keeps camera
({p} = await open('?scene=dolomites&c=12.2,46.6,9.5&theme=light')); await p.waitForTimeout(7000);
const style = () => p.locator('[data-map-style]').getAttribute('data-map-style');
console.log('style', await style());
await p.evaluate(()=>{document.documentElement.classList.remove('fx-light','light'); document.documentElement.classList.add('fx-dark','dark');});
await p.waitForTimeout(6000);
console.log('style after', await style());
await p.screenshot({path:'map-shots/camera-switched.png'});
await p.context().close();
// reduced motion: fly click -> instant
({p} = await open('?scene=dolomites&theme=light', {reducedMotion:'reduce'})); await p.waitForTimeout(7000);
await p.click('text=fly to Braies'); await p.waitForTimeout(150);
await p.screenshot({path:'map-shots/reduced-after150ms.png'});
await b.close();
