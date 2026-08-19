import assert from "node:assert/strict";
import { test } from "node:test";
import { InstagramGraphClient } from "../src/integrations/InstagramGraphClient.js";
import { TikTokContentClient } from "../src/integrations/TikTokContentClient.js";
import { TikTokOAuthService } from "../src/integrations/TikTokOAuthService.js";

function memoryStore<T>() {
  let items: T[] = [];
  return { async load() { return items; }, async save(next: T[]) { items = structuredClone(next); }, close() {}, inspect() { return items; } };
}

test("Instagram official connector creates, verifies and publishes a media container", async () => {
  const client = new InstagramGraphClient("account", "token", "v23.0");
  const calls: string[] = [];
  const result = await client.publishImage("https://media.example/image.png", "Legenda", async (input) => { const url = String(input); calls.push(url); if (url.includes("/account/media_publish")) return new Response(JSON.stringify({ id: "post-1" }), { status: 200 }); if (url.includes("fields=status_code")) return new Response(JSON.stringify({ status_code: "FINISHED" }), { status: 200 }); return new Response(JSON.stringify({ id: "container-1" }), { status: 200 }); });
  assert.equal(result.externalId, "post-1");
  assert.equal(calls.length, 3);
});

test("Instagram connector waits for asynchronous media processing", async () => {
  let statusChecks = 0;
  const waits: number[] = [];
  const client = new InstagramGraphClient("account", "token", "v23.0", "https://graph.facebook.com", { attempts: 3, intervalMs: 25 }, async (milliseconds) => { waits.push(milliseconds); });
  const result = await client.publishImage("https://media.example/image.png", "Legenda", async (input) => {
    const url = String(input);
    if (url.includes("/account/media_publish")) return new Response(JSON.stringify({ id: "post-2" }), { status: 200 });
    if (url.includes("fields=status_code")) return new Response(JSON.stringify({ status_code: ++statusChecks === 1 ? "IN_PROGRESS" : "FINISHED" }), { status: 200 });
    return new Response(JSON.stringify({ id: "container-2" }), { status: 200 });
  });
  assert.equal(result.externalId, "post-2");
  assert.equal(statusChecks, 2);
  assert.deepEqual(waits, [25]);
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

test("TikTok OAuth validates state, encrypts tokens and exposes only safe connection metadata", async () => {
  const states = memoryStore<{ state: string; ownerId: string; expiresAt: string }>();
  const tokens = memoryStore<any>();
  const oauth = new TikTokOAuthService(states, tokens, "client-key", "client-secret", "https://radar.example/callback", "encryption-secret");
  const started = await oauth.begin("owner-1");
  const state = new URL(started.authorizationUrl).searchParams.get("state")!;
  const connected = await oauth.complete("authorization-code", state, async () => new Response(JSON.stringify({ access_token: "access-secret", refresh_token: "refresh-secret", open_id: "creator-1", scope: "user.info.basic,video.upload,video.publish", token_type: "Bearer", expires_in: 3600, refresh_expires_in: 31536000 }), { status: 200 }));
  assert.equal(connected.connected, true);
  assert.equal(connected.openId, "creator-1");
  assert.equal(JSON.stringify(tokens.inspect()).includes("access-secret"), false);
  assert.equal(JSON.stringify(tokens.inspect()).includes("refresh-secret"), false);
  assert.equal(await oauth.accessToken("owner-1"), "access-secret");
  await assert.rejects(() => oauth.complete("reused-code", state), /invalid or expired/);
});
