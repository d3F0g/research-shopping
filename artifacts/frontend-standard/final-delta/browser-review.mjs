import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn, execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import net from 'node:net';
const project = '/Users/josiahwong/Documents/research-shopping-shadcn-qa';
const output = '/Users/josiahwong/Documents/research-shopping/artifacts/frontend-standard/final-delta';
const require = createRequire(`${project}/package.json`);
const { chromium, expect } = require('@playwright/test');
const proof = { commit: execFileSync('git', ['rev-parse', 'HEAD'], {cwd:project,encoding:'utf8'}).trim(), worktree: execFileSync('git',['status','--short'],{cwd:project,encoding:'utf8'}), checks: [], errors: [], externalRequests: [], cleanup: false };
const ports = [3673,5773];
const portFree = (port) => new Promise((resolve,reject) => { const s = net.createServer(); s.once('error',reject); s.listen(port,'127.0.0.1',()=>s.close(()=>resolve(true))); });
const labels = {'comfort':'Comfort','sound-quality':'Sound','noise-cancelling':'Noise cancelling','battery-life':'Battery','portability':'Portability','value':'Value'};
const log=[];
let server, browser;
async function overflow(page, label) {
 const widths=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth}));
 assert(widths.document<=widths.viewport && widths.body<=widths.viewport);
 proof.checks.push({label,widths});
}
async function keyboardTo(page, locator) {
 for(let i=0;i<60;i++) {
  if(await locator.evaluate(el=>el===document.activeElement)) return;
  await page.keyboard.press('Tab');
 }
 throw Error('Keyboard target unreachable');
}
try {
 for(const port of ports) await portFree(port);
 server=spawn('npm',['run','dev'],{cwd:project,detached:true,env:{...process.env,API_PORT:'3673',VITE_API_PORT:'3673',WEB_PORT:'5773'},stdio:['ignore','pipe','pipe']});
 proof.serverPid=server.pid;
 server.stdout.on('data',x=>log.push(x.toString()));server.stderr.on('data',x=>log.push(x.toString()));
 for(let i=0;i<120;i++) {
  try {const h=await(await fetch('http://127.0.0.1:5773/api/health')).json();if(h.status==='ok'){proof.health=h;break;}} catch{}
  await new Promise(r=>setTimeout(r,250));
 }
 assert.equal(proof.health?.mode,'fixture');assert.equal(proof.health.liveIntegrations,false);
 browser=await chromium.launch();
 for(const mobile of [false,true]) {
  const name=mobile?'mobile':'desktop';
  const context=await browser.newContext({viewport: mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce'});
  await context.tracing.start({screenshots:true,snapshots:true,sources:true});
  await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.hostname==='127.0.0.1'||['data:','blob:'].includes(u.protocol))return route.continue();proof.externalRequests.push(u.href);return route.abort();});
  const page=await context.newPage();page.on('pageerror',e=>proof.errors.push(e.message));
  await page.goto('http://127.0.0.1:5773');await page.evaluate(()=>document.fonts.ready);
  await expect(page.getByText('FIXTURE MODE',{exact:true})).toBeVisible();
  const initialResponse=page.waitForResponse(r=>r.url().endsWith('/api/turn')&&r.request().method()==='POST');
  await page.getByRole('button',{name:/Wireless headphones for long flights/}).click();
  const initial=await(await initialResponse).json();
  await expect(page.getByRole('heading',{name:'Your shortlist'})).toBeVisible();
  await expect(page.getByText('Sample price · fixture only').first()).toBeVisible();
  await overflow(page,`${name} results`);
  await page.screenshot({path:`${output}/${name}-results.png`,fullPage:true,animations:'disabled'});
  if(mobile) {
   await page.getByRole('button',{name:/Filters and preferences/}).click();
   await expect(page.getByRole('dialog')).toBeVisible();
   await page.screenshot({path:`${output}/mobile-sheet-hard-limits.png`,animations:'disabled'});
  }
  const portability=page.getByRole('checkbox',{name:'Portability',exact:true});
  await expect(portability).toBeChecked();
  const row=portability.locator("xpath=ancestor::*[@data-slot='field'][1]");
  await expect(row.getByLabel('Priority 1')).toBeVisible();
  for(const [index,priority] of initial.preferences.soft.priorities.entries()) {
   assert(labels[priority],`No visible option for ${priority}`);
   const box=page.getByRole('checkbox',{name:labels[priority],exact:true});
   await expect(box).toBeChecked();
   await expect(box.locator("xpath=ancestor::*[@data-slot='field'][1]").getByLabel(`Priority ${index+1}`)).toBeVisible();
  }
  await keyboardTo(page,portability);
  const focus=await portability.evaluate(el=>{const s=getComputedStyle(el);return {outlineWidth:s.outlineWidth,outlineStyle:s.outlineStyle,boxShadow:s.boxShadow,rect:el.getBoundingClientRect().toJSON()};});
  assert(parseFloat(focus.outlineWidth)>0||focus.boxShadow!=='none');
  assert(focus.rect.x>=0&&focus.rect.right<=(mobile?390:1440));
  await overflow(page,`${name} priority editor`);
  await page.screenshot({path:`${output}/${name}-portability-focus.png`,animations:'disabled'});
  await page.keyboard.press('Space');await expect(portability).not.toBeChecked();
  await expect(page.getByLabel('Maximum budget amount')).toHaveValue('500');
  await expect(page.getByRole('checkbox',{name:'Wireless',exact:true})).toBeChecked();
  const update=page.getByRole('button',{name:'Update comparison'});
  await keyboardTo(page,update);
  const changedResponse=page.waitForResponse(r=>r.url().endsWith('/api/turn')&&r.request().method()==='POST');
  await page.keyboard.press('Enter');
  const response=await changedResponse;
  const request=response.request().postDataJSON();
  const changed=await response.json();
  assert.deepEqual(request.preferences.hard,initial.preferences.hard);
  assert.deepEqual(changed.preferences.hard,initial.preferences.hard);
  assert(!request.preferences.soft.priorities.includes('portability'));
  assert(!changed.preferences.soft.priorities.includes('portability'));
  await expect(page.getByRole('heading',{name:'Your shortlist'})).toBeVisible();
  if(mobile) {
   await expect(page.getByRole('dialog')).not.toBeVisible();
   await page.getByRole('button',{name:/Filters and preferences/}).click();
   await expect(page.getByRole('dialog')).toBeVisible();
  }
  await expect(page.getByRole('checkbox',{name:'Portability',exact:true})).not.toBeChecked();
  proof.checks.push({label:`${name} edit`,initialPriorities:initial.preferences.soft.priorities,requestHard:request.preferences.hard,responseHard:changed.preferences.hard,updatedPriorities:changed.preferences.soft.priorities,focus});
  if(mobile) {
   const dialog=page.getByRole('dialog');
   await expect.poll(()=>dialog.evaluate(el=>el.contains(document.activeElement))).toBe(true);
   for(let i=0;i<30;i++){
    await page.keyboard.press('Tab');
    await expect.poll(()=>dialog.evaluate(el=>el.contains(document.activeElement))).toBe(true);
   }
   await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();
   await expect(page.getByRole('button',{name:/Filters and preferences/})).toBeFocused();
  }
  await overflow(page,`${name} updated results`);
  await page.screenshot({path:`${output}/${name}-updated.png`,fullPage:true,animations:'disabled'});
  await context.tracing.stop({path:`${output}/${name}-trace.zip`});await context.close();
 }
 assert.deepEqual(proof.errors,[]);assert.deepEqual(proof.externalRequests,[]);
 proof.result='passed';
} catch(e) {proof.result='failed';proof.failure=e.stack;process.exitCode=1;}
finally {
 if(browser) await browser.close();
 if(server){try{process.kill(-server.pid,'SIGTERM');}catch{};for(let i=0;i<40;i++){try{await Promise.all(ports.map(portFree));proof.cleanup=true;break;}catch{await new Promise(r=>setTimeout(r,100));}}}
 await writeFile(`${output}/browser-server.log`,log.join(''));
 await writeFile(`${output}/proof.json`,JSON.stringify(proof,null,2)+'\n');
 console.log(JSON.stringify(proof,null,2));
 if(!proof.cleanup) process.exitCode=1;
}
