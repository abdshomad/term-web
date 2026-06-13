# Detailed Feature List - Antigravity Terminal

This document provides a comprehensive overview of the backend processes, frontend modules, protocol design, and styling guidelines implemented in the **Antigravity Terminal** project.

---

## 1. Interactive Shell Execution Engine

The core terminal execution runs on a Node.js process that wraps terminal input/output and manages interactive terminal spawning:

- **Pseudoterminal (PTY) Spawning**: The backend uses the native [`node-pty`](https://github.com/microsoft/node-pty) library to spawn shell sessions. This simulates authentic terminal capabilities (such as standard input, output, control signals, cursor positioning, and colored exit codes) rather than running commands as raw, non-interactive subprocesses.
- **Automated SSH Bridge**: By default, the application runs inside a container and establishes an SSH bridge using `sshpass` combined with native `ssh`. The backend programmatically issues the command:
  ```bash
  sshpass -p <password> ssh -o StrictHostKeyChecking=no <username>@<SSH_HOST>
  ```
  This automatically accepts host signatures and logs in with the specified user credentials.
- **Dynamic Terminal Resizing**: Terminal resize events (e.g., resizing the browser window) are observed by the client and sent to the server. The server invokes `ptyProcess.resize(cols, rows)` to dynamically instruct the terminal interface to adjust its layout, wrapping lines appropriately.

---

## 2. WebSocket Real-Time Synchronization Protocol

All communications between the browser client and the backend server occur over a WebSocket connection bound to the path `/terminal`.

### Connection Handshake
1. On initial WebSocket load, the server starts a **15-second authentication timeout timer**.
2. The client must immediately send an initialization payload of action type `connect` containing credentials:
   ```json
   {
     "action": "connect",
     "username": "...",
     "password": "...",
     "cols": 80,
     "rows": 24
   }
   ```
3. If credentials are correct, the backend spawns the `node-pty` process, clears the timeout, sends a `title` message to verify login, and initializes periodic telemetry stats.
4. If authentication fails, the server sends an `error` message and closes the socket.

### Data Channel Payloads
| Action | Direction | Description | Data Structure |
| :--- | :--- | :--- | :--- |
| `connect` | Client $\rightarrow$ Server | Initiates authentication and session parameters | `{ action: "connect", username, password, cols, rows }` |
| `input` | Client $\rightarrow$ Server | Forwards keypresses/actions to the terminal process | `{ action: "input", data: "..." }` |
| `resize` | Client $\rightarrow$ Server | Informs the PTY to adjust its row/column dimensions | `{ action: "resize", cols: N, rows: M }` |
| `output` | Server $\rightarrow$ Client | Forwards raw terminal print codes/data to the browser | `{ action: "output", data: "..." }` |
| `title` | Server $\rightarrow$ Client | Confirms connection and details target shell session | `{ action: "title", data: "ssh user@host" }` |
| `stats` | Server $\rightarrow$ Client | Broadcasts live CPU, RAM, and uptime metrics (every 2s) | `{ action: "stats", cpu: X, ram: Y, uptime: Z }` |
| `error` | Server $\rightarrow$ Client | Informs the client of auth failure or crash details | `{ action: "error", data: "..." }` |

---

## 3. Advanced Frontend UI & Custom Themes

The UI is custom-designed using standard HTML5 and Vanilla CSS to ensure maximum performance and rich aesthetics:

- **Glassmorphism Design System**:
  - Blurs the background layers (`backdrop-filter: blur(12px)`) to create a floating pane appearance.
  - Features gradient backdrops, sleek glowing indicators, and semi-transparent dark borders (`rgba(255, 255, 255, 0.08)`).
- **Typography Layout**:
  - Uses the **Plus Jakarta Sans** font family for headers, sidebars, dashboard telemetry, and form elements.
  - Uses the **Fira Code** font family for all text printed in the terminal console viewport.
- **xterm.js Canvas Customization**:
  - **Color Palette**: Overrides standard shell outputs to fit a high-contrast theme (purple cursors, bright-green status dots, and soft grey highlights).
  - **Scrollbars**: Custom scrollbars are styled inside the terminal window to match the modern look.

---

## 4. Host Metric Dashboard & Sidebar Diagnostics

A collapsible diagnostics sidebar monitors the server environment hosting the shell:

- **CPU Usage Telemetry**:
  - Computed by calculating the tick difference in `/proc/stat` parameters using `os.cpus()`.
  - Compares CPU idle times and total time differences across a 100ms interval on the server.
- **Memory (RAM) Diagnostics**:
  - Evaluates system usage via `os.totalmem()` and `os.freemem()`.
  - Expresses consumption as a neat integer percentage.
- **Uptime Monitor**:
  - Dynamically formats native OS uptime seconds into a human-readable format: `X days, Y hours, Z minutes, A seconds`.
- **Responsive Collapsible Drawer**:
  - Side navigation panels slide smoothly (`transition: margin-left 0.3s`) to allow full screen focus.
  - Completely responsive: wraps into horizontal metric badges on mobile layouts.

---

## 5. Session Control Operations

Three interactive operations are provided in the UI:

1. **Credentials Portal**: An input overlay blocks interface interaction until login. All password fields are cleared from the page state immediately after validation.
2. **Clear Buffer**: Clicking the "Clear Screen" button invokes `term.clear()` to erase the terminal scrollback history.
3. **Reset Connection**: The "Reset Connection" button triggers socket teardown, kills the backend SSH process safely, and resets all dashboard graphs back to `0%`.

---

## 6. Containerization and Infrastructure

The project is structured to run in isolated microservices:

- **Build Toolchain**: Installs `g++`, `make`, and `python3` dynamically in the `node:22-slim` image to compile the C++ bindings required by `node-pty`.
- **Local Network Routing**: Employs `extra_hosts` with the `host-gateway` flag in `docker-compose.yml` to resolve `host.docker.internal`, allowing the container to establish SSH tunnels back to the local developer host.
