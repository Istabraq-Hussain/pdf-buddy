// After `vite build`, generates dist/client/index.html so the built assets
// can be loaded as a plain SPA (used by the Electron packaging step).
import fs from "node:fs";
import path from "node:path";

const clientDir = path.resolve("dist/client");
const assetsDir = path.join(clientDir, "assets");
if (!fs.existsSync(assetsDir)) {
  console.error("dist/client/assets not found — run `vite build` first.");
  process.exit(1);
}

const files = fs.readdirSync(assetsDir);
const entry = files.find((f) => /^index-.*\.js$/.test(f));
const css = files.find((f) => /\.css$/.test(f));
if (!entry) {
  console.error("Could not find an index-*.js entry in dist/client/assets");
  process.exit(1);
}

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>PDF24 Toolkit</title>
    ${css ? `<link rel="stylesheet" href="/assets/${css}" />` : ""}
    <link rel="icon" href="/favicon.ico" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/assets/${entry}"></script>
  </body>
</html>
`;

fs.writeFileSync(path.join(clientDir, "index.html"), html);
console.log("Wrote dist/client/index.html (entry:", entry + (css ? ", css: " + css : "") + ")");
