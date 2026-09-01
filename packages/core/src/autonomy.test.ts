import assert from "node:assert/strict";
import test from "node:test";
import { AutonomyEngine, AutonomyPolicyCenter, type CollectionStore } from "./index.js";
import type { AutonomyJob, AutonomyPolicy } from "@atlas/types";

function store<T>(): CollectionStore<T> {
  let items: T[] = [];
  return { async load() { return structuredClone(items); }, async save(next) { items = structuredClone(next); } };
}

test("autonomy queue is idempotent and completes a job only once", async () => {
  const engine = new AutonomyEngine(store<AutonomyJob>(), "worker-a");
  const first = await engine.enqueue({ ownerId: "tenant-a", kind: "discover_offers", idempotencyKey: "discover:2026-08-31", runAt: "2026-08-31T12:00:00Z" });
  const duplicate = await engine.enqueue({ ownerId: "tenant-a", kind: "discover_offers", idempotencyKey: "discover:2026-08-31", runAt: "2026-08-31T12:00:00Z" });
  assert.equal(first.id, duplicate.id);
  let calls = 0;
  const result = await engine.runOnce({ discover_offers: async () => { calls++; } }, new Date("2026-08-31T12:00:00Z"));
  assert.equal(result?.status, "completed"); assert.equal(calls, 1);
  assert.equal(await engine.runOnce({ discover_offers: async () => { calls++; } }, new Date("2026-08-31T12:01:00Z")), undefined);
});

test("autonomy queue retries failures and moves exhausted work to dead letter", async () => {
  const engine = new AutonomyEngine(store<AutonomyJob>(), "worker-a");
  await engine.enqueue({ ownerId: "tenant-a", kind: "validate_offer", idempotencyKey: "offer:1", maxAttempts: 2, runAt: "2026-08-31T12:00:00Z" });
  const first = await engine.runOnce({ validate_offer: async () => { throw new Error("provider unavailable"); } }, new Date("2026-08-31T12:00:00Z"));
  assert.equal(first?.status, "retry"); assert.match(first?.lastError ?? "", /provider unavailable/);
  const second = await engine.runOnce({ validate_offer: async () => { throw new Error("provider unavailable"); } }, new Date("2026-08-31T12:01:00Z"));
  assert.equal(second?.status, "dead_letter"); assert.equal(second?.attempts, 2);
});

test("autonomy queue recovers work abandoned by a stopped worker", async () => {
  const shared = store<AutonomyJob>(); const firstWorker = new AutonomyEngine(shared, "worker-a", 1_000);
  await firstWorker.enqueue({ ownerId: "tenant-a", kind: "publish_content", idempotencyKey: "post:1" });
  await firstWorker.runOnce({}, new Date("2026-08-31T12:00:00Z"));
  const secondWorker = new AutonomyEngine(shared, "worker-b", 1_000);
  assert.equal(await secondWorker.recoverExpiredLeases(new Date("2026-08-31T12:02:00Z")), 0);
});

test("autonomy policy is safe by default and validates operational limits", async () => {
  const policies = new AutonomyPolicyCenter(store<AutonomyPolicy>());
  const defaults = await policies.get("tenant-a");
  assert.equal(defaults.enabled, false); assert.equal(defaults.requireLicensedMedia, true);
  const enabled = await policies.update("tenant-a", { enabled: true, maxPostsPerChannelPerDay: 3 });
  assert.equal(enabled.enabled, true); assert.equal(enabled.maxPostsPerChannelPerDay, 3);
  await assert.rejects(() => policies.update("tenant-a", { maxPostsPerChannelPerDay: 0 }), /between 1 and 50/);
});
