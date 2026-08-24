// One-command dev runner: starts the auth server (port 4177) and the Vite
// dev server (port 5177) together, prefixing output and shutting both down
// on Ctrl+C or when either process exits.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

// Resolve vite's CLI from the client package so this works with npm
// workspaces (hoisted to root node_modules) and pnpm (client/node_modules).
const clientRequire = createRequire(join(root, "client", "package.json"));
let viteBin;
try {
  // "vite/bin/vite.js" is not in vite's package exports, so resolve the
  // package.json (exempt from exports) and derive the bin path from it.
  const vitePkg = clientRequire.resolve("vite/package.json");
  viteBin = join(dirname(vitePkg), "bin", "vite.js");
} catch {
  console.error(
    "vite is not installed. Run `npm install` in the repository root first."
  );
  process.exit(1);
}

const procs = [];

function run(name, color, command, args, cwd) {
  const child = spawn(command, args, { cwd, env: process.env });
  procs.push(child);

  const prefix = `\x1b[${color}m[${name}]\x1b[0m `;
  const forward = (stream, out) => {
    let buf = "";
    stream.on("data", (chunk) => {
      buf += chunk.toString();
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) out.write(prefix + line + "\n");
    });
  };
  forward(child.stdout, process.stdout);
  forward(child.stderr, process.stderr);

  child.on("exit", (code) => {
    console.log(`${prefix}exited with code ${code ?? 0}`);
    shutdown(code ?? 0);
  });
  return child;
}

let shuttingDown = false;
function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const p of procs) p.kill("SIGTERM");
  setTimeout(() => process.exit(code), 200);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

run(
  "server",
  "36", // cyan
  process.execPath,
  ["--experimental-strip-types", "--env-file-if-exists=.env", "index.ts"],
  join(root, "server")
);

run(
  "client",
  "35", // magenta
  process.execPath,
  [viteBin],
  join(root, "client")
);
