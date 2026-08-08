import { AtlasCore, CompatibleAiProvider, MockAiProvider, resolveAiProvider } from "@atlas/core";
import type { AuditEntry, Decision, KnowledgeItem, MemoryItem, Mission } from "@atlas/types";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { createJsonStore } from "./lib/storage.js";

export function createAtlasCore(): AtlasCore {
  const provider = resolveAiProvider({ provider: process.env.AI_PROVIDER, model: process.env.AI_MODEL, apiKey: process.env.AI_API_KEY, baseUrl: process.env.AI_BASE_URL }, new MockAiProvider(), (name, model, key, baseUrl) => new CompatibleAiProvider(name, model, key, baseUrl));
  const data = (name: string) => process.env.ATLAS_DATA_DIR ? resolve(process.env.ATLAS_DATA_DIR, `${name}.json`) : fileURLToPath(new URL(`../data/${name}.json`, import.meta.url));
  return new AtlasCore(provider, {
    missions: createJsonStore<Mission>(data("missions")),
    decisions: createJsonStore<Decision>(data("decisions")),
    knowledge: createJsonStore<KnowledgeItem>(data("knowledge")),
    audit: createJsonStore<AuditEntry>(data("audit")),
    memory: createJsonStore<MemoryItem>(data("memory")),
  });
}
