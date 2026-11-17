const { chromium, expect } = require('/Users/josiahwong/Documents/research-shopping-review/node_modules/@playwright/test');
const fs=require('node:fs/promises');
const cp=require('node:child_process');
const base='http://127.0.0.1:5293';
const artifact=process.argv[2]||'/Users/josiahwong/Documents/research-shopping/artifacts/security-review/browser-initial';
(async()=>{
 await fs.mkdir(artifact,{recursive:true});
 const browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 await context.tracing.start({screenshots:true,snapshots:true,sources:true});
 const page=await context.newPage();const observations=[];const external=[];const errors=[];
 page.on('request',r=>{if(!r.url().startsWith(base)&&!r.url().startsWith('data:'))external.push(r.url());});
 page.on('pageerror',e=>errors.push(e.message));
 const prompt=page.getByLabel('Start with the outcome, not a model number.');
 const submit=async(text)=>{await prompt.fill(text);await page.getByRole('button',{name:'Research options',exact:true}).click();};
 try {
 await page.goto(base);await expect(page.getByText('FIXTURE MODE',{exact:true})).toBeVisible();
 await submit('headphones under SGD500');await expect(page.locator('.product-card')).toHaveCount(3);
 await submit("I don't like these. Better battery life");await expect(page.locator('.product-card').first()).toContainText('MOMENTUM 4');await expect(page.getByLabel('Maximum budget amount')).toHaveValue('500');observations.push('Actionable dissatisfaction reprioritizes battery and retains hard SGD500 budget');
 await submit("I don't like these");await expect(page.locator('.clarification-panel')).toContainText('What should improve first');observations.push('Generic dissatisfaction asks targeted clarification');
 await submit('headphones that must be waterproof');await expect(page.getByText('Unresolved hard requirement')).toBeVisible();
 await page.getByRole('button',{name:'Update comparison',exact:true}).click();await expect(page.locator('.product-card')).toHaveCount(0);await expect(page.locator('.clarification-panel')).toBeVisible();observations.push('Pending unsupported hard constraint survives neutral update and prevents cards');
 await page.getByRole('button',{name:'Reset session',exact:false}).click();
 let release;const gate=new Promise(r=>release=r);let seen;const started=new Promise(r=>seen=r);let delayed=true;
 const routeLate=async route=>{if(!delayed)return route.continue();delayed=false;const response=await route.fetch();seen();await gate;await route.fulfill({response}).catch(()=>{});};
 await page.route('**/api/turn',routeLate);
 await page.getByRole('button',{name:/Wireless headphones for long flights/}).click();await started;
 await page.getByRole('button',{name:/A light laptop for writing and travel/}).click();await expect(page.locator('.product-card').first()).toContainText('ASUS');release();await page.waitForTimeout(300);await expect(page.locator('.product-card').first()).toContainText('ASUS');await expect(page.getByLabel('Product type')).toHaveValue('laptops');observations.push('Actually overlapping responses preserve newer laptop turn when older headphones response is released');await page.unroute('**/api/turn',routeLate);
 await page.getByRole('button',{name:'Reset session',exact:false}).click();
 let releaseReset;const resetGate=new Promise(r=>releaseReset=r);let resetSeen;const resetStarted=new Promise(r=>resetSeen=r);
 const routeReset=async route=>{const response=await route.fetch();resetSeen();await resetGate;await route.fulfill({response}).catch(()=>{});};
 await page.route('**/api/turn',routeReset);await page.getByRole('button',{name:/Wireless headphones for long flights/}).click();await resetStarted;await page.getByRole('button',{name:'Reset session',exact:false}).click();releaseReset();await page.waitForTimeout(300);await expect(page.locator('.product-card')).toHaveCount(0);await expect(page.getByLabel('Product type')).toHaveValue('');observations.push('Reset during outstanding turn blocks late results and preferences');await page.unroute('**/api/turn',routeReset);
 await submit('headphones under SGD500');await expect(page.locator('.product-card')).toHaveCount(3);
 const card=page.locator('.product-card').first();await card.getByText('Evidence and limits').click();await expect(card.getByText('CONFLICTING SAMPLE CLAIMS',{exact:true})).toBeVisible();
 await page.screenshot({path:artifact+'/desktop-evidence.png',fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:artifact+'/mobile-evidence.png',fullPage:true});
 const widths=await page.evaluate(()=>({viewport:innerWidth,doc:document.documentElement.scrollWidth,body:document.body.scrollWidth}));expect(widths.doc).toBeLessThanOrEqual(widths.viewport);expect(widths.body).toBeLessThanOrEqual(widths.viewport);observations.push({responsiveWidths:widths});
 const selectionResponse=page.waitForResponse(r=>r.url().endsWith('/api/select')&&r.request().method()==='POST');await card.getByRole('button',{name:'Select this product',exact:true}).click();const handoff=await(await selectionResponse).json();await expect(page.getByRole('link',{name:/Open manufacturer product page/})).toHaveAttribute('href',handoff.productUrl);await expect(page.locator('.handoff-domain')).toContainText(new URL(handoff.productUrl).hostname);await expect(page.locator('.handoff-panel')).toContainText('Sample price');await page.screenshot({path:artifact+'/mobile-handoff.png',fullPage:true});observations.push({selection:handoff.productId,url:handoff.productUrl});
 await page.getByRole('button',{name:'Start a new search',exact:true}).click();await expect(page.getByLabel('Maximum budget amount')).toHaveValue('');
 const second=await browser.newContext();const other=await second.newPage();await other.goto(base);await other.getByLabel('Product type').selectOption('laptops');await page.getByLabel('Product type').selectOption('headphones');await page.getByLabel('Maximum budget amount').fill('200');await expect(other.getByLabel('Product type')).toHaveValue('laptops');await expect(other.getByLabel('Maximum budget amount')).toHaveValue('');await page.getByRole('button',{name:'Reset session',exact:false}).click();await expect(other.getByLabel('Product type')).toHaveValue('laptops');await second.close();observations.push('Independent browser contexts keep preference changes and reset isolated');
 await submit('headphones <script>window.injectedMarker=1</script>');await expect(page.locator('.pending-constraint')).toContainText('<script>window.injectedMarker=1</script>');expect(await page.evaluate(()=>window.injectedMarker)).toBeUndefined();expect(await page.locator('.pending-constraint script').count()).toBe(0);observations.push('Input script is displayed as inert pending text');
 expect(external).toEqual([]);expect(errors).toEqual([]);
 const commit=cp.execFileSync('git',['rev-parse','HEAD'],{cwd:'/Users/josiahwong/Documents/research-shopping-review',encoding:'utf8'}).trim();
 await fs.writeFile(artifact+'/proof.json',JSON.stringify({result:'passed',commit,observations,external,errors},null,2));
 console.log(JSON.stringify({result:'passed',commit,observations:observations.length,artifact}));
 }catch(error){await page.screenshot({path:artifact+'/failure.png',fullPage:true}).catch(()=>{});await fs.writeFile(artifact+'/failure.txt',String(error.stack||error));throw error;}
 finally{await context.tracing.stop({path:artifact+'/trace.zip'});await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
