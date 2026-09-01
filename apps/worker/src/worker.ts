const apiUrl = process.env.ATLAS_API_INTERNAL_URL?.replace(/\/$/, "");
const secret = process.env.ATLAS_WORKER_SECRET?.trim();
const tickIntervalMs = positiveInteger(process.env.ATLAS_WORKER_TICK_MS, 5_000, 1_000);
const scheduleIntervalMs = positiveInteger(process.env.ATLAS_SCHEDULER_INTERVAL_MS, 15 * 60_000, 60_000);

if (!apiUrl || !secret) {
  console.error("ATLAS_API_INTERNAL_URL and ATLAS_WORKER_SECRET are required");
  process.exit(1);
}

let stopping = false;
let nextScheduleAt = 0;

async function request(path: string): Promise<Response> {
  return fetch(`${apiUrl}${path}`, { method: "POST", headers: { "x-atlas-worker-secret": secret! }, signal: AbortSignal.timeout(30_000) });
}

async function cycle(): Promise<void> {
  const now = Date.now();
  if (now >= nextScheduleAt) {
    const scheduled = await request("/internal/autonomy/schedule");
    if (!scheduled.ok && scheduled.status !== 409) throw new Error(`Scheduler failed with HTTP ${scheduled.status}`);
    nextScheduleAt = now + scheduleIntervalMs;
  }
  const tick = await request("/internal/autonomy/tick");
  if (!tick.ok && tick.status !== 204 && tick.status !== 409) throw new Error(`Worker tick failed with HTTP ${tick.status}`);
}

async function main(): Promise<void> {
  console.log(JSON.stringify({ event: "worker.started", tickIntervalMs, scheduleIntervalMs }));
  while (!stopping) {
    try { await cycle(); }
    catch (error) { console.error(JSON.stringify({ event: "worker.cycle.failed", message: error instanceof Error ? error.message : "unknown" })); }
    await new Promise((resolve) => setTimeout(resolve, tickIntervalMs));
  }
  console.log(JSON.stringify({ event: "worker.stopped" }));
}

process.once("SIGINT", () => { stopping = true; });
process.once("SIGTERM", () => { stopping = true; });
await main();

function positiveInteger(value: string | undefined, fallback: number, minimum: number): number {
  const parsed = Number(value); return Number.isInteger(parsed) && parsed >= minimum ? parsed : fallback;
}
