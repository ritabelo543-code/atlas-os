import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkSqliteHealth, createSqliteAppendStore, createSqliteStore } from "../src/lib/sqlite.js";

test("SQLite collection store commits complete replacements transactionally", async () => {
  const directory = mkdtempSync(join(tmpdir(), "atlas-sqlite-"));
  try { const path = join(directory, "atlas.db"); const first = createSqliteStore<{ id: string }>(path, "items"); await first.save([{ id: "one" }, { id: "two" }]); const reopened = createSqliteStore<{ id: string }>(path, "items"); assert.deepEqual(await reopened.load(), [{ id: "one" }, { id: "two" }]); await reopened.save([{ id: "three" }]); assert.deepEqual(await first.load(), [{ id: "three" }]); assert.equal(checkSqliteHealth(path), true); first.close?.(); reopened.close?.(); }
  finally { rmSync(directory, { recursive: true, force: true }); }
});

test("SQLite append store keeps concurrent tracking events without lost updates", async () => {
  const directory = mkdtempSync(join(tmpdir(), "radar-events-"));
  try { const path = join(directory, "atlas.db"); const events = createSqliteAppendStore<{ id: string }>(path, "clicks"); await Promise.all(Array.from({ length: 50 }, (_, index) => events.append(`click-${index}`, { id: `click-${index}` }))); assert.equal((await events.load()).length, 50); events.close(); }
  finally { rmSync(directory, { recursive: true, force: true }); }
});

test("SQLite append store migrates legacy click collections without data loss", async () => {
  const directory = mkdtempSync(join(tmpdir(), "radar-events-migration-"));
  try { const path = join(directory, "atlas.db"); const legacy = createSqliteStore<{ id: string }>(path, "clicks"); await legacy.save([{ id: "old-1" }, { id: "old-2" }]); legacy.close?.(); const events = createSqliteAppendStore<{ id: string }>(path, "clicks"); assert.deepEqual((await events.load()).map((item) => item.id).sort(), ["old-1", "old-2"]); events.close(); }
  finally { rmSync(directory, { recursive: true, force: true }); }
});
