import type { AgentExecution, AtlasAgent, PluginManifest } from "@atlas/types";

export class PermissionManager {
  constructor(private readonly grants: Record<string, string[]> = {}) {}
  grant(subject: string, permissions: string[]): void { this.grants[subject] = [...new Set(permissions)]; }
  can(subject: string, permission: string): boolean { return (this.grants[subject] ?? []).includes(permission); }
  require(subject: string, permission: string): void { if (!this.can(subject, permission)) throw new Error(`Permission denied: ${subject} cannot ${permission}`); }
  list(subject: string): string[] { return [...(this.grants[subject] ?? [])]; }
}

export class AgentRuntime {
  private readonly agents = new Map<string, AtlasAgent>();
  private readonly executions: AgentExecution[] = [];
  private readonly controllers = new Map<string, AbortController>();

  register(agent: AtlasAgent): void { this.agents.set(agent.id, { ...agent, status: "idle", currentMissionId: null, startedAt: null }); }
  start(id: string): void { const agent = this.mustAgent(id); agent.status = "idle"; }
  stop(id: string): void { const agent = this.mustAgent(id); agent.status = "stopped"; agent.currentMissionId = null; }
  cancel(executionId: string): boolean { const controller = this.controllers.get(executionId); if (!controller) return false; controller.abort(); return true; }
  listAgents(): AtlasAgent[] { return [...this.agents.values()].map((agent) => ({ ...agent })); }
  listExecutions(): AgentExecution[] { return this.executions.map((execution) => ({ ...execution })); }

  async run<T>(agentId: string, missionId: string, task: (signal: AbortSignal) => Promise<{ result: T; memoryUsed: number; provider: string }>, timeoutMs = 30_000, ownerId?: string): Promise<T> {
    const agent = this.mustAgent(agentId); if (agent.status === "stopped") throw new Error("Agent is stopped");
    const controller = new AbortController(); const id = crypto.randomUUID(); const started = Date.now();
    const execution: AgentExecution = { id, agentId, missionId, ownerId, state: "running", startedAt: new Date(started).toISOString(), finishedAt: null, elapsedMs: 0, memoryUsed: 0, provider: null, error: null };
    this.executions.unshift(execution); this.controllers.set(id, controller); Object.assign(agent, { status: "running", currentMissionId: missionId, startedAt: execution.startedAt });
    const timer = setTimeout(() => controller.abort(new Error("Agent execution timed out")), timeoutMs);
    try {
      const value = await task(controller.signal); if (controller.signal.aborted) throw controller.signal.reason ?? new Error("Agent execution cancelled");
      Object.assign(execution, { state: "idle", memoryUsed: value.memoryUsed, provider: value.provider }); Object.assign(agent, { status: "idle", memoryUsed: value.memoryUsed, provider: value.provider }); return value.result;
    } catch (error) {
      execution.state = controller.signal.aborted ? "cancelled" : "failed"; execution.error = error instanceof Error ? error.message : "Unknown agent error"; agent.status = execution.state; throw error;
    } finally {
      clearTimeout(timer); this.controllers.delete(id); execution.finishedAt = new Date().toISOString(); execution.elapsedMs = Date.now() - started; agent.elapsedMs = execution.elapsedMs; agent.currentMissionId = null;
      agent.status = execution.state === "idle" ? "idle" : execution.state;
    }
  }
  private mustAgent(id: string): AtlasAgent { const agent = this.agents.get(id); if (!agent) throw new Error(`Agent not registered: ${id}`); return agent; }
}

export interface AtlasPlugin { manifest: PluginManifest; load(): Promise<void>; unload(): Promise<void> }
export class PluginRuntime {
  private readonly plugins = new Map<string, AtlasPlugin>();
  constructor(private readonly permissions: PermissionManager) {}
  register(plugin: AtlasPlugin): void { this.plugins.set(plugin.manifest.id, plugin); }
  async load(id: string): Promise<void> { const plugin = this.mustPlugin(id); for (const permission of plugin.manifest.permissions ?? []) this.permissions.require(`plugin:${id}`, permission); await plugin.load(); plugin.manifest.enabled = true; plugin.manifest.status = "loaded"; }
  async unload(id: string): Promise<void> { const plugin = this.mustPlugin(id); await plugin.unload(); plugin.manifest.enabled = false; plugin.manifest.status = "unloaded"; }
  list(): PluginManifest[] { return [...this.plugins.values()].map(({ manifest }) => ({ ...manifest })); }
  get<T extends AtlasPlugin>(id: string): T { return this.mustPlugin(id) as T; }
  private mustPlugin(id: string): AtlasPlugin { const plugin = this.plugins.get(id); if (!plugin) throw new Error(`Plugin not registered: ${id}`); return plugin; }
}

export type GitHubHistoryEntry = { timestamp: string; action: string; repository: string; ownerId?: string };
export class GitHubPlugin implements AtlasPlugin {
  manifest: PluginManifest = { id: "github", name: "GitHub", version: "1.0.0", enabled: false, status: "unloaded", capabilities: ["repositories.read", "pull_requests.read", "issues.read"], permissions: ["network.github.read"] };
  private readonly history: GitHubHistoryEntry[] = [];
  constructor(private readonly token?: string, private readonly apiUrl = "https://api.github.com") {}
  async load(): Promise<void> {}
  async unload(): Promise<void> {}
  listHistory(ownerId?: string): GitHubHistoryEntry[] { return this.history.filter((item) => !ownerId || item.ownerId === ownerId).map((item) => ({ ...item })); }
  repositories(owner: string, ownerId?: string): Promise<unknown> { return this.request(`/users/${encodeURIComponent(owner)}/repos`, "repositories", owner, ownerId); }
  pullRequests(owner: string, repo: string, ownerId?: string): Promise<unknown> { return this.request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls`, "pull_requests", `${owner}/${repo}`, ownerId); }
  issues(owner: string, repo: string, ownerId?: string): Promise<unknown> { return this.request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`, "issues", `${owner}/${repo}`, ownerId); }
  private async request(path: string, action: string, repository: string, ownerId?: string): Promise<unknown> {
    if (!this.manifest.enabled) throw new Error("GitHub plugin is not loaded");
    const response = await fetch(`${this.apiUrl}${path}`, { headers: { accept: "application/vnd.github+json", "user-agent": "atlas-os", ...(this.token ? { authorization: `Bearer ${this.token}` } : {}) } });
    if (!response.ok) throw new Error(`GitHub request failed (${response.status})`);
    this.history.unshift({ timestamp: new Date().toISOString(), action, repository, ownerId }); return response.json();
  }
}
