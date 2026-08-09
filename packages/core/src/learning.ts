import type { CreatePerformanceInput, DistributionCampaign, LearningInsight, PerformanceRecord } from "@atlas/types";
import type { AiProvider, CollectionStore, Guardian } from "./index.js";
import { AgentRuntime, PermissionManager } from "./v03.js";

export class LearningEngine {
  constructor(private readonly records: CollectionStore<PerformanceRecord>, private readonly insights: CollectionStore<LearningInsight>, private readonly campaigns: CollectionStore<DistributionCampaign>, private readonly guardian: Guardian, private readonly runtime: AgentRuntime, private readonly permissions: PermissionManager, private readonly aiProvider?: AiProvider) {
    for (const [id, name, role] of [["analytics", "Analytics Agent", "Calcula desempenho comercial rastreável"], ["optimization", "Optimization Agent", "Compara experimentos e recomenda melhorias"]] as const) { permissions.grant(`agent:${id}`, ["analytics.record", "analytics.learn"]); if (!runtime.listAgents().some((agent) => agent.id === id)) runtime.register({ id, name, role, status: "registered", permissions: permissions.list(`agent:${id}`) }); runtime.start(id); }
  }
  async record(ownerId: string, input: CreatePerformanceInput): Promise<PerformanceRecord> {
    this.permissions.require("agent:analytics", "analytics.record"); const campaign = await this.findCampaign(input.campaignId, ownerId); if (!campaign) throw new Error("Distribution campaign not found"); if (campaign.status !== "completed") throw new Error("Only completed campaigns can receive metrics"); if (input.dataKind === "confirmed" && (campaign.mode !== "live" || !campaign.result?.delivered)) throw new Error("Dry-run campaigns cannot produce confirmed performance"); validate(input.metrics);
    const { impressions, clicks, conversions, cost, revenue } = input.metrics; const record: PerformanceRecord = { id: crypto.randomUUID(), ownerId, campaignId: campaign.id, assetId: campaign.assetId, opportunityId: campaign.opportunityId, metrics: input.metrics, ctr: impressions ? round(clicks / impressions * 100) : 0, conversionRate: clicks ? round(conversions / clicks * 100) : 0, cac: conversions ? round(cost / conversions) : null, roi: cost ? round((revenue - cost) / cost * 100) : null, profit: round(revenue - cost), dataKind: input.dataKind, source: input.source.trim(), observedAt: new Date(input.observedAt).toISOString(), createdAt: new Date().toISOString() }; await this.records.save([record, ...await this.records.load()]); await this.guardian.record("learning-engine", "performance.record", { ownerId, recordId: record.id, campaignId: campaign.id, dataKind: record.dataKind, impressions, clicks, conversions, cost, revenue }, "success"); return record;
  }
  async learn(ownerId: string, opportunityId: string): Promise<LearningInsight> {
    this.permissions.require("agent:optimization", "analytics.learn"); const records = (await this.listRecords(ownerId)).filter((item) => item.opportunityId === opportunityId); if (!records.length) throw new Error("No performance records for this opportunity");
    const insight = await this.runtime.run("optimization", opportunityId, async () => {
      const ranked = [...records].sort((a, b) => score(b) - score(a)); const winner = ranked[0]!;
      const confidence = Math.min(.95, .35 + records.length * .1 + (records.every((item) => item.dataKind === "confirmed") ? .2 : 0));
      const recommendation = winner.profit > 0 && (winner.roi ?? 0) > 0 ? "Repetir o criativo vencedor em teste controlado, mantendo orçamento limitado até confirmar consistência." : "Não escalar. Revisar oferta, mensagem e segmentação antes de um novo teste.";
      let summary: string; let provider: string;
      if (this.aiProvider?.mode === "live" && this.aiProvider.summarizeInsight) {
        const ai = await this.aiProvider.summarizeInsight({ winner, recordCount: records.length, recommendation });
        summary = ai.summary; provider = this.aiProvider.name;
      } else {
        summary = `Melhor resultado: CTR ${winner.ctr}%, conversão ${winner.conversionRate}%, ROI ${winner.roi ?? "indisponível"}% e lucro ${winner.profit}.`;
        provider = "local-analytics-rules";
      }
      const result: LearningInsight = { id: crypto.randomUUID(), ownerId, opportunityId, recordIds: records.map((item) => item.id), winnerRecordId: winner.id, summary, recommendation, confidence, dataKind: records.every((item) => item.dataKind === "confirmed") ? "confirmed" : records.some((item) => item.dataKind === "simulated") ? "simulated" : "calculated", ...(provider !== "local-analytics-rules" ? { aiProvider: this.aiProvider!.name, aiModel: this.aiProvider!.model } : {}), createdAt: new Date().toISOString() };
      return { result, memoryUsed: records.length, provider };
    }, 30_000, ownerId);
    await this.insights.save([insight, ...await this.insights.load()]); await this.guardian.record("learning-engine", "optimization.learn", { ownerId, opportunityId, insightId: insight.id, records: records.length, winnerRecordId: insight.winnerRecordId ?? null, confidence: insight.confidence, dataKind: insight.dataKind }, "success"); return insight;
  }
  async listRecords(ownerId: string) { return (await this.records.load()).filter((item) => item.ownerId === ownerId); }
  async listInsights(ownerId: string) { return (await this.insights.load()).filter((item) => item.ownerId === ownerId); }
  close() { this.records.close?.(); this.insights.close?.(); }
  private async findCampaign(id: string, ownerId: string) { return (await this.campaigns.load()).find((item) => item.id === id && item.ownerId === ownerId); }
}
function validate(metrics: CreatePerformanceInput["metrics"]) { for (const [name, value] of Object.entries(metrics)) if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be a non-negative number`); if (metrics.clicks > metrics.impressions) throw new Error("Clicks cannot exceed impressions"); if (metrics.conversions > metrics.clicks) throw new Error("Conversions cannot exceed clicks"); }
function score(record: PerformanceRecord) { return record.profit * 2 + (record.roi ?? 0) + record.conversionRate * 3 + record.ctr; }
function round(value: number) { return Math.round(value * 100) / 100; }
