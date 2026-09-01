import type { AutonomyJob, AutonomyJobKind, AutonomyPolicy, AutonomyStatus } from "@atlas/types";
import type { CollectionStore } from "./index.js";

export type EnqueueAutonomyJob = {
  ownerId: string; kind: AutonomyJobKind; idempotencyKey: string;
  payload?: Record<string, unknown>; priority?: number; maxAttempts?: number; runAt?: string;
};

export type AutonomyHandler = (job: AutonomyJob) => Promise<void>;

export const DEFAULT_AUTONOMY_POLICY: Omit<AutonomyPolicy, "ownerId" | "updatedAt"> = {
  enabled: false,
  timezone: "America/Sao_Paulo",
  quietHoursStart: "22:00",
  quietHoursEnd: "07:00",
  maxPostsPerChannelPerDay: 4,
  duplicateCooldownHours: 168,
  requireLicensedMedia: true,
  requirePriceAndAvailabilityCheck: true,
  pauseOnFailureRatePercent: 25,
};

export class AutonomyEngine {
  private heartbeatAt: string | null = null;
  constructor(
    private readonly jobs: CollectionStore<AutonomyJob>,
    readonly workerId: string,
    private readonly leaseMs = 120_000,
  ) {}

  async enqueue(input: EnqueueAutonomyJob): Promise<AutonomyJob> {
    const items = await this.jobs.load();
    const existing = items.find((item) => item.ownerId === input.ownerId && item.idempotencyKey === input.idempotencyKey && item.status !== "cancelled" && item.status !== "dead_letter");
    if (existing) return existing;
    const now = new Date().toISOString();
    const job: AutonomyJob = {
      id: crypto.randomUUID(), ownerId: input.ownerId, kind: input.kind,
      status: "pending", idempotencyKey: input.idempotencyKey,
      payload: input.payload ?? {}, priority: input.priority ?? 0,
      attempts: 0, maxAttempts: Math.max(1, input.maxAttempts ?? 5),
      runAt: input.runAt ?? now, createdAt: now, updatedAt: now,
    };
    await this.jobs.save([job, ...items]);
    return job;
  }

  async runOnce(handlers: Partial<Record<AutonomyJobKind, AutonomyHandler>>, now = new Date()): Promise<AutonomyJob | undefined> {
    this.heartbeatAt = now.toISOString();
    const claimed = await this.claim(now);
    if (!claimed) return undefined;
    const handler = handlers[claimed.kind];
    if (!handler) return this.fail(claimed.id, `No handler registered for ${claimed.kind}`, now);
    try {
      await handler(claimed);
      return await this.complete(claimed.id, now);
    } catch (error) {
      return this.fail(claimed.id, error instanceof Error ? error.message : "Unknown worker failure", now);
    }
  }

  async recoverExpiredLeases(now = new Date()): Promise<number> {
    const items = await this.jobs.load();
    let recovered = 0;
    for (const item of items) {
      if (item.status === "running" && item.leaseExpiresAt && new Date(item.leaseExpiresAt) <= now) {
        item.status = "retry"; item.runAt = now.toISOString(); item.updatedAt = now.toISOString();
        delete item.leaseOwner; delete item.leaseExpiresAt; recovered++;
      }
    }
    if (recovered) await this.jobs.save(items);
    return recovered;
  }

  async status(enabled: boolean): Promise<AutonomyStatus> {
    const items = await this.jobs.load();
    return { enabled, workerId: this.workerId, heartbeatAt: this.heartbeatAt,
      pending: items.filter((item) => item.status === "pending").length,
      running: items.filter((item) => item.status === "running").length,
      retrying: items.filter((item) => item.status === "retry").length,
      deadLetter: items.filter((item) => item.status === "dead_letter").length };
  }

  async list(ownerId: string): Promise<AutonomyJob[]> {
    return (await this.jobs.load()).filter((item) => item.ownerId === ownerId);
  }

  private async claim(now: Date): Promise<AutonomyJob | undefined> {
    await this.recoverExpiredLeases(now);
    const items = await this.jobs.load();
    const eligible = items.filter((item) => (item.status === "pending" || item.status === "retry") && new Date(item.runAt) <= now)
      .sort((a, b) => b.priority - a.priority || new Date(a.runAt).getTime() - new Date(b.runAt).getTime());
    const job = eligible[0];
    if (!job) return undefined;
    job.status = "running"; job.attempts += 1; job.leaseOwner = this.workerId;
    job.leaseExpiresAt = new Date(now.getTime() + this.leaseMs).toISOString(); job.updatedAt = now.toISOString();
    await this.jobs.save(items);
    return { ...job };
  }

  private async complete(id: string, now: Date): Promise<AutonomyJob | undefined> {
    const items = await this.jobs.load(); const job = items.find((item) => item.id === id && item.leaseOwner === this.workerId);
    if (!job) return undefined;
    job.status = "completed"; job.completedAt = now.toISOString(); job.updatedAt = now.toISOString();
    delete job.leaseOwner; delete job.leaseExpiresAt; delete job.lastError;
    await this.jobs.save(items); return job;
  }

  private async fail(id: string, message: string, now: Date): Promise<AutonomyJob | undefined> {
    const items = await this.jobs.load(); const job = items.find((item) => item.id === id && item.leaseOwner === this.workerId);
    if (!job) return undefined;
    job.lastError = message.slice(0, 1000); job.updatedAt = now.toISOString();
    job.status = job.attempts >= job.maxAttempts ? "dead_letter" : "retry";
    if (job.status === "retry") job.runAt = new Date(now.getTime() + retryDelay(job.attempts)).toISOString();
    delete job.leaseOwner; delete job.leaseExpiresAt;
    await this.jobs.save(items); return job;
  }
}

export class AutonomyPolicyCenter {
  constructor(private readonly policies: CollectionStore<AutonomyPolicy>) {}
  async get(ownerId: string): Promise<AutonomyPolicy> {
    const existing = (await this.policies.load()).find((item) => item.ownerId === ownerId);
    return existing ?? { ownerId, ...DEFAULT_AUTONOMY_POLICY, updatedAt: new Date().toISOString() };
  }
  async update(ownerId: string, patch: Partial<Omit<AutonomyPolicy, "ownerId" | "updatedAt">>): Promise<AutonomyPolicy> {
    const items = await this.policies.load(); const previous = await this.get(ownerId);
    const policy: AutonomyPolicy = { ...previous, ...patch, ownerId, updatedAt: new Date().toISOString() };
    validatePolicy(policy);
    const index = items.findIndex((item) => item.ownerId === ownerId);
    if (index >= 0) items[index] = policy; else items.unshift(policy);
    await this.policies.save(items); return policy;
  }
  close() { this.policies.close?.(); }
}

function retryDelay(attempt: number): number {
  return Math.min(60 * 60_000, 30_000 * 2 ** Math.max(0, attempt - 1));
}

function validatePolicy(policy: AutonomyPolicy): void {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(policy.quietHoursStart) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(policy.quietHoursEnd)) throw new Error("Quiet hours must use HH:MM");
  if (!Number.isInteger(policy.maxPostsPerChannelPerDay) || policy.maxPostsPerChannelPerDay < 1 || policy.maxPostsPerChannelPerDay > 50) throw new Error("Daily channel limit must be between 1 and 50");
  if (policy.duplicateCooldownHours < 1 || policy.duplicateCooldownHours > 8760) throw new Error("Duplicate cooldown must be between 1 and 8760 hours");
  if (policy.pauseOnFailureRatePercent < 1 || policy.pauseOnFailureRatePercent > 100) throw new Error("Failure rate must be between 1 and 100");
  try { new Intl.DateTimeFormat("pt-BR", { timeZone: policy.timezone }).format(); } catch { throw new Error("Timezone is invalid"); }
}
