import assert from "node:assert/strict";
import { test } from "node:test";
import { createHotmartLink, validateHotmartAffiliateUrl } from "../src/integrations/HotmartLinks.js";

test("accepts official Hotmart affiliate links and rejects unrelated domains", () => {
  assert.match(validateHotmartAffiliateUrl("https://go.hotmart.com/V107180956B"), /go\.hotmart\.com/);
  assert.throws(() => validateHotmartAffiliateUrl("https://example.com/product"), /Hotmart/);
});

test("creates a confirmed Hotmart affiliate link", () => {
  const link = createHotmartLink("owner", { name: "Produto", affiliateUrl: "https://go.hotmart.com/V107180956B", subId: "atlas" });
  assert.equal(link.dataKind, "confirmed"); assert.equal(link.source, "hotmart-affiliate"); assert.equal(link.subId, "atlas");
});
