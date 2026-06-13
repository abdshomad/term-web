# Antigravity Terminal ⚡

A premium, full-featured web-based terminal emulator powered by `xterm.js` and WebSockets, with live host performance and resource monitoring. This application allows users to establish secure, interactive SSH sessions to a target host right from their web browser.

---

## 🚀 Key Features

- **Interactive SSH Shell**: Real-time terminal session rendering inside the browser using [xterm.js](https://xtermjs.org/).
- **Dynamic Resizing**: Automatically handles viewport resize events using the `FitAddon` to fit the browser layout.
- **Performance Dashboard**: Toggleable sidebar showing live host metrics, including:
  - CPU Usage percentage.
  - Memory (RAM) Usage percentage.
  - Host Uptime tracker.
- **Secure Handshake**: Clean credential login screen that establishes authentication securely over WebSockets using `sshpass` and `node-pty`.
- **Beautiful Glassmorphic Design**: Sleek dark mode styling using the *Plus Jakarta Sans* and *Fira Code* fonts, smooth gradients, subtle micro-animations, and full responsiveness.
- **Fully Containerized**: Ready to deploy with a multi-stage Docker build and Docker Compose configuration.

---

## 🛠️ Technology Stack

### Frontend
- **HTML5 & Vanilla CSS**: Implements a glassmorphic design system using CSS custom properties (variables), backdrop filters, and custom scrollbars.
- **xterm.js**: Renders the terminal console emulator with custom theme settings.
- **WebSocket Client**: Synchronizes user keyboard inputs, resizing events, and parses system stats.

### Backend
- **Node.js & Express**: Serves frontend static assets and manages HTTP server upgrades.
- **ws (WebSocket Server)**: Intercepts connection requests to `/terminal` and forwards terminal data.
- **node-pty**: Spawns terminal processes (pseudoterminals) to run interactive commands.
- **sshpass**: Runs container-based SSH commands securely using password parameters.

---

## 📂 Project Structure

- **[server.js](./server.js)**: Node.js server setup containing WebSocket upgrade handling, SSH terminal spawn logic (`node-pty`), authentication flows, and system performance calculations.
- **`public/`**: Frontend assets.
  - **[public/index.html](./public/index.html)**: Main terminal viewport and credential login dialog structure.
  - **[public/client.js](./public/client.js)**: Terminal initialization, WebSocket communication, resize observer, and sidebar statistics updates.
  - **[public/style.css](./public/style.css)**: Sleek CSS design with customizable themes, responsive grids, and clean animations.
- **[Dockerfile](./Dockerfile)**: Multi-dependency installation (compiles `node-pty` using Python 3 and native compilation tools, installs openssh-client and sshpass).
- **[docker-compose.yml](./docker-compose.yml)**: Multi-container orchestration, mapping environments and mapping target host routes (`host.docker.internal`).
- **[.env](./.env)**: Environment configuration file defining port and host details.

---

## ⚙️ Configuration

Create a `.env` file in the root directory (a default one is provided):

```env
PORT=3046
SSH_USER=your_ssh_username
SSH_HOST=host.docker.internal
```

- `PORT`: The local port the Node.js server runs on.
- `SSH_USER`: The default SSH username for connection.
- `SSH_HOST`: The target host server. When running inside Docker, `host.docker.internal` allows SSH access back to the host machine.

---

## 🏁 Quick Start

### Option 1: Running with Docker (Recommended)

1. Ensure Docker is running on your machine.
2. Build and start the containers using Docker Compose:
   ```bash
   docker-compose up --build
   ```
3. Open your browser and navigate to `http://localhost:3046`.

### Option 2: Running Locally

1. Install system prerequisites (e.g., `sshpass` and `openssh-client` must be installed on your OS).
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to `http://localhost:3046`.

---

## 📖 Feature Reference

For a detailed breakdown of all the client, server, and infrastructure features of the terminal, please refer to the **[Feature List Documentation](./docs/feature-list.md)**.
