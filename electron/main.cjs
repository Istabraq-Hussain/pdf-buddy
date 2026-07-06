// Electron main process — loads the static offline renderer from disk.
const { app, BrowserWindow, protocol, shell } = require("electron");
const fs = require("fs");
const path = require("path");

protocol.registerSchemesAsPrivileged([
  {
    scheme: "pdf24",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

function getRendererRoot() {
  return path.join(__dirname, "..", "dist-electron");
}

function getRendererPath() {
  return path.join(getRendererRoot(), "electron", "index.html");
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".js" || ext === ".mjs") return "text/javascript; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".ico") return "image/x-icon";
  return "application/octet-stream";
}

function registerLocalAppProtocol() {
  protocol.handle("pdf24", async (request) => {
    const url = new URL(request.url);
    const root = getRendererRoot();
    const requestedPath = decodeURIComponent(url.pathname === "/" ? "/electron/index.html" : url.pathname);
    const filePath = path.normalize(path.join(root, requestedPath));

    if (!filePath.startsWith(root + path.sep)) {
      return new Response("Forbidden", { status: 403 });
    }

    try {
      const data = await fs.promises.readFile(filePath);
      return new Response(data, {
        headers: { "content-type": getContentType(filePath) },
      });
    } catch (error) {
      console.error("[protocol] failed to read", filePath, error);
      return new Response("Not found", { status: 404 });
    }
  });
}

function renderFailurePage(message, detail = "") {
  return `<!doctype html><html><head><meta charset="utf-8" />
    <title>PDF24 Toolkit could not start</title>
    <style>
      body{margin:0;font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#ecfdf5;color:#064e3b;display:grid;min-height:100vh;place-items:center;padding:32px;box-sizing:border-box}
      main{max-width:760px;border:1px solid #a7f3d0;background:white;border-radius:12px;padding:28px;box-shadow:0 20px 45px rgba(6,78,59,.12)}
      h1{margin:0 0 10px;font-size:24px} p{line-height:1.5} pre{overflow:auto;background:#022c22;color:#d1fae5;border-radius:8px;padding:14px;white-space:pre-wrap}
    </style></head><body><main>
      <h1>PDF24 Toolkit could not start</h1>
      <p>${message}</p>
      ${detail ? `<pre>${detail.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c])}</pre>` : ""}
    </main></body></html>`;
}

app.whenReady().then(async () => {
  registerLocalAppProtocol();

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

  win.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    console.log(`[renderer:${level}] ${message} (${sourceId}:${line})`);
  });

  win.webContents.on("did-fail-load", (_e, code, desc, url) => {
    console.error("[did-fail-load]", code, desc, url);
    win.loadURL(
      "data:text/html;charset=utf-8," +
        encodeURIComponent(renderFailurePage("The local app file failed to load.", `${code} ${desc}\n${url}`)),
    );
  });

  const rendererPath = getRendererPath();
  if (!fs.existsSync(rendererPath)) {
    win.loadURL(
      "data:text/html;charset=utf-8," +
        encodeURIComponent(renderFailurePage("The packaged renderer file is missing.", rendererPath)),
    );
    return;
  }

  await win.loadURL("pdf24://app/electron/index.html");
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
