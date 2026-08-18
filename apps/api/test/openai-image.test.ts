import assert from "node:assert/strict";
import { test } from "node:test";
import { OpenAIImageClient } from "../src/integrations/OpenAIImageClient.js";

test("OpenAI image client sends a low-cost generation request and decodes PNG bytes", async () => {
  const client = new OpenAIImageClient("test-key", "gpt-image-1-mini");
  let requestBody: Record<string, unknown> = {};
  const generated = await client.generate("Produto organizado em ambiente claro", async (_input, init) => {
    requestBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ data: [{ b64_json: Buffer.from("png-bytes").toString("base64"), revised_prompt: "revised" }] }), { status: 200, headers: { "x-request-id": "req-image-1" } });
  });
  assert.equal(requestBody.model, "gpt-image-1-mini");
  assert.equal(requestBody.quality, "low");
  assert.equal(generated.bytes.toString(), "png-bytes");
  assert.equal(generated.requestId, "req-image-1");
});

test("OpenAI image client fails explicitly when credentials or image data are missing", async () => {
  await assert.rejects(() => new OpenAIImageClient("").generate("prompt"), /OPENAI_API_KEY/);
  await assert.rejects(() => new OpenAIImageClient("test-key").generate("prompt", async () => new Response(JSON.stringify({ data: [] }), { status: 200 })), /no image data/);
});
