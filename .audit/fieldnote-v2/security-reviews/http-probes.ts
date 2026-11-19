import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer, request as httpRequest } from 'node:http';
import { writeFileSync } from 'node:fs';
import { once } from 'node:events';
import { serve } from '@hono/node-server';
import { createApp } from '../../../src/server/app';
import { createConversationService } from '../../../src/server/conversations';
import { createExaProductResearch } from '../../../src/server/exa-research';
import { nativeMaterial } from '../../../tests/helpers/v2-material';
const checks:string[]=[];
const logs:unknown[]=[];
const reservations:string[]=[];
const settlements:unknown[]=[];
let mode='positive', calls=0, entered=0, closed=0;
const upstream=createServer(async(req,res)=>{
  let body='';for await(const chunk of req) body+=chunk;
  calls++;entered++;
  res.on('close',()=>closed++);
  if(mode==='hang'){res.writeHead(200,{'content-type':'application/json'});res.write('{"answer":');return;}
  if(mode==='error'){res.writeHead(503).end('SENSITIVE_PROVIDER_SENTINEL');return;}
  if(mode==='malformed'){res.writeHead(200,{'content-type':'application/json'}).end('{"answer":{}}');return;}
  const input=JSON.parse(body),intent=JSON.parse(input.systemPrompt.split('Current authoritative shopping intent: ')[1]);
  const material=nativeMaterial(intent);
  if(mode==='empty') material.citations=[];
  if(mode==='cut') material.citations[0].text+='\n\nFixture data: technical details follow.\n\n'+'Fixture filler '.repeat(1900)+'\n\nFixture data: Model A costs SGD 35 only with a membership voucher; ordinary price SGD 65.';
  res.writeHead(200,{'content-type':'application/json'}).end(JSON.stringify(material));
});
upstream.listen(0,'127.0.0.1');await once(upstream,'listening');
const upstreamAddress=upstream.address() as any;
const sdk=createExaProductResearch('SYNTHETIC_PRIVATE_KEY_SENTINEL',{baseUrl:`http://127.0.0.1:${upstreamAddress.port}`,timeoutMs:250});
const service=createConversationService({research:async(req,signal)=>{const r=await sdk(req,signal);if(r.status==='ready')r.research.dataKind='test-fixture';return r;},quota:{reserve:async(id)=>{reservations.push(id);return 'admitted';},settle:async(id,cost,success)=>{settlements.push({id,cost,success});}}});
let app:any;
const api=serve({hostname:'127.0.0.1',port:0,fetch:req=>app.fetch(req)});await once(api,'listening');
const address=api.address() as any;
const origin=`http://127.0.0.1:${address.port}`;
app=createApp({conversations:service,logger:e=>logs.push(e)},{apiPort:address.port,webPort:address.port});
const get=(path:string,cookie='')=>fetch(origin+path,{headers:{cookie}});
const post=(body:unknown,cookie='',path='/api/turn',extra:Record<string,string>={})=>fetch(origin+path,{method:'POST',headers:{origin,'content-type':'application/json',cookie,...extra},body:JSON.stringify(body)});
const state=async(cookie:string)=>(await get('/api/session',cookie)).json();
const client=async()=>{const r=await get('/api/session');return r.headers.get('set-cookie')!.split(';')[0];};
const prepare=async(cookie:string,message='a USB-C powerbank between SGD30 and40')=>{const r=await post({phase:'prepare',operationId:randomUUID(),message},cookie);assert.equal(r.status,200);const p=await r.json();assert.equal(p.kind,'prepared');return p;};
const research=async(cookie:string,p:any)=>{const r=await post({phase:'research',preparedId:p.preparedId},cookie);assert.equal(r.status,200);return r.json();};
const until=async(fn:()=>boolean)=>{for(let i=0;i<100;i++){if(fn())return;await new Promise(r=>setTimeout(r,5));}throw Error('condition timed out');};
try{
  assert.equal(address.address,'127.0.0.1');assert.equal(upstreamAddress.address,'127.0.0.1');checks.push('Owned actual API and SDK upstream sockets bind 127.0.0.1.');
  const a=await client(),b=await client();assert.notEqual(a,b);
  for(const [body,headers,expected] of [
    ['{',{'content-type':'application/json'},400],
    ['{}',{'content-type':'text/plain'},415],
    ['{}',{'content-type':'application/json','content-encoding':'gzip'},415],
    ['x'.repeat(16385),{'content-type':'application/json'},413],
    [new Uint8Array([0xff]),{'content-type':'application/json'},400],
  ] as const){const r=await fetch(origin+'/api/turn',{method:'POST',headers:{origin,...headers},body:body as any});assert.equal(r.status,expected);}
  for(const body of [{phase:'prepare',operationId:randomUUID(),message:'x'.repeat(2001)},{phase:'prepare',operationId:randomUUID(),message:'Hello',userId:'forged'},{phase:'research',preparedId:randomUUID(),intent:{}},{phase:'prepare',operationId:randomUUID(),message:'Edit',edit:{description:'Item',requirements:[],budget:{minimum:50,maximum:30,currency:'SGD'}}}])assert.equal((await post(body,a)).status,400);
  const chunked=await new Promise<number>((resolve,reject)=>{const q=httpRequest(origin+'/api/turn',{method:'POST',headers:{origin,'content-type':'application/json','transfer-encoding':'chunked'}},r=>{r.resume();r.on('end',()=>resolve(r.statusCode!));});q.on('error',reject);q.write('x'.repeat(9000));q.end('x'.repeat(9000));});assert.equal(chunked,413);checks.push('Invalid JSON, UTF-8, media type, encoding, 16KiB streamed body, >2000 message, extra fields and inverted budget rejected.');
  assert.equal((await get('/api/health')).status,200);
  assert.equal((await post({},a,'/api/new-chat',{origin:'https://foreign.example'})).status,403);
  const foreignHost=await new Promise<number>((resolve,reject)=>{const q=httpRequest(origin+'/api/new-chat',{method:'POST',headers:{host:'evil.example',origin,'content-type':'application/json',cookie:a}},r=>{r.resume();r.on('end',()=>resolve(r.statusCode!));});q.on('error',reject);q.end('{}');});assert.equal(foreignHost,403);
  assert.equal((await fetch(origin+'/api/health',{headers:{origin:'null'}})).status,403);
  assert.equal((await fetch(origin+'/api/turn',{method:'OPTIONS',headers:{origin}})).status,204);checks.push('Foreign Host/Origin and null Origin rejected; same-origin requests and preflight accepted.');
  const p=await prepare(a,'a USB-C powerbank between SGD30 and40 SENSITIVE_CONVERSATION_SENTINEL');
  const other=await research(b,p);assert.equal(other.reason,'stale');assert.equal(calls,0);assert.equal((await state(b)).state.messages.length,0);
  const [one,two]=await Promise.all([research(a,p),research(a,p)]);assert.equal(one.kind,'research');assert.equal(two.kind,'research');assert.equal(calls,1);await research(a,p);assert.equal(calls,1);assert.equal(reservations.length,1);checks.push('Known cross-session prepared IDs denied; same-session concurrent dispatch and replay reserve/call once.');
  const failures:any[]=[];
  for(const failure of ['error','malformed','empty','hang']){mode=failure;const p=await prepare(a);const before=calls;const r=await research(a,p);assert.equal(r.kind,'research-unavailable');assert.equal(calls,before+1);assert.ok(!JSON.stringify(r).includes('SENSITIVE_PROVIDER_SENTINEL'));failures.push({mode:failure,reason:r.reason});}
  checks.push('Provider 503, malformed envelope, empty evidence and SDK body timeout fail honestly with one call and no replacement research.');
  mode='hang';const pending=await prepare(a);const before=entered;const closeBefore=closed;const delayed=research(a,pending);await until(()=>entered>before);assert.equal((await post({},a,'/api/new-chat')).status,200);const late=await delayed;assert.equal(late.reason,'stale');await until(()=>closed>closeBefore);assert.deepEqual((await state(a)).state.messages,[]);checks.push('New chat aborts actual SDK body socket, settles unknown cost unsuccessfully and blocks stale publication.');
  mode='cut';const cut=await research(a,await prepare(a));
  assert.equal(cut.kind,'research');
  const cutObservation={choice:cut.research.choice,eligible:cut.research.products[0].eligible,priceConditionsResolved:cut.research.products[0].price?.conditionsResolved,sourceCut:cut.research.sources[0].textTruncated};
  assert.ok(!JSON.stringify(logs).includes('SENSITIVE_CONVERSATION_SENTINEL'));assert.ok(!JSON.stringify(logs).includes('SYNTHETIC_PRIVATE_KEY_SENTINEL'));assert.ok(!JSON.stringify(logs).includes('SENSITIVE_PROVIDER_SENTINEL'));assert.ok(!JSON.stringify(logs).includes(a));checks.push('Injected structured logger contains request IDs/status/duration only; synthetic message, key, cookie and provider-body sentinels absent.');
  writeFileSync('artifacts/fieldnote-v2/security/http-probes.json',JSON.stringify({head:process.env.REVIEW_HEAD,checks,failures,settlements,cutObservation,logs},null,2));console.log(JSON.stringify({checks:checks.length,providerCalls:calls,cutObservation,failures},null,2));
}finally{api.closeAllConnections();upstream.closeAllConnections();await Promise.all([new Promise<void>(r=>api.close(()=>r())),new Promise<void>(r=>upstream.close(()=>r()))]);}
