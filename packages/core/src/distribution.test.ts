import assert from "node:assert/strict";
import { test } from "node:test";
import type { CollectionStore } from "./index.js";
import type { ContentAsset, DistributionCampaign } from "@atlas/types";
import { DistributionCenter } from "./distribution.js";
import { Guardian } from "./index.js";
import { AgentRuntime, PermissionManager } from "./v03.js";

function store<T>(initial: T[] = []): CollectionStore<T> { let values = structuredClone(initial); return { load: async () => structuredClone(values), save: async (next) => { values = structuredClone(next); } }; }

test("live distribution completes only after an official connector returns an external id", async () => {
  const asset: ContentAsset = { id: "asset", ownerId: "owner", planId: "plan", opportunityId: "opp", channel: "instagram", format: "social-post", title: "Título", body: "Corpo", cta: "CTA", keywords: [], variants: [], status: "approved", generatedBy: [], generationMode: "ai", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  const center = new DistributionCenter(store<DistributionCampaign>(), store([asset]), new Guardian(store()), new AgentRuntime(), new PermissionManager(), ["instagram"]);
  const campaign = await center.create("owner", { assetId: asset.id, channel: "instagram", destination: "perfil", scheduledAt: new Date().toISOString(), targetUrl: "https://example.com/oferta", campaignName: "Campanha real", mode: "live" });
  await center.approve("owner", campaign.id); await center.schedule("owner", campaign.id);
  const completed = await center.executeLive("owner", campaign.id, async () => ({ externalId: "ig-post-1", detail: "Published by Instagram Graph API" }));
  assert.equal(completed?.status, "completed"); assert.equal(completed?.result?.delivered, true); assert.equal(completed?.externalId, "ig-post-1");
});

test("live distribution remains blocked when the official channel is not configured", async () => {
  const asset: ContentAsset = { id: "asset", ownerId: "owner", planId: "plan", opportunityId: "opp", channel: "instagram", format: "social-post", title: "Título", body: "Corpo", cta: "CTA", keywords: [], variants: [], status: "approved", generatedBy: [], generationMode: "ai", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  const center = new DistributionCenter(store(), store([asset]), new Guardian(store()), new AgentRuntime(), new PermissionManager());
  await assert.rejects(() => center.create("owner", { assetId: asset.id, channel: "instagram", destination: "perfil", scheduledAt: new Date().toISOString(), targetUrl: "https://example.com", campaignName: "Bloqueada", mode: "live" }), /official channel connector/);
});
