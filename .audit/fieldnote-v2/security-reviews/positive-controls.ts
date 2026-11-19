import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {initialConversation} from '../../../src/domain/conversation';
import {reduceTurn} from '../../../src/domain/turn-reducer';
import {createExaProductResearch} from '../../../src/server/exa-research';
import {nativeMaterial} from '../../../tests/helpers/v2-material';
const intent=reduceTurn(initialConversation(),{phase:'prepare',operationId:randomUUID(),message:'a USB-C powerbank between SGD30 and40'}).state.intent;
let mode='shared',calls=0,material:any;
function control(shared:boolean){
 const payload:any=nativeMaterial(intent);payload.answer.products=[];payload.citations=[];
 for(let index=0;index<3;index++){
  const name=`Fixture Quartz ${['One','Two','Three'][index]}`,variant=shared?'standard':`Model ${['A','B','C'][index]}`,amount=35+index;
  const text=`Fixture data. ${name} ${variant} is a USB-C powerbank. ${shared?`${name} ${variant}`:variant} costs SGD ${amount} for one unit, tax included.`;
  const url=`https://manufacturer.com/quartz-${index}`;
  const one=nativeMaterial(intent),item=structuredClone(one.answer.products[0]);item.id=`q-${index}`;item.name=name;item.variant=variant;item.price.variant=variant;item.price.amount=amount;
  for(const a of [item.identity,item.requestMatch,...item.criteria.map(c=>c.assessment),...item.attributes.map(a=>a.assessment),item.price.assessment])a.support=[{url,quote:text}];
  payload.answer.products.push(item);payload.citations.push({url,text,title:`Fixture ${name}`});
 }
 payload.answer.choice={productId:'q-0'};return payload;
}
const upstream=createServer(async(req,res)=>{for await(const _chunk of req){}calls++;material=control(mode==='shared');res.writeHead(200,{'content-type':'application/json'}).end(JSON.stringify(material));});upstream.listen(0,'127.0.0.1');await once(upstream,'listening');
const sdk=createExaProductResearch('fixture-multiple-products-security',{baseUrl:`http://127.0.0.1:${(upstream.address() as any).port}`});const proof=[];
try{
 for(mode of ['shared','unique']){
  const result=await sdk({intent},new AbortController().signal);assert.equal(result.status,'ready');if(result.status!=='ready')throw Error('Missing research');
  assert.deepEqual(result.research.products.map(p=>p.eligible),[true,true,true]);assert.equal(result.research.choice?.productId,'q-0');
  for(const p of result.research.products){assert.equal(p.price?.conditionsResolved,true);const native=material.answer.products.find((v:any)=>v.id===p.id);for(const span of p.price!.assessment.support){assert.ok(native.price.assessment.support.some((v:any)=>v.quote===span.originalQuote));const source=result.research.sources.find(s=>s.id===span.sourceId)!;assert.equal(source.text.slice(span.originalStart,span.originalEnd),span.originalQuote);assert.equal(source.text.slice(span.start,span.end),span.quote);}}
  proof.push({mode,input:material,result});
 }
 assert.equal(calls,2);writeFileSync('artifacts/fieldnote-v2/security/positive-controls.json',JSON.stringify({head:process.env.REVIEW_HEAD,status:'passed',actualSdkCalls:calls,proof},null,2));console.log('Actual SDK shared-standard and unique Model A/B/C controls pass, all six products eligible, original/native and expanded quote bindings intact.');
}finally{upstream.closeAllConnections();await new Promise<void>(r=>upstream.close(()=>r()));}
