import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

function resolveServerEntrypoint() {
  const defaultEntrypoint = join('build', 'server', 'index.js');

  if (existsSync(defaultEntrypoint)) {
    return defaultEntrypoint;
  }

  const serverDir = join('build', 'server');

  if (!existsSync(serverDir)) {
    throw new Error(`Missing directory: ${serverDir}`);
  }

  const runtimeDir = readdirSync(serverDir).find((entry) => entry.startsWith('nodejs-'));

  if (!runtimeDir) {
    throw new Error(`Cannot locate server runtime directory in ${serverDir}`);
  }

  const entrypoint = join(serverDir, runtimeDir, 'index.js');

  if (!existsSync(entrypoint)) {
    throw new Error(`Cannot locate server entrypoint: ${entrypoint}`);
  }

  return entrypoint;
}

const entrypoint = resolveServerEntrypoint();
const command = process.platform === 'win32' ? 'remix-serve.cmd' : 'remix-serve';
const child = spawn(command, [entrypoint], {
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});

