import cors from "@fastify/cors";
import { GitHubPlugin, PluginRuntime, type AtlasCore } from "@atlas/core";
import type { CreateMissionInput, CreateProjectInput, CreateTaskInput, HealthResponse, UpdateProjectInput, UpdateTaskInput } from "@atlas/types";
import Fastify, { type FastifyError, type FastifyInstance } from "fastify";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { ProjectService } from "./services/ProjectService.js";
import { TaskService } from "./services/TaskService.js";
import { createAtlasCore } from "./atlas.js";
import { createSqliteStore } from "./lib/sqlite.js";
import { AuthService, type StoredUser } from "./services/AuthService.js";

const idParams = { type: "object", additionalProperties: false, required: ["id"], properties: { id: { type: "string", minLength: 1, maxLength: 100 } } } as const;
const nullableDate = { anyOf: [{ type: "string", format: "date" }, { type: "null" }] } as const;
const projectBody = { type: "object", additionalProperties: false, required: ["name"], properties: { name: { type: "string", minLength: 1, maxLength: 120, pattern: "\\S" }, description: { type: "string", maxLength: 2000 } } } as const;
const projectPatch = { type: "object", additionalProperties: false, minProperties: 1, properties: { ...projectBody.properties, status: { type: "string", enum: ["planning", "active", "completed"] } } } as const;
const taskBody = { type: "object", additionalProperties: false, required: ["title"], properties: { title: { type: "string", minLength: 1, maxLength: 240, pattern: "\\S" }, priority: { type: "string", enum: ["low", "medium", "high"] }, dueDate: nullableDate } } as const;
const taskPatch = { type: "object", additionalProperties: false, minProperties: 1, properties: { ...taskBody.properties, completed: { type: "boolean" } } } as const;
const missionBody = { type: "object", additionalProperties: false, required: ["title", "objective"], properties: { title: { type: "string", minLength: 1, maxLength: 160, pattern: "\\S" }, objective: { type: "string", minLength: 10, maxLength: 2000, pattern: "\\S" }, context: { type: "string", maxLength: 5000 } } } as const;

export type AppDependencies = { projects?: ProjectService; tasks?: TaskService; atlas?: AtlasCore; auth?: AuthService; logger?: boolean };

export async function buildApp(dependencies: AppDependencies = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: dependencies.logger ?? true, bodyLimit: 64 * 1024 });
  const projects = dependencies.projects ?? new ProjectService();
  const tasks = dependencies.tasks ?? new TaskService();
  const atlas = dependencies.atlas ?? createAtlasCore();
  const database = process.env.ATLAS_DATABASE_PATH ?? (process.env.ATLAS_DATA_DIR ? resolve(process.env.ATLAS_DATA_DIR, "atlas.db") : fileURLToPath(new URL("../data/atlas.db", import.meta.url)));
  const auth = dependencies.auth ?? new AuthService(createSqliteStore<StoredUser>(database, "users"), authSecret(database));
  const authenticate = (authorization?: string) => { try { const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : ""; return token ? auth.verify(token) : null; } catch { return null; } };
  atlas.permissions.grant("plugin:github", ["network.github.read"]);
  const plugins = new PluginRuntime(atlas.permissions);
  const github = new GitHubPlugin(process.env.GITHUB_TOKEN);
  plugins.register(github);
  await plugins.load("github");
  await atlas.start();
  app.addHook("onClose", async () => { await atlas.stop(); auth.close(); });
  const allowedOrigin = process.env.CORS_ORIGIN ?? "http://localhost:3000";
  await app.register(cors, { origin: allowedOrigin, methods: ["GET", "POST", "PATCH", "DELETE"] });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    const statusCode = error.validation ? 400 : (error.statusCode && error.statusCode < 500 ? error.statusCode : 500);
    if (statusCode >= 500) request.log.error({ err: error }, "request failed");
    void reply.code(statusCode).send({ error: statusCode === 400 ? "VALIDATION_ERROR" : "INTERNAL_ERROR", message: statusCode === 400 ? error.message : "Unexpected server error.", statusCode, requestId: request.id });
  });

  app.get("/health", async (_request, reply): Promise<HealthResponse> => {
    try {
      await projects.list();
      return { status: "ok", service: "atlas-api", version: "0.4.0", timestamp: new Date().toISOString(), uptimeSeconds: Math.floor(process.uptime()), storage: "ok" };
    } catch (error) {
      app.log.error({ err: error }, "health storage check failed");
      return reply.code(503).send({ status: "degraded", service: "atlas-api", version: "0.4.0", timestamp: new Date().toISOString(), uptimeSeconds: Math.floor(process.uptime()), storage: "error" });
    }
  });

  app.post<{ Body: { email: string; password: string; name: string } }>("/auth/register", async (request, reply) => { try { return reply.code(201).send(await auth.register(request.body.email, request.body.password, request.body.name)); } catch (error) { return reply.code(400).send({ error: "AUTH_ERROR", message: error instanceof Error ? error.message : "Registration failed", statusCode: 400 }); } });
  app.post<{ Body: { email: string; password: string } }>("/auth/login", async (request, reply) => { try { return await auth.login(request.body.email, request.body.password); } catch { return reply.code(401).send({ error: "UNAUTHORIZED", message: "Invalid credentials", statusCode: 401 }); } });
  app.get("/auth/me", async (request, reply) => { const user = authenticate(request.headers.authorization); return user ?? reply.code(401).send({ error: "UNAUTHORIZED", message: "Authentication required", statusCode: 401 }); });

  app.get("/atlas/status", async () => atlas.status());
  app.get("/atlas/operation", async (request, reply) => {
    const user = authenticate(request.headers.authorization); if (!user) return reply.code(401).send({ error: "UNAUTHORIZED", message: "Authentication required", statusCode: 401 });
    const [missions, decisions, knowledge, memory, audit] = await Promise.all([atlas.listMissions(user.id), atlas.listDecisions(user.id), atlas.listKnowledge(user.id), atlas.listMemory(user.id), atlas.listAudit()]);
    return { status: atlas.status(), counts: { missions: missions.length, decisions: decisions.length, knowledge: knowledge.length, memory: memory.length, audit: audit.filter((entry) => entry.context.ownerId === user.id).length, agents: atlas.agentRuntime.listAgents().length, executions: atlas.agentRuntime.listExecutions().filter((item) => item.ownerId === user.id).length, plugins: plugins.list().length }, uptimeSeconds: Math.floor(process.uptime()), lastExecutionAt: decisions[0]?.createdAt ?? null };
  });
  app.get("/atlas/logs", async (request) => {
    const query = request.query as { module?: string; severity?: string; from?: string };
    const user = authenticate(request.headers.authorization); if (!user) return [];
    return (await atlas.listAudit()).filter((entry) => entry.context.ownerId === user.id).map((entry) => ({ ...entry, severity: entry.result === "failure" ? "error" : entry.result === "denied" ? "warning" : "info" })).filter((entry) => (!query.module || entry.module === query.module) && (!query.severity || entry.severity === query.severity) && (!query.from || entry.timestamp >= query.from));
  });
  app.get("/atlas/knowledge", async (request, reply) => { const user = authenticate(request.headers.authorization); return user ? atlas.listKnowledge(user.id) : reply.code(401).send({ error: "UNAUTHORIZED", message: "Authentication required", statusCode: 401 }); });
  app.get("/atlas/memory", async (request, reply) => { const user = authenticate(request.headers.authorization); return user ? atlas.listMemory(user.id) : reply.code(401).send({ error: "UNAUTHORIZED", message: "Authentication required", statusCode: 401 }); });
  app.get("/atlas/decisions", async (request, reply) => { const user = authenticate(request.headers.authorization); return user ? atlas.listDecisions(user.id) : reply.code(401).send({ error: "UNAUTHORIZED", message: "Authentication required", statusCode: 401 }); });
  app.get("/atlas/agents", async () => atlas.agentRuntime.listAgents());
  app.get("/atlas/agent-executions", async (request, reply) => { const user = authenticate(request.headers.authorization); return user ? atlas.agentRuntime.listExecutions().filter((item) => item.ownerId === user.id) : reply.code(401).send({ error: "UNAUTHORIZED", message: "Authentication required", statusCode: 401 }); });
  app.post<{ Params: { id: string } }>("/atlas/agent-executions/:id/cancel", { schema: { params: idParams } }, async (request, reply) => atlas.agentRuntime.cancel(request.params.id) ? reply.code(202).send({ cancelled: true }) : reply.code(404).send({ error: "NOT_FOUND", message: "Execution not found.", statusCode: 404 }));
  app.get("/atlas/plugins", async () => plugins.list());
  app.get<{ Params: { owner: string } }>("/atlas/plugins/github/repositories/:owner", async (request) => github.repositories(request.params.owner));
  app.get<{ Params: { owner: string; repo: string } }>("/atlas/plugins/github/:owner/:repo/pulls", async (request) => github.pullRequests(request.params.owner, request.params.repo));
  app.get<{ Params: { owner: string; repo: string } }>("/atlas/plugins/github/:owner/:repo/issues", async (request) => github.issues(request.params.owner, request.params.repo));
  app.get("/atlas/plugins/github/history", async () => github.listHistory());
  app.get("/atlas/events", async (request, reply) => { const user = authenticate(request.headers.authorization); return user ? (await atlas.listAudit()).filter((entry) => entry.context.ownerId === user.id).slice(0, 100) : reply.code(401).send({ error: "UNAUTHORIZED", message: "Authentication required", statusCode: 401 }); });
  app.get("/atlas/performance", async (request, reply) => { const user = authenticate(request.headers.authorization); if (!user) return reply.code(401).send({ error: "UNAUTHORIZED", message: "Authentication required", statusCode: 401 }); const executions = atlas.agentRuntime.listExecutions().filter((item) => item.ownerId === user.id); return { executions: executions.length, averageElapsedMs: executions.length ? Math.round(executions.reduce((sum, item) => sum + item.elapsedMs, 0) / executions.length) : 0, failures: executions.filter((item) => item.state === "failed").length, cancellations: executions.filter((item) => item.state === "cancelled").length }; });
  app.get("/atlas/config", async () => ({ provider: atlas.status().ai.provider, model: atlas.status().ai.model, temperature: Number(process.env.AI_TEMPERATURE ?? "0"), mockEnabled: atlas.status().ai.mode === "mock", variables: ["AI_PROVIDER", "AI_MODEL", "AI_TEMPERATURE", "AI_API_KEY", "AI_BASE_URL"].map((name) => ({ name, configured: Boolean(process.env[name]), secret: name.endsWith("KEY") })) }));
  app.get("/missions", async (request, reply) => { const user = authenticate(request.headers.authorization); return user ? atlas.listMissions(user.id) : reply.code(401).send({ error: "UNAUTHORIZED", message: "Authentication required", statusCode: 401 }); });
  app.get<{ Params: { id: string } }>("/missions/:id", { schema: { params: idParams } }, async (request, reply) => { const user = authenticate(request.headers.authorization); if (!user) return reply.code(401).send({ error: "UNAUTHORIZED", message: "Authentication required", statusCode: 401 }); return (await atlas.getMission(request.params.id, user.id)) ?? reply.code(404).send({ error: "NOT_FOUND", message: "Mission not found.", statusCode: 404 }); });
  app.post<{ Body: CreateMissionInput }>("/missions", { schema: { body: missionBody } }, async (request, reply) => { const user = authenticate(request.headers.authorization); if (!user) return reply.code(401).send({ error: "UNAUTHORIZED", message: "Authentication required", statusCode: 401 }); return reply.code(201).send(await atlas.createMission({ title: request.body.title.trim(), objective: request.body.objective.trim(), context: request.body.context?.trim() ?? "", ownerId: user.id })); });
  app.post<{ Params: { id: string } }>("/missions/:id/execute", { schema: { params: idParams } }, async (request, reply) => { const user = authenticate(request.headers.authorization); if (!user) return reply.code(401).send({ error: "UNAUTHORIZED", message: "Authentication required", statusCode: 401 }); return (await atlas.executeMission(request.params.id, user.id)) ?? reply.code(404).send({ error: "NOT_FOUND", message: "Mission not found.", statusCode: 404 }); });
  app.get<{ Params: { id: string } }>("/decisions/:id", { schema: { params: idParams } }, async (request, reply) => { const user = authenticate(request.headers.authorization); if (!user) return reply.code(401).send({ error: "UNAUTHORIZED", message: "Authentication required", statusCode: 401 }); return (await atlas.getDecision(request.params.id, user.id)) ?? reply.code(404).send({ error: "NOT_FOUND", message: "Decision not found.", statusCode: 404 }); });

  app.get("/projects", () => projects.list());
  app.get<{ Params: { id: string } }>("/projects/:id", { schema: { params: idParams } }, async (request, reply) => (await projects.find(request.params.id)) ?? reply.code(404).send({ error: "NOT_FOUND", message: "Project not found.", statusCode: 404 }));
  app.post<{ Body: CreateProjectInput }>("/projects", { schema: { body: projectBody } }, async (request, reply) => reply.code(201).send(await projects.create(request.body.name.trim(), request.body.description?.trim() ?? "")));
  app.patch<{ Params: { id: string }; Body: UpdateProjectInput }>("/projects/:id", { schema: { params: idParams, body: projectPatch } }, async (request, reply) => {
    const input = { ...request.body };
    if (input.name !== undefined) input.name = input.name.trim();
    if (input.description !== undefined) input.description = input.description.trim();
    return (await projects.update(request.params.id, input)) ?? reply.code(404).send({ error: "NOT_FOUND", message: "Project not found.", statusCode: 404 });
  });
  app.delete<{ Params: { id: string } }>("/projects/:id", { schema: { params: idParams } }, async (request, reply) => {
    if (!await projects.delete(request.params.id)) return reply.code(404).send({ error: "NOT_FOUND", message: "Project not found.", statusCode: 404 });
    await tasks.deleteByProject(request.params.id);
    return reply.code(204).send();
  });

  app.get("/tasks", () => tasks.list());
  app.get<{ Params: { id: string } }>("/projects/:id/tasks", { schema: { params: idParams } }, async (request, reply) => {
    if (!await projects.find(request.params.id)) return reply.code(404).send({ error: "NOT_FOUND", message: "Project not found.", statusCode: 404 });
    return tasks.list(request.params.id);
  });
  app.post<{ Params: { id: string }; Body: CreateTaskInput }>("/projects/:id/tasks", { schema: { params: idParams, body: taskBody } }, async (request, reply) => {
    if (!await projects.find(request.params.id)) return reply.code(404).send({ error: "NOT_FOUND", message: "Project not found.", statusCode: 404 });
    const input = { title: request.body.title.trim(), priority: request.body.priority ?? "medium", dueDate: request.body.dueDate ?? null };
    return reply.code(201).send(await tasks.create(request.params.id, input));
  });
  app.patch<{ Params: { id: string }; Body: UpdateTaskInput }>("/tasks/:id", { schema: { params: idParams, body: taskPatch } }, async (request, reply) => {
    const input = { ...request.body };
    if (input.title !== undefined) input.title = input.title.trim();
    return (await tasks.update(request.params.id, input)) ?? reply.code(404).send({ error: "NOT_FOUND", message: "Task not found.", statusCode: 404 });
  });
  app.delete<{ Params: { id: string } }>("/tasks/:id", { schema: { params: idParams } }, async (request, reply) => (await tasks.delete(request.params.id)) ? reply.code(204).send() : reply.code(404).send({ error: "NOT_FOUND", message: "Task not found.", statusCode: 404 }));
  return app;
}

function authSecret(database: string): string { if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET; const path = `${database}.secret`; if (existsSync(path)) return readFileSync(path, "utf8").trim(); const secret = randomBytes(32).toString("hex"); writeFileSync(path, secret, { encoding: "utf8", mode: 0o600 }); return secret; }
