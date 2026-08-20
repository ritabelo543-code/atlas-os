import assert from "node:assert/strict";
import test from "node:test";
import type { ContentPlan, MarketOpportunity } from "@atlas/types";
import { CompatibleAiProvider } from "../index.js";

test("CompatibleAiProvider generates structured commercial content", async () => {
  const previousFetch = globalThis.fetch;
  let requestBody = "";
  globalThis.fetch = async (_input, init) => {
    requestBody = String(init?.body ?? "");
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ title: "3 usos práticos de IA", body: "Use IA para organizar atendimento, rascunhar conteúdo e resumir tarefas.", cta: "Conheça a oferta e avalie se ela serve para seu negócio.", variants: [{ title: "Variação", hook: "Ganhe clareza", cta: "Veja os detalhes" }], designBrief: "Visual limpo e responsável" }) } }] }), { status: 200 });
  };
  try {
    const provider = new CompatibleAiProvider("openai", "model", "secret", "https://api.example/v1");
    const opportunity = { id: "opp", ownerId: "owner", researchId: "research", market: "Educação", niche: "IA", audience: "Pequenos negócios", painOrDesire: "Poupar tempo", evidenceIds: [], offerId: "offer", metrics: { demand: 50, commercialIntent: 50, competition: 50, monetization: 50, margin: 50, effort: 50, risk: 50, evidenceQuality: 50, confidence: 50, scalability: 50 }, score: 50, confidence: .5, dataKind: "estimated", rankingRationale: "Teste", status: "candidate", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as unknown as MarketOpportunity;
    const plan = { id: "plan", ownerId: "owner", opportunityId: "opp", audience: "Pequenos negócios", painOrDesire: "Poupar tempo", objective: "Informar", funnelStage: "conversion", channels: ["tiktok"], keywords: ["IA"], tone: "claro", status: "active", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as ContentPlan;
    const result = await provider.generateContent({ opportunity, plan, channel: "tiktok", format: "social-post", instructions: "Três usos práticos" });
    assert.equal(result.title, "3 usos práticos de IA");
    assert.match(requestBody, /Três usos práticos/);
  } finally { globalThis.fetch = previousFetch; }
});

test("CompatibleAiProvider retries without response_format when the model does not support it", async () => {
  const previousFetch = globalThis.fetch;
  const bodies: string[] = [];
  globalThis.fetch = async (_input, init) => {
    const body = String(init?.body ?? "");
    bodies.push(body);
    if (bodies.length === 1) return new Response(JSON.stringify({ error: { message: "Invalid parameter: 'response_format' is not supported with this model." } }), { status: 400 });
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ summary: "Insight baseado nos dados observados." }) } }] }), { status: 200 });
  };
  try {
    const provider = new CompatibleAiProvider("openai", "model", "secret", "https://api.example/v1");
    const result = await provider.summarizeInsight({ winner: {} as never, recordCount: 1, recommendation: "Repetir o teste" });
    assert.equal(result.summary, "Insight baseado nos dados observados.");
    assert.match(bodies[0], /response_format/);
    assert.doesNotMatch(bodies[1], /response_format/);
  } finally { globalThis.fetch = previousFetch; }
});
