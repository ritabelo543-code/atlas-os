import assert from "node:assert/strict";
import test from "node:test";
import type { AuditEntry, Decision, KnowledgeItem, MemoryItem, Mission } from "@atlas/types";
import { AtlasCore, MockAiProvider, type CollectionStore } from "./index.js";

function memory<T>(): CollectionStore<T> {
  let values: T[] = [];
  return { load: async () => structuredClone(values), save: async (next) => { values = structuredClone(next); } };
}

test("runs related missions through reusable memory, decision and audit", async () => {
  const core = new AtlasCore(new MockAiProvider(), { missions: memory<Mission>(), decisions: memory<Decision>(), knowledge: memory<KnowledgeItem>(), audit: memory<AuditEntry>(), memory: memory<MemoryItem>() });
  await core.start();
  const first = await core.createMission({ title: "Mercado B2B", objective: "Analisar uma oportunidade de mercado B2B", context: "Novo produto para pequenas equipes" });
  const firstDecision = await core.executeMission(first.id);
  assert.equal(firstDecision?.memoryIds?.length, 0);
  const second = await core.createMission({ title: "Mercado B2B relacionado", objective: "Definir um piloto para a oportunidade de mercado B2B", context: "Produto para pequenas equipes" });
  const secondDecision = await core.executeMission(second.id);
  assert.equal(secondDecision?.outcome, "recommendation");
  assert.equal(secondDecision?.memoryIds?.length, 1);
  assert.equal((await core.listMemory()).length, 2);
  assert.equal((await core.getMission(second.id))?.status, "completed");
  assert.equal(core.status().lifecycle, "running");
});
