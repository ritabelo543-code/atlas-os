import assert from "node:assert/strict";
import test from "node:test";
import type { AffiliateOffer, AutonomyJob, ContentAsset, ContentPlan, MarketOpportunity } from "@atlas/types";
import { buildDefaultAutonomyHandlers } from "../src/autonomy/defaultHandlers.js";

const date = new Date("2026-09-01T12:00:00.000Z");

test("catalog discovery queues validation only for qualified offers with URLs", async () => {
  const queued: Array<{ kind: string; idempotencyKey: string }> = [];
  const handlers = buildDefaultAutonomyHandlers({
    autonomy: { enqueue: async (input) => { queued.push(input); return job(input.kind, input.payload); } },
    market: { listOffers: async () => [offer()], listOpportunities: async () => [opportunity()] },
    content: emptyContent(), now: () => date,
  });
  await handlers.discover_offers!(job("discover_offers"));
  assert.equal(queued.length, 1);
  assert.equal(queued[0]?.kind, "validate_offer");
  assert.equal(queued[0]?.idempotencyKey, "validate:offer-1:2026-09-01");
});

test("offer validation accepts a reachable public HTTPS redirect and queues draft preparation", async () => {
  const queued: Array<{ kind: string; payload?: Record<string, unknown> }> = [];
  const handlers = buildDefaultAutonomyHandlers({
    autonomy: { enqueue: async (input) => { queued.push(input); return job(input.kind, input.payload); } },
    market: { listOffers: async () => [offer()], listOpportunities: async () => [opportunity()] },
    content: emptyContent(), now: () => date,
    fetchOffer: async () => new Response(null, { status: 302, headers: { location: "https://checkout.example.com" } }),
  });
  await handlers.validate_offer!(job("validate_offer", { offerId: "offer-1", opportunityId: "opp-1" }));
  assert.equal(queued[0]?.kind, "prepare_content");
  assert.equal(queued[0]?.payload?.validatedUrl, "https://example.com/product");
});

test("content preparation creates review drafts for supported channels and never publishes", async () => {
  const plans: ContentPlan[] = [];
  const assets: ContentAsset[] = [];
  const generated: string[] = [];
  const handlers = buildDefaultAutonomyHandlers({
    autonomy: { enqueue: async (input) => job(input.kind, input.payload) },
    market: { listOffers: async () => [offer()], listOpportunities: async () => [{ ...opportunity(), channels: ["instagram", "tiktok", "youtube", "unsupported"] }] },
    content: {
      listPlans: async () => plans,
      listAssets: async () => assets,
      createPlan: async (ownerId, input) => { const plan = { id: "plan-1", ownerId, opportunityId: input.opportunityId, offerId: "offer-1", audience: "empreendedoras", painOrDesire: "aprender unhas", objective: input.objective, funnelStage: input.funnelStage, channels: input.channels, keywords: input.keywords, tone: input.tone, status: "active", createdAt: date.toISOString(), updatedAt: date.toISOString() } satisfies ContentPlan; plans.push(plan); return plan; },
      generate: async (ownerId, input) => { generated.push(`${input.channel}:${input.format}`); const asset = { id: `asset-${generated.length}`, ownerId, planId: input.planId, opportunityId: "opp-1", channel: input.channel, format: input.format, title: "Rascunho", body: "Texto", cta: "Saiba mais", keywords: [], variants: [], status: "in_review", generatedBy: [], generationMode: "deterministic", createdAt: date.toISOString(), updatedAt: date.toISOString() } satisfies ContentAsset; assets.push(asset); return asset; },
    },
    now: () => date,
  });
  await handlers.prepare_content!(job("prepare_content", { opportunityId: "opp-1" }));
  assert.deepEqual(generated, ["instagram:social-post", "tiktok:video-script", "youtube:video-script"]);
  assert.ok(assets.every((asset) => asset.status === "in_review"));
});

function emptyContent() {
  return { listPlans: async () => [] as ContentPlan[], listAssets: async () => [] as ContentAsset[], createPlan: async () => { throw new Error("not used"); }, generate: async () => { throw new Error("not used"); } };
}

function offer(): AffiliateOffer {
  return { id: "offer-1", ownerId: "owner-1", researchId: "research-1", name: "Curso", provider: "hotmart", url: "https://example.com/product", notes: "", createdAt: date.toISOString() };
}

function opportunity(): MarketOpportunity {
  return { id: "opp-1", ownerId: "owner-1", researchId: "research-1", market: "beleza", niche: "unhas", audience: "empreendedoras", painOrDesire: "aprender unhas", offerId: "offer-1", evidenceIds: ["evidence-1"], channels: ["instagram"], confidence: .9, score: 80, scoreComponents: { demand: 80, commercialIntent: 80, competition: 40, monetization: 70, margin: 70, effort: 30, risk: 20, evidenceQuality: 80, confidence: 90, scalability: 70 }, rankingRationale: "Evidência confirmada", status: "qualified", discoveredAt: date.toISOString(), updatedAt: date.toISOString(), dataKind: "confirmed" };
}

function job(kind: AutonomyJob["kind"], payload: Record<string, unknown> = {}): AutonomyJob {
  return { id: crypto.randomUUID(), ownerId: "owner-1", kind, status: "pending", idempotencyKey: `${kind}:test`, payload, priority: 0, attempts: 0, maxAttempts: 5, runAt: date.toISOString(), createdAt: date.toISOString(), updatedAt: date.toISOString() };
}
