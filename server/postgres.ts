import pg, { type PoolClient, type PoolConfig } from "pg";

const { Pool } = pg;

export type PostgresPool = InstanceType<typeof Pool>;
export type PostgresQueryable = PostgresPool | PoolClient;

export async function rows<T>(
  db: PostgresQueryable,
  text: string,
  values: unknown[] = []
): Promise<T[]> {
  return (await db.query(text, values)).rows as T[];
}

export async function row<T>(
  db: PostgresQueryable,
  text: string,
  values: unknown[] = []
): Promise<T | null> {
  return (await rows<T>(db, text, values))[0] ?? null;
}

export async function inTransaction<T>(
  pool: PostgresPool,
  work: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function createPostgresPool(
  connectionString: string
): Promise<PostgresPool> {
  const schema = process.env.DATABASE_SCHEMA ?? "wearroute";
  const pool = new Pool(postgresPoolConfig(connectionString, schema));
  await pool.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
  await initializePostgresSchema(pool);
  return pool;
}

export function postgresPoolConfig(
  connectionString: string,
  schema: string
): PoolConfig {
  if (!/^[a-z_][a-z0-9_]*$/.test(schema)) {
    throw new Error("DATABASE_SCHEMA must be a lowercase PostgreSQL identifier.");
  }
  return {
    connectionString,
    max: Number(process.env.DATABASE_POOL_SIZE ?? 5),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
    // Neon pooler rejects search_path in PostgreSQL's startup packet. Its
    // awaited connection hook runs the equivalent SQL before the client is
    // handed to any store, so every pooled connection uses our isolated schema.
    onConnect: async (client) => {
      await client.query(`SELECT set_config('search_path', $1, false)`, [
        `${schema},public`,
      ]);
    },
  };
}

async function initializePostgresSchema(pool: PostgresPool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      name TEXT NOT NULL,
      pass_salt TEXT NOT NULL,
      pass_hash TEXT NOT NULL,
      age INTEGER,
      height_cm DOUBLE PRECISION,
      weight_kg DOUBLE PRECISION,
      style TEXT,
      gender TEXT,
      bust_cm DOUBLE PRECISION,
      waist_cm DOUBLE PRECISION,
      hip_cm DOUBLE PRECISION,
      body_type TEXT,
      season_color_type TEXT,
      style_prefs TEXT,
      wear_feel TEXT,
      wear_feel_other TEXT,
      travel_habits TEXT,
      travel_habits_other TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique
      ON users (LOWER(email));

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS wardrobe_items (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      subtype TEXT NOT NULL DEFAULT '',
      count INTEGER NOT NULL DEFAULT 1,
      colors TEXT NOT NULL DEFAULT '[]',
      fit TEXT NOT NULL DEFAULT '',
      material TEXT NOT NULL DEFAULT '',
      seasons TEXT NOT NULL DEFAULT '[]',
      style_tags TEXT NOT NULL DEFAULT '[]',
      details TEXT NOT NULL DEFAULT '',
      photo_data BYTEA,
      photo_content_type TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_wardrobe_user
      ON wardrobe_items(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS trip_plans (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      scenario TEXT NOT NULL,
      place_name TEXT NOT NULL,
      place_detail TEXT NOT NULL DEFAULT '',
      lat DOUBLE PRECISION NOT NULL,
      lon DOUBLE PRECISION NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      itinerary_id TEXT,
      generation_status TEXT NOT NULL DEFAULT 'pending',
      generation_error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_trip_plans_user
      ON trip_plans(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS trips (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      title_en TEXT NOT NULL DEFAULT '',
      scenario TEXT NOT NULL DEFAULT 'travel',
      depart_label TEXT NOT NULL DEFAULT '',
      source_plan_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_trips_user
      ON trips(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS trip_days (
      id TEXT PRIMARY KEY,
      trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
      day_number INTEGER NOT NULL,
      date_label TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT '',
      city_en TEXT NOT NULL DEFAULT '',
      summary TEXT NOT NULL DEFAULT '',
      summary_en TEXT NOT NULL DEFAULT '',
      weather_summary TEXT NOT NULL DEFAULT '',
      weather_summary_en TEXT NOT NULL DEFAULT '',
      weather_risk TEXT NOT NULL DEFAULT '',
      weather_risk_en TEXT NOT NULL DEFAULT '',
      outfit_json TEXT NOT NULL DEFAULT '[]',
      equipment_json TEXT NOT NULL DEFAULT '[]'
    );
    CREATE INDEX IF NOT EXISTS idx_trip_days_trip
      ON trip_days(trip_id, day_number);

    CREATE TABLE IF NOT EXISTS trip_stops (
      id TEXT PRIMARY KEY,
      day_id TEXT NOT NULL REFERENCES trip_days(id) ON DELETE CASCADE,
      position INTEGER NOT NULL,
      kind TEXT NOT NULL DEFAULT 'spot',
      name TEXT NOT NULL,
      name_en TEXT NOT NULL DEFAULT '',
      start_time TEXT NOT NULL DEFAULT '',
      duration TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      note_en TEXT NOT NULL DEFAULT '',
      photo_query TEXT NOT NULL DEFAULT '',
      photo_url TEXT,
      photo_credit TEXT,
      photo_source_url TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_trip_stops_day
      ON trip_stops(day_id, position);

    CREATE TABLE IF NOT EXISTS generated_packing_plans (
      trip_plan_id TEXT PRIMARY KEY REFERENCES trip_plans(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      trip_days INTEGER NOT NULL,
      plan_json TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_generated_packing_user
      ON generated_packing_plans(user_id, created_at DESC);
  `);

  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS gender TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS bust_cm DOUBLE PRECISION;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS waist_cm DOUBLE PRECISION;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS hip_cm DOUBLE PRECISION;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS body_type TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS season_color_type TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS style_prefs TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS wear_feel TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS wear_feel_other TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS travel_habits TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS travel_habits_other TEXT;
    ALTER TABLE wardrobe_items ADD COLUMN IF NOT EXISTS subtype TEXT NOT NULL DEFAULT '';
    ALTER TABLE wardrobe_items ADD COLUMN IF NOT EXISTS photo_data BYTEA;
    ALTER TABLE wardrobe_items ADD COLUMN IF NOT EXISTS photo_content_type TEXT;
    ALTER TABLE trip_plans ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '';
    ALTER TABLE trip_plans ADD COLUMN IF NOT EXISTS itinerary_id TEXT;
    ALTER TABLE trip_plans ADD COLUMN IF NOT EXISTS generation_status TEXT NOT NULL DEFAULT 'pending';
    ALTER TABLE trip_plans ADD COLUMN IF NOT EXISTS generation_error TEXT;
    ALTER TABLE trips ADD COLUMN IF NOT EXISTS source_plan_id TEXT;
    ALTER TABLE trip_days ADD COLUMN IF NOT EXISTS weather_summary TEXT NOT NULL DEFAULT '';
    ALTER TABLE trip_days ADD COLUMN IF NOT EXISTS weather_summary_en TEXT NOT NULL DEFAULT '';
    ALTER TABLE trip_days ADD COLUMN IF NOT EXISTS weather_risk TEXT NOT NULL DEFAULT '';
    ALTER TABLE trip_days ADD COLUMN IF NOT EXISTS weather_risk_en TEXT NOT NULL DEFAULT '';
    ALTER TABLE trip_days ADD COLUMN IF NOT EXISTS outfit_json TEXT NOT NULL DEFAULT '[]';
    ALTER TABLE trip_days ADD COLUMN IF NOT EXISTS equipment_json TEXT NOT NULL DEFAULT '[]';
  `);
}
