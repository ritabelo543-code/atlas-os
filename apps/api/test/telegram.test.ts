import assert from "node:assert/strict";
import test from "node:test";
import { TelegramBotClient } from "../src/integrations/TelegramBotClient.js";

test("Telegram connector publishes an offer with a verified HTTPS button", async () => {
  let requestBody: Record<string, unknown> = {};
  const client = new TelegramBotClient("token", async (_url, init) => { requestBody = JSON.parse(String(init?.body)); return new Response(JSON.stringify({ ok: true, result: { message_id: 42, chat: { id: -1001 } } }), { status: 200, headers: { "content-type": "application/json" } }); });
  const result = await client.sendOffer({ chatId: "-1001", text: "Oferta confirmada", link: "https://www.radardeescolhas.com.br/oferta/1" });
  assert.equal(result.externalId, "-1001:42");
  assert.deepEqual(requestBody.reply_markup, { inline_keyboard: [[{ text: "Ver oferta", url: "https://www.radardeescolhas.com.br/oferta/1" }]] });
});

test("Telegram connector fails explicitly without credentials or a safe link", async () => {
  await assert.rejects(() => new TelegramBotClient(undefined).verify(), /not configured/);
  await assert.rejects(() => new TelegramBotClient("token").sendOffer({ chatId: "1", text: "x", link: "http://example.com" }), /HTTPS/);
});
