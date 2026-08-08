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

test("semantic knowledge search ranks normalized terms and bigrams", async () => {
  const core = new AtlasCore(new MockAiProvider(), { missions: memory<Mission>(), decisions: memory<Decision>(), knowledge: memory<KnowledgeItem>(), audit: memory<AuditEntry>(), memory: memory<MemoryItem>() }); await core.start();
  await core.knowledge.add({ content: "Estratégia de retenção para clientes B2B", summary: "Retenção de clientes", source: "research", context: "SaaS", confidence: .9, metadata: {}, ownerId: "one" });
  await core.knowledge.add({ content: "Infraestrutura de servidores", summary: "Operação técnica", source: "ops", context: "cloud", confidence: .9, metadata: {}, ownerId: "one" });
  const results = await core.knowledge.search("retencao clientes B2B", 5, { ownerId: "one" }); assert.equal(results[0]?.summary, "Retenção de clientes");
});
