import { AtlasCore, CompatibleAiProvider, MockAiProvider, resolveAiProvider } from "@atlas/core";
import type { AuditEntry, Decision, KnowledgeItem, MemoryItem, Mission } from "@atlas/types";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { dirname, join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { createSqliteStore } from "./lib/sqlite.js";

export function createAtlasCore(): AtlasCore {
  const provider = resolveAiProvider({ provider: process.env.AI_PROVIDER, model: process.env.AI_MODEL, apiKey: process.env.AI_API_KEY, baseUrl: process.env.AI_BASE_URL }, new MockAiProvider(), (name, model, key, baseUrl) => new CompatibleAiProvider(name, model, key, baseUrl));
  const database = process.env.ATLAS_DATABASE_PATH ?? (process.env.ATLAS_DATA_DIR ? resolve(process.env.ATLAS_DATA_DIR, "atlas.db") : fileURLToPath(new URL("../data/atlas.db", import.meta.url)));
  const isNewDatabase = !existsSync(database);
  const stores = {
    missions: createSqliteStore<Mission>(database, "missions"), decisions: createSqliteStore<Decision>(database, "decisions"), knowledge: createSqliteStore<KnowledgeItem>(database, "knowledge"), audit: createSqliteStore<AuditEntry>(database, "audit"), memory: createSqliteStore<MemoryItem>(database, "memory"),
  };
  if (isNewDatabase) for (const name of Object.keys(stores) as Array<keyof typeof stores>) { const legacy = join(dirname(database), `${name}.json`); if (existsSync(legacy)) { const items = JSON.parse(readFileSync(legacy, "utf8")) as never[]; void stores[name].save(items); } }
  return new AtlasCore(provider, {
    ...stores,
  });
}
