import type { ContentAsset, ContentFormat, ContentPlan, ContentVariant, CreateContentPlanInput, GenerateContentInput, MarketOpportunity } from "@atlas/types";
import type { AiProvider, CollectionStore, Guardian } from "./index.js";
import { AgentRuntime, PermissionManager } from "./v03.js";

export type ContentStores = { plans: CollectionStore<ContentPlan>; assets: CollectionStore<ContentAsset> };
const AFFILIATE_DISCLOSURE = "Transparência: este conteúdo pode conter uma recomendação de afiliado; condições e resultados variam.";

export class ContentStudio {
  constructor(private readonly stores: ContentStores, private readonly opportunities: CollectionStore<MarketOpportunity>, private readonly guardian: Guardian, private readonly runtime: AgentRuntime, private readonly permissions: PermissionManager, private readonly aiProvider?: AiProvider) {
    for (const [id, name, role] of [
      ["content-strategist", "Content Strategy Agent", "Planeja conteúdo ligado a oportunidades comerciais"],
      ["copywriter", "Copywriting Agent", "Produz textos, títulos e chamadas para ação"],
      ["seo", "SEO Agent", "Aplica palavras-chave e intenção de busca"],
      ["content-reviewer", "Content Review Agent", "Revisa clareza, promessa e rastreabilidade"],
    ] as const) {
      permissions.grant(`agent:${id}`, ["content.plan", "content.generate", "content.review"]);
      if (!runtime.listAgents().some((agent) => agent.id === id)) runtime.register({ id, name, role, status: "registered", permissions: permissions.list(`agent:${id}`) });
      runtime.start(id);
    }
  }

  async createPlan(ownerId: string, input: CreateContentPlanInput): Promise<ContentPlan> {
    this.permissions.require("agent:content-strategist", "content.plan");
    const opportunity = await this.findOpportunity(input.opportunityId, ownerId);
    if (!opportunity) throw new Error("Opportunity not found");
    const now = new Date().toISOString();
    const plan: ContentPlan = { id: crypto.randomUUID(), ownerId, opportunityId: opportunity.id, offerId: opportunity.offerId, audience: opportunity.audience, painOrDesire: opportunity.painOrDesire, objective: input.objective.trim(), funnelStage: input.funnelStage, channels: [...new Set(input.channels)], keywords: [...new Set(input.keywords.map((item) => item.trim()).filter(Boolean))], tone: input.tone.trim(), status: "active", createdAt: now, updatedAt: now };
    await this.append(this.stores.plans, plan);
    await this.guardian.record("content-studio", "content.plan.create", { ownerId, planId: plan.id, opportunityId: opportunity.id, funnelStage: plan.funnelStage, channels: plan.channels.join(",") }, "success");
    return plan;
  }

  async generate(ownerId: string, input: GenerateContentInput): Promise<ContentAsset> {
    this.permissions.require("agent:copywriter", "content.generate");
    const plan = (await this.stores.plans.load()).find((item) => item.id === input.planId && item.ownerId === ownerId);
    if (!plan) throw new Error("Content plan not found");
    if (!plan.channels.includes(input.channel)) throw new Error("Channel is not part of this content plan");
    const opportunity = await this.findOpportunity(plan.opportunityId, ownerId);
    if (!opportunity) throw new Error("Opportunity not found");
    const asset = await this.runtime.run("copywriter", plan.id, async () => {
      const now = new Date().toISOString();
      let result: ContentAsset; let provider: string;
      if (this.aiProvider?.mode === "live" && this.aiProvider.generateContent) {
        const ai = await this.aiProvider.generateContent({ opportunity, plan, channel: input.channel, format: input.format, instructions: input.instructions });
        result = { id: crypto.randomUUID(), ownerId, planId: plan.id, opportunityId: opportunity.id, channel: input.channel, format: input.format, title: ai.title, body: `${ai.body}\n\n${AFFILIATE_DISCLOSURE}`, cta: ai.cta, keywords: plan.keywords, variants: ai.variants, designBrief: ai.designBrief, status: "in_review", generatedBy: ["content-strategist", "copywriter", "seo"], generationMode: "ai", provider: this.aiProvider.name, model: this.aiProvider.model, createdAt: now, updatedAt: now };
        provider = this.aiProvider.name;
      } else {
        const variants = buildVariants(opportunity, plan);
        const primary = variants[0]!;
        result = { id: crypto.randomUUID(), ownerId, planId: plan.id, opportunityId: opportunity.id, channel: input.channel, format: input.format, title: primary.title, body: buildBody(input.format, opportunity, plan, primary, input.instructions), cta: primary.cta, keywords: plan.keywords, variants, designBrief: buildDesignBrief(input.format, opportunity, plan), status: "in_review", generatedBy: ["content-strategist", "copywriter", "seo"], generationMode: "deterministic", createdAt: now, updatedAt: now };
        provider = "local-content-rules";
      }
      return { result, memoryUsed: 0, provider };
    }, 30_000, ownerId);
    await this.append(this.stores.assets, asset);
    await this.guardian.record("content-studio", "content.asset.generate", { ownerId, planId: plan.id, assetId: asset.id, opportunityId: opportunity.id, channel: input.channel, format: input.format, mode: asset.generationMode }, "success");
    return asset;
  }

  async review(ownerId: string, id: string, status: "approved" | "rejected", notes = ""): Promise<ContentAsset | undefined> {
    this.permissions.require("agent:content-reviewer", "content.review");
    const assets = await this.stores.assets.load(); const asset = assets.find((item) => item.id === id && item.ownerId === ownerId); if (!asset) return undefined;
    asset.status = status; asset.reviewNotes = notes.trim(); asset.reviewedAt = new Date().toISOString(); asset.updatedAt = asset.reviewedAt; await this.stores.assets.save(assets);
    await this.guardian.record("content-studio", "content.asset.review", { ownerId, assetId: asset.id, status, notes: asset.reviewNotes }, "success"); return asset;
  }
  async listPlans(ownerId: string) { return (await this.stores.plans.load()).filter((item) => item.ownerId === ownerId); }
  async listAssets(ownerId: string) { return (await this.stores.assets.load()).filter((item) => item.ownerId === ownerId); }
  async getAsset(id: string, ownerId: string) { return (await this.stores.assets.load()).find((item) => item.id === id && item.ownerId === ownerId); }
  close() { this.stores.plans.close?.(); this.stores.assets.close?.(); }
  private async findOpportunity(id: string, ownerId: string) { return (await this.opportunities.load()).find((item) => item.id === id && item.ownerId === ownerId); }
  private async append<T>(store: CollectionStore<T>, item: T) { await store.save([item, ...await store.load()]); }
}

function buildVariants(opportunity: MarketOpportunity, plan: ContentPlan): ContentVariant[] {
  const benefit = opportunity.painOrDesire.replace(/^./, (letter) => letter.toLowerCase());
  return [
    { title: `${opportunity.audience}: como ${benefit}`, hook: `Se ${benefit} é uma prioridade, comece pelo que reduz atrito e aumenta clareza.`, cta: "Conheça a solução e avalie se ela faz sentido para você." },
    { title: `O caminho mais simples para ${benefit}`, hook: `Uma abordagem prática para ${opportunity.niche}, sem promessas irreais.`, cta: "Veja os detalhes da oferta antes de decidir." },
    { title: `Antes de escolher uma solução para ${opportunity.niche}`, hook: `Compare necessidades, benefícios e limitações com calma.`, cta: "Confira a oferta e valide as condições atuais." },
  ];
}
function buildBody(format: ContentFormat, opportunity: MarketOpportunity, plan: ContentPlan, variant: ContentVariant, instructions?: string) {
  const disclosure = AFFILIATE_DISCLOSURE;
  const core = `${variant.hook}\n\nPara ${opportunity.audience}, o ponto central é ${opportunity.painOrDesire}. Esta peça apresenta uma opção relacionada a ${opportunity.niche}, com foco em decisão informada, benefícios verificáveis e limitações.\n\n${variant.cta}`;
  if (format === "video-script") return `ABERTURA: ${variant.hook}\nCONTEXTO: ${opportunity.painOrDesire}.\nDESENVOLVIMENTO: apresente o problema, critérios de escolha e a oferta sem garantir resultados.\nCTA: ${variant.cta}\n${disclosure}`;
  if (format === "landing-page") return `${variant.title}\n\n${core}\n\nO que avaliar: adequação ao seu cenário, preço atual, suporte e termos da oferta.\n\n${disclosure}`;
  return `${core}${instructions?.trim() ? `\n\nDireção adicional: ${instructions.trim()}` : ""}\n\n${disclosure}`;
}
function buildDesignBrief(format: ContentFormat, opportunity: MarketOpportunity, plan: ContentPlan) { return ["creative-brief", "video-script", "social-post"].includes(format) ? `Visual claro para ${opportunity.audience}; enfatizar ${opportunity.painOrDesire}; tom ${plan.tone}; evitar alegações não comprovadas; CTA legível.` : undefined; }
