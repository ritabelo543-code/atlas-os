import { DatabaseSync } from "node:sqlite";
import { dirname } from "node:path";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import type { CollectionStore } from "@atlas/core";

export type SqliteAppendStore<T> = { load(): Promise<T[]>; append(id: string, item: T): Promise<void>; close(): void };

export function createSqliteStore<T>(databasePath: string, collection: string): CollectionStore<T> {
  mkdirSync(dirname(databasePath), { recursive: true });
  const db = new DatabaseSync(databasePath);
  db.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS atlas_collections (collection TEXT NOT NULL, position INTEGER NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(collection, position));");
  return {
    async load() { return db.prepare("SELECT payload FROM atlas_collections WHERE collection = ? ORDER BY position").all(collection).map((row) => JSON.parse(String((row as { payload: string }).payload)) as T); },
    async save(items) {
      db.exec("BEGIN IMMEDIATE");
      try { db.prepare("DELETE FROM atlas_collections WHERE collection = ?").run(collection); const insert = db.prepare("INSERT INTO atlas_collections(collection, position, payload) VALUES (?, ?, ?)"); items.forEach((item, position) => insert.run(collection, position, JSON.stringify(item))); db.exec("COMMIT"); }
      catch (error) { db.exec("ROLLBACK"); throw error; }
    },
    close() { db.close(); },
  };
}

export function checkSqliteHealth(databasePath: string): boolean {
  const db = new DatabaseSync(databasePath, { readOnly: true });
  try { return String((db.prepare("PRAGMA quick_check").get() as { quick_check?: string })?.quick_check) === "ok"; }
  finally { db.close(); }
}

export function createSqliteAppendStore<T extends { id: string }>(databasePath: string, collection: string): SqliteAppendStore<T> {
  mkdirSync(dirname(databasePath), { recursive: true });
  const db = new DatabaseSync(databasePath);
  db.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS atlas_collections (collection TEXT NOT NULL, position INTEGER NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(collection, position)); CREATE TABLE IF NOT EXISTS atlas_events (sequence INTEGER PRIMARY KEY AUTOINCREMENT, collection TEXT NOT NULL, event_id TEXT NOT NULL, payload TEXT NOT NULL, UNIQUE(collection, event_id));");
  const insert = db.prepare("INSERT OR IGNORE INTO atlas_events(collection, event_id, payload) VALUES (?, ?, ?)");
  const count = Number((db.prepare("SELECT COUNT(*) AS total FROM atlas_events WHERE collection = ?").get(collection) as { total: number }).total);
  if (count === 0) {
    const legacy = db.prepare("SELECT payload FROM atlas_collections WHERE collection = ? ORDER BY position").all(collection) as Array<{ payload: string }>;
    if (legacy.length) { db.exec("BEGIN IMMEDIATE"); try { for (const row of legacy) { const item = JSON.parse(row.payload) as T; insert.run(collection, item.id, row.payload); } db.exec("COMMIT"); } catch (error) { db.exec("ROLLBACK"); throw error; } }
  }
  return {
    async load() { return db.prepare("SELECT payload FROM atlas_events WHERE collection = ? ORDER BY sequence DESC").all(collection).map((row) => JSON.parse(String((row as { payload: string }).payload)) as T); },
    async append(id, item) { insert.run(collection, id, JSON.stringify(item)); },
    close() { db.close(); },
  };
}

export async function migrateJsonIntoEmptyStore<T>(store: CollectionStore<T>, legacyFile: string): Promise<number> { if (!existsSync(legacyFile) || (await store.load()).length) return 0; const items = JSON.parse(readFileSync(legacyFile, "utf8")) as T[]; if (items.length) await store.save(items); return items.length; }
