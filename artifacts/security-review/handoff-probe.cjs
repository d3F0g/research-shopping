const {chromium,expect}=require('/Users/josiahwong/Documents/research-shopping-review/node_modules/@playwright/test');
const fs=require('node:fs/promises');
const base='http://127.0.0.1:5293';
const mode=process.argv[2]||'initial';
const dir='/Users/josiahwong/Documents/research-shopping/artifacts/security-review/handoff-'+mode;
const changes={
 'external-host':r=>{r.productUrl=r.offer.productUrl='https://evil.test/product';r.offer.merchantHost='evil.test';},
 'arbitrary-approved-path':r=>{r.productUrl=r.offer.productUrl='https://www.sony.com.sg/arbitrary';},
 'different-product':r=>{r.productId=r.offer.productId='sennheiser-momentum-4';r.productName='Sennheiser MOMENTUM 4 Wireless';r.productUrl=r.offer.productUrl='https://global.sennheiser-hearing.com/products/momentum-4-wireless';r.offer.merchantHost='global.sennheiser-hearing.com';},
 'wrong-name':r=>{r.productName='Unrelated fraudulent product';},
 'wrong-merchant-host':r=>{r.offer.merchantHost='evil.test';},
};
(async()=>{await fs.mkdir(dir,{recursive:true});const browser=await chromium.launch();const records=[];try{
for(const [name,change]of Object.entries(changes)){const context=await browser.newContext();await context.tracing.start({screenshots:true,snapshots:true});const page=await context.newPage();await page.goto(base);await page.getByRole('button',{name:/Wireless headphones for long flights/}).click();await expect(page.locator('.product-card')).toHaveCount(3);let injected;
await page.route('**/api/select',async route=>{const response=await route.fetch();const result=await response.json();change(result);injected=result;await route.fulfill({response,json:result});});
await page.locator('.product-card').first().getByRole('button',{name:'Select this product',exact:true}).click();await expect(page.locator('.handoff-panel,.selection-error')).toBeVisible();const href=await page.locator('.merchant-link').count()?await page.locator('.merchant-link').getAttribute('href'):null;const error=await page.locator('.selection-error').count()?await page.locator('.selection-error').textContent():null;records.push({name,injected,href,error});await page.screenshot({path:dir+'/'+name+'.png',fullPage:true});if(mode==='final'){expect(href).toBeNull();expect(error).toMatch(/unsafe product link/);}await context.tracing.stop({path:dir+'/'+name+'.zip'});await context.close();}
await fs.writeFile(dir+'/proof.json',JSON.stringify({mode,records},null,2));console.log(JSON.stringify({mode,observations:records.map(r=>({name:r.name,clickable:r.href,error:r.error})),dir}));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
