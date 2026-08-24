// Populate one development account with varied clothing so Trip Agent output
// can be inspected locally. This is intentionally an explicit script rather
// than app-start seeding: it never modifies a user's wardrobe unexpectedly.
import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createWardrobeStore } from "./wardrobe.ts";
import { DEMO_WARDROBE_ITEMS } from "./demo-wardrobe.ts";

const root = dirname(fileURLToPath(import.meta.url));
const dbPath = join(root, "data", "wearroute.db");
const email = process.argv[2] ?? "test@example.com";

if (!existsSync(dbPath)) {
  throw new Error(`Database not found: ${dbPath}`);
}

const db = new DatabaseSync(dbPath);
const user = db
  .prepare("SELECT id FROM users WHERE email = ? COLLATE NOCASE")
  .get(email) as { id: string } | undefined;
if (!user) throw new Error(`No user found for ${email}`);

const wardrobe = createWardrobeStore(db, join(root, "data", "photos"));
const existingTitles = new Set(wardrobe.list(user.id).map((item) => item.title));
let added = 0;
for (const item of DEMO_WARDROBE_ITEMS) {
  if (existingTitles.has(item.title)) continue;
  wardrobe.add(user.id, item);
  added += 1;
}
console.log(`Seeded ${added} wardrobe items for ${email}; total is ${wardrobe.list(user.id).length}.`);
