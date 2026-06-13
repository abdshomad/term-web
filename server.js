const express = require('express');
const http = require('http');
const ws = require('ws');
const pty = require('node-pty');
const os = require('os');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const wss = new ws.Server({ noServer: true });

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Shell configuration is determined dynamically per connection

// CPU calculation helpers
function cpuAverage() {
  let totalIdle = 0, totalTick = 0;
  const cpus = os.cpus();
  if (!cpus || cpus.length === 0) return { idle: 0, total: 0 };
  
  for (let i = 0, len = cpus.length; i < len; i++) {
    const cpu = cpus[i];
    for (const type in cpu.times) {
      totalTick += cpu.times[type];
    }
    totalIdle += cpu.times.idle;
  }
  return { idle: totalIdle / cpus.length, total: totalTick / cpus.length };
}

function getCpuUsage(callback) {
  const startMeasure = cpuAverage();
  setTimeout(() => {
    const endMeasure = cpuAverage();
    const idleDifference = endMeasure.idle - startMeasure.idle;
    const totalDifference = endMeasure.total - startMeasure.total;
    if (totalDifference === 0) {
      callback(0);
      return;
    }
    const percentageCPU = 100 - Math.round(100 * idleDifference / totalDifference);
    callback(percentageCPU);
  }, 100);
}

wss.on('connection', (ws) => {
  console.log('New client connected to terminal WebSocket. Waiting for credentials...');

  let ptyProcess = null;
  let statsInterval = null;

  // Connection timeout if credentials are not received in 15 seconds
  const authTimeout = setTimeout(() => {
    if (!ptyProcess && ws.readyState === ws.OPEN) {
      console.log('Authentication timeout reached, closing connection');
      ws.close();
    }
  }, 15000);

  // Handle incoming messages from client
  ws.on('message', (message) => {
    try {
      const parsed = JSON.parse(message);

      // Handle authentication/connection handshake first
      if (!ptyProcess) {
        if (parsed.action === 'connect') {
          clearTimeout(authTimeout);
          const { username, password } = parsed;

          if (!username || !password) {
            ws.send(JSON.stringify({ action: 'error', data: 'Username and password are required' }));
            ws.close();
            return;
          }

          console.log(`Spawning authenticated SSH process for: ${username}`);
          
          const sshHost = process.env.SSH_HOST || 'host.docker.internal';
          const shellCmd = 'sshpass';
          const shellArgs = [
            '-p', password,
            'ssh',
            '-o', 'StrictHostKeyChecking=no',
            `${username}@${sshHost}`
          ];

          // Spawn PTY process
          try {
            ptyProcess = pty.spawn(shellCmd, shellArgs, {
              name: 'xterm-256color',
              cols: parsed.cols || 80,
              rows: parsed.rows || 24,
              cwd: process.env.HOME || process.cwd(),
              env: {
                ...process.env,
                TERM: 'xterm-256color',
                COLORTERM: 'truecolor'
              }
            });
          } catch (spawnErr) {
            console.error('Failed to spawn PTY terminal:', spawnErr);
            ws.send(JSON.stringify({ action: 'error', data: 'Failed to start terminal session' }));
            ws.close();
            return;
          }

          let isFailed = false;

          // Send output from pty to client
          ptyProcess.onData((data) => {
            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({ action: 'output', data }));
            }
          });

          // Handle pty process exit
          ptyProcess.onExit(({ exitCode, signal }) => {
            console.log(`PTY process exited with code ${exitCode}, signal ${signal}`);
            isFailed = true;
            if (statsInterval) clearInterval(statsInterval);
            if (ws.readyState === ws.OPEN) {
              let errMsg = 'Connection closed';
              if (exitCode === 5) {
                errMsg = 'Authentication failed: Incorrect password';
              } else if (exitCode === 6) {
                errMsg = 'Authentication failed: Host key unknown';
              } else if (exitCode === 255) {
                errMsg = 'Authentication failed: Connection refused or permission denied';
              }
              ws.send(JSON.stringify({ action: 'error', data: errMsg }));
              ws.close();
            }
          });

          // Wait 1.2 seconds to confirm connection before sending success title to client
          setTimeout(() => {
            if (!isFailed && ws.readyState === ws.OPEN) {
              const sessionTitle = `ssh ${username}@${sshHost}`;
              ws.send(JSON.stringify({ action: 'title', data: sessionTitle }));

              // Start periodic system stats monitoring
              statsInterval = setInterval(() => {
                if (ws.readyState === ws.OPEN) {
                  getCpuUsage((cpuPercent) => {
                    const totalMem = os.totalmem();
                    const freeMem = os.freemem();
                    const ramPercent = Math.round(((totalMem - freeMem) / totalMem) * 100);
                    ws.send(JSON.stringify({
                      action: 'stats',
                      cpu: cpuPercent,
                      ram: ramPercent,
                      uptime: Math.round(os.uptime())
                    }));
                  });
                }
              }, 2000);
            }
          }, 1200);
        } else {
          // Received non-connect message before authentication
          ws.send(JSON.stringify({ action: 'error', data: 'Authentication required' }));
          ws.close();
        }
        return;
      }

      // Handle standard terminal interactive sessions once authenticated
      if (parsed.action === 'input') {
        ptyProcess.write(parsed.data);
      } else if (parsed.action === 'resize') {
        ptyProcess.resize(parsed.cols, parsed.rows);
      }
    } catch (err) {
      console.error('Failed to parse WebSocket message:', err);
      if (ptyProcess) {
        ptyProcess.write(message.toString());
      }
    }
  });

  // Handle connection close
  ws.on('close', () => {
    console.log('Client disconnected, cleaning up session');
    clearTimeout(authTimeout);
    if (statsInterval) clearInterval(statsInterval);
    if (ptyProcess) {
      try {
        ptyProcess.kill();
      } catch (e) {
        // Process might already be dead
      }
    }
  });
});

// Upgrade HTTP connection to WebSocket
server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;

  if (pathname === '/terminal') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

const PORT = process.env.PORT || 3046;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
