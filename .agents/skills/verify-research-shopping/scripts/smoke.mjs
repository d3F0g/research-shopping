#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
assert(args.length === 0 || args.length === 2 && args[0] === '--project-dir', 'Use smoke.mjs [--project-dir /checkout]');
const repo = args.length ? path.resolve(args[1]) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const output = path.resolve(process.env.VERIFY_ARTIFACT_DIR ?? path.join(repo, 'artifacts/verification-skill', new Date().toISOString().replaceAll(':', '-')));
const child = spawn(process.execPath, ['--import', 'tsx', path.join(repo, 'evals/browser/run.ts'), '--mode', 'smoke', '--out', output], {
  cwd: repo,
  stdio: 'inherit',
  env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, NODE_ENV: 'test', EXA_RESEARCH_ENABLED: 'false' },
});
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => child.kill(signal));
child.once('error', (error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
child.once('exit', (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); });
