import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import type { ContentAsset, ContentPlan, DistributionCampaign, MarketOpportunity, Project, Task } from "@atlas/types";
import type { AuditEntry, Decision, KnowledgeItem, MemoryItem, Mission } from "@atlas/types";
import { AgentRuntime, AtlasCore, ContentStudio, DistributionCenter, Guardian, MarketIntelligence, MockAiProvider, PermissionManager } from "@atlas/core";
import { buildApp } from "../src/app.js";
import type { JsonStore } from "../src/lib/storage.js";
import { ProjectRepository } from "../src/repositories/ProjectRepository.js";
import { TaskRepository } from "../src/repositories/TaskRepository.js";
import { ProjectService } from "../src/services/ProjectService.js";
import { TaskService } from "../src/services/TaskService.js";
import { AuthService, type StoredUser } from "../src/services/AuthService.js";

const apps: Awaited<ReturnType<typeof buildApp>>[] = [];
function memoryStore<T>(initial: T[] = []): JsonStore<T> {
  let values = structuredClone(initial);
  return { load: async () => structuredClone(values), save: async (next) => { values = structuredClone(next); } };
}
async function testApp(initialProjects: Project[] = [], initialTasks: Task[] = []) {
  const projects = new ProjectService(new ProjectRepository(memoryStore<Project>(initialProjects)));
  const tasks = new TaskService(new TaskRepository(memoryStore<Task>(initialTasks)));
  const atlas = new AtlasCore(new MockAiProvider(), { missions: memoryStore<Mission>(), decisions: memoryStore<Decision>(), knowledge: memoryStore<KnowledgeItem>(), audit: memoryStore<AuditEntry>(), memory: memoryStore<MemoryItem>() });
  const auth = new AuthService(memoryStore<StoredUser>(), "test-secret");
  const opportunityStore = memoryStore<MarketOpportunity>(); const runtime = new AgentRuntime(); const permissions = new PermissionManager(); const guardian = new Guardian(memoryStore<AuditEntry>());
  const market = new MarketIntelligence({ research: memoryStore(), evidence: memoryStore(), signals: memoryStore(), offers: memoryStore(), opportunities: opportunityStore }, guardian, runtime, permissions);
  const contentAssetStore = memoryStore<ContentAsset>(); const content = new ContentStudio({ plans: memoryStore<ContentPlan>(), assets: contentAssetStore }, opportunityStore, guardian, runtime, permissions);
  const distribution = new DistributionCenter(memoryStore<DistributionCampaign>(), contentAssetStore, guardian, runtime, permissions);
  const app = await buildApp({ projects, tasks, atlas, auth, market, content, distribution, logger: false });
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
  assert.equal((await app.inject({ method: "GET", url: "/atlas/status" })).json().version, "0.7.0");
});

test("market research ranks traceable simulated opportunities and isolates users", async () => {
  const app = await testApp(); const owner = await authHeaders(app, "market-owner@example.com"); const outsider = await authHeaders(app, "market-outsider@example.com");
  const payload = { query: "automação para pequenas empresas", market: "Software", niche: "automação", audience: "pequenas empresas", painOrDesire: "economizar tempo", channels: ["SEO", "YouTube"], evidence: [{ source: "fixture:v0.5", observedAt: "2026-08-08T00:00:00.000Z", excerpt: "Sinal simulado de demanda crescente", valueKind: "simulated", confidence: .8 }], offers: [{ name: "Oferta Demo", provider: "fixture", commission: 30, commissionKind: "simulated", notes: "Somente demonstração" }], metrics: { demand: 85, commercialIntent: 75, competition: 45, monetization: 80, margin: 70, effort: 30, risk: 25, evidenceQuality: 80, confidence: 75, scalability: 85 }, dataKind: "simulated" };
  const response = await app.inject({ method: "POST", url: "/market/research", headers: owner, payload }); assert.equal(response.statusCode, 201); const opportunity = response.json().opportunities[0]; assert.equal(opportunity.dataKind, "simulated"); assert.ok(opportunity.score > 0); assert.match(opportunity.rankingRationale, /Demanda/); assert.equal((await app.inject({ method: "GET", url: "/market/opportunities", headers: owner })).json().length, 1); assert.equal((await app.inject({ method: "GET", url: "/market/opportunities", headers: outsider })).json().length, 0); assert.equal((await app.inject({ method: "GET", url: `/market/opportunities/${opportunity.id}`, headers: outsider })).statusCode, 404);
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

test("distribution requires approved content, tracks links, dry-runs and isolates users", async () => {
  const app = await testApp(); const owner = await authHeaders(app, "distribution-owner@example.com"); const outsider = await authHeaders(app, "distribution-outsider@example.com");
  const research = await app.inject({ method: "POST", url: "/market/research", headers: owner, payload: { query: "vendas", market: "Software", niche: "vendas digitais", audience: "afiliados iniciantes", painOrDesire: "criar conteúdo que converte", channels: ["youtube"], evidence: [{ source: "fixture:v0.7", observedAt: "2026-08-08T00:00:00.000Z", excerpt: "Demanda simulada crescente", valueKind: "simulated", confidence: .8 }], offers: [{ name: "Oferta Demo", provider: "fixture", notes: "Demonstração" }], metrics: { demand: 80, commercialIntent: 80, competition: 40, monetization: 75, margin: 70, effort: 35, risk: 25, evidenceQuality: 80, confidence: 75, scalability: 80 }, dataKind: "simulated" } }); const opportunityId = research.json().opportunities[0].id;
  const plan = (await app.inject({ method: "POST", url: "/content/plans", headers: owner, payload: { opportunityId, objective: "Gerar interesse qualificado", funnelStage: "conversion", channels: ["youtube"], keywords: ["vendas"], tone: "claro" } })).json<ContentPlan>();
  const asset = (await app.inject({ method: "POST", url: "/content/assets", headers: owner, payload: { planId: plan.id, channel: "youtube", format: "video-script" } })).json<ContentAsset>();
  const denied = await app.inject({ method: "POST", url: "/distribution/campaigns", headers: owner, payload: { assetId: asset.id, channel: "youtube", destination: "Canal demo", scheduledAt: "2026-08-09T12:00:00.000Z", targetUrl: "https://example.com/offer", campaignName: "Teste v0.7" } }); assert.equal(denied.statusCode, 400);
  await app.inject({ method: "PATCH", url: `/content/assets/${asset.id}/review`, headers: owner, payload: { status: "approved" } });
  const created = await app.inject({ method: "POST", url: "/distribution/campaigns", headers: owner, payload: { assetId: asset.id, channel: "youtube", destination: "Canal demo", scheduledAt: "2026-08-09T12:00:00.000Z", targetUrl: "https://example.com/offer", campaignName: "Teste v0.7" } }); assert.equal(created.statusCode, 201); const campaign = created.json<DistributionCampaign>(); assert.equal(campaign.mode, "dry_run"); assert.match(campaign.trackingUrl, /utm_source=youtube/);
  await app.inject({ method: "POST", url: `/distribution/campaigns/${campaign.id}/approve`, headers: owner }); await app.inject({ method: "POST", url: `/distribution/campaigns/${campaign.id}/schedule`, headers: owner }); const executed = await app.inject({ method: "POST", url: `/distribution/campaigns/${campaign.id}/execute`, headers: owner }); assert.equal(executed.json().status, "completed"); assert.equal(executed.json().result.delivered, false);
  assert.equal((await app.inject({ method: "GET", url: "/distribution/campaigns", headers: outsider })).json().length, 0); assert.equal((await app.inject({ method: "GET", url: `/distribution/campaigns/${campaign.id}`, headers: outsider })).statusCode, 404);
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
