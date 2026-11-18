const { spawn, exec } = require('child_process');
const path = require('path');
const net = require('net');
const fs = require('fs');

const ROOT_DIR = path.resolve(__dirname, '..');
const SERVER_DIR = path.join(ROOT_DIR, 'server');
const CLIENT_DIR = path.join(ROOT_DIR, 'client');
const PG_BIN = 'F:\\pg17\\pgsql\\bin';
const PG_DATA = 'F:\\pg17\\data';
const PG_LOG = 'F:\\pg17\\pg.log';

let serverProcess = null;
let clientProcess = null;

/**
 * Checks if a TCP port is open / listening
 */
function isPortOpen(port, host = '127.0.0.1', timeout = 1200) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let status = false;

    socket.setTimeout(timeout);
    socket.once('connect', () => {
      status = true;
      socket.destroy();
    });
    socket.once('timeout', () => {
      socket.destroy();
    });
    socket.once('error', () => {
      socket.destroy();
    });
    socket.once('close', () => {
      resolve(status);
    });

    socket.connect(port, host);
  });
}

/**
 * Wait until a port becomes available
 */
async function waitForPort(port, host = '127.0.0.1', maxRetries = 30, interval = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    const open = await isPortOpen(port, host);
    if (open) return true;
    await new Promise((r) => setTimeout(r, interval));
  }
  return false;
}

/**
 * Ensures PostgreSQL is running
 */
async function ensurePostgres(onLog = console.log) {
  const isOpen = await isPortOpen(5432);
  if (isOpen) {
    onLog('✅ PostgreSQL is already running on port 5432');
    return true;
  }

  onLog('⏳ PostgreSQL not active on port 5432. Starting portable instance...');
  const pgCtl = path.join(PG_BIN, 'pg_ctl.exe');

  if (!fs.existsSync(pgCtl)) {
    onLog(`⚠️ pg_ctl not found at ${pgCtl}. Skipping internal PG start.`);
    return false;
  }

  return new Promise((resolve) => {
    const cmd = `"${pgCtl}" -D "${PG_DATA}" -l "${PG_LOG}" start`;
    exec(cmd, { env: { ...process.env, PATH: `${PG_BIN};${process.env.PATH}` } }, async (err, stdout, stderr) => {
      if (err) {
        onLog(`⚠️ PG start warning: ${err.message}`);
      } else {
        onLog(`🐘 ${stdout.trim() || 'PostgreSQL start initiated'}`);
      }

      const ready = await waitForPort(5432, '127.0.0.1', 15, 1000);
      if (ready) {
        onLog('✅ PostgreSQL connected on port 5432');
      } else {
        onLog('❌ PostgreSQL did not respond on port 5432 in time');
      }
      resolve(ready);
    });
  });
}

/**
 * Ensures Express API server is running on port 5000
 */
async function ensureExpressServer(onLog = console.log) {
  const isOpen = await isPortOpen(5000);
  if (isOpen) {
    onLog('✅ Express API server is already running on port 5000');
    return true;
  }

  onLog('⏳ Starting Express API server on port 5000...');
  const serverEntry = path.join(SERVER_DIR, 'src', 'server.js');

  serverProcess = spawn('node', [serverEntry], {
    cwd: SERVER_DIR,
    env: {
      ...process.env,
      PORT: '5000',
      HOST: '0.0.0.0',
      PATH: `${PG_BIN};${process.env.PATH}`
    },
    stdio: 'pipe',
    shell: true
  });

  serverProcess.stdout.on('data', (d) => {
    const msg = d.toString().trim();
    if (msg) onLog(`[Backend] ${msg}`);
  });

  serverProcess.stderr.on('data', (d) => {
    const msg = d.toString().trim();
    if (msg) onLog(`[Backend Err] ${msg}`);
  });

  const ready = await waitForPort(5000, '127.0.0.1', 25, 1000);
  if (ready) {
    onLog('✅ Express API is online at http://0.0.0.0:5000');
  } else {
    onLog('❌ Express API server failed to respond on port 5000');
  }
  return ready;
}

/**
 * Ensures Next.js Client is running on port 3000
 */
async function ensureNextClient(onLog = console.log) {
  const isOpen = await isPortOpen(3000);
  if (isOpen) {
    onLog('✅ Next.js frontend is already running on port 3000');
    return true;
  }

  onLog('⏳ Starting Next.js frontend on port 3000...');
  const nextBin = path.join(CLIENT_DIR, 'node_modules', 'next', 'dist', 'bin', 'next');

  clientProcess = spawn('node', [nextBin, 'dev', '-H', '0.0.0.0', '-p', '3000'], {
    cwd: CLIENT_DIR,
    env: {
      ...process.env
    },
    stdio: 'pipe',
    shell: true
  });

  clientProcess.stdout.on('data', (d) => {
    const msg = d.toString().trim();
    if (msg) onLog(`[Frontend] ${msg}`);
  });

  clientProcess.stderr.on('data', (d) => {
    const msg = d.toString().trim();
    if (msg) onLog(`[Frontend Err] ${msg}`);
  });

  const ready = await waitForPort(3000, '127.0.0.1', 30, 1000);
  if (ready) {
    onLog('✅ Next.js frontend is online at http://0.0.0.0:3000');
  } else {
    onLog('❌ Next.js frontend did not respond on port 3000');
  }
  return ready;
}

/**
 * Gracefully shuts down spawned processes
 */
function stopProcesses(onLog = console.log) {
  if (serverProcess) {
    onLog('🛑 Terminating Express API process...');
    try {
      serverProcess.kill('SIGTERM');
    } catch {}
    serverProcess = null;
  }
  if (clientProcess) {
    onLog('🛑 Terminating Next.js client process...');
    try {
      clientProcess.kill('SIGTERM');
    } catch {}
    clientProcess = null;
  }
}

module.exports = {
  isPortOpen,
  ensurePostgres,
  ensureExpressServer,
  ensureNextClient,
  stopProcesses
};

