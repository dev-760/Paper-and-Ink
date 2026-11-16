import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve(import.meta.dirname, '..');
const mode = process.argv[2] || 'dev';

function readPortFromEnv() {
  if (process.env.PORT && /^\d+$/.test(process.env.PORT.trim())) {
    return process.env.PORT.trim();
  }
  const envPath = path.join(rootDir, '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const match = line.trim().match(/^PORT\s*=\s*["']?(\d+)["']?/);
      if (match) return match[1];
    }
  }
  return '3001';
}

function resolvePythonExecutable() {
  const candidates = [
    process.env.PYTHON,
    path.join(rootDir, 'server', '.venv', 'Scripts', 'python.exe'),
    path.join(rootDir, 'server', '.venv', 'bin', 'python'),
    path.join(rootDir, '.venv', 'Scripts', 'python.exe'),
    path.join(rootDir, '.venv', 'bin', 'python'),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  for (const cmd of ['python', 'python3']) {
    const check = spawnSync(cmd, ['--version'], { stdio: 'ignore' });
    if (check.status === 0) return cmd;
  }

  console.error(
    'Python interpreter not found. Create server/.venv and install server/requirements.txt first.',
  );
  process.exit(1);
}

const pythonExe = resolvePythonExecutable();
const port = readPortFromEnv();

let args;
if (mode === 'dev') {
  args = [
    '-m',
    'uvicorn',
    'server.main:app',
    '--host',
    '0.0.0.0',
    '--port',
    port,
    '--reload',
    '--reload-dir',
    'server',
  ];
} else if (mode === 'start') {
  args = ['-m', 'uvicorn', 'server.main:app', '--host', '0.0.0.0', '--port', port];
} else if (mode === 'check') {
  args = ['-m', 'compileall', '-x', '(\\.venv|__pycache__)', '-q', 'server'];
} else if (mode === 'test') {
  args = ['-m', 'pytest', 'server/tests'];
} else {
  console.error(`Unknown server mode "${mode}". Expected one of: dev, start, check, test`);
  process.exit(1);
}

const child = spawn(pythonExe, args, {
  cwd: rootDir,
  stdio: 'inherit',
  env: process.env,
});

const forwardSignal = (signal) => {
  if (!child.killed) {
    child.kill(signal);
  }
};

process.on('SIGINT', () => forwardSignal('SIGINT'));
process.on('SIGTERM', () => forwardSignal('SIGTERM'));

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
