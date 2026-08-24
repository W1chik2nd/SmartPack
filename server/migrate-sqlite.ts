import { DatabaseSync } from "node:sqlite";
import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPostgresPool,
  inTransaction,
  type PostgresQueryable,
} from "./postgres.ts";

type SqliteValue = string | number | bigint | Buffer | null;
type SqliteRow = Record<string, SqliteValue>;

const root = dirname(fileURLToPath(import.meta.url));
const sqlitePath = process.env.SQLITE_PATH ?? join(root, "data", "wearroute.db");
const connectionString = process.env.DATABASE_URL;

if (!connectionString) throw new Error("DATABASE_URL is required.");
if (!existsSync(sqlitePath)) throw new Error(`SQLite database not found: ${sqlitePath}`);

const sqlite = new DatabaseSync(sqlitePath, { readOnly: true });
const pool = await createPostgresPool(connectionString);

function sqliteRows(table: string, columns: string[]): SqliteRow[] {
  return sqlite.prepare(`SELECT ${columns.join(", ")} FROM ${table}`).all() as SqliteRow[];
}

async function upsert(
  db: PostgresQueryable,
  table: string,
  columns: string[],
  values: SqliteValue[],
  conflictColumn: string
): Promise<void> {
  const updates = columns
    .filter((column) => column !== conflictColumn)
    .map((column) => `${column} = EXCLUDED.${column}`)
    .join(", ");
  await db.query(
    `INSERT INTO ${table} (${columns.join(", ")})
     VALUES (${columns.map((_, index) => `$${index + 1}`).join(", ")})
     ON CONFLICT (${conflictColumn}) DO UPDATE SET ${updates}`,
    values
  );
}

async function copyTable(
  db: PostgresQueryable,
  table: string,
  columns: string[],
  conflictColumn: string
): Promise<number> {
  const values = sqliteRows(table, columns);
  for (const value of values) {
    await upsert(
      db,
      table,
      columns,
      columns.map((column) => value[column]),
      conflictColumn
    );
  }
  return values.length;
}

const counts = await inTransaction(pool, async (client) => {
  const migrated: Record<string, number> = {};
  const userColumns = [
    "id", "email", "name", "pass_salt", "pass_hash", "age", "height_cm",
    "weight_kg", "style", "gender", "bust_cm", "waist_cm", "hip_cm",
    "body_type", "season_color_type", "style_prefs", "wear_feel",
    "wear_feel_other", "travel_habits", "travel_habits_other", "created_at",
  ];
  migrated.users = await copyTable(client, "users", userColumns, "id");

  const sessionColumns = ["token", "user_id", "created_at"];
  migrated.sessions = await copyTable(client, "sessions", sessionColumns, "token");

  const wardrobeColumns = [
    "id", "user_id", "title", "category", "subtype", "count", "colors",
    "fit", "material", "seasons", "style_tags", "details", "created_at",
  ];
  const wardrobeRows = sqliteRows("wardrobe_items", [
    ...wardrobeColumns,
    "photo_file",
  ]);
  for (const value of wardrobeRows) {
    const filename = typeof value.photo_file === "string" ? value.photo_file : null;
    const path = filename ? join(dirname(sqlitePath), "photos", filename) : null;
    const photoData = path && existsSync(path) ? readFileSync(path) : null;
    const photoType = path
      ? extname(path).toLowerCase() === ".png"
        ? "image/png"
        : "image/jpeg"
      : null;
    const columns = [...wardrobeColumns, "photo_data", "photo_content_type"];
    await upsert(
      client,
      "wardrobe_items",
      columns,
      [
        ...wardrobeColumns.map((column) => value[column]),
        photoData,
        photoType,
      ],
      "id"
    );
  }
  migrated.wardrobe_items = wardrobeRows.length;

  migrated.trip_plans = await copyTable(
    client,
    "trip_plans",
    [
      "id", "user_id", "scenario", "place_name", "place_detail", "lat", "lon",
      "start_date", "end_date", "notes", "itinerary_id", "generation_status",
      "generation_error", "created_at",
    ],
    "id"
  );
  migrated.trips = await copyTable(
    client,
    "trips",
    [
      "id", "user_id", "title", "title_en", "scenario", "depart_label",
      "source_plan_id", "created_at",
    ],
    "id"
  );
  migrated.trip_days = await copyTable(
    client,
    "trip_days",
    [
      "id", "trip_id", "day_number", "date_label", "city", "city_en", "summary",
      "summary_en", "weather_summary", "weather_summary_en", "weather_risk",
      "weather_risk_en", "outfit_json", "equipment_json",
    ],
    "id"
  );
  migrated.trip_stops = await copyTable(
    client,
    "trip_stops",
    [
      "id", "day_id", "position", "kind", "name", "name_en", "start_time",
      "duration", "note", "note_en", "photo_query", "photo_url", "photo_credit",
      "photo_source_url",
    ],
    "id"
  );
  migrated.generated_packing_plans = await copyTable(
    client,
    "generated_packing_plans",
    ["trip_plan_id", "user_id", "trip_days", "plan_json", "created_at"],
    "trip_plan_id"
  );
  return migrated;
});

sqlite.close();
await pool.end();
console.log(
  Object.entries(counts)
    .map(([table, count]) => `${table}=${count}`)
    .join(" ")
);
