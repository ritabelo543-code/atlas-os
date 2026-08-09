import type { AffiliateOffer, CreateMarketResearchInput, MarketEvidence, MarketOpportunity, MarketResearch, MarketSignal, OpportunityScoreComponents } from "@atlas/types";
import type { AiProvider, CollectionStore } from "./index.js";
import type { Guardian } from "./index.js";
import { AgentRuntime, PermissionManager } from "./v03.js";

export type MarketStores = { research: CollectionStore<MarketResearch>; evidence: CollectionStore<MarketEvidence & { ownerId: string; researchId: string }>; signals: CollectionStore<MarketSignal>; offers: CollectionStore<AffiliateOffer>; opportunities: CollectionStore<MarketOpportunity> };
const weights: Record<keyof OpportunityScoreComponents, number> = { demand: .16, commercialIntent: .15, competition: .1, monetization: .13, margin: .1, effort: .08, risk: .08, evidenceQuality: .08, confidence: .06, scalability: .06 };
const beneficial = new Set<keyof OpportunityScoreComponents>(["demand", "commercialIntent", "monetization", "margin", "evidenceQuality", "confidence", "scalability"]);
export function scoreOpportunity(input: Partial<OpportunityScoreComponents>) { const components = Object.fromEntries(Object.keys(weights).map((key) => [key, Math.max(0, Math.min(100, input[key as keyof OpportunityScoreComponents] ?? 0))])) as OpportunityScoreComponents; const score = Math.round(Object.entries(weights).reduce((sum, [key, weight]) => { const value = components[key as keyof OpportunityScoreComponents]; return sum + (beneficial.has(key as keyof OpportunityScoreComponents) ? value : 100 - value) * weight; }, 0) * 100) / 100; return { score, components, rationale: `Demanda ${components.demand}, intenção ${components.commercialIntent}, monetização ${components.monetization}; penalidades de concorrência ${components.competition}, esforço ${components.effort} e risco ${components.risk}. Evidências ${components.evidenceQuality} e confiança ${components.confidence}.` }; }

export class MarketIntelligence {
  readonly logicVersion = "market-score-v1";
  constructor(private readonly stores: MarketStores, private readonly guardian: Guardian, private readonly runtime: AgentRuntime, private readonly permissions: PermissionManager, private readonly aiProvider?: AiProvider) {
    for (const [id, name, role] of [["trend-hunter", "Trend Hunter Agent", "Classifica sinais de mercado"], ["market-research", "Market Research Agent", "Estrutura e pontua oportunidades"]] as const) { permissions.grant(`agent:${id}`, ["market.research"]); if (!runtime.listAgents().some((agent) => agent.id === id)) runtime.register({ id, name, role, status: "registered", permissions: ["market.research"] }); runtime.start(id); }
  }
  async run(ownerId: string, input: CreateMarketResearchInput): Promise<{ research: MarketResearch; opportunities: MarketOpportunity[] }> {
    if (!input.evidence.length) throw new Error("At least one traceable evidence item is required");
    const started = Date.now(), researchId = crypto.randomUUID(); this.permissions.require("agent:trend-hunter", "market.research");
    const evidence = input.evidence.map((item) => ({ ...item, id: crypto.randomUUID(), ownerId, researchId })); await this.append(this.stores.evidence, evidence);
    let aiRankingRationale: string | undefined; let aiUsed = false;
    const signals = await this.runtime.run("trend-hunter", researchId, async () => {
      if (this.aiProvider?.mode === "live" && this.aiProvider.analyzeMarket) {
        const ai = await this.aiProvider.analyzeMarket({ market: input.market, niche: input.niche, audience: input.audience, painOrDesire: input.painOrDesire, evidence });
        aiRankingRationale = ai.rankingRationale; aiUsed = true;
        const result = evidence.map((item, index): MarketSignal => ({ id: crypto.randomUUID(), ownerId, researchId, kind: ai.signals[index]!.kind, label: item.excerpt, direction: ai.signals[index]!.direction, evidenceIds: [item.id], observedAt: item.observedAt }));
        return { result, memoryUsed: 0, provider: this.aiProvider.name };
      }
      const result = evidence.map((item): MarketSignal => ({ id: crypto.randomUUID(), ownerId, researchId, kind: /ruído|ruido|isolado/i.test(item.excerpt) ? "noise" : /sazon/i.test(item.excerpt) ? "seasonality" : /cres|alta|aument|rising/i.test(item.excerpt) ? "trend" : "demand", label: item.excerpt, direction: /queda|falling/i.test(item.excerpt) ? "falling" : /cres|alta|aument|rising/i.test(item.excerpt) ? "rising" : /estável|estavel/i.test(item.excerpt) ? "stable" : "unknown", evidenceIds: [item.id], observedAt: item.observedAt }));
      return { result, memoryUsed: 0, provider: "local-rules" };
    }); await this.append(this.stores.signals, signals);
    const offers = input.offers.map((item): AffiliateOffer => ({ ...item, id: crypto.randomUUID(), ownerId, researchId, createdAt: new Date().toISOString() })); await this.append(this.stores.offers, offers);
    this.permissions.require("agent:market-research", "market.research"); const scored = scoreOpportunity(input.metrics);
    const opportunities = await this.runtime.run("market-research", researchId, async () => ({ result: (offers.length ? offers : [undefined]).map((offer): MarketOpportunity => ({ id: crypto.randomUUID(), ownerId, researchId, market: input.market, niche: input.niche, audience: input.audience, painOrDesire: input.painOrDesire, offerId: offer?.id, evidenceIds: evidence.map((item) => item.id), channels: input.channels, demandEstimate: input.metrics.demand, competitionIntensity: input.metrics.competition, monetizationPotential: input.metrics.monetization, effortEstimate: input.metrics.effort, risk: input.metrics.risk, confidence: (input.metrics.confidence ?? 0) / 100, score: scored.score, scoreComponents: scored.components, rankingRationale: aiRankingRationale ?? scored.rationale, status: scored.score >= 60 ? "qualified" : "candidate", discoveredAt: new Date().toISOString(), updatedAt: new Date().toISOString(), dataKind: input.dataKind })), memoryUsed: 0, provider: aiUsed ? this.aiProvider!.name : "local-rules" })); await this.append(this.stores.opportunities, opportunities);
    const now = new Date().toISOString(); const research: MarketResearch = { id: researchId, ownerId, query: input.query, market: input.market, niche: input.niche, audience: input.audience, startedBy: "user", status: "completed", input: { painOrDesire: input.painOrDesire, channels: input.channels }, sourceIds: evidence.map((item) => item.id), signalIds: signals.map((item) => item.id), offerIds: offers.map((item) => item.id), opportunityIds: opportunities.map((item) => item.id), logicVersion: this.logicVersion, startedAt: new Date(started).toISOString(), completedAt: now, durationMs: Date.now() - started, dataKind: input.dataKind, ...(aiUsed ? { aiProvider: this.aiProvider!.name, aiModel: this.aiProvider!.model } : {}) }; await this.append(this.stores.research, [research]); await this.record(ownerId, research, "success"); return { research, opportunities };
  }
  async listOpportunities(ownerId: string) { return (await this.stores.opportunities.load()).filter((item) => item.ownerId === ownerId).sort((a, b) => b.score - a.score); }
  async listResearch(ownerId: string) { return (await this.stores.research.load()).filter((item) => item.ownerId === ownerId); }
  async listEvidence(ownerId: string) { return (await this.stores.evidence.load()).filter((item) => item.ownerId === ownerId); }
  async listSignals(ownerId: string) { return (await this.stores.signals.load()).filter((item) => item.ownerId === ownerId); }
  async listOffers(ownerId: string) { return (await this.stores.offers.load()).filter((item) => item.ownerId === ownerId); }
  async getOpportunity(id: string, ownerId: string) { return (await this.stores.opportunities.load()).find((item) => item.id === id && item.ownerId === ownerId); }
  close() { for (const store of Object.values(this.stores)) store.close?.(); }
  private async append<T>(store: CollectionStore<T>, values: T[]) { const existing = await store.load(); await store.save([...values, ...existing]); }
  private async record(ownerId: string, research: MarketResearch, result: "success" | "failure") { await this.guardian.record("market-intelligence", "research.execute", { ownerId, researchId: research.id, market: research.market, niche: research.niche, sourceIds: research.sourceIds.join(","), opportunities: research.opportunityIds.length, durationMs: research.durationMs, logicVersion: research.logicVersion, dataKind: research.dataKind }, result); }
}
