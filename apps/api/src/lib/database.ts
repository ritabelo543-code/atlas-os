import { Pool } from "pg";
import type { CollectionStore } from "@atlas/core";
import { checkSqliteHealth, createSqliteAppendStore, createSqliteStore, type SqliteAppendStore } from "./sqlite.js";

type AppendStore<T> = { load(): Promise<T[]>; append(id: string, item: T): Promise<void>; close(): void };
let pool: Pool | undefined;
let initialized: Promise<void> | undefined;

function postgres(): Pool {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error("DATABASE_URL is required for PostgreSQL storage");
  pool ??= new Pool({ connectionString, max: Number(process.env.ATLAS_DATABASE_POOL_SIZE ?? 10), connectionTimeoutMillis: 10_000, idleTimeoutMillis: 30_000, ssl: process.env.PGSSLMODE === "disable" ? false : undefined });
  return pool;
}

function initialize(): Promise<void> {
  initialized ??= postgres().query(`
    CREATE TABLE IF NOT EXISTS atlas_collections (
      collection TEXT NOT NULL,
      position INTEGER NOT NULL,
      payload JSONB NOT NULL,
      PRIMARY KEY(collection, position)
    );
    CREATE TABLE IF NOT EXISTS atlas_events (
      sequence BIGSERIAL PRIMARY KEY,
      collection TEXT NOT NULL,
      event_id TEXT NOT NULL,
      payload JSONB NOT NULL,
      UNIQUE(collection, event_id)
    );
    CREATE INDEX IF NOT EXISTS atlas_events_collection_sequence_idx ON atlas_events(collection, sequence DESC);
  `).then(() => undefined);
  return initialized;
}

export function usesPostgres(): boolean { return Boolean(process.env.DATABASE_URL?.trim()); }

export function createCollectionStore<T>(databasePath: string, collection: string): CollectionStore<T> {
  if (!usesPostgres()) return createSqliteStore<T>(databasePath, collection);
  return {
    async load() { await initialize(); const result = await postgres().query<{ payload: T }>("SELECT payload FROM atlas_collections WHERE collection = $1 ORDER BY position", [collection]); return result.rows.map((row) => row.payload); },
    async save(items) { await initialize(); const client = await postgres().connect(); try { await client.query("BEGIN"); await client.query("DELETE FROM atlas_collections WHERE collection = $1", [collection]); for (let position = 0; position < items.length; position++) await client.query("INSERT INTO atlas_collections(collection, position, payload) VALUES ($1, $2, $3::jsonb)", [collection, position, JSON.stringify(items[position])]); await client.query("COMMIT"); } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); } },
  };
}

export function createAppendStore<T extends { id: string }>(databasePath: string, collection: string): AppendStore<T> {
  if (!usesPostgres()) return createSqliteAppendStore<T>(databasePath, collection) as SqliteAppendStore<T>;
  return {
    async load() { await initialize(); const result = await postgres().query<{ payload: T }>("SELECT payload FROM atlas_events WHERE collection = $1 ORDER BY sequence DESC", [collection]); return result.rows.map((row) => row.payload); },
    async append(id, item) { await initialize(); await postgres().query("INSERT INTO atlas_events(collection, event_id, payload) VALUES ($1, $2, $3::jsonb) ON CONFLICT(collection, event_id) DO NOTHING", [collection, id, JSON.stringify(item)]); },
    close() {},
  };
}

export async function checkDatabaseHealth(databasePath: string): Promise<boolean> {
  if (!usesPostgres()) return checkSqliteHealth(databasePath);
  await initialize(); const result = await postgres().query<{ healthy: number }>("SELECT 1 AS healthy"); return result.rows[0]?.healthy === 1;
}

export async function closeDatabasePool(): Promise<void> { if (pool) { await pool.end(); pool = undefined; initialized = undefined; } }
