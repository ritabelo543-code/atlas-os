import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSqliteStore } from "../src/lib/sqlite.js";

test("SQLite collection store commits complete replacements transactionally", async () => {
  const directory = mkdtempSync(join(tmpdir(), "atlas-sqlite-"));
  try { const path = join(directory, "atlas.db"); const first = createSqliteStore<{ id: string }>(path, "items"); await first.save([{ id: "one" }, { id: "two" }]); const reopened = createSqliteStore<{ id: string }>(path, "items"); assert.deepEqual(await reopened.load(), [{ id: "one" }, { id: "two" }]); await reopened.save([{ id: "three" }]); assert.deepEqual(await first.load(), [{ id: "three" }]); first.close?.(); reopened.close?.(); }
  finally { rmSync(directory, { recursive: true, force: true }); }
});
