import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import type { Project, Task } from "@atlas/types";
import type { AuditEntry, Decision, KnowledgeItem, MemoryItem, Mission } from "@atlas/types";
import { AtlasCore, MockAiProvider } from "@atlas/core";
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
async function testApp() {
  const projects = new ProjectService(new ProjectRepository(memoryStore<Project>()));
  const tasks = new TaskService(new TaskRepository(memoryStore<Task>()));
  const atlas = new AtlasCore(new MockAiProvider(), { missions: memoryStore<Mission>(), decisions: memoryStore<Decision>(), knowledge: memoryStore<KnowledgeItem>(), audit: memoryStore<AuditEntry>(), memory: memoryStore<MemoryItem>() });
  const auth = new AuthService(memoryStore<StoredUser>(), "test-secret");
  const app = await buildApp({ projects, tasks, atlas, auth, logger: false });
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
  assert.equal((await app.inject({ method: "GET", url: "/atlas/status" })).json().version, "0.4.0");
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

test("project and task lifecycle works end to end", async () => {
  const app = await testApp();
  const createdProject = await app.inject({ method: "POST", url: "/projects", payload: { name: " Mission Alpha ", description: "MVP" } });
  assert.equal(createdProject.statusCode, 201);
  const project = createdProject.json<Project>();
  assert.equal(project.name, "Mission Alpha");

  const createdTask = await app.inject({ method: "POST", url: `/projects/${project.id}/tasks`, payload: { title: "Decide scope", priority: "high", dueDate: "2026-08-10" } });
  assert.equal(createdTask.statusCode, 201);
  const task = createdTask.json<Task>();
  assert.equal(task.projectId, project.id);

  const updated = await app.inject({ method: "PATCH", url: `/tasks/${task.id}`, payload: { completed: true } });
  assert.equal(updated.statusCode, 200);
  assert.equal(updated.json<Task>().completed, true);

  assert.equal((await app.inject({ method: "GET", url: `/projects/${project.id}/tasks` })).json<Task[]>().length, 1);
  assert.equal((await app.inject({ method: "DELETE", url: `/projects/${project.id}` })).statusCode, 204);
  assert.equal((await app.inject({ method: "GET", url: "/tasks" })).json<Task[]>().length, 0);
});

test("validation and not-found errors are consistent", async () => {
  const app = await testApp();
  const invalid = await app.inject({ method: "POST", url: "/projects", payload: { name: "   ", unknown: true } });
  assert.equal(invalid.statusCode, 400);
  assert.equal(invalid.json().error, "VALIDATION_ERROR");
  const missing = await app.inject({ method: "PATCH", url: "/tasks/missing", payload: { completed: true } });
  assert.equal(missing.statusCode, 404);
  assert.equal(missing.json().error, "NOT_FOUND");
});
