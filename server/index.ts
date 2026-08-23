// Entry point: wires the app to a real port and an on-disk database.
// All request handling lives in app.ts so tests can exercise it directly.
import { createServer } from "node:http";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "data");
mkdirSync(DATA_DIR, { recursive: true });

const PORT = Number(process.env.PORT ?? 4177);
// Serve the client build when present, so a single port works in production.
const app = createApp(
  join(DATA_DIR, "smartpack.db"),
  join(__dirname, "..", "client", "dist")
);

createServer(app.handle).listen(PORT, () => {
  console.log(`SmartPack auth server listening on http://localhost:${PORT}`);
});
