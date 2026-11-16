import { spawn } from 'node:child_process';
import path from 'node:path';

const APP_DIRS = {
  reader: 'reader-web',
  notes: 'notes-web',
  news: 'news-web',
};

const [, , appKey, mode = 'dev'] = process.argv;
const folder = APP_DIRS[appKey];
if (!folder) {
  console.error(`Unknown app "${appKey}". Expected one of: ${Object.keys(APP_DIRS).join(', ')}`);
  process.exit(1);
}

const rootDir = path.resolve(import.meta.dirname, '..');
const cwd = path.join(rootDir, folder);

let cmdArgs;
if (mode === 'dev') {
  cmdArgs = [path.join(cwd, 'node_modules', 'vite', 'bin', 'vite.js')];
} else if (mode === 'build') {
  cmdArgs = [path.join(cwd, 'node_modules', 'vite', 'bin', 'vite.js'), 'build'];
} else if (mode === 'lint') {
  cmdArgs = [path.join(cwd, 'node_modules', 'typescript', 'bin', 'tsc'), '--noEmit'];
} else {
  console.error(`Unknown mode "${mode}".`);
  process.exit(1);
}

const child = spawn(process.execPath, cmdArgs, {
  cwd,
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
