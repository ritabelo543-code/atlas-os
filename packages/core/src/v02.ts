import type { AiProvider, AiRequest, AiResult, CollectionStore, ContentAiRequest, ContentAiResult, MarketAiRequest, MarketAiResult } from "./index.js";
import type { AtlasAgent, MemoryItem, PluginManifest } from "@atlas/types";

export class AiProviderError extends Error {
  constructor(message: string, readonly providerStatus?: number) { super(message); this.name = "AiProviderError"; }
}
function parseJson(raw: string): unknown {
  try { return JSON.parse(raw); } catch { throw new AiProviderError("AI provider returned a response that was not valid JSON"); }
}
const AI_SYSTEM_PROMPT = "Return JSON with recommendation, rationale, confidence (0..1), nextSteps (string array). Reply with only the JSON object, no prose, no markdown fences.";
function parseAiResult(raw: string): AiResult {
  const parsed = parseJson(raw) as AiResult;
  if (!parsed.recommendation || !parsed.rationale || !Array.isArray(parsed.nextSteps) || typeof parsed.confidence !== "number") throw new AiProviderError("AI provider returned an invalid response");
  return { ...parsed, confidence: Math.max(0, Math.min(1, parsed.confidence)) };
}
function aiRequestBody(request: AiRequest): unknown { return { mission: { title: request.mission.title, objective: request.mission.objective, context: request.mission.context }, knowledge: request.knowledge, memory: request.memory }; }

const CONTENT_SYSTEM_PROMPT = "Return JSON with title, body, cta (all strings), variants (an array of exactly 3 objects, each with title, hook, cta strings) and optionally designBrief (string). Do not include unverifiable claims or fabricated statistics. Reply with only the JSON object, no prose, no markdown fences.";
function parseContentResult(raw: string): ContentAiResult {
  const parsed = parseJson(raw) as ContentAiResult;
  const validVariants = Array.isArray(parsed.variants) && parsed.variants.length === 3 && parsed.variants.every((variant) => variant && typeof variant.title === "string" && typeof variant.hook === "string" && typeof variant.cta === "string");
  if (!parsed.title || !parsed.body || !parsed.cta || !validVariants) throw new AiProviderError("AI content provider returned an invalid response");
  return { title: parsed.title, body: parsed.body, cta: parsed.cta, variants: parsed.variants, designBrief: parsed.designBrief };
}
function contentRequestBody(request: ContentAiRequest): unknown { return { opportunity: { market: request.opportunity.market, niche: request.opportunity.niche, audience: request.opportunity.audience, painOrDesire: request.opportunity.painOrDesire }, plan: { objective: request.plan.objective, funnelStage: request.plan.funnelStage, tone: request.plan.tone, keywords: request.plan.keywords }, channel: request.channel, format: request.format, instructions: request.instructions }; }

const MARKET_SIGNAL_KINDS = ["trend", "seasonality", "noise", "demand", "competition"] as const;
const MARKET_SIGNAL_DIRECTIONS = ["rising", "falling", "stable", "unknown"] as const;
const MARKET_SYSTEM_PROMPT = `Return JSON with signals (an array with exactly one classification per evidence item, in the same order as given, each an object with kind and direction) and rankingRationale (string). kind must be exactly one of: ${MARKET_SIGNAL_KINDS.join(", ")}. direction must be exactly one of: ${MARKET_SIGNAL_DIRECTIONS.join(", ")}. Ground rankingRationale only in the given evidence and score; do not invent new numbers or unverifiable claims. Reply with only the JSON object, no prose, no markdown fences.`;
function parseMarketResult(raw: string, expectedCount: number): MarketAiResult {
  const parsed = parseJson(raw) as MarketAiResult;
  const validSignals = Array.isArray(parsed.signals) && parsed.signals.length === expectedCount && parsed.signals.every((signal) => signal && (MARKET_SIGNAL_KINDS as readonly string[]).includes(signal.kind) && (MARKET_SIGNAL_DIRECTIONS as readonly string[]).includes(signal.direction));
  if (!validSignals || !parsed.rankingRationale) throw new AiProviderError("AI market provider returned an invalid response");
  return { signals: parsed.signals, rankingRationale: parsed.rankingRationale };
}
function marketRequestBody(request: MarketAiRequest): unknown { return { market: request.market, niche: request.niche, audience: request.audience, painOrDesire: request.painOrDesire, evidence: request.evidence.map((item) => ({ excerpt: item.excerpt, valueKind: item.valueKind, confidence: item.confidence })) }; }

export class AnthropicAiProvider implements AiProvider {
  readonly name = "anthropic"; readonly mode = "live" as const;
  private readonly timeoutMs: number; private readonly maxRetries: number;
  constructor(readonly model: string, private readonly apiKey: string, private readonly baseUrl = "https://api.anthropic.com/v1", options: { timeoutMs?: number; maxRetries?: number } = {}) {
    this.timeoutMs = options.timeoutMs ?? 20_000; this.maxRetries = options.maxRetries ?? 2;
  }
  async generate(request: AiRequest): Promise<AiResult> { return parseAiResult(await this.callMessages(AI_SYSTEM_PROMPT, aiRequestBody(request), 1024)); }
  async generateContent(request: ContentAiRequest): Promise<ContentAiResult> { return parseContentResult(await this.callMessages(CONTENT_SYSTEM_PROMPT, contentRequestBody(request), 4096)); }
  async analyzeMarket(request: MarketAiRequest): Promise<MarketAiResult> { return parseMarketResult(await this.callMessages(MARKET_SYSTEM_PROMPT, marketRequestBody(request), 2048), request.evidence.length); }
  private async callMessages(system: string, userPayload: unknown, maxTokens: number): Promise<string> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/messages`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-api-key": this.apiKey, "anthropic-version": "2023-06-01" },
          signal: controller.signal,
          body: JSON.stringify({ model: this.model, max_tokens: maxTokens, system, messages: [{ role: "user", content: JSON.stringify(userPayload) }] }),
        });
        if (!response.ok) {
          const excerpt = (await response.text().catch(() => "")).slice(0, 200);
          const error = new AiProviderError(`Anthropic provider request failed (${response.status}): ${excerpt}`, response.status);
          if (response.status === 429 || response.status >= 500) { lastError = error; if (attempt < this.maxRetries) { await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt)); continue; } }
          throw error;
        }
        const body = await response.json() as { content?: Array<{ type?: string; text?: string }> };
        const text = body.content?.find((block) => block.type === "text")?.text ?? body.content?.[0]?.text;
        if (!text) throw new AiProviderError("Anthropic provider returned an empty response");
        return text;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") { lastError = new AiProviderError(`Anthropic provider request timed out after ${this.timeoutMs}ms`); if (attempt < this.maxRetries) { continue; } throw lastError; }
        if (error instanceof AiProviderError) throw error;
        lastError = error; if (attempt < this.maxRetries) { await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt)); continue; }
        throw error;
      } finally { clearTimeout(timer); }
    }
    throw lastError instanceof Error ? lastError : new AiProviderError("Anthropic provider request failed");
  }
}

export class MemoryManager {
  constructor(private readonly store: CollectionStore<MemoryItem>, private readonly retentionDays = 30, private readonly maxItems = 500) {}
  async remember(input: Omit<MemoryItem, "id" | "createdAt" | "updatedAt" | "expiresAt"> & { expiresAt?: string | null }): Promise<MemoryItem> {
    const now = new Date();
    const item: MemoryItem = { ...input, priority: input.priority ?? 0.5, favorite: input.favorite ?? false, relatedMemoryIds: input.relatedMemoryIds ?? [], id: crypto.randomUUID(), createdAt: now.toISOString(), updatedAt: now.toISOString(), expiresAt: input.expiresAt ?? (input.scope === "temporary" ? new Date(now.getTime() + this.retentionDays * 86400000).toISOString() : null) };
    const items = (await this.store.load()).filter((entry) => !entry.expiresAt || entry.expiresAt > now.toISOString());
    const duplicate = items.find((entry) => entry.content.trim().toLowerCase() === item.content.trim().toLowerCase());
    if (duplicate) return duplicate;
    items.unshift(item); await this.store.save(items.slice(0, this.maxItems)); return item;
  }
  async context(query: string, excludeMissionId?: string, limit = 5, ownerId?: string): Promise<MemoryItem[]> {
    const now = new Date().toISOString();
    const terms = new Set(query.toLowerCase().split(/\W+/).filter((term) => term.length > 2));
    return (await this.store.load())
      .filter((item) => (!item.expiresAt || item.expiresAt > now) && item.missionId !== excludeMissionId && (!ownerId || item.ownerId === ownerId))
      .map((item) => { const ageDays = Math.max(0, (Date.now() - Date.parse(item.updatedAt)) / 86400000); const decay = Math.exp(-ageDays / this.retentionDays); const lexical = [...terms].reduce((score, term) => score + (`${item.summary} ${item.content} ${item.tags.join(" ")}`.toLowerCase().includes(term) ? 1 : 0), 0); return { item, score: lexical + item.relevance * decay + item.confidence / 10 + (item.priority ?? .5) + (item.favorite ? 1 : 0) }; })
      .filter(({ score }) => score > 1).sort((a, b) => b.score - a.score).slice(0, limit).map(({ item }) => item);
  }
  list(): Promise<MemoryItem[]> { return this.store.load(); }
}
export class AgentRegistry { private readonly agents: AtlasAgent[] = [{ id:"ceo",name:"CEO Agent",role:"Strategic direction",status:"registered" },{ id:"architect",name:"Architect Agent",role:"System design",status:"registered" },{ id:"developer",name:"Developer Agent",role:"Implementation support",status:"registered" },{ id:"knowledge",name:"Knowledge Agent",role:"Knowledge curation",status:"registered" },{ id:"qa",name:"QA Agent",role:"Quality assurance",status:"registered" }]; list(): AtlasAgent[] { return [...this.agents]; } }
export class PluginRegistry { private readonly plugins: PluginManifest[] = ["GitHub","Gmail","Google Calendar","Slack","Notion","REST APIs"].map((name) => ({ id:name.toLowerCase().replace(/\s+/g,"-"),name,version:"planned",enabled:false,capabilities:[] })); list(): PluginManifest[] { return [...this.plugins]; } }
export function resolveAiProvider(config: { provider?: string; model?: string; apiKey?: string; baseUrl?: string }, fallback: AiProvider, createCompatible: (name: string, model: string, key: string, baseUrl: string) => AiProvider, createAnthropic?: (model: string, key: string, baseUrl: string) => AiProvider): AiProvider { if (!config.apiKey || config.provider === "mock") return fallback; const provider = config.provider ?? "openai"; const urls: Record<string,string> = { openai:"https://api.openai.com/v1", deepseek:"https://api.deepseek.com/v1", ollama:"http://localhost:11434/v1", claude:"https://api.anthropic.com/v1", gemini:"https://generativelanguage.googleapis.com/v1beta/openai" }; const baseUrl = config.baseUrl ?? urls[provider] ?? urls.openai; if (provider === "claude" && createAnthropic) return createAnthropic(config.model ?? "claude-sonnet-5", config.apiKey, baseUrl); return createCompatible(provider, config.model ?? "gpt-5-mini", config.apiKey, baseUrl); }
