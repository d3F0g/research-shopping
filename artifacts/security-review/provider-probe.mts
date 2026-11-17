import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import cp from 'node:child_process';
const tag=process.argv[2]||'initial';
const commit=cp.execFileSync('git',['rev-parse','HEAD'],{cwd:'/Users/josiahwong/Documents/research-shopping-review',encoding:'utf8'}).trim();
import { createRequire } from 'node:module';
import { once } from 'node:events';
import { createApp } from '/Users/josiahwong/Documents/research-shopping-review/src/server/app.ts';
import { createFixtureProviders } from '/Users/josiahwong/Documents/research-shopping-review/src/server/fixtures.ts';
import { defaultPreferences } from '/Users/josiahwong/Documents/research-shopping-review/src/domain/contracts.ts';
const require=createRequire('/Users/josiahwong/Documents/research-shopping-review/package.json');
const { serve }=require('@hono/node-server');
const records:any[]=[];const logs:any[]=[];const fixture=createFixtureProviders();
let active:any=fixture;
const providers:any={
 discovery:{discover:(...args:any[])=>active.discovery.discover(...args),findById:(...args:any[])=>active.discovery.findById(...args)},
 research:{research:(...args:any[])=>active.research.research(...args)},merchant:{lookup:(...args:any[])=>active.merchant.lookup(...args)}
};
const app=createApp({providers,providerTimeoutMs:25,logger:event=>logs.push(event)},{apiPort:3194,webPort:5294});
const server=serve({fetch:app.fetch,hostname:'127.0.0.1',port:3194});await once(server,'listening');
const call=async()=>{const response=await fetch('http://127.0.0.1:3194/api/turn',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:'headphones under SGD500',preferences:defaultPreferences()})});assert.equal(response.status,200);return response.json();};
try{
 for(const provider of ['discovery','research','merchant'] as const){for(const mode of ['error','timeout','malformed'] as const){active=createFixtureProviders({[provider]:mode});const result=await call();assert.equal(result.kind,'error');assert.equal(result.code,'provider-failed');assert.equal(result.retryable,true);assert.ok(!('candidates' in result));records.push({provider,mode,result});}}
 for(const url of ['javascript:alert(1)','https://www.sony.com.sg/redirect','https://www.sony.com.sg/electronics/headband-headphones/wh-1000xm5?redirect=https://evil.test','https://www.sony.com.sg.evil.test/test','https://user@www.sony.com.sg/headphones/products/wh-ch720n']){
  active={...fixture,research:{research:async(product:any,context:any)=>(await fixture.research.research(product,context)).map((claim:any)=>claim.status==='supported'?{...claim,sources:claim.sources.map((source:any)=>({...source,url}))}:claim)}};
  const result=await call();assert.equal(result.kind,'error');assert.equal(result.code,'provider-failed');records.push({sourceUrl:url,result});
 }
 for(const patch of [{productId:'sennheiser-momentum-4'},{merchantHost:'evil.test'},{price:{amount:NaN,currency:'SGD'}},{productUrl:'https://www.sony.com.sg/arbitrary'}]){
  active={...fixture,merchant:{lookup:async(product:any,preferences:any,context:any)=>({...await fixture.merchant.lookup(product,preferences,context),...patch})}};const result=await call();assert.equal(result.kind,'error');records.push({offerPatch:patch,result});
 }
 active={...fixture,discovery:{...fixture.discovery,discover:async()=>{throw Error('credential-secret-marker NEVER LOG');}}};const result=await call();assert.equal(result.kind,'error');
 const serialized=JSON.stringify(logs);assert.ok(!serialized.includes('credential-secret-marker'));assert.ok(!serialized.includes('headphones under'));assert.ok(!serialized.includes('SGD'));assert.ok(logs.some(e=>e.outcomes.some((outcome:any)=>outcome.outcome==='timeout')));assert.ok(logs.every(e=>Object.keys(e).sort().join(',')==='durationMs,outcomes,requestId,route,status'));
 records.push({logging:'Safe bounded request and provider outcome fields only',logCount:logs.length});
 await fs.writeFile(`/Users/josiahwong/Documents/research-shopping/artifacts/security-review/provider-http-${tag}.json`,JSON.stringify({commit,records,logs},null,2));console.log(`PASS ${records.length} provider-boundary real HTTP observations`);
}finally{server.close();await once(server,'close');}
