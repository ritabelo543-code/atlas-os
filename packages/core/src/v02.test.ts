import assert from "node:assert/strict";
import test from "node:test";
import type { AiRequest } from "./index.js";
import { AiProviderError, AnthropicAiProvider } from "./v02.js";

const request: AiRequest = {
  mission: { id: "m1", title: "Mercado B2B", objective: "Analisar uma oportunidade de mercado B2B", context: "Novo produto", status: "running", createdAt: "", updatedAt: "", decisionId: null },
  knowledge: [],
  memory: [],
};

function withFetch<T>(impl: typeof fetch, run: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  return run().finally(() => { globalThis.fetch = original; });
}

test("AnthropicAiProvider parses a successful Messages API response", async () => {
  const calls: unknown[] = [];
  await withFetch(async (url, init) => {
    calls.push({ url, headers: (init as RequestInit).headers });
    return new Response(JSON.stringify({ content: [{ type: "text", text: JSON.stringify({ recommendation: "Testar em pequena escala", rationale: "Baixo risco", confidence: 1.5, nextSteps: ["passo1"] }) }] }), { status: 200 });
  }, async () => {
    const provider = new AnthropicAiProvider("claude-sonnet-5", "sk-test-key");
    const result = await provider.generate(request);
    assert.equal(result.recommendation, "Testar em pequena escala");
    assert.equal(result.confidence, 1);
  });
  assert.equal(calls.length, 1);
  const [{ url, headers }] = calls as Array<{ url: string; headers: Record<string, string> }>;
  assert.equal(url, "https://api.anthropic.com/v1/messages");
  assert.equal(headers["x-api-key"], "sk-test-key");
  assert.equal(headers["anthropic-version"], "2023-06-01");
});

test("AnthropicAiProvider throws on malformed model output without leaking the key", async () => {
  await withFetch(async () => new Response(JSON.stringify({ content: [{ type: "text", text: "not json" }] }), { status: 200 }), async () => {
    const provider = new AnthropicAiProvider("claude-sonnet-5", "sk-secret", "https://api.anthropic.com/v1", { maxRetries: 0 });
    await assert.rejects(() => provider.generate(request));
  });
});

test("AnthropicAiProvider fails fast on 401 without retrying", async () => {
  let attempts = 0;
  await withFetch(async () => { attempts++; return new Response("unauthorized", { status: 401 }); }, async () => {
    const provider = new AnthropicAiProvider("claude-sonnet-5", "sk-bad-key");
    await assert.rejects(() => provider.generate(request), (error: AiProviderError) => {
      assert.ok(error instanceof AiProviderError);
      assert.equal(error.providerStatus, 401);
      assert.match(error.message, /401/);
      assert.doesNotMatch(error.message, /sk-bad-key/);
      return true;
    });
  });
  assert.equal(attempts, 1);
});

test("AnthropicAiProvider retries once on 429 then succeeds", async () => {
  let attempts = 0;
  await withFetch(async () => {
    attempts++;
    if (attempts === 1) return new Response("rate limited", { status: 429 });
    return new Response(JSON.stringify({ content: [{ type: "text", text: JSON.stringify({ recommendation: "ok", rationale: "ok", confidence: .5, nextSteps: [] }) }] }), { status: 200 });
  }, async () => {
    const provider = new AnthropicAiProvider("claude-sonnet-5", "sk-test-key");
    const result = await provider.generate(request);
    assert.equal(result.recommendation, "ok");
  });
  assert.equal(attempts, 2);
});

test("AnthropicAiProvider times out when the request never resolves", async () => {
  await withFetch((_url, init) => new Promise((_resolve, reject) => { (init as RequestInit).signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))); }), async () => {
    const provider = new AnthropicAiProvider("claude-sonnet-5", "sk-test-key", "https://api.anthropic.com/v1", { timeoutMs: 20, maxRetries: 0 });
    await assert.rejects(() => provider.generate(request), /timed out/);
  });
});
