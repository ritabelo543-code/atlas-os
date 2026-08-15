import assert from "node:assert/strict";
import test from "node:test";
import type { AiRequest } from "../index.js";
import { AnthropicAiProvider } from "./anthropic.js";

function sampleRequest(): AiRequest {
  return {
    mission: { id: "m1", title: "Testar oportunidade", objective: "Validar demanda de um produto novo", context: "Nicho de teste", status: "pending", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), decisionId: null } as AiRequest["mission"],
    knowledge: [],
    memory: [],
  };
}

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