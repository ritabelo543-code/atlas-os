import type { AutonomyHandler, AutonomyEngine, ContentStudio, MarketIntelligence } from "@atlas/core";
import type { AutonomyJobKind, ContentChannel, ContentFormat } from "@atlas/types";

type HandlerDependencies = {
  autonomy: Pick<AutonomyEngine, "enqueue">;
  market: Pick<MarketIntelligence, "listOffers" | "listOpportunities">;
  content: Pick<ContentStudio, "listPlans" | "listAssets" | "createPlan" | "generate">;
  fetchOffer?: typeof fetch;
  now?: () => Date;
};

const CONTENT_CHANNELS = new Set<ContentChannel>(["instagram", "tiktok", "youtube", "pinterest", "telegram", "whatsapp"]);

export function buildDefaultAutonomyHandlers(dependencies: HandlerDependencies): Partial<Record<AutonomyJobKind, AutonomyHandler>> {
  const fetchOffer = dependencies.fetchOffer ?? fetch;
  const now = dependencies.now ?? (() => new Date());

  return {
    discover_offers: async (job) => {
      const [offers, opportunities] = await Promise.all([
        dependencies.market.listOffers(job.ownerId),
        dependencies.market.listOpportunities(job.ownerId),
      ]);
      const offerIds = new Set(offers.filter((offer) => offer.url).map((offer) => offer.id));
      const date = now().toISOString().slice(0, 10);
      for (const opportunity of opportunities) {
        if (!opportunity.offerId || !offerIds.has(opportunity.offerId) || !["qualified", "testing"].includes(opportunity.status)) continue;
        await dependencies.autonomy.enqueue({
          ownerId: job.ownerId,
          kind: "validate_offer",
          idempotencyKey: `validate:${opportunity.offerId}:${date}`,
          payload: { offerId: opportunity.offerId, opportunityId: opportunity.id },
          priority: 20,
        });
      }
    },

    validate_offer: async (job) => {
      const offerId = requiredPayload(job.payload, "offerId");
      const opportunityId = requiredPayload(job.payload, "opportunityId");
      const offers = await dependencies.market.listOffers(job.ownerId);
      const offer = offers.find((candidate) => candidate.id === offerId);
      if (!offer?.url) throw new Error("Offer URL is missing");
      const url = publicHttpsUrl(offer.url);
      const response = await fetchOffer(url, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(15_000) });
      if (response.status >= 400) throw new Error(`Offer validation failed with HTTP ${response.status}`);
      await dependencies.autonomy.enqueue({
        ownerId: job.ownerId,
        kind: "prepare_content",
        idempotencyKey: `prepare:${opportunityId}:${now().toISOString().slice(0, 10)}`,
        payload: { offerId, opportunityId, validatedUrl: url.toString(), validatedAt: now().toISOString() },
        priority: 10,
      });
    },

    prepare_content: async (job) => {
      const opportunityId = requiredPayload(job.payload, "opportunityId");
      const opportunities = await dependencies.market.listOpportunities(job.ownerId);
      const opportunity = opportunities.find((candidate) => candidate.id === opportunityId);
      if (!opportunity) throw new Error("Opportunity not found");
      const channels = opportunity.channels.filter((channel): channel is ContentChannel => CONTENT_CHANNELS.has(channel as ContentChannel));
      if (!channels.length) throw new Error("Opportunity has no supported distribution channel");
      const plans = await dependencies.content.listPlans(job.ownerId);
      const plan = plans.find((candidate) => candidate.opportunityId === opportunity.id && candidate.status === "active") ?? await dependencies.content.createPlan(job.ownerId, {
        opportunityId: opportunity.id,
        objective: `Preparar conteúdo de venda verificável para ${opportunity.niche}`,
        funnelStage: "conversion",
        channels,
        keywords: [opportunity.niche, opportunity.market].filter(Boolean),
        tone: "claro, útil e confiável",
      });
      const assets = await dependencies.content.listAssets(job.ownerId);
      for (const channel of channels) {
        if (assets.some((asset) => asset.planId === plan.id && asset.channel === channel && asset.status !== "rejected")) continue;
        await dependencies.content.generate(job.ownerId, {
          planId: plan.id,
          channel,
          format: formatFor(channel),
          instructions: "Crie somente um rascunho para aprovação humana. Não invente preço, desconto, resultado, depoimento ou benefício não comprovado.",
        });
      }
    },
  };
}

function requiredPayload(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== "string" || !value.trim()) throw new Error(`Missing ${key} in autonomy job payload`);
  return value.trim();
}

function publicHttpsUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("Offer URL must be public HTTPS without embedded credentials");
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host === "0.0.0.0" || host === "::1" || /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)) throw new Error("Offer URL cannot target a private network");
  return url;
}

function formatFor(channel: ContentChannel): ContentFormat {
  return channel === "tiktok" || channel === "youtube" ? "video-script" : "social-post";
}
