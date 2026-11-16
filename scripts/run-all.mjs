import { spawn } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const mode = process.argv[2] || 'build';
const rootDir = path.resolve(import.meta.dirname, '..');

function runNode(args, label) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: rootDir,
      stdio: 'inherit',
      env: process.env,
    });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${label} failed with exit code ${code}`));
    });
  });
}

if (mode === 'dev') {
  const children = [
    spawn(process.execPath, ['--import', pathToFileURL(path.join(rootDir, 'node_modules', 'tsx', 'dist', 'loader.mjs')).href, 'server/index.ts'], {
      cwd: rootDir,
      stdio: ['ignore', 'inherit', 'inherit'],
    }),
    spawn(process.execPath, [path.join(rootDir, 'scripts', 'run-app.mjs'), 'reader', 'dev'], {
      cwd: rootDir,
      stdio: ['ignore', 'inherit', 'inherit'],
    }),
    spawn(process.execPath, [path.join(rootDir, 'scripts', 'run-app.mjs'), 'notes', 'dev'], {
      cwd: rootDir,
      stdio: ['ignore', 'inherit', 'inherit'],
    }),
    spawn(process.execPath, [path.join(rootDir, 'scripts', 'run-app.mjs'), 'news', 'dev'], {
      cwd: rootDir,
      stdio: ['ignore', 'inherit', 'inherit'],
    }),
  ];

  const shutdown = () => {
    for (const child of children) {
      child.kill();
    }
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
} else if (mode === 'build') {
  await runNode([path.join(rootDir, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', 'server/tsconfig.build.json'], 'server build');
  for (const app of ['reader', 'notes', 'news']) {
    await runNode([path.join(rootDir, 'scripts', 'run-app.mjs'), app, 'build'], `${app} build`);
  }
} else if (mode === 'lint') {
  await runNode([path.join(rootDir, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', 'server/tsconfig.json', '--noEmit'], 'server typecheck');
  for (const app of ['reader', 'notes', 'news']) {
    await runNode([path.join(rootDir, 'scripts', 'run-app.mjs'), app, 'lint'], `${app} typecheck`);
  }
} else {
  console.error(`Unknown mode "${mode}".`);
  process.exit(1);
}
