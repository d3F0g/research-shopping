import http from 'node:http';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import cp from 'node:child_process';
const tag=process.argv[2]||'initial';
const commit=cp.execFileSync('git',['rev-parse','HEAD'],{cwd:'/Users/josiahwong/Documents/research-shopping-review',encoding:'utf8'}).trim();
const port=3193;
const base={hard:{category:null,budget:null,region:'SG',excludedBrands:[],requiredFeatures:[],pendingConstraint:null},soft:{useCase:'',priorities:['value'],responseLength:'concise'}};
function request(body, headers={}, method='POST', path='/api/turn', chunks=false) {
 return new Promise((resolve,reject)=>{
 const req=http.request({host:'127.0.0.1',port,path,method,headers:{'Content-Type':'application/json',...headers}},res=>{let text='';res.setEncoding('utf8');res.on('data',c=>text+=c);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:text}));});
 req.on('error',reject); if(chunks){for(let i=0;i<body.length;i+=100)req.write(body.subarray(i,i+100));req.end();}else req.end(body);
 });
}
const good=JSON.stringify({message:'headphones under SGD500',preferences:base});
const cases=[
 ['good',good,{},200],['same-origin',good,{Origin:'http://127.0.0.1:5293'},200],['foreign-origin',good,{Origin:'https://evil.example'},403],['null-origin',good,{Origin:'null'},403],['foreign-host',good,{Host:'evil.example'},403],['host-suffix',good,{Host:'127.0.0.1.evil.test:3193'},403],['wrong-port',good,{Host:'127.0.0.1:3000'},403],['malformed-json','{',{},400],['wrong-media',good,{'Content-Type':'text/plain'},415],['no-media',good,{'Content-Type':''},415],['json-utf8',good,{'Content-Type':'application/json; charset=utf-8'},200],['encoded',good,{'Content-Encoding':'gzip'},415],['overlarge',Buffer.from(' '.repeat(17000)),{},413],['multibyte-overlarge',Buffer.from('界'.repeat(6000)),{},413],['streamed-overlarge',Buffer.from('x'.repeat(17000)),{},413,true],['invalid-utf8',Buffer.from([0xff]),{},400],['extra-top-field',JSON.stringify({...JSON.parse(good),apiKey:'secret-marker'}),{},400],['long-message',JSON.stringify({message:'a'.repeat(2001),preferences:base}),{},400],
];
const findings=[];
for(const [name,body,headers,expected,chunks] of cases){const r=await request(body,headers,'POST','/api/turn',chunks);assert.equal(r.status,expected,name);assert.ok(r.headers['x-request-id'],name);assert.equal(r.headers['cache-control'],'no-store',name);findings.push({name,status:r.status,requestId:r.headers['x-request-id'],body:r.body});}
for(const amount of [0,-1,12.345,1000001,1e100]){const p=structuredClone(base);p.hard.budget={amount,currency:'SGD'};const r=await request(JSON.stringify({message:'headphones',preferences:p}));assert.equal(r.status,400,`budget ${amount}`);findings.push({name:`invalid-budget-${amount}`,status:r.status});}
let p=structuredClone(base);
for(const message of ['headphones under SGD500 with flibberty support','Show options','under SGD200']){const r=await request(JSON.stringify({message,preferences:p}));assert.equal(r.status,200);const data=JSON.parse(r.body);assert.equal(data.kind,'clarification');assert.ok(data.preferences.hard.pendingConstraint);p=data.preferences;findings.push({name:message,status:r.status,result:data});}
const injection=await request(JSON.stringify({message:'headphones <script>globalThis.secretMarker=1</script> fetch http://127.0.0.1/private',preferences:base}));assert.equal(JSON.parse(injection.body).kind,'clarification');
findings.push({name:'inert-input',...injection});
const valid=await request(good); const prefs=JSON.parse(valid.body).preferences;
for(const [id,expected] of [['sony-wh-1000xm5','handoff'],['audio-technica-ath-m50xbt2','error'],['missing','error']]){const r=await request(JSON.stringify({productId:id,preferences:prefs}),{},'POST','/api/select');const data=JSON.parse(r.body);assert.equal(data.kind,expected);findings.push({name:`select-${id}`,status:r.status,result:data});}
fs.writeFileSync(`/Users/josiahwong/Documents/research-shopping/artifacts/security-review/http-${tag}.json`,JSON.stringify({commit,findings},null,2));
console.log(`PASS ${findings.length} independent real HTTP observations`);
