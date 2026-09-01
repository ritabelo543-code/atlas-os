import "../dotenv-loader.js";
import { DatabaseSync } from "node:sqlite";
import { Pool } from "pg";

const sqlitePath = process.env.ATLAS_DATABASE_PATH?.trim();
const connectionString = process.env.DATABASE_URL?.trim();
if (!sqlitePath || !connectionString) throw new Error("ATLAS_DATABASE_PATH and DATABASE_URL are required");

const source = new DatabaseSync(sqlitePath, { readOnly: true });
const target = new Pool({ connectionString, max: 1, ssl: process.env.PGSSLMODE === "disable" ? false : undefined });
const client = await target.connect();
try {
  await client.query("BEGIN");
  await client.query("CREATE TABLE IF NOT EXISTS atlas_collections (collection TEXT NOT NULL, position INTEGER NOT NULL, payload JSONB NOT NULL, PRIMARY KEY(collection, position))");
  await client.query("CREATE TABLE IF NOT EXISTS atlas_events (sequence BIGSERIAL PRIMARY KEY, collection TEXT NOT NULL, event_id TEXT NOT NULL, payload JSONB NOT NULL, UNIQUE(collection, event_id))");
  const existing = await client.query<{ total: string }>("SELECT (SELECT COUNT(*) FROM atlas_collections) + (SELECT COUNT(*) FROM atlas_events) AS total");
  if (Number(existing.rows[0]?.total ?? 0) > 0) throw new Error("PostgreSQL target is not empty; migration stopped to prevent overwriting data");
  const collections = source.prepare("SELECT collection, position, payload FROM atlas_collections ORDER BY collection, position").all() as Array<{ collection: string; position: number; payload: string }>;
  for (const row of collections) await client.query("INSERT INTO atlas_collections(collection, position, payload) VALUES ($1, $2, $3::jsonb)", [row.collection, row.position, row.payload]);
  const hasEvents = Boolean(source.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='atlas_events'").get());
  const events = hasEvents ? source.prepare("SELECT collection, event_id, payload FROM atlas_events ORDER BY sequence").all() as Array<{ collection: string; event_id: string; payload: string }> : [];
  for (const row of events) await client.query("INSERT INTO atlas_events(collection, event_id, payload) VALUES ($1, $2, $3::jsonb)", [row.collection, row.event_id, row.payload]);
  await client.query("COMMIT");
  console.log(JSON.stringify({ migratedCollections: collections.length, migratedEvents: events.length }));
} catch (error) {
  await client.query("ROLLBACK"); throw error;
} finally {
  client.release(); await target.end(); source.close();
}
