import assert from "node:assert/strict";
import { test } from "node:test";
import { HotmartClient, parseHotmartCredentials } from "../src/integrations/HotmartClient.js";

test("parses the downloaded Hotmart credential format without exposing values", () => {
  const credentials = parseHotmartCredentials("Client ID: client\nClient Secret: secret\nBasic: Basic encoded\n");
  assert.deepEqual(credentials, { clientId: "client", clientSecret: "secret", basic: "encoded" });
});

test("loads production credentials from environment and derives Basic safely", async () => {
  const previousId = process.env.HOTMART_CLIENT_ID;
  const previousSecret = process.env.HOTMART_CLIENT_SECRET;
  try {
    process.env.HOTMART_CLIENT_ID = "client";
    process.env.HOTMART_CLIENT_SECRET = "secret";
    const client = HotmartClient.fromEnvironment("production");
    assert.equal(client.status().configured, true);
    const calls: Array<{ url: string; authorization: string | null }> = [];
    await client.verifyAuthentication(async (input, init) => {
      calls.push({ url: String(input), authorization: new Headers(init?.headers).get("Authorization") });
      return new Response(JSON.stringify({ access_token: "temporary" }), { status: 200 });
    });
    assert.equal(calls[0]?.authorization, `Basic ${Buffer.from("client:secret").toString("base64")}`);
  } finally {
    if (previousId === undefined) delete process.env.HOTMART_CLIENT_ID; else process.env.HOTMART_CLIENT_ID = previousId;
    if (previousSecret === undefined) delete process.env.HOTMART_CLIENT_SECRET; else process.env.HOTMART_CLIENT_SECRET = previousSecret;
  }
});

test("reports safe sandbox status and verifies authentication without retaining the token", async () => {
  const client = new HotmartClient({ clientId: "client", clientSecret: "secret", basic: "encoded" });
  assert.deepEqual(client.status(), { configured: true, environment: "sandbox", authenticated: false });
  const status = await client.verifyAuthentication(async () => new Response(JSON.stringify({ access_token: "temporary", expires_in: 120 }), { status: 200, headers: { "Content-Type": "application/json" } }));
  assert.deepEqual(status, { configured: true, environment: "sandbox", authenticated: true, expiresIn: 120 });
  assert.equal(JSON.stringify(status).includes("temporary"), false);
});

test("loads products, offers and affiliate sales with bearer authentication", async () => {
  const client = new HotmartClient({ clientId: "client", clientSecret: "secret", basic: "encoded" });
  const calls: string[] = [];
  const fetcher = async (input: string | URL | Request) => {
    const url = String(input); calls.push(url);
    if (url.includes("oauth/token")) return new Response(JSON.stringify({ access_token: "temporary", expires_in: 120 }), { status: 200, headers: { "Content-Type": "application/json" } });
    if (url.includes("/offers")) return new Response(JSON.stringify({ items: [{ code: "offer-1", price: { value: 10, currency_code: "BRL" } }] }), { status: 200 });
    if (url.includes("sales/history")) return new Response(JSON.stringify({ items: [{ purchase: { transaction: "sale-1", commission_as: "AFFILIATE" } }] }), { status: 200 });
    return new Response(JSON.stringify({ items: [{ id: 1, name: "Product", ucode: "product-1", status: "ACTIVE" }] }), { status: 200 });
  };
  assert.equal((await client.listProducts(fetcher as typeof fetch))[0]?.ucode, "product-1");
  assert.equal((await client.listOffers("product-1", fetcher as typeof fetch))[0]?.code, "offer-1");
  assert.equal((await client.listAffiliateSales(fetcher as typeof fetch))[0]?.purchase?.commission_as, "AFFILIATE");
  assert.ok(calls.some((url) => url.includes("commission_as=AFFILIATE")));
});

test("treats a missing sandbox offer fixture as an empty offer list", async () => {
  const client = new HotmartClient({ clientId: "client", clientSecret: "secret", basic: "encoded" });
  const fetcher = async (input: string | URL | Request) => String(input).includes("oauth/token")
    ? new Response(JSON.stringify({ access_token: "temporary" }), { status: 200 })
    : new Response(JSON.stringify({ error: "not_found" }), { status: 404 });
  assert.deepEqual(await client.listOffers("missing", fetcher as typeof fetch), []);
});
