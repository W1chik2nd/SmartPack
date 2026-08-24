// Entry point: wires the app to a real port and an on-disk database.
// All request handling lives in app.ts so tests can exercise it directly.
import { createServer } from "node:http";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "data");
mkdirSync(DATA_DIR, { recursive: true });

// Load server/.env when present (AI key etc.) from code rather than the
// --env-file-if-exists flag: that flag needs Node 22.9+ and kills startup
// with "bad option" below it, while this works on every Node we support.
const envPath = join(__dirname, ".env");
if (existsSync(envPath)) process.loadEnvFile(envPath);

const PORT = Number(process.env.PORT ?? 4177);
const app = createApp(join(DATA_DIR, "smartpack.db"));

const server = createServer(app.handle);

// A stale server instance holding the port is the classic "nothing works"
// failure: Vite still proxies /api here, but to old code and old data.
// Fail loudly with the fix instead of a raw EADDRINUSE stack trace.
server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `Port ${PORT} is already in use — another WearRoute server is likely still running.\n` +
        `Stop it with:  lsof -ti :${PORT} | xargs kill\n` +
        `…or start this one on another port:  PORT=4178 npm run dev`
    );
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, () => {
  console.log(`WearRoute auth server listening on http://localhost:${PORT}`);
});
