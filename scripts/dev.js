const { spawn } = require('child_process');
const net = require('net');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port);
  });
}

function startProcess(command, args, options) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: true,
    ...options
  });

  child.on('exit', (code) => {
    process.exitCode = process.exitCode ?? code ?? 0;
  });

  return child;
}

(async () => {
  const shouldStartServer = await isPortFree(4000);

  if (!shouldStartServer) {
    console.log('[dev] API already running on port 4000, starting Vite only.');
  } else {
    console.log('[dev] Starting API server on port 4000.');
    startProcess(npmCmd, ['run', 'server'], { cwd: rootDir });
  }

  console.log('[dev] Starting Vite on port 3000.');
  startProcess(npmCmd, ['run', 'dev:client'], { cwd: rootDir });
})();