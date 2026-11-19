import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const viewport of [{name:'desktop',width:1440,height:1000},{name:'mobile',width:390,height:844}]) {
    const context = await browser.newContext({ viewport, colorScheme:'light' });
    await context.tracing.start({screenshots:true,snapshots:true});
    const page = await context.newPage();
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.hostname === '127.0.0.1') return route.continue();
      if (url.pathname.endsWith('.png')) return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="160" height="100"><text x="10" y="50">Fixture image</text></svg>'});
      return route.abort();
    });
    await page.goto('http://127.0.0.1:5293/');
    await page.getByRole('textbox',{name:'Message',exact:true}).fill('I want to buy a powerbank around $30-40.');
    await page.getByRole('button',{name:'Send message',exact:true}).click();
    await page.getByRole('button',{name:'SGD',exact:true}).click();
    await page.getByText('Fixture data. Automated test substitute.',{exact:true}).waitFor();
    await page.getByText('Fixture Powerbank Model A',{exact:true}).waitFor();
    await page.screenshot({path:`artifacts/fieldnote-v2/root-scroll-red/${viewport.name}.png`});
    const heading = await page.getByText('Fixture Powerbank Model A',{exact:true}).boundingBox();
    const composer = await page.getByRole('textbox',{name:'Message',exact:true}).boundingBox();
    results.push({viewport,heading,composer,leadingRecommendationInViewport:heading!==null&&heading.y>=56&&heading.y+heading.height<composer.y});
    await context.tracing.stop({path:`artifacts/fieldnote-v2/root-scroll-red/${viewport.name}.trace.zip`});
    await context.close();
  }
} finally {await browser.close();}
await writeFile('artifacts/fieldnote-v2/root-scroll-red/proof.json', JSON.stringify({commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty:execFileSync('git',['status','--short'],{encoding:'utf8'}),material:'Explicit automated test SDK loopback fixture. No paid call.',results},null,2));
console.log(JSON.stringify(results));
