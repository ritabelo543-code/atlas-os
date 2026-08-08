import assert from "node:assert/strict";
import { test } from "node:test";
import { createShopeeLink, validateShopeeAffiliateUrl } from "../src/integrations/ShopeeLinks.js";

test("accepts official Shopee affiliate link domains and rejects unrelated links", () => {
  assert.match(validateShopeeAffiliateUrl("https://s.shopee.com.br/example"), /shopee/);
  assert.match(validateShopeeAffiliateUrl("https://shope.ee/example"), /shope/);
  assert.throws(() => validateShopeeAffiliateUrl("https://example.com/product"), /Shopee/);
});

test("creates a confirmed, channel-specific affiliate link without personal data", () => {
  const link = createShopeeLink("owner", { name: "Organizador", category: "Casa", channel: "pinterest", affiliateUrl: "https://s.shopee.com.br/example", subId: "pinterest-casa" });
  assert.equal(link.dataKind, "confirmed");
  assert.equal(link.channel, "pinterest");
  assert.equal("email" in link, false);
});
