import assert from "node:assert/strict";
import { test } from "node:test";
import { InstagramGraphClient } from "../src/integrations/InstagramGraphClient.js";
import { TikTokContentClient } from "../src/integrations/TikTokContentClient.js";

test("Instagram official connector creates, verifies and publishes a media container", async () => {
  const client = new InstagramGraphClient("account", "token", "v23.0");
  const calls: string[] = [];
  const result = await client.publishImage("https://media.example/image.png", "Legenda", async (input) => { const url = String(input); calls.push(url); if (url.includes("/account/media_publish")) return new Response(JSON.stringify({ id: "post-1" }), { status: 200 }); if (url.includes("fields=status_code")) return new Response(JSON.stringify({ status_code: "FINISHED" }), { status: 200 }); return new Response(JSON.stringify({ id: "container-1" }), { status: 200 }); });
  assert.equal(result.externalId, "post-1");
  assert.equal(calls.length, 3);
});

test("Instagram official connector refuses local or insecure media", async () => {
  await assert.rejects(() => new InstagramGraphClient("account", "token").publishImage("http://localhost/image.png", "Legenda"), /HTTPS/);
});

test("TikTok official connector queries creator before direct photo publishing", async () => {
  const client = new TikTokContentClient("token");
  const calls: string[] = [];
  const result = await client.publishPhoto(["https://verified.example/image.png"], "Título", "Descrição", "SELF_ONLY", async (input) => { const url = String(input); calls.push(url); return url.includes("creator_info") ? new Response(JSON.stringify({ data: { creator_username: "atlas", privacy_level_options: ["SELF_ONLY"] }, error: { code: "ok" } }), { status: 200 }) : new Response(JSON.stringify({ data: { publish_id: "publish-1" }, error: { code: "ok" } }), { status: 200 }); });
  assert.equal(result.externalId, "publish-1");
  assert.equal(calls.length, 2);
});

test("official social connectors fail explicitly without OAuth tokens", async () => {
  await assert.rejects(() => new InstagramGraphClient("", "").verify(), /INSTAGRAM_ACCESS_TOKEN/);
  await assert.rejects(() => new TikTokContentClient("").creatorInfo(), /TIKTOK_ACCESS_TOKEN/);
});
