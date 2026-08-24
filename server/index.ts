// Entry point: wires the app to a real port and an on-disk database.
// All request handling lives in app.ts so tests can exercise it directly.
import { createServer } from "node:http";
import { createReadStream, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp, createPostgresApp } from "./app.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "data");
mkdirSync(DATA_DIR, { recursive: true });

// Load server/.env when present (AI key etc.) from code rather than the
// --env-file-if-exists flag: that flag needs Node 22.9+ and kills startup
// with "bad option" below it, while this works on every Node we support.
const envPath = join(__dirname, ".env");
if (existsSync(envPath)) process.loadEnvFile(envPath);

const PORT = Number(process.env.PORT ?? 4177);
const app = process.env.DATABASE_URL
  ? await createPostgresApp(process.env.DATABASE_URL)
  : createApp(join(DATA_DIR, "wearroute.db"));

const CLIENT_DIST = resolve(__dirname, "../client/dist");
const MIME: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (url.pathname.startsWith("/api/")) {
    await app.handle(req, res);
    return;
  }
  const requested = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
  let file = resolve(CLIENT_DIST, requested);
  if (!file.startsWith(`${CLIENT_DIST}${sep}`) || !existsSync(file) || !statSync(file).isFile()) {
    file = join(CLIENT_DIST, "index.html");
  }
  if (!existsSync(file)) {
    res.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("WearRoute client build is missing. Run npm run build first.");
    return;
  }
  res.writeHead(200, {
    "Content-Type": MIME[extname(file).toLowerCase()] ?? "application/octet-stream",
    "Cache-Control": file.endsWith("index.html")
      ? "no-cache"
      : "public, max-age=31536000, immutable",
  });
  createReadStream(file).pipe(res);
});

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
  console.log(`WearRoute server listening on http://localhost:${PORT}`);
});

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    server.close(() => void Promise.resolve(app.close()).finally(() => process.exit(0)));
  });
}
