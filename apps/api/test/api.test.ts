import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import type { CompanyCycle, ContentAsset, ContentPlan, DistributionCampaign, LearningInsight, MarketOpportunity, PerformanceRecord, Project, ScalePolicy, ScaleProposal, Task } from "@atlas/types";
import type { AuditEntry, Decision, KnowledgeItem, MemoryItem, Mission } from "@atlas/types";
import { AgentRuntime, AiProviderError, AtlasCore, CompanyOrchestrator, ContentStudio, DistributionCenter, Guardian, LearningEngine, MarketIntelligence, MockAiProvider, PermissionManager, ScaleEngine, type AiProvider } from "@atlas/core";
import { buildApp } from "../src/app.js";
import type { JsonStore } from "../src/lib/storage.js";
import { ProjectRepository } from "../src/repositories/ProjectRepository.js";
import { TaskRepository } from "../src/repositories/TaskRepository.js";
import { ProjectService } from "../src/services/ProjectService.js";
import { TaskService } from "../src/services/TaskService.js";
import { AuthService, type StoredUser } from "../src/services/AuthService.js";
import { OpenAIImageClient } from "../src/integrations/OpenAIImageClient.js";

const apps: Awaited<ReturnType<typeof buildApp>>[] = [];
function memoryStore<T>(initial: T[] = []): JsonStore<T> {
  let values = structuredClone(initial);
  return { load: async () => structuredClone(values), save: async (next) => { values = structuredClone(next); } };
}
async function testApp(initialProjects: Project[] = [], initialTasks: Task[] = [], aiProvider: AiProvider = new MockAiProvider(), imageClient?: OpenAIImageClient, trackingBaseUrl = "", registrationPolicy?: { adminEmail?: string; enabledAfterAdmin?: boolean }) {
  const projects = new ProjectService(new ProjectRepository(memoryStore<Project>(initialProjects)));
  const tasks = new TaskService(new TaskRepository(memoryStore<Task>(initialTasks)));
  const atlas = new AtlasCore(aiProvider, { missions: memoryStore<Mission>(), decisions: memoryStore<Decision>(), knowledge: memoryStore<KnowledgeItem>(), audit: memoryStore<AuditEntry>(), memory: memoryStore<MemoryItem>() });
  const auth = new AuthService(memoryStore<StoredUser>(), "test-secret");
  const opportunityStore = memoryStore<MarketOpportunity>(); const runtime = new AgentRuntime(); const permissions = new PermissionManager(); const guardian = new Guardian(memoryStore<AuditEntry>());
  const market = new MarketIntelligence({ research: memoryStore(), evidence: memoryStore(), signals: memoryStore(), offers: memoryStore(), opportunities: opportunityStore }, guardian, runtime, permissions, aiProvider);
  const contentAssetStore = memoryStore<ContentAsset>(); const content = new ContentStudio({ plans: memoryStore<ContentPlan>(), assets: contentAssetStore }, opportunityStore, guardian, runtime, permissions, aiProvider);
  const campaignStore = memoryStore<DistributionCampaign>(); const distribution = new DistributionCenter(campaignStore, contentAssetStore, guardian, runtime, permissions, [], trackingBaseUrl); const performanceStore = memoryStore<PerformanceRecord>(), insightStore = memoryStore<LearningInsight>(); const learning = new LearningEngine(performanceStore, insightStore, campaignStore, guardian, runtime, permissions, aiProvider); const proposalStore = memoryStore<ScaleProposal>(); const scale = new ScaleEngine(memoryStore<ScalePolicy>(), proposalStore, insightStore, performanceStore, guardian, runtime, permissions); const company = new CompanyOrchestrator({ cycles: memoryStore<CompanyCycle>(), opportunities: opportunityStore, assets: contentAssetStore, campaigns: campaignStore, performance: performanceStore, insights: insightStore, proposals: proposalStore }, guardian, runtime, permissions);
  const app = await buildApp({ projects, tasks, atlas, auth, market, content, distribution, learning, scale, company, imageClient, registrationPolicy, logger: false });
  apps.push(app);
  return app;
}
async function authHeaders(app: Awaited<ReturnType<typeof buildApp>>, email = "owner@example.com") { const response = await app.inject({ method: "POST", url: "/auth/register", payload: { email, password: "secure-password", name: "Owner" } }); return { authorization: `Bearer ${response.json().token}` }; }
afterEach(async () => { await Promise.all(apps.splice(0).map((app) => app.close())); });

test("health reports API and storage readiness", async () => {
  const response = await (await testApp()).inject({ method: "GET", url: "/health" });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().status, "ok");
  assert.equal(response.json().storage, "ok");
});

test("mission flow returns a structured decision and history", async () => {
  const app = await testApp();
  const headers = await authHeaders(app);
  const created = await app.inject({ method: "POST", url: "/missions", headers, payload: { title: "Mercado B2B", objective: "Analisar uma oportunidade de mercado", context: "SaaS para pequenas equipes" } });
  assert.equal(created.statusCode, 201);
  const mission = created.json<Mission>();
  const executed = await app.inject({ method: "POST", url: `/missions/${mission.id}/execute`, headers });
  assert.equal(executed.statusCode, 200);
  const decision = executed.json<Decision>();
  assert.ok(decision.recommendation);
  assert.ok(decision.rationale);
  assert.ok(decision.nextSteps.length);
  assert.equal(decision.alternatives?.length, 3);
  assert.equal(decision.executionPlan?.length, 3);
  assert.equal((await app.inject({ method: "GET", url: "/missions", headers })).json<Mission[]>()[0]?.status, "completed");
  assert.equal((await app.inject({ method: "GET", url: "/atlas/status" })).json().ai.mode, "mock");
});

test("a related mission reuses persistent memory from the previous mission", async () => {
  const app = await testApp();
  const headers = await authHeaders(app);
  const first = (await app.inject({ method: "POST", url: "/missions", headers, payload: { title: "Mercado B2B", objective: "Analisar demanda para um produto B2B", context: "Pequenas equipes SaaS" } })).json<Mission>();
  const firstDecision = (await app.inject({ method: "POST", url: `/missions/${first.id}/execute`, headers })).json<Decision>();
  assert.deepEqual(firstDecision.memoryIds, []);
  const second = (await app.inject({ method: "POST", url: "/missions", headers, payload: { title: "Piloto B2B", objective: "Planejar piloto do produto B2B", context: "Pequenas equipes SaaS" } })).json<Mission>();
  const secondDecision = (await app.inject({ method: "POST", url: `/missions/${second.id}/execute`, headers })).json<Decision>();
  assert.equal(secondDecision.memoryIds?.length, 1);
  assert.match(secondDecision.rationale, /1 memória/);
  const operation = (await app.inject({ method: "GET", url: "/atlas/operation", headers })).json();
  assert.equal(operation.counts.memory, 2);
  assert.equal(operation.counts.agents, 1);
  assert.equal(operation.counts.executions, 2);
});

test("agent, plugin and performance operation endpoints expose v0.3 runtime", async () => {
  const app = await testApp();
  const headers = await authHeaders(app);
  assert.equal((await app.inject({ method: "GET", url: "/atlas/agents" })).json()[0].name, "Atlas Executive Agent");
  assert.equal((await app.inject({ method: "GET", url: "/atlas/plugins" })).json()[0].status, "loaded");
  assert.equal((await app.inject({ method: "GET", url: "/atlas/performance", headers })).json().executions, 0);
  assert.equal((await app.inject({ method: "GET", url: "/atlas/status" })).json().version, "1.0.0");
});

test("market research ranks traceable simulated opportunities and isolates users", async () => {
  const app = await testApp(); const owner = await authHeaders(app, "market-owner@example.com"); const outsider = await authHeaders(app, "market-outsider@example.com");
  const payload = { query: "automação para pequenas empresas", market: "Software", niche: "automação", audience: "pequenas empresas", painOrDesire: "economizar tempo", channels: ["SEO", "YouTube"], evidence: [{ source: "fixture:v0.5", observedAt: "2026-08-08T00:00:00.000Z", excerpt: "Sinal simulado de demanda crescente", valueKind: "simulated", confidence: .8 }], offers: [{ name: "Oferta Demo", provider: "fixture", commission: 30, commissionKind: "simulated", notes: "Somente demonstração" }], metrics: { demand: 85, commercialIntent: 75, competition: 45, monetization: 80, margin: 70, effort: 30, risk: 25, evidenceQuality: 80, confidence: 75, scalability: 85 }, dataKind: "simulated" };
  const response = await app.inject({ method: "POST", url: "/market/research", headers: owner, payload }); assert.equal(response.statusCode, 201); const opportunity = response.json().opportunities[0]; assert.equal(opportunity.dataKind, "simulated"); assert.ok(opportunity.score > 0); assert.match(opportunity.rankingRationale, /Demanda/); assert.equal((await app.inject({ method: "GET", url: "/market/opportunities", headers: owner })).json().length, 1); assert.equal((await app.inject({ method: "GET", url: "/market/opportunities", headers: outsider })).json().length, 0); assert.equal((await app.inject({ method: "GET", url: `/market/opportunities/${opportunity.id}`, headers: outsider })).statusCode, 404);
});

test("market research uses a live AI provider for signal classification and rationale, and records provider/model", async () => {
  const aiProvider: AiProvider = { name: "anthropic", model: "claude-sonnet-5", mode: "live", generate: async () => { throw new Error("not used in this test"); }, analyzeMarket: async () => ({ signals: [{ kind: "trend", direction: "rising" }], rankingRationale: "Racional gerado pela IA a partir das evidências." }) };
  const app = await testApp([], [], aiProvider); const owner = await authHeaders(app, "market-ai-owner@example.com");
  const payload = { query: "automação", market: "Software", niche: "automação", audience: "pequenas empresas", painOrDesire: "economizar tempo", channels: ["SEO"], evidence: [{ source: "fixture:v0.5", observedAt: "2026-08-08T00:00:00.000Z", excerpt: "Sinal simulado de demanda crescente", valueKind: "simulated", confidence: .8 }], offers: [{ name: "Oferta Demo", provider: "fixture", notes: "Somente demonstração" }], metrics: { demand: 85, commercialIntent: 75, competition: 45, monetization: 80, margin: 70, effort: 30, risk: 25, evidenceQuality: 80, confidence: 75, scalability: 85 }, dataKind: "simulated" };
  const response = await app.inject({ method: "POST", url: "/market/research", headers: owner, payload });
  assert.equal(response.statusCode, 201); const body = response.json();
  assert.equal(body.research.aiProvider, "anthropic"); assert.equal(body.research.aiModel, "claude-sonnet-5");
  assert.equal(body.opportunities[0].rankingRationale, "Racional gerado pela IA a partir das evidências.");
});

test("market research surfaces AI provider failures as a structured 502, not a generic 400", async () => {
  const aiProvider: AiProvider = { name: "anthropic", model: "claude-sonnet-5", mode: "live", generate: async () => { throw new Error("not used in this test"); }, analyzeMarket: async () => { throw new AiProviderError("Anthropic provider request failed (400): insufficient credits", 400); } };
  const app = await testApp([], [], aiProvider); const owner = await authHeaders(app, "market-ai-fail-owner@example.com");
  const payload = { query: "automação", market: "Software", niche: "automação", audience: "pequenas empresas", painOrDesire: "economizar tempo", channels: ["SEO"], evidence: [{ source: "fixture:v0.5", observedAt: "2026-08-08T00:00:00.000Z", excerpt: "Sinal simulado de demanda crescente", valueKind: "simulated", confidence: .8 }], offers: [{ name: "Oferta Demo", provider: "fixture", notes: "Somente demonstração" }], metrics: { demand: 85, commercialIntent: 75, competition: 45, monetization: 80, margin: 70, effort: 30, risk: 25, evidenceQuality: 80, confidence: 75, scalability: 85 }, dataKind: "simulated" };
  const response = await app.inject({ method: "POST", url: "/market/research", headers: owner, payload });
  assert.equal(response.statusCode, 502); const body = response.json(); assert.equal(body.error, "AI_PROVIDER_ERROR"); assert.doesNotMatch(JSON.stringify(body), /insufficient credits/);
});

test("content studio creates, generates, reviews and isolates commercial assets", async () => {
  const app = await testApp(); const owner = await authHeaders(app, "content-owner@example.com"); const outsider = await authHeaders(app, "content-outsider@example.com");
  const research = await app.inject({ method: "POST", url: "/market/research", headers: owner, payload: { query: "produtividade", market: "Software", niche: "produtividade", audience: "profissionais autônomos", painOrDesire: "economizar tempo", channels: ["blog", "youtube"], evidence: [{ source: "fixture:v0.6", observedAt: "2026-08-08T00:00:00.000Z", excerpt: "Demanda simulada crescente", valueKind: "simulated", confidence: .8 }], offers: [{ name: "Oferta Demo", provider: "fixture", notes: "Demonstração" }], metrics: { demand: 80, commercialIntent: 70, competition: 40, monetization: 75, margin: 70, effort: 35, risk: 25, evidenceQuality: 80, confidence: 75, scalability: 80 }, dataKind: "simulated" } });
  const opportunityId = research.json().opportunities[0].id;
  const planResponse = await app.inject({ method: "POST", url: "/content/plans", headers: owner, payload: { opportunityId, objective: "Apresentar a oferta com transparência", funnelStage: "conversion", channels: ["blog", "youtube"], keywords: ["produtividade", "economizar tempo"], tone: "claro e confiável" } });
  assert.equal(planResponse.statusCode, 201); const plan = planResponse.json<ContentPlan>(); assert.equal(plan.opportunityId, opportunityId);
  const assetResponse = await app.inject({ method: "POST", url: "/content/assets", headers: owner, payload: { planId: plan.id, channel: "youtube", format: "video-script" } });
  assert.equal(assetResponse.statusCode, 201); const asset = assetResponse.json<ContentAsset>(); assert.equal(asset.status, "in_review"); assert.equal(asset.variants.length, 3); assert.match(asset.body, /Transparência/); assert.equal(asset.generationMode, "deterministic");
  const reviewed = await app.inject({ method: "PATCH", url: `/content/assets/${asset.id}/review`, headers: owner, payload: { status: "approved", notes: "Revisado" } }); assert.equal(reviewed.json().status, "approved");
  assert.equal((await app.inject({ method: "GET", url: "/content/assets", headers: outsider })).json().length, 0); assert.equal((await app.inject({ method: "GET", url: `/content/assets/${asset.id}`, headers: outsider })).statusCode, 404);
});

test("content generation uses a live AI provider when available and records provider/model", async () => {
  const aiProvider: AiProvider = { name: "anthropic", model: "claude-sonnet-5", mode: "live", generate: async () => { throw new Error("not used in this test"); }, generateContent: async () => ({ title: "Título gerado por IA", body: "Corpo gerado pela IA real.", cta: "Saiba mais", variants: [{ title: "V1", hook: "H1", cta: "C1" }, { title: "V2", hook: "H2", cta: "C2" }, { title: "V3", hook: "H3", cta: "C3" }], designBrief: "Brief gerado por IA" }) };
  const app = await testApp([], [], aiProvider); const owner = await authHeaders(app, "content-ai-owner@example.com");
  const research = await app.inject({ method: "POST", url: "/market/research", headers: owner, payload: { query: "produtividade", market: "Software", niche: "produtividade", audience: "profissionais autônomos", painOrDesire: "economizar tempo", channels: ["blog", "youtube"], evidence: [{ source: "fixture:v0.6", observedAt: "2026-08-08T00:00:00.000Z", excerpt: "Demanda simulada crescente", valueKind: "simulated", confidence: .8 }], offers: [{ name: "Oferta Demo", provider: "fixture", notes: "Demonstração" }], metrics: { demand: 80, commercialIntent: 70, competition: 40, monetization: 75, margin: 70, effort: 35, risk: 25, evidenceQuality: 80, confidence: 75, scalability: 80 }, dataKind: "simulated" } });
  const opportunityId = research.json().opportunities[0].id;
  const plan = (await app.inject({ method: "POST", url: "/content/plans", headers: owner, payload: { opportunityId, objective: "Apresentar a oferta com transparência", funnelStage: "conversion", channels: ["youtube"], keywords: ["produtividade"], tone: "claro" } })).json<ContentPlan>();
  const assetResponse = await app.inject({ method: "POST", url: "/content/assets", headers: owner, payload: { planId: plan.id, channel: "youtube", format: "video-script" } });
  assert.equal(assetResponse.statusCode, 201); const asset = assetResponse.json<ContentAsset>();
  assert.equal(asset.generationMode, "ai"); assert.equal(asset.provider, "anthropic"); assert.equal(asset.model, "claude-sonnet-5");
  assert.equal(asset.title, "Título gerado por IA"); assert.match(asset.body, /Transparência/);
});

test("content generation surfaces AI provider failures as a structured 502, not a generic 400", async () => {
  const aiProvider: AiProvider = { name: "anthropic", model: "claude-sonnet-5", mode: "live", generate: async () => { throw new Error("not used in this test"); }, generateContent: async () => { throw new AiProviderError("Anthropic provider request failed (400): insufficient credits", 400); } };
  const app = await testApp([], [], aiProvider); const owner = await authHeaders(app, "content-ai-fail-owner@example.com");
  const research = await app.inject({ method: "POST", url: "/market/research", headers: owner, payload: { query: "produtividade", market: "Software", niche: "produtividade", audience: "profissionais autônomos", painOrDesire: "economizar tempo", channels: ["blog", "youtube"], evidence: [{ source: "fixture:v0.6", observedAt: "2026-08-08T00:00:00.000Z", excerpt: "Demanda simulada crescente", valueKind: "simulated", confidence: .8 }], offers: [{ name: "Oferta Demo", provider: "fixture", notes: "Demonstração" }], metrics: { demand: 80, commercialIntent: 70, competition: 40, monetization: 75, margin: 70, effort: 35, risk: 25, evidenceQuality: 80, confidence: 75, scalability: 80 }, dataKind: "simulated" } });
  const opportunityId = research.json().opportunities[0].id;
  const plan = (await app.inject({ method: "POST", url: "/content/plans", headers: owner, payload: { opportunityId, objective: "Apresentar a oferta com transparência", funnelStage: "conversion", channels: ["youtube"], keywords: ["produtividade"], tone: "claro" } })).json<ContentPlan>();
  const assetResponse = await app.inject({ method: "POST", url: "/content/assets", headers: owner, payload: { planId: plan.id, channel: "youtube", format: "video-script" } });
  assert.equal(assetResponse.statusCode, 502); const body = assetResponse.json(); assert.equal(body.error, "AI_PROVIDER_ERROR"); assert.doesNotMatch(JSON.stringify(body), /insufficient credits/);
});

test("distribution requires approved content, tracks links, dry-runs and isolates users", async () => {
  const app = await testApp(); const owner = await authHeaders(app, "distribution-owner@example.com"); const outsider = await authHeaders(app, "distribution-outsider@example.com");
  const research = await app.inject({ method: "POST", url: "/market/research", headers: owner, payload: { query: "vendas", market: "Software", niche: "vendas digitais", audience: "afiliados iniciantes", painOrDesire: "criar conteúdo que converte", channels: ["youtube"], evidence: [{ source: "fixture:v0.7", observedAt: "2026-08-08T00:00:00.000Z", excerpt: "Demanda simulada crescente", valueKind: "simulated", confidence: .8 }], offers: [{ name: "Oferta Demo", provider: "fixture", notes: "Demonstração" }], metrics: { demand: 80, commercialIntent: 80, competition: 40, monetization: 75, margin: 70, effort: 35, risk: 25, evidenceQuality: 80, confidence: 75, scalability: 80 }, dataKind: "simulated" } }); const opportunityId = research.json().opportunities[0].id;
  const plan = (await app.inject({ method: "POST", url: "/content/plans", headers: owner, payload: { opportunityId, objective: "Gerar interesse qualificado", funnelStage: "conversion", channels: ["youtube"], keywords: ["vendas"], tone: "claro" } })).json<ContentPlan>();
  const asset = (await app.inject({ method: "POST", url: "/content/assets", headers: owner, payload: { planId: plan.id, channel: "youtube", format: "video-script" } })).json<ContentAsset>();
  const denied = await app.inject({ method: "POST", url: "/distribution/campaigns", headers: owner, payload: { assetId: asset.id, channel: "youtube", destination: "Canal demo", scheduledAt: "2026-08-09T12:00:00.000Z", targetUrl: "https://example.com/offer", campaignName: "Teste v0.7" } }); assert.equal(denied.statusCode, 400);
  await app.inject({ method: "PATCH", url: `/content/assets/${asset.id}/review`, headers: owner, payload: { status: "approved" } });
  const created = await app.inject({ method: "POST", url: "/distribution/campaigns", headers: owner, payload: { assetId: asset.id, channel: "youtube", destination: "Canal demo", scheduledAt: "2026-08-09T12:00:00.000Z", targetUrl: "https://example.com/offer", campaignName: "Teste v0.7" } }); assert.equal(created.statusCode, 201); const campaign = created.json<DistributionCampaign>(); assert.equal(campaign.mode, "dry_run"); assert.match(campaign.trackingUrl, /utm_source=youtube/);
  await app.inject({ method: "POST", url: `/distribution/campaigns/${campaign.id}/approve`, headers: owner }); await app.inject({ method: "POST", url: `/distribution/campaigns/${campaign.id}/schedule`, headers: owner }); const executed = await app.inject({ method: "POST", url: `/distribution/campaigns/${campaign.id}/execute`, headers: owner }); assert.equal(executed.json().status, "completed"); assert.equal(executed.json().result.delivered, false);
  const confirmed = await app.inject({ method: "POST", url: "/learning/performance", headers: owner, payload: { campaignId: campaign.id, metrics: { impressions: 1000, clicks: 100, conversions: 10, cost: 50, revenue: 150 }, dataKind: "confirmed", source: "fixture", observedAt: "2026-08-09T13:00:00.000Z" } }); assert.equal(confirmed.statusCode, 400);
  const performance = await app.inject({ method: "POST", url: "/learning/performance", headers: owner, payload: { campaignId: campaign.id, metrics: { impressions: 1000, clicks: 100, conversions: 10, cost: 50, revenue: 150 }, dataKind: "simulated", source: "fixture:v0.8", observedAt: "2026-08-09T13:00:00.000Z" } }); assert.equal(performance.statusCode, 201); assert.equal(performance.json().ctr, 10); assert.equal(performance.json().conversionRate, 10); assert.equal(performance.json().roi, 200); assert.equal(performance.json().profit, 100);
  const insight = await app.inject({ method: "POST", url: `/learning/opportunities/${opportunityId}/analyze`, headers: owner }); assert.equal(insight.statusCode, 200); assert.equal(insight.json().dataKind, "simulated"); assert.match(insight.json().recommendation, /teste controlado/);
  const policy = await app.inject({ method: "POST", url: "/scale/policies", headers: owner, payload: { name: "Safe zero budget", maxTotalBudget: 0, maxDailyBudget: 0, maxIncreasePercent: 20, minRoiPercent: 50, minConversions: 5, maxCac: 20 } }); assert.equal(policy.statusCode, 201); assert.equal(policy.json().liveExecutionEnabled, false);
  const proposal = await app.inject({ method: "POST", url: "/scale/proposals", headers: owner, payload: { policyId: policy.json().id, insightId: insight.json().id, currentBudget: 0 } }); assert.equal(proposal.statusCode, 201); assert.equal(proposal.json().action, "hold"); assert.ok(proposal.json().riskFlags.includes("unconfirmed-data")); assert.ok(proposal.json().riskFlags.includes("zero-budget-policy"));
  await app.inject({ method: "POST", url: `/scale/proposals/${proposal.json().id}/review`, headers: owner, payload: { status: "approved" } }); const simulatedScale = await app.inject({ method: "POST", url: `/scale/proposals/${proposal.json().id}/simulate`, headers: owner }); assert.equal(simulatedScale.json().status, "simulated"); assert.equal(simulatedScale.json().proposedBudget, 0);
  const cycle = await app.inject({ method: "POST", url: "/company/cycles/assess", headers: owner }); assert.equal(cycle.statusCode, 201); assert.equal(cycle.json().mode, "safe"); assert.equal(cycle.json().externalPublishingEnabled, false); assert.equal(cycle.json().financialExecutionEnabled, false); assert.equal(cycle.json().stages.find((item: { name: string }) => item.name === "measurement").status, "blocked"); assert.match(cycle.json().nextAction, /fonte real/);
  assert.equal((await app.inject({ method: "GET", url: "/distribution/campaigns", headers: outsider })).json().length, 0); assert.equal((await app.inject({ method: "GET", url: `/distribution/campaigns/${campaign.id}`, headers: outsider })).statusCode, 404);
  assert.equal((await app.inject({ method: "GET", url: "/learning/performance", headers: outsider })).json().length, 0); assert.equal((await app.inject({ method: "GET", url: "/learning/insights", headers: outsider })).json().length, 0);
  assert.equal((await app.inject({ method: "GET", url: "/scale/policies", headers: outsider })).json().length, 0); assert.equal((await app.inject({ method: "GET", url: "/scale/proposals", headers: outsider })).json().length, 0);
  assert.equal((await app.inject({ method: "GET", url: "/company/cycles", headers: outsider })).json().length, 0);
});

async function runToPerformance(app: Awaited<ReturnType<typeof buildApp>>, owner: { authorization: string }) {
  const research = await app.inject({ method: "POST", url: "/market/research", headers: owner, payload: { query: "vendas", market: "Software", niche: "vendas digitais", audience: "afiliados iniciantes", painOrDesire: "criar conteúdo que converte", channels: ["youtube"], evidence: [{ source: "fixture:v0.7", observedAt: "2026-08-08T00:00:00.000Z", excerpt: "Demanda simulada crescente", valueKind: "simulated", confidence: .8 }], offers: [{ name: "Oferta Demo", provider: "fixture", notes: "Demonstração" }], metrics: { demand: 80, commercialIntent: 80, competition: 40, monetization: 75, margin: 70, effort: 35, risk: 25, evidenceQuality: 80, confidence: 75, scalability: 80 }, dataKind: "simulated" } }); const opportunityId = research.json().opportunities[0].id;
  const plan = (await app.inject({ method: "POST", url: "/content/plans", headers: owner, payload: { opportunityId, objective: "Gerar interesse qualificado", funnelStage: "conversion", channels: ["youtube"], keywords: ["vendas"], tone: "claro" } })).json<ContentPlan>();
  const asset = (await app.inject({ method: "POST", url: "/content/assets", headers: owner, payload: { planId: plan.id, channel: "youtube", format: "video-script" } })).json<ContentAsset>();
  await app.inject({ method: "PATCH", url: `/content/assets/${asset.id}/review`, headers: owner, payload: { status: "approved" } });
  const campaign = (await app.inject({ method: "POST", url: "/distribution/campaigns", headers: owner, payload: { assetId: asset.id, channel: "youtube", destination: "Canal demo", scheduledAt: "2026-08-09T12:00:00.000Z", targetUrl: "https://example.com/offer", campaignName: "Teste IA" } })).json<DistributionCampaign>();
  await app.inject({ method: "POST", url: `/distribution/campaigns/${campaign.id}/approve`, headers: owner }); await app.inject({ method: "POST", url: `/distribution/campaigns/${campaign.id}/schedule`, headers: owner }); await app.inject({ method: "POST", url: `/distribution/campaigns/${campaign.id}/execute`, headers: owner });
  await app.inject({ method: "POST", url: "/learning/performance", headers: owner, payload: { campaignId: campaign.id, metrics: { impressions: 1000, clicks: 100, conversions: 10, cost: 50, revenue: 150 }, dataKind: "simulated", source: "fixture:v0.8", observedAt: "2026-08-09T13:00:00.000Z" } });
  return opportunityId;
}

test("learning uses a live AI provider to write the insight summary, keeping the recommendation deterministic", async () => {
  const aiProvider: AiProvider = { name: "anthropic", model: "claude-sonnet-5", mode: "live", generate: async () => { throw new Error("not used in this test"); }, summarizeInsight: async () => ({ summary: "Resumo gerado pela IA a partir das métricas reais." }) };
  const app = await testApp([], [], aiProvider); const owner = await authHeaders(app, "learning-ai-owner@example.com");
  const opportunityId = await runToPerformance(app, owner);
  const insight = await app.inject({ method: "POST", url: `/learning/opportunities/${opportunityId}/analyze`, headers: owner });
  assert.equal(insight.statusCode, 200); const body = insight.json();
  assert.equal(body.summary, "Resumo gerado pela IA a partir das métricas reais.");
  assert.equal(body.aiProvider, "anthropic"); assert.equal(body.aiModel, "claude-sonnet-5");
  assert.match(body.recommendation, /teste controlado/);
});

test("learning surfaces AI provider failures as a structured 502, not a generic 400", async () => {
  const aiProvider: AiProvider = { name: "anthropic", model: "claude-sonnet-5", mode: "live", generate: async () => { throw new Error("not used in this test"); }, summarizeInsight: async () => { throw new AiProviderError("Anthropic provider request failed (400): insufficient credits", 400); } };
  const app = await testApp([], [], aiProvider); const owner = await authHeaders(app, "learning-ai-fail-owner@example.com");
  const opportunityId = await runToPerformance(app, owner);
  const insight = await app.inject({ method: "POST", url: `/learning/opportunities/${opportunityId}/analyze`, headers: owner });
  assert.equal(insight.statusCode, 502); const body = insight.json(); assert.equal(body.error, "AI_PROVIDER_ERROR"); assert.doesNotMatch(JSON.stringify(body), /insufficient credits/);
});

test("authentication isolates missions between users", async () => {
  const app = await testApp(); const firstHeaders = await authHeaders(app, "first@example.com"); const secondHeaders = await authHeaders(app, "second@example.com");
  assert.equal((await app.inject({ method: "GET", url: "/missions" })).statusCode, 401);
  await app.inject({ method: "POST", url: "/missions", headers: firstHeaders, payload: { title: "Private mission", objective: "Analyze private strategy for first user", context: "tenant one" } });
  assert.equal((await app.inject({ method: "GET", url: "/missions", headers: firstHeaders })).json<Mission[]>().length, 1);
  assert.equal((await app.inject({ method: "GET", url: "/missions", headers: secondHeaders })).json<Mission[]>().length, 0);
  const login = await app.inject({ method: "POST", url: "/auth/login", payload: { email: "first@example.com", password: "secure-password" } });
  assert.equal(login.statusCode, 200); assert.ok(login.json().token);
});

test("projects and tasks enforce authentication and owner isolation", async () => {
  const app = await testApp(); const owner = await authHeaders(app, "project-owner@example.com"); const outsider = await authHeaders(app, "project-outsider@example.com");
  assert.equal((await app.inject({ method: "GET", url: "/projects" })).statusCode, 401);
  assert.equal((await app.inject({ method: "GET", url: "/tasks" })).statusCode, 401);
  const project = (await app.inject({ method: "POST", url: "/projects", headers: owner, payload: { name: "Private project", description: "Owner only" } })).json<Project>();
  const task = (await app.inject({ method: "POST", url: `/projects/${project.id}/tasks`, headers: owner, payload: { title: "Private task", priority: "high" } })).json<Task>();
  assert.equal((await app.inject({ method: "GET", url: "/projects", headers: outsider })).json<Project[]>().length, 0);
  assert.equal((await app.inject({ method: "GET", url: "/tasks", headers: outsider })).json<Task[]>().length, 0);
  assert.equal((await app.inject({ method: "GET", url: `/projects/${project.id}`, headers: outsider })).statusCode, 404);
  assert.equal((await app.inject({ method: "GET", url: `/projects/${project.id}/tasks`, headers: outsider })).statusCode, 404);
  assert.equal((await app.inject({ method: "POST", url: `/projects/${project.id}/tasks`, headers: outsider, payload: { title: "Intrusion" } })).statusCode, 404);
  assert.equal((await app.inject({ method: "PATCH", url: `/projects/${project.id}`, headers: outsider, payload: { name: "Hijacked" } })).statusCode, 404);
  assert.equal((await app.inject({ method: "PATCH", url: `/tasks/${task.id}`, headers: outsider, payload: { completed: true } })).statusCode, 404);
  assert.equal((await app.inject({ method: "DELETE", url: `/tasks/${task.id}`, headers: outsider })).statusCode, 404);
  assert.equal((await app.inject({ method: "DELETE", url: `/projects/${project.id}`, headers: outsider })).statusCode, 404);
  assert.equal((await app.inject({ method: "GET", url: `/projects/${project.id}`, headers: owner })).statusCode, 200);
  assert.equal((await app.inject({ method: "GET", url: `/projects/${project.id}/tasks`, headers: owner })).json<Task[]>().length, 1);
});

test("first admin claims unowned legacy projects and tasks without data loss", async () => {
  const now = new Date().toISOString(); const legacyProject: Project = { id: "legacy-project", name: "Legacy", description: "Imported", status: "active", createdAt: now, updatedAt: now }; const legacyTask: Task = { id: "legacy-task", projectId: legacyProject.id, title: "Legacy task", completed: false, priority: "medium", dueDate: null, createdAt: now, updatedAt: now };
  const app = await testApp([legacyProject], [legacyTask]); const headers = await authHeaders(app, "legacy-admin@example.com"); const projects = (await app.inject({ method: "GET", url: "/projects", headers })).json<Project[]>(); const tasks = (await app.inject({ method: "GET", url: "/tasks", headers })).json<Task[]>(); assert.equal(projects[0]?.id, legacyProject.id); assert.equal(tasks[0]?.id, legacyTask.id); assert.ok(projects[0]?.ownerId); assert.equal(tasks[0]?.ownerId, projects[0]?.ownerId);
});

test("project and task lifecycle works end to end", async () => {
  const app = await testApp();
  const headers = await authHeaders(app);
  const createdProject = await app.inject({ method: "POST", url: "/projects", headers, payload: { name: " Mission Alpha ", description: "MVP" } });
  assert.equal(createdProject.statusCode, 201);
  const project = createdProject.json<Project>();
  assert.equal(project.name, "Mission Alpha");

  const createdTask = await app.inject({ method: "POST", url: `/projects/${project.id}/tasks`, headers, payload: { title: "Decide scope", priority: "high", dueDate: "2026-08-10" } });
  assert.equal(createdTask.statusCode, 201);
  const task = createdTask.json<Task>();
  assert.equal(task.projectId, project.id);

  const updated = await app.inject({ method: "PATCH", url: `/tasks/${task.id}`, headers, payload: { completed: true } });
  assert.equal(updated.statusCode, 200);
  assert.equal(updated.json<Task>().completed, true);

  assert.equal((await app.inject({ method: "GET", url: `/projects/${project.id}/tasks`, headers })).json<Task[]>().length, 1);
  assert.equal((await app.inject({ method: "DELETE", url: `/projects/${project.id}`, headers })).statusCode, 204);
  assert.equal((await app.inject({ method: "GET", url: "/tasks", headers })).json<Task[]>().length, 0);
});

test("validation and not-found errors are consistent", async () => {
  const app = await testApp();
  const headers = await authHeaders(app);
  const invalid = await app.inject({ method: "POST", url: "/projects", payload: { name: "   ", unknown: true } });
  assert.equal(invalid.statusCode, 400);
  assert.equal(invalid.json().error, "VALIDATION_ERROR");
  const missing = await app.inject({ method: "PATCH", url: "/tasks/missing", headers, payload: { completed: true } });
  assert.equal(missing.statusCode, 404);
  assert.equal(missing.json().error, "NOT_FOUND");
});

test("autonomy control plane queues idempotent work and isolates it behind authentication", async () => {
  const app = await testApp();
  assert.equal((await app.inject({ method: "GET", url: "/autonomy/status" })).statusCode, 401);
  const headers = await authHeaders(app);
  const payload = { kind: "discover_offers", idempotencyKey: "radar:discovery:2026-08-31", runAt: "2026-08-31T12:00:00Z" };
  const first = await app.inject({ method: "POST", url: "/autonomy/jobs", headers, payload });
  const duplicate = await app.inject({ method: "POST", url: "/autonomy/jobs", headers, payload });
  assert.equal(first.statusCode, 201); assert.equal(first.json().id, duplicate.json().id);
  const jobs = await app.inject({ method: "GET", url: "/autonomy/jobs", headers });
  assert.equal(jobs.statusCode, 200); assert.equal(jobs.json().length, 1);
  const status = await app.inject({ method: "GET", url: "/autonomy/status", headers });
  assert.equal(status.statusCode, 200); assert.equal(status.json().pending, 1); assert.equal(status.json().enabled, false);
});

test("TikTok OAuth callback is publicly reachable without exposing credentials", async () => {
  const response = await (await testApp()).inject({ method: "GET", url: "/integrations/tiktok/callback" });
  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.json(), { status: "ready", provider: "tiktok", message: "TikTok OAuth callback is active. Start authorization from Radar de Escolhas." });
});

test("TikTok URL ownership signature is served at the exact verified prefix", async () => {
  const response = await (await testApp()).inject({ method: "GET", url: "/integrations/tiktok/callback/tiktokZUTUUz5GNXVqHqCqbSQSroyxHl9mBXoK.txt" });
  assert.equal(response.statusCode, 200);
  assert.match(response.headers["content-type"] ?? "", /^text\/plain/);
  assert.equal(response.body, "tiktok-developers-site-verification=ZUTUUz5GNXVqHqCqbSQSroyxHl9mBXoK");
});

test("production registration policy reserves the first admin and closes public signups", async () => {
  const app = await testApp([], [], new MockAiProvider(), undefined, "", { adminEmail: "owner@example.com", enabledAfterAdmin: false });
  assert.deepEqual((await app.inject({ method: "GET", url: "/auth/registration-status" })).json(), { registrationOpen: true, awaitingAdmin: true, restrictedToAdminEmail: true, recoveryAvailable: false });
  assert.equal((await app.inject({ method: "POST", url: "/auth/register", payload: { email: "intruder@example.com", password: "secure-password", name: "Intruder" } })).statusCode, 403);
  assert.equal((await app.inject({ method: "POST", url: "/auth/register", payload: { email: "OWNER@example.com", password: "secure-password", name: "Owner" } })).statusCode, 201);
  assert.deepEqual((await app.inject({ method: "GET", url: "/auth/registration-status" })).json(), { registrationOpen: false, awaitingAdmin: false, restrictedToAdminEmail: false, recoveryAvailable: false });
  assert.equal((await app.inject({ method: "POST", url: "/auth/register", payload: { email: "member@example.com", password: "secure-password", name: "Member" } })).statusCode, 403);
});

test("administrator recovery preserves the existing owner and rotates credentials", async () => {
  const previous = process.env.ATLAS_ADMIN_RECOVERY_TOKEN; process.env.ATLAS_ADMIN_RECOVERY_TOKEN = "temporary-recovery-code";
  try {
    const app = await testApp([], [], new MockAiProvider(), undefined, "", { adminEmail: "owner@example.com", enabledAfterAdmin: false });
    const created = await app.inject({ method: "POST", url: "/auth/register", payload: { email: "owner@example.com", password: "old-password", name: "Owner" } });
    const ownerId = created.json().user.id;
    assert.equal((await app.inject({ method: "POST", url: "/auth/recover", payload: { email: "owner@example.com", password: "new-password", recoveryCode: "wrong" } })).statusCode, 401);
    const recovered = await app.inject({ method: "POST", url: "/auth/recover", payload: { email: "owner@example.com", password: "new-password", recoveryCode: "temporary-recovery-code" } });
    assert.equal(recovered.statusCode, 200); assert.equal(recovered.json().user.id, ownerId); assert.equal(recovered.json().user.email, "owner@example.com");
    assert.equal((await app.inject({ method: "POST", url: "/auth/login", payload: { email: "owner@example.com", password: "old-password" } })).statusCode, 401);
    assert.equal((await app.inject({ method: "POST", url: "/auth/login", payload: { email: "owner@example.com", password: "new-password" } })).statusCode, 200);
  } finally { if (previous === undefined) delete process.env.ATLAS_ADMIN_RECOVERY_TOKEN; else process.env.ATLAS_ADMIN_RECOVERY_TOKEN = previous; }
});

test("approved content can generate and serve a persisted real media asset", async () => {
  const imageClient = new OpenAIImageClient("test-key", "gpt-image-1-mini");
  imageClient.generate = async () => ({ bytes: Buffer.from("real-png-bytes"), model: "gpt-image-1-mini", mimeType: "image/png", requestId: "req-test" });
  const app = await testApp([], [], new MockAiProvider(), imageClient);
  const owner = await authHeaders(app, "media-owner@example.com");
  const research = await app.inject({ method: "POST", url: "/market/research", headers: owner, payload: { query: "casa", market: "Afiliados", niche: "organização", audience: "adultos", painOrDesire: "organizar a casa", channels: ["instagram"], evidence: [{ source: "fixture", observedAt: new Date().toISOString(), excerpt: "teste", valueKind: "simulated", confidence: .8 }], offers: [{ name: "Oferta", provider: "fixture" }], metrics: { demand: 70, commercialIntent: 70, competition: 40, monetization: 70, margin: 60, effort: 30, risk: 20, evidenceQuality: 70, confidence: 70, scalability: 70 }, dataKind: "simulated" } });
  const opportunityId = research.json().opportunities[0].id;
  const plan = (await app.inject({ method: "POST", url: "/content/plans", headers: owner, payload: { opportunityId, objective: "Apresentar produto", funnelStage: "conversion", channels: ["instagram"], keywords: ["casa"], tone: "claro" } })).json<ContentPlan>();
  const asset = (await app.inject({ method: "POST", url: "/content/assets", headers: owner, payload: { planId: plan.id, channel: "instagram", format: "social-post" } })).json<ContentAsset>();
  assert.equal((await app.inject({ method: "POST", url: `/content/assets/${asset.id}/image`, headers: owner, payload: {} })).statusCode, 409);
  await app.inject({ method: "PATCH", url: `/content/assets/${asset.id}/review`, headers: owner, payload: { status: "approved" } });
  const generated = await app.inject({ method: "POST", url: `/content/assets/${asset.id}/image`, headers: owner, payload: { prompt: "Imagem comercial limpa" } });
  assert.equal(generated.statusCode, 201);
  assert.equal(generated.json().model, "gpt-image-1-mini");
  const media = await app.inject({ method: "GET", url: `/media/${generated.json().id}` });
  assert.equal(media.statusCode, 200);
  assert.equal(media.body, "real-png-bytes");
});

test("Shopee tracking redirect records confirmed clicks without personal data", async () => {
  const app = await testApp();
  const owner = await authHeaders(app, "shopee-tracking@example.com");
  const created = await app.inject({ method: "POST", url: "/integrations/shopee/links", headers: owner, payload: { name: "Organizador", category: "Casa", channel: "instagram", affiliateUrl: "https://shope.ee/example", subId: "atlas-test" } });
  assert.equal(created.statusCode, 201);
  const link = created.json();
  const redirect = await app.inject({ method: "GET", url: `/r/shopee/${link.id}` });
  assert.equal(redirect.statusCode, 302);
  assert.equal(redirect.headers.location, "https://shope.ee/example");
  const clicks = await app.inject({ method: "GET", url: "/integrations/shopee/clicks", headers: owner });
  assert.equal(clicks.statusCode, 200);
  assert.equal(clicks.json().length, 1);
  assert.equal(clicks.json()[0].dataKind, "confirmed");
  assert.equal(JSON.stringify(clicks.json()).includes("ip"), false);
  await app.close();
});

test("campaign redirect records a confirmed click and forwards to the UTM destination", async () => {
  const app = await testApp([], [], new MockAiProvider(), undefined, "https://api.example");
  const owner = await authHeaders(app, "campaign-tracking@example.com");
  const research = await app.inject({ method: "POST", url: "/market/research", headers: owner, payload: { query: "casa", market: "Afiliados", niche: "organização", audience: "adultos", painOrDesire: "organizar a casa", channels: ["instagram"], evidence: [{ source: "fixture", observedAt: new Date().toISOString(), excerpt: "teste", valueKind: "simulated", confidence: .8 }], offers: [{ name: "Oferta", provider: "fixture" }], metrics: { demand: 70, commercialIntent: 70, competition: 40, monetization: 70, margin: 60, effort: 30, risk: 20, evidenceQuality: 70, confidence: 70, scalability: 70 }, dataKind: "simulated" } });
  const opportunityId = research.json().opportunities[0].id;
  const plan = (await app.inject({ method: "POST", url: "/content/plans", headers: owner, payload: { opportunityId, objective: "Apresentar produto", funnelStage: "conversion", channels: ["instagram"], keywords: ["casa"], tone: "claro" } })).json<ContentPlan>();
  const asset = (await app.inject({ method: "POST", url: "/content/assets", headers: owner, payload: { planId: plan.id, channel: "instagram", format: "social-post" } })).json<ContentAsset>();
  await app.inject({ method: "PATCH", url: `/content/assets/${asset.id}/review`, headers: owner, payload: { status: "approved" } });
  const campaign = (await app.inject({ method: "POST", url: "/distribution/campaigns", headers: owner, payload: { assetId: asset.id, channel: "instagram", destination: "Perfil", scheduledAt: new Date().toISOString(), targetUrl: "https://go.hotmart.com/V107180956B", campaignName: "Radar Casa" } })).json<DistributionCampaign>();
  assert.equal(campaign.trackingUrl, `https://api.example/r/campaign/${campaign.id}`);
  await app.inject({ method: "POST", url: `/distribution/campaigns/${campaign.id}/approve`, headers: owner });
  await app.inject({ method: "POST", url: `/distribution/campaigns/${campaign.id}/schedule`, headers: owner });
  const redirect = await app.inject({ method: "GET", url: `/r/campaign/${campaign.id}` });
  assert.equal(redirect.statusCode, 302);
  assert.match(String(redirect.headers.location), /go\.hotmart\.com/);
  assert.match(String(redirect.headers.location), /utm_source=instagram/);
  assert.equal(redirect.headers["cache-control"], "no-store");
  const clicks = await app.inject({ method: "GET", url: "/distribution/clicks", headers: owner });
  assert.equal(clicks.json().length, 1);
  assert.equal(clicks.json()[0].dataKind, "confirmed");
  assert.equal(JSON.stringify(clicks.json()).includes("ip"), false);
});

test("Hotmart affiliate redirect records confirmed clicks when catalog API is empty", async () => {
  const app = await testApp();
  const owner = await authHeaders(app, "hotmart-link@example.com");
  const created = await app.inject({ method: "POST", url: "/integrations/hotmart/links", headers: owner, payload: { name: "Produto Hotmart", affiliateUrl: "https://go.hotmart.com/V107180956B", subId: "atlas-test" } });
  assert.equal(created.statusCode, 201);
  const redirect = await app.inject({ method: "GET", url: `/r/hotmart/${created.json().id}` });
  assert.equal(redirect.statusCode, 302);
  assert.match(String(redirect.headers.location), /go\.hotmart\.com/);
  const clicks = await app.inject({ method: "GET", url: "/integrations/hotmart/clicks", headers: owner });
  assert.equal(clicks.json().length, 1); assert.equal(clicks.json()[0].dataKind, "confirmed");
});

test("readiness never reports legacy username/password social connectors as operational", async () => {
  const previousInstagramToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  const previousTikTokToken = process.env.TIKTOK_ACCESS_TOKEN;
  delete process.env.INSTAGRAM_ACCESS_TOKEN;
  delete process.env.TIKTOK_ACCESS_TOKEN;
  try {
    const app = await testApp();
    const owner = await authHeaders(app, "readiness@example.com");
    const response = await app.inject({ method: "GET", url: "/atlas/readiness", headers: owner });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().integrations.instagramPublishing.ready, false);
    assert.equal(response.json().integrations.tiktokPublishing.ready, false);
    assert.equal(response.json().readyForExternalPublishing, false);
    await app.close();
  } finally {
    if (previousInstagramToken !== undefined) process.env.INSTAGRAM_ACCESS_TOKEN = previousInstagramToken;
    if (previousTikTokToken !== undefined) process.env.TIKTOK_ACCESS_TOKEN = previousTikTokToken;
  }
});
