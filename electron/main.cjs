// Electron main process — serves the built SPA locally and opens it in a window.
const { app, BrowserWindow, shell } = require("electron");
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "dist", "client");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".wasm": "application/wasm",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let url = decodeURIComponent((req.url || "/").split("?")[0]);
      let filePath = path.join(ROOT, url === "/" ? "index.html" : url);
      if (!filePath.startsWith(ROOT)) {
        res.writeHead(403); return res.end();
      }
      fs.stat(filePath, (err, stat) => {
        if (err || !stat.isFile()) {
          // SPA fallback
          filePath = path.join(ROOT, "index.html");
        }
        const ext = path.extname(filePath).toLowerCase();
        res.setHeader("Content-Type", MIME[ext] || "application/octet-stream");
        fs.createReadStream(filePath).pipe(res);
      });
    });
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      resolve(`http://127.0.0.1:${port}`);
    });
  });
}

app.whenReady().then(async () => {
  const baseUrl = await serve();
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
  win.webContents.on("render-process-gone", (_e, details) => {
    console.error("[render-process-gone]", details);
  });
  win.webContents.on("console-message", (_e, level, msg, line, src) => {
    console.log(`[renderer:${level}] ${msg} (${src}:${line})`);
  });
  win.webContents.openDevTools({ mode: "detach" });
  win.loadURL(baseUrl);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
