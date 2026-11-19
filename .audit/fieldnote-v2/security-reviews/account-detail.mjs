import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {accountRuntime} from './account-test-runtime.mjs';
const runtime=await accountRuntime();
const post=(path,body,cookie='')=>fetch(runtime.apiOrigin+path,{method:'POST',headers:{origin:runtime.origin,'content-type':'application/json',cookie},body:JSON.stringify(body)});
const read=async cookie=>{const r=await fetch(runtime.apiOrigin+'/api/account',{headers:{cookie}});assert.equal(r.status,200);return r.json();};
try{
 const signup=await post('/api/auth/sign-up/email',{name:'Fixture detail',email:randomUUID()+'@example.test',password:'fixture-detail-password-only'});assert.equal(signup.status,200);const cookie=signup.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
 let w=(await read(cookie)).workspace;
 const prepared=await post('/api/workspace',{phase:'prepare',revision:w.revision,operationId:randomUUID(),message:'a USB-C powerbank between SGD30 and40'},cookie).then(r=>r.json());
 const complete=await post('/api/workspace',{phase:'research',revision:prepared.workspace.revision,preparedId:prepared.workspace.pendingPreparedId},cookie).then(r=>r.json());assert.equal(complete.response.kind,'research');
 const snapshot=structuredClone(complete.workspace.state.messages.find(m=>m.research));
 const held=await post('/api/workspace',{phase:'prepare',revision:complete.workspace.revision,operationId:randomUUID(),message:'What about battery life?'},cookie).then(r=>r.json());assert.equal(held.response.kind,'message');
 const detail=held.workspace.state.messages.at(-1).detail;assert.equal(typeof detail,'string');assert.ok(detail.length>0&&detail.length<=24000);assert.ok(detail.includes('Fixture'));assert.deepEqual(held.workspace.state.messages.find(m=>m.research),snapshot);
 const calls=(await fetch(runtime.apiOrigin+'/api/test-stats').then(r=>r.json())).calls;assert.equal(calls,1);
 await runtime.restart();const restored=(await read(cookie)).workspace;assert.deepEqual(restored,held.workspace);assert.deepEqual(restored.state.messages.at(-1).detail,detail);
 await writeFile('artifacts/fieldnote-v2/security/account-detail.json',JSON.stringify({head:process.env.REVIEW_HEAD,status:'passed',beforeRestartProviderCalls:calls,detailLength:detail.length,checks:['Real account persisted optional detail without altering original research snapshot.','Held detail used no additional provider call.','Detail and accepted state survived actual API restart.']},null,2));console.log('Optional detail persists through actual owned PostgreSQL/API restart, original research unchanged, held reply adds zero provider calls.');
}finally{await runtime.close();}
