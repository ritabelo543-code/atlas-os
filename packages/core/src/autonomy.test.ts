import assert from "node:assert/strict";
import test from "node:test";
import { AutonomyEngine, type CollectionStore } from "./index.js";
import type { AutonomyJob } from "@atlas/types";

function store(): CollectionStore<AutonomyJob> {
  let items: AutonomyJob[] = [];
  return { async load() { return structuredClone(items); }, async save(next) { items = structuredClone(next); } };
}

test("autonomy queue is idempotent and completes a job only once", async () => {
  const engine = new AutonomyEngine(store(), "worker-a");
  const first = await engine.enqueue({ ownerId: "tenant-a", kind: "discover_offers", idempotencyKey: "discover:2026-08-31", runAt: "2026-08-31T12:00:00Z" });
  const duplicate = await engine.enqueue({ ownerId: "tenant-a", kind: "discover_offers", idempotencyKey: "discover:2026-08-31", runAt: "2026-08-31T12:00:00Z" });
  assert.equal(first.id, duplicate.id);
  let calls = 0;
  const result = await engine.runOnce({ discover_offers: async () => { calls++; } }, new Date("2026-08-31T12:00:00Z"));
  assert.equal(result?.status, "completed"); assert.equal(calls, 1);
  assert.equal(await engine.runOnce({ discover_offers: async () => { calls++; } }, new Date("2026-08-31T12:01:00Z")), undefined);
});

test("autonomy queue retries failures and moves exhausted work to dead letter", async () => {
  const engine = new AutonomyEngine(store(), "worker-a");
  await engine.enqueue({ ownerId: "tenant-a", kind: "validate_offer", idempotencyKey: "offer:1", maxAttempts: 2, runAt: "2026-08-31T12:00:00Z" });
  const first = await engine.runOnce({ validate_offer: async () => { throw new Error("provider unavailable"); } }, new Date("2026-08-31T12:00:00Z"));
  assert.equal(first?.status, "retry"); assert.match(first?.lastError ?? "", /provider unavailable/);
  const second = await engine.runOnce({ validate_offer: async () => { throw new Error("provider unavailable"); } }, new Date("2026-08-31T12:01:00Z"));
  assert.equal(second?.status, "dead_letter"); assert.equal(second?.attempts, 2);
});

test("autonomy queue recovers work abandoned by a stopped worker", async () => {
  const shared = store(); const firstWorker = new AutonomyEngine(shared, "worker-a", 1_000);
  await firstWorker.enqueue({ ownerId: "tenant-a", kind: "publish_content", idempotencyKey: "post:1" });
  await firstWorker.runOnce({}, new Date("2026-08-31T12:00:00Z"));
  const secondWorker = new AutonomyEngine(shared, "worker-b", 1_000);
  assert.equal(await secondWorker.recoverExpiredLeases(new Date("2026-08-31T12:02:00Z")), 0);
});
