// Initialize Terminal
const term = new Terminal({
  cursorBlink: true,
  cursorStyle: 'block',
  theme: {
    background: '#030712',
    foreground: '#f3f4f6',
    cursor: '#8b5cf6',
    cursorAccent: '#030712',
    selectionBackground: 'rgba(139, 92, 246, 0.3)',
    black: '#000000',
    red: '#ef4444',
    green: '#10b981',
    yellow: '#f59e0b',
    blue: '#3b82f6',
    magenta: '#8b5cf6',
    cyan: '#06b6d4',
    white: '#e5e7eb',
    brightBlack: '#4b5563',
    brightRed: '#f87171',
    brightGreen: '#34d399',
    brightYellow: '#fbbf24',
    brightBlue: '#60a5fa',
    brightMagenta: '#a78bfa',
    brightCyan: '#22d3ee',
    brightWhite: '#ffffff'
  },
  fontFamily: '"Fira Code", Courier, monospace',
  fontSize: 14,
  lineHeight: 1.2
});

const fitAddon = new FitAddon.FitAddon();
term.loadAddon(fitAddon);

// Open Terminal in target div
const terminalContainer = document.getElementById('terminal-container');
term.open(terminalContainer);
fitAddon.fit();

let ws;
let currentUsername = '';
let currentPassword = '';

// DOM Elements
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const cpuValue = document.getElementById('cpu-value');
const cpuProgress = document.getElementById('cpu-progress');
const ramValue = document.getElementById('ram-value');
const ramProgress = document.getElementById('ram-progress');
const uptimeValue = document.getElementById('uptime-value');
const btnClear = document.getElementById('btn-clear');
const btnReconnect = document.getElementById('btn-reconnect');
const sidebar = document.getElementById('sidebar');
const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');

const loginOverlay = document.getElementById('login-overlay');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const usernameInput = document.getElementById('ssh-username');
const passwordInput = document.getElementById('ssh-password');
const btnLoginSubmit = document.getElementById('btn-login-submit');

// Uptime formatter helper
function formatUptime(seconds) {
  const days = Math.floor(seconds / (24 * 3600));
  const hours = Math.floor((seconds % (24 * 3600)) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);
  return parts.join(' ');
}

// Connect WebSocket
function connect(username, password) {
  // Clear previous terminal content and write connection prompt
  term.reset();
  term.write('\x1b[36m⚡ Connecting and authenticating terminal session...\x1b[0m\r\n');
  
  statusDot.className = 'status-dot';
  statusText.textContent = 'Connecting...';
  
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/terminal`;
  
  ws = new WebSocket(wsUrl);
  
  ws.onopen = () => {
    statusDot.className = 'status-dot';
    statusText.textContent = 'Authenticating...';
    
    // Send initial resize to fit the terminal size and perform the SSH authentication handshake
    fitAddon.fit();
    ws.send(JSON.stringify({
      action: 'connect',
      username: username,
      password: password,
      cols: term.cols,
      rows: term.rows
    }));
  };
  
  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.action === 'output') {
        term.write(msg.data);
      } else if (msg.action === 'title') {
        // Successful authentication - update title and hide login card
        document.getElementById('terminal-session-title').textContent = msg.data;
        statusDot.className = 'status-dot connected';
        statusText.textContent = 'Connected';
        loginOverlay.classList.add('hidden');
        passwordInput.value = ''; // Clear password field for security
      } else if (msg.action === 'error') {
        // Display auth error
        showLoginError(msg.data);
        ws.close();
      } else if (msg.action === 'stats') {
        // Update dashboard metrics
        cpuValue.textContent = `${msg.cpu}%`;
        cpuProgress.style.width = `${msg.cpu}%`;
        
        ramValue.textContent = `${msg.ram}%`;
        ramProgress.style.width = `${msg.ram}%`;
        
        uptimeValue.textContent = formatUptime(msg.uptime);
      }
    } catch (err) {
      // If parsing fails, just write raw data
      term.write(event.data);
    }
  };
  
  ws.onerror = (err) => {
    console.error('WebSocket error:', err);
    term.write('\r\n\x1b[31m⚡ Connection error!\x1b[0m\r\n');
    showLoginError('Connection error. Is the server running?');
  };
  
  ws.onclose = () => {
    statusDot.className = 'status-dot';
    statusText.textContent = 'Disconnected';
    term.write('\r\n\x1b[31m⚡ Session ended. Please log in again.\x1b[0m\r\n');
    
    // Clear status values
    cpuValue.textContent = '0%';
    cpuProgress.style.width = '0%';
    ramValue.textContent = '0%';
    ramProgress.style.width = '0%';
    uptimeValue.textContent = '--:--:--';
    
    // Re-show login screen
    loginOverlay.classList.remove('hidden');
  };
}

// Show login error helper
function showLoginError(message) {
  loginError.textContent = message;
  loginError.style.display = 'block';
  btnLoginSubmit.disabled = false;
  btnLoginSubmit.textContent = 'Connect Session';
}

// Forward user keystrokes to WebSocket
term.onData((data) => {
  if (ws && ws.readyState === WebSocket.OPEN && loginOverlay.classList.contains('hidden')) {
    ws.send(JSON.stringify({ action: 'input', data }));
  }
});

// Watch size changes on container to auto-resize
const resizeObserver = new ResizeObserver(() => {
  try {
    fitAddon.fit();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        action: 'resize',
        cols: term.cols,
        rows: term.rows
      }));
    }
  } catch (e) {
    // Fit addon can fail if container is temporarily invisible or has 0 width
  }
});
resizeObserver.observe(terminalContainer);

// Control actions
btnToggleSidebar.addEventListener('click', () => {
  sidebar.classList.toggle('collapsed');
});

btnClear.addEventListener('click', () => {
  term.clear();
});

btnReconnect.addEventListener('click', () => {
  if (ws) {
    ws.close();
  }
  // This will naturally trigger onclose and show the login overlay
});

// Login Form Submission
loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  loginError.style.display = 'none';
  
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  
  if (!username || !password) {
    showLoginError('Please enter both username and password.');
    return;
  }
  
  btnLoginSubmit.disabled = true;
  btnLoginSubmit.textContent = 'Connecting...';
  
  currentUsername = username;
  currentPassword = password;
  
  connect(username, password);
});
