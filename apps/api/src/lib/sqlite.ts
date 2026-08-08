import { DatabaseSync } from "node:sqlite";
import { dirname } from "node:path";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import type { CollectionStore } from "@atlas/core";

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

export async function migrateJsonIntoEmptyStore<T>(store: CollectionStore<T>, legacyFile: string): Promise<number> { if (!existsSync(legacyFile) || (await store.load()).length) return 0; const items = JSON.parse(readFileSync(legacyFile, "utf8")) as T[]; if (items.length) await store.save(items); return items.length; }
