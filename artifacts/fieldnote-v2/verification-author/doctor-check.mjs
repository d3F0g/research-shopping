import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
const directory = '/Users/josiahwong/Documents/research-shopping-v2-verification/artifacts/fieldnote-v2/verification-skill/occupied-port';
const port = 3273;
const listener = createServer((_request, response) => response.end('owned-doctor-listener'));
await new Promise((resolve, reject) => { listener.once('error', reject); listener.listen(port, '127.0.0.1', resolve); });
try {
 const child = spawn(process.execPath, ['/Users/josiahwong/Documents/research-shopping-v2-verification/.agents/skills/verify-research-shopping/scripts/smoke.mjs', '--project-dir', '/Users/josiahwong/Documents/research-shopping-v2'], { env: { ...process.env, VERIFY_API_PORT: String(port), VERIFY_WEB_PORT: '5383', VERIFY_ARTIFACT_DIR: directory }, stdio: 'pipe' });
 let stdout = ''; child.stdout.on('data', (data) => { stdout += data; });
 const code = await new Promise((resolve) => child.once('exit', resolve));
 assert.equal(code, 1);
 assert.equal(await fetch(`http://127.0.0.1:${port}`).then((response) => response.text()), 'owned-doctor-listener');
 const proof = JSON.parse(await readFile(`${directory}/proof.json`, 'utf8'));
 assert.equal(proof.result, 'failed'); assert.equal(proof.cleanup, true); assert.deepEqual(proof.processes, []); assert.match(proof.error, /EADDRINUSE/);
 await writeFile(`${directory}/doctor-proof.json`, JSON.stringify({ result: 'passed', occupiedPort: port, helperExit: code, helperSpawnedNoProcesses: true, existingListenerUnchanged: true, stdout }, null, 2));
 process.stdout.write('Occupied-port refusal passed. Existing owned listener survived unchanged.\n');
} finally { await new Promise((resolve) => listener.close(resolve)); }
