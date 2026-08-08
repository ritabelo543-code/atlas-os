import assert from "node:assert/strict";
import test from "node:test";
import { AgentRuntime, GitHubPlugin, PermissionManager, PluginRuntime } from "./v03.js";

test("agent runtime tracks execution metrics", async () => {
  const runtime = new AgentRuntime(); runtime.register({ id: "executive", name: "Executive", role: "test", status: "registered" }); runtime.start("executive");
  const result = await runtime.run("executive", "mission-1", async () => ({ result: "ok", memoryUsed: 2, provider: "mock" }), 1000);
  assert.equal(result, "ok"); const execution = runtime.listExecutions()[0]; assert.equal(execution?.memoryUsed, 2); assert.equal(execution?.provider, "mock"); assert.equal(execution?.state, "idle");
});

test("permission manager denies critical actions by default", () => {
  const permissions = new PermissionManager(); assert.throws(() => permissions.require("plugin:github", "network.github.read"), /Permission denied/); permissions.grant("plugin:github", ["network.github.read"]); assert.equal(permissions.can("plugin:github", "network.github.read"), true);
});

test("GitHub plugin loads with permission and records repository history", async () => {
  const originalFetch = globalThis.fetch; globalThis.fetch = async () => new Response(JSON.stringify([{ name: "atlas-os" }]), { status: 200, headers: { "content-type": "application/json" } });
  try { const permissions = new PermissionManager({ "plugin:github": ["network.github.read"] }); const runtime = new PluginRuntime(permissions); const plugin = new GitHubPlugin(); runtime.register(plugin); await runtime.load("github"); const repositories = await plugin.repositories("atlas"); assert.deepEqual(repositories, [{ name: "atlas-os" }]); assert.equal(plugin.listHistory().length, 1); assert.equal(runtime.list()[0]?.status, "loaded"); } finally { globalThis.fetch = originalFetch; }
});
