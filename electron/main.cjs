// Electron main process — starts the bundled TanStack Start Node SSR
// server on a random localhost port, then loads it in a window.
const { app, BrowserWindow, shell } = require("electron");
const { spawn } = require("child_process");
const net = require("net");
const path = require("path");
const http = require("http");

function findFreePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.unref();
    s.on("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() - start > timeoutMs) return reject(new Error("SSR server timeout"));
        setTimeout(tick, 150);
      });
    };
    tick();
  });
}

let child;

async function startServer() {
  const port = await findFreePort();
  const serverEntry = path.join(__dirname, "..", "dist", "server", "index.mjs");
  child = spawn(process.execPath, [serverEntry], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", PORT: String(port), HOST: "127.0.0.1", NODE_ENV: "production" },
    stdio: ["ignore", "inherit", "inherit"],
  });
  child.on("exit", (code) => {
    console.error("[ssr] exited with code", code);
  });
  const url = `http://127.0.0.1:${port}/`;
  await waitForServer(url);
  return url;
}

app.whenReady().then(async () => {
  let baseUrl;
  try {
    baseUrl = await startServer();
  } catch (err) {
    console.error("Failed to start SSR server:", err);
    app.quit();
    return;
  }

  const win = new BrowserWindow({
    width: 1200,
    height: 820,
    title: "PDF24 Toolkit",
    backgroundColor: "#ecfdf5",
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  win.setMenuBarVisibility(false);
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("did-fail-load", (_e, code, desc, url) => {
    console.error("[did-fail-load]", code, desc, url);
  });
  win.loadURL(baseUrl);
});

app.on("window-all-closed", () => {
  if (child) try { child.kill(); } catch {}
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (child) try { child.kill(); } catch {}
});
