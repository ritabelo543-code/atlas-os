import assert from "node:assert/strict";
import test from "node:test";
import type { AiRequest, ContentAiRequest, LearningAiRequest, MarketAiRequest } from "../index.js";
import { AiProviderError, AnthropicAiProvider } from "./anthropic.js";

function sampleRequest(): AiRequest {
  return {
    mission: { id: "m1", title: "Testar oportunidade", objective: "Validar demanda de um produto novo", context: "Nicho de teste", status: "pending", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), decisionId: null } as AiRequest["mission"],
    knowledge: [],
    memory: [],
  };
}

const contentRequest: ContentAiRequest = {
  opportunity: { id: "o1", ownerId: "u1", researchId: "r1", market: "Software", niche: "produtividade", audience: "profissionais autônomos", painOrDesire: "economizar tempo", evidenceIds: [], channels: ["blog"], confidence: .8, score: 70, scoreComponents: { demand: 80, commercialIntent: 70, competition: 40, monetization: 75, margin: 70, effort: 35, risk: 25, evidenceQuality: 80, confidence: 75, scalability: 80 }, rankingRationale: "teste", status: "candidate", discoveredAt: "", updatedAt: "", dataKind: "simulated" },
  plan: { id: "p1", ownerId: "u1", opportunityId: "o1", audience: "profissionais autônomos", painOrDesire: "economizar tempo", objective: "Apresentar a oferta", funnelStage: "conversion", channels: ["youtube"], keywords: ["produtividade"], tone: "claro", status: "active", createdAt: "", updatedAt: "" },
  channel: "youtube",
  format: "video-script",
};

const marketRequest: MarketAiRequest = {
  market: "Software", niche: "produtividade", audience: "profissionais autônomos", painOrDesire: "economizar tempo",
  evidence: [
    { id: "e1", source: "fixture", observedAt: "", excerpt: "Interesse crescente em automação", valueKind: "simulated", confidence: .8 },
    { id: "e2", source: "fixture", observedAt: "", excerpt: "Reclamações isoladas sobre suporte", valueKind: "simulated", confidence: .6 },
  ],
};

const learningRequest: LearningAiRequest = {
  winner: { id: "r1", ownerId: "u1", campaignId: "c1", assetId: "a1", opportunityId: "o1", metrics: { impressions: 1000, clicks: 100, conversions: 10, cost: 50, revenue: 150 }, ctr: 10, conversionRate: 10, cac: 5, roi: 200, profit: 100, dataKind: "confirmed", source: "fixture", observedAt: "", createdAt: "" },
  recordCount: 1,
  recommendation: "Repetir o criativo vencedor em teste controlado, mantendo orçamento limitado até confirmar consistência.",
};

function mockFetch(handler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>): typeof fetch {
  return handler as unknown as typeof fetch;
}

test("AnthropicAiProvider requires an API key", () => {
  assert.throws(() => new AnthropicAiProvider("claude-sonnet-4-6", ""), /API key/);
});

test("AnthropicAiProvider requires a model", () => {
  assert.throws(() => new AnthropicAiProvider("", "fake-key"), /model/);
});

test("AnthropicAiProvider parses a valid structured response", async () => {
  const fetchImpl = mockFetch(async () => {
    return new Response(
      JSON.stringify({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              recommendation: "Validar com um piloto pequeno",
              rationale: "Baixo risco, alta aprendizagem",
              confidence: 0.72,
              nextSteps: ["Definir metrica", "Rodar piloto"],
            }),
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  });

  const provider = new AnthropicAiProvider("claude-sonnet-4-6", "fake-key", undefined, { fetchImpl });
  const result = await provider.generate(sampleRequest());

  assert.equal(result.recommendation, "Validar com um piloto pequeno");
  assert.equal(result.confidence, 0.72);
  assert.deepEqual(result.nextSteps, ["Definir metrica", "Rodar piloto"]);
});

test("AnthropicAiProvider clamps confidence to the 0..1 range", async () => {
  const fetchImpl = mockFetch(async () => {
    return new Response(
      JSON.stringify({
        content: [{ type: "text", text: JSON.stringify({ recommendation: "r", rationale: "j", confidence: 1.5, nextSteps: [] }) }],
      }),
      { status: 200 }
    );
  });
  const provider = new AnthropicAiProvider("claude-sonnet-4-6", "fake-key", undefined, { fetchImpl });
  const result = await provider.generate(sampleRequest());
  assert.equal(result.confidence, 1);
});

test("AnthropicAiProvider throws on authentication failure without retrying", async () => {
  let calls = 0;
  const fetchImpl = mockFetch(async () => {
    calls++;
    return new Response("unauthorized", { status: 401 });
  });
  const provider = new AnthropicAiProvider("claude-sonnet-4-6", "bad-key", undefined, { fetchImpl, maxRetries: 3 });
  await assert.rejects(() => provider.generate(sampleRequest()), /authentication failed/);
  assert.equal(calls, 1);
});

test("AnthropicAiProvider retries on rate limit then succeeds", async () => {
  let calls = 0;
  const fetchImpl = mockFetch(async () => {
    calls++;
    if (calls < 2) return new Response("rate limited", { status: 429 });
    return new Response(
      JSON.stringify({
        content: [{ type: "text", text: JSON.stringify({ recommendation: "r", rationale: "j", confidence: 0.5, nextSteps: [] }) }],
      }),
      { status: 200 }
    );
  });
  const provider = new AnthropicAiProvider("claude-sonnet-4-6", "fake-key", undefined, { fetchImpl, maxRetries: 3 });
  const result = await provider.generate(sampleRequest());
  assert.equal(calls, 2);
  assert.equal(result.recommendation, "r");
});

test("AnthropicAiProvider throws after exhausting retries on server error", async () => {
  let calls = 0;
  const fetchImpl = mockFetch(async () => {
    calls++;
    return new Response("server error", { status: 503 });
  });
  const provider = new AnthropicAiProvider("claude-sonnet-4-6", "fake-key", undefined, { fetchImpl, maxRetries: 1 });
  await assert.rejects(() => provider.generate(sampleRequest()), /failed after retries/);
  assert.equal(calls, 2);
});

test("AnthropicAiProvider throws on invalid JSON response", async () => {
  const fetchImpl = mockFetch(async () => {
    return new Response(JSON.stringify({ content: [{ type: "text", text: "isso nao e json" }] }), { status: 200 });
  });
  const provider = new AnthropicAiProvider("claude-sonnet-4-6", "fake-key", undefined, { fetchImpl });
  await assert.rejects(() => provider.generate(sampleRequest()), /not valid JSON/);
});

test("AnthropicAiProvider throws on missing fields in response", async () => {
  const fetchImpl = mockFetch(async () => {
    return new Response(JSON.stringify({ content: [{ type: "text", text: JSON.stringify({ recommendation: "r" }) }] }), { status: 200 });
  });
  const provider = new AnthropicAiProvider("claude-sonnet-4-6", "fake-key", undefined, { fetchImpl });
  await assert.rejects(() => provider.generate(sampleRequest()), /invalid response shape/);
});

test("AnthropicAiProvider generateContent parses a structured content response", async () => {
  const fetchImpl = mockFetch(async () => new Response(JSON.stringify({ content: [{ type: "text", text: JSON.stringify({ title: "Título", body: "Corpo do texto", cta: "Saiba mais", variants: [{ title: "V1", hook: "H1", cta: "C1" }, { title: "V2", hook: "H2", cta: "C2" }, { title: "V3", hook: "H3", cta: "C3" }], designBrief: "Brief" }) }] }), { status: 200 }));
  const provider = new AnthropicAiProvider("claude-sonnet-5", "fake-key", undefined, { fetchImpl });
  const result = await provider.generateContent(contentRequest);
  assert.equal(result.title, "Título");
  assert.equal(result.variants.length, 3);
  assert.equal(result.designBrief, "Brief");
});

test("AnthropicAiProvider generateContent throws AiProviderError on malformed variants", async () => {
  const fetchImpl = mockFetch(async () => new Response(JSON.stringify({ content: [{ type: "text", text: JSON.stringify({ title: "Título", body: "Corpo", cta: "CTA", variants: [{ title: "V1", hook: "H1", cta: "C1" }] }) }] }), { status: 200 }));
  const provider = new AnthropicAiProvider("claude-sonnet-5", "fake-key", undefined, { fetchImpl, maxRetries: 0 });
  await assert.rejects(() => provider.generateContent(contentRequest), (error: unknown) => { assert.ok(error instanceof AiProviderError); return true; });
});

test("AnthropicAiProvider generateContent throws AiProviderError on truncated/invalid JSON (e.g. cut off by max_tokens)", async () => {
  const fetchImpl = mockFetch(async () => new Response(JSON.stringify({ content: [{ type: "text", text: '{"title": "Título", "body": "texto incompleto sem fechar' }] }), { status: 200 }));
  const provider = new AnthropicAiProvider("claude-sonnet-5", "fake-key", undefined, { fetchImpl, maxRetries: 0 });
  await assert.rejects(() => provider.generateContent(contentRequest), (error: unknown) => { assert.ok(error instanceof AiProviderError); return true; });
});

test("AnthropicAiProvider analyzeMarket classifies each evidence item in order", async () => {
  const fetchImpl = mockFetch(async () => new Response(JSON.stringify({ content: [{ type: "text", text: JSON.stringify({ signals: [{ kind: "trend", direction: "rising" }, { kind: "noise", direction: "unknown" }], rankingRationale: "Racional gerado pela IA" }) }] }), { status: 200 }));
  const provider = new AnthropicAiProvider("claude-sonnet-5", "fake-key", undefined, { fetchImpl });
  const result = await provider.analyzeMarket(marketRequest);
  assert.equal(result.signals.length, 2);
  assert.equal(result.signals[0]?.kind, "trend"); assert.equal(result.signals[0]?.direction, "rising");
  assert.equal(result.signals[1]?.kind, "noise"); assert.equal(result.signals[1]?.direction, "unknown");
  assert.equal(result.rankingRationale, "Racional gerado pela IA");
});

test("AnthropicAiProvider analyzeMarket throws AiProviderError when signal count does not match evidence", async () => {
  const fetchImpl = mockFetch(async () => new Response(JSON.stringify({ content: [{ type: "text", text: JSON.stringify({ signals: [{ kind: "trend", direction: "rising" }], rankingRationale: "Faltando um sinal" }) }] }), { status: 200 }));
  const provider = new AnthropicAiProvider("claude-sonnet-5", "fake-key", undefined, { fetchImpl, maxRetries: 0 });
  await assert.rejects(() => provider.analyzeMarket(marketRequest), (error: unknown) => { assert.ok(error instanceof AiProviderError); return true; });
});

test("AnthropicAiProvider analyzeMarket throws AiProviderError on an invalid kind/direction value", async () => {
  const fetchImpl = mockFetch(async () => new Response(JSON.stringify({ content: [{ type: "text", text: JSON.stringify({ signals: [{ kind: "trend", direction: "rising" }, { kind: "not-a-real-kind", direction: "rising" }], rankingRationale: "Racional" }) }] }), { status: 200 }));
  const provider = new AnthropicAiProvider("claude-sonnet-5", "fake-key", undefined, { fetchImpl, maxRetries: 0 });
  await assert.rejects(() => provider.analyzeMarket(marketRequest), (error: unknown) => { assert.ok(error instanceof AiProviderError); return true; });
});

test("AnthropicAiProvider summarizeInsight returns a summary grounded in the given metrics", async () => {
  const fetchImpl = mockFetch(async () => new Response(JSON.stringify({ content: [{ type: "text", text: JSON.stringify({ summary: "O criativo vencedor teve CTR de 10% e ROI de 200%, com lucro de 100." }) }] }), { status: 200 }));
  const provider = new AnthropicAiProvider("claude-sonnet-5", "fake-key", undefined, { fetchImpl });
  const result = await provider.summarizeInsight(learningRequest);
  assert.match(result.summary, /CTR/);
});

test("AnthropicAiProvider summarizeInsight throws AiProviderError when summary is missing", async () => {
  const fetchImpl = mockFetch(async () => new Response(JSON.stringify({ content: [{ type: "text", text: JSON.stringify({}) }] }), { status: 200 }));
  const provider = new AnthropicAiProvider("claude-sonnet-5", "fake-key", undefined, { fetchImpl, maxRetries: 0 });
  await assert.rejects(() => provider.summarizeInsight(learningRequest), (error: unknown) => { assert.ok(error instanceof AiProviderError); return true; });
});