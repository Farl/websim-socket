const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "example");
const DEST = path.join(ROOT, ".site");

// Read .env.local if it exists
const env = {};
const envPath = path.join(ROOT, ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx > 0) {
      env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
    }
  }
}

// Copy example/ to .site/
fs.cpSync(SRC, DEST, { recursive: true });

// Replace placeholders in index.html
const htmlPath = path.join(DEST, "index.html");
let html = fs.readFileSync(htmlPath, "utf8");
html = html.replace(/__PARTYKIT_HOST__/g, env.PARTYKIT_HOST || "");
fs.writeFileSync(htmlPath, html);

const host = env.PARTYKIT_HOST || "(window.location.host)";
console.log(`Prepared example → .site/ (host: ${host})`);
