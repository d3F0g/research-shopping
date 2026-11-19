import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {accountRuntime} from './account-test-runtime.mjs';
const runtime=await accountRuntime();const checks=[];
const post=(path,body,cookie='',origin=runtime.origin)=>fetch(runtime.apiOrigin+path,{method:'POST',headers:{origin,'content-type':'application/json',cookie},body:JSON.stringify(body)});
const read=async cookie=>{const r=await fetch(runtime.apiOrigin+'/api/account',{headers:{cookie}});assert.equal(r.status,200);return r.json();};
async function user(label){const r=await post('/api/auth/sign-up/email',{name:'Fixture '+label,email:randomUUID()+'@example.test',password:'fixture-security-password-only'});assert.equal(r.status,200);return r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');}
try{
 const a=await user('A'),b=await user('B');const initial=await read(a);
 const p=await post('/api/workspace',{phase:'prepare',revision:initial.workspace.revision,operationId:randomUUID(),message:'a USB-C powerbank under SGD40'},a).then(r=>r.json());
 const w=(await read(b)).workspace;
 assert.equal((await post('/api/workspace',{phase:'research',revision:w.revision,preparedId:p.workspace.pendingPreparedId},b)).status,409);
 assert.equal((await post('/api/workspace',{phase:'cancel',revision:w.revision,operationId:randomUUID(),target:p.workspace.pendingOperationId},b)).status,409);
 assert.equal((await post('/api/workspace',{phase:'new-chat',revision:w.revision,operationId:randomUUID(),userId:initial.user.id},b)).status,400);
 assert.deepEqual((await read(b)).workspace.state.messages,[]);checks.push('Actual Better Auth cookies with known cross-user prepared and operation IDs cannot read, execute, or cancel another workspace. Caller ownership fields rejected.');
 const unauthorized=await post('/api/workspace',{phase:'new-chat',revision:0,operationId:randomUUID()});assert.equal(unauthorized.status,401);
 assert.equal((await post('/api/auth/sign-out',{},a,'https://foreign.example')).status,403);
 assert.equal((await post('/api/auth/sign-out',{large:'x'.repeat(17000)},a)).status,413);
 assert.equal((await fetch(runtime.apiOrigin+'/api/auth/sign-out',{method:'POST',headers:{origin:runtime.origin,cookie:a,'content-type':'text/plain'},body:'{}'})).status,415);checks.push('HTTP account mutation requires valid cookie, exact Origin, JSON media type and bounded body.');
 assert.equal((await post('/api/auth/sign-out',{},a)).status,200);
 assert.equal((await post('/api/workspace',{phase:'research',revision:p.workspace.revision,preparedId:p.workspace.pendingPreparedId},a)).status,401);checks.push('Revoked real cookie cannot dispatch an already prepared account operation.');
 assert.equal((await fetch(runtime.apiOrigin+'/api/test-stats').then(r=>r.json())).calls,0);
 await writeFile('artifacts/fieldnote-v2/security/account-http.json',JSON.stringify({head:process.env.REVIEW_HEAD,status:'passed',checks,providerCalls:0},null,2));console.log(checks.join('\n'));
}finally{await runtime.close();}
