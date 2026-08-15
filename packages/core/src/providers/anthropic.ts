import type { AiProvider, AiRequest, AiResult, ContentAiRequest, ContentAiResult, LearningAiRequest, LearningAiResult, MarketAiRequest, MarketAiResult } from "../index.js";

export interface AnthropicProviderOptions {
  timeoutMs?: number;
  maxRetries?: number;
  fetchImpl?: typeof fetch;
}

export class AiProviderError extends Error {
  constructor(message: string, readonly providerStatus?: number) {
    super(message);
    this.name = "AiProviderError";
  }
}

const DEFAULT_BASE_URL = "https://api.anthropic.com";
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 2;
const ANTHROPIC_VERSION = "2023-06-01";

const MISSION_SYSTEM_PROMPT =
  'Voce e o motor de decisao do Atlas OS. Responda SOMENTE com um objeto JSON valido, sem texto adicional, sem markdown, no formato exato: {"recommendation": string, "rationale": string, "confidence": number entre 0 e 1, "nextSteps": string[]}.';

const CONTENT_SYSTEM_PROMPT =
  "Return JSON with title, body, cta (all strings), variants (an array of exactly 3 objects, each with title, hook, cta strings) and optionally designBrief (string). Do not include unverifiable claims or fabricated statistics. Reply with only the JSON object, no prose, no markdown fences.";

const MARKET_SIGNAL_KINDS = ["trend", "seasonality", "noise", "demand", "competition"] as const;
const MARKET_SIGNAL_DIRECTIONS = ["rising", "falling", "stable", "unknown"] as const;
const MARKET_SYSTEM_PROMPT = `Return JSON with signals (an array with exactly one classification per evidence item, in the same order as given, each an object with kind and direction) and rankingRationale (string). kind must be exactly one of: ${MARKET_SIGNAL_KINDS.join(", ")}. direction must be exactly one of: ${MARKET_SIGNAL_DIRECTIONS.join(", ")}. Ground rankingRationale only in the given evidence and score; do not invent new numbers or unverifiable claims. Reply with only the JSON object, no prose, no markdown fences.`;

const LEARNING_SYSTEM_PROMPT =
  "Return JSON with summary (string): a short natural-language performance summary. Reference only the exact CTR, conversion rate, ROI and profit values given -- never invent or alter numbers, and do not restate the recommendation verbatim. Reply with only the JSON object, no prose, no markdown fences.";

function parseJson(raw: string): unknown {
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new AiProviderError("Anthropic provider returned a response that was not valid JSON");
  }
}

function missionRequestBody({ mission, knowledge, memory }: AiRequest): unknown {
  return { mission: { title: mission.title, objective: mission.objective, context: mission.context }, knowledge, memory };
}
function parseMissionResult(raw: string): AiResult {
  const parsed = parseJson(raw) as Partial<AiResult>;
  if (typeof parsed.recommendation !== "string" || typeof parsed.rationale !== "string" || typeof parsed.confidence !== "number" || !Array.isArray(parsed.nextSteps)) {
    throw new AiProviderError("Anthropic provider returned an invalid response shape");
  }
  return {
    recommendation: parsed.recommendation,
    rationale: parsed.rationale,
    confidence: Math.max(0, Math.min(1, parsed.confidence)),
    nextSteps: parsed.nextSteps.filter((step): step is string => typeof step === "string"),
  };
}

function contentRequestBody(request: ContentAiRequest): unknown {
  return {
    opportunity: { market: request.opportunity.market, niche: request.opportunity.niche, audience: request.opportunity.audience, painOrDesire: request.opportunity.painOrDesire },
    plan: { objective: request.plan.objective, funnelStage: request.plan.funnelStage, tone: request.plan.tone, keywords: request.plan.keywords },
    channel: request.channel,
    format: request.format,
    instructions: request.instructions,
  };
}
function parseContentResult(raw: string): ContentAiResult {
  const parsed = parseJson(raw) as Partial<ContentAiResult>;
  const validVariants = Array.isArray(parsed.variants) && parsed.variants.length === 3 && parsed.variants.every((variant) => variant && typeof variant.title === "string" && typeof variant.hook === "string" && typeof variant.cta === "string");
  if (!parsed.title || !parsed.body || !parsed.cta || !validVariants) throw new AiProviderError("Anthropic content provider returned an invalid response");
  return { title: parsed.title, body: parsed.body, cta: parsed.cta, variants: parsed.variants!, designBrief: parsed.designBrief };
}

function marketRequestBody(request: MarketAiRequest): unknown {
  return { market: request.market, niche: request.niche, audience: request.audience, painOrDesire: request.painOrDesire, evidence: request.evidence.map((item) => ({ excerpt: item.excerpt, valueKind: item.valueKind, confidence: item.confidence })) };
}
function parseMarketResult(raw: string, expectedCount: number): MarketAiResult {
  const parsed = parseJson(raw) as Partial<MarketAiResult>;
  const validSignals = Array.isArray(parsed.signals) && parsed.signals.length === expectedCount && parsed.signals.every((signal) => signal && (MARKET_SIGNAL_KINDS as readonly string[]).includes(signal.kind) && (MARKET_SIGNAL_DIRECTIONS as readonly string[]).includes(signal.direction));
  if (!validSignals || !parsed.rankingRationale) throw new AiProviderError("Anthropic market provider returned an invalid response");
  return { signals: parsed.signals!, rankingRationale: parsed.rankingRationale };
}

function learningRequestBody(request: LearningAiRequest): unknown {
  return { winner: { ctr: request.winner.ctr, conversionRate: request.winner.conversionRate, roi: request.winner.roi, profit: request.winner.profit, cac: request.winner.cac, dataKind: request.winner.dataKind }, recordCount: request.recordCount, recommendation: request.recommendation };
}
function parseLearningResult(raw: string): LearningAiResult {
  const parsed = parseJson(raw) as Partial<LearningAiResult>;
  if (!parsed.summary) throw new AiProviderError("Anthropic learning provider returned an invalid response");
  return { summary: parsed.summary };
}

/**
 * Provider nativo da API Anthropic (endpoint /v1/messages).
 * Nao usa o protocolo compativel com OpenAI usado pelo CompatibleAiProvider.
 */
export class AnthropicAiProvider implements AiProvider {
  readonly name = "anthropic";
  readonly mode = "live" as const;
  readonly model: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly fetchImpl: typeof fetch;

  constructor(model: string, apiKey: string, baseUrl = DEFAULT_BASE_URL, options: AnthropicProviderOptions = {}) {
    if (!apiKey) throw new Error("AnthropicAiProvider requires an API key");
    if (!model) throw new Error("AnthropicAiProvider requires a model name");
    this.model = model;
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async generate(request: AiRequest): Promise<AiResult> {
    return parseMissionResult(await this.callMessages(MISSION_SYSTEM_PROMPT, missionRequestBody(request), 1024));
  }

  async generateContent(request: ContentAiRequest): Promise<ContentAiResult> {
    return parseContentResult(await this.callMessages(CONTENT_SYSTEM_PROMPT, contentRequestBody(request), 4096));
  }

  async analyzeMarket(request: MarketAiRequest): Promise<MarketAiResult> {
    return parseMarketResult(await this.callMessages(MARKET_SYSTEM_PROMPT, marketRequestBody(request), 2048), request.evidence.length);
  }

  async summarizeInsight(request: LearningAiRequest): Promise<LearningAiResult> {
    return parseLearningResult(await this.callMessages(LEARNING_SYSTEM_PROMPT, learningRequestBody(request), 512));
  }

  private async callMessages(system: string, userPayload: unknown, maxTokens: number): Promise<string> {
    const body = JSON.stringify({
      model: this.model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: JSON.stringify(userPayload) }],
    });

    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetchImpl(`${this.baseUrl}/v1/messages`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": this.apiKey,
            "anthropic-version": ANTHROPIC_VERSION,
          },
          body,
          signal: controller.signal,
        });
        clearTimeout(timeoutHandle);

        if (response.status === 401 || response.status === 403) {
          throw new AiProviderError("Anthropic provider authentication failed (invalid or missing API key)", response.status);
        }

        if (response.status === 429 || response.status >= 500) {
          if (attempt < this.maxRetries) {
            await delay(backoffMs(attempt));
            continue;
          }
          throw new AiProviderError(`Anthropic provider request failed after retries (status ${response.status})`, response.status);
        }

        if (!response.ok) {
          throw new AiProviderError(`Anthropic provider request failed (status ${response.status})`, response.status);
        }

        const data = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
        const text = (data.content ?? [])
          .filter((block) => block.type === "text" && typeof block.text === "string")
          .map((block) => block.text)
          .join("")
          .trim();

        if (!text) throw new AiProviderError("Anthropic provider returned an empty response");
        return text;
      } catch (error) {
        clearTimeout(timeoutHandle);
        lastError = error;
        if (isAbortError(error)) {
          if (attempt < this.maxRetries) {
            await delay(backoffMs(attempt));
            continue;
          }
          throw new AiProviderError(`Anthropic provider request timed out after ${this.timeoutMs}ms`);
        }
        if (error instanceof AiProviderError) throw error;
        if (attempt < this.maxRetries) {
          await delay(backoffMs(attempt));
          continue;
        }
        throw error;
      }
    }
    throw lastError instanceof Error ? lastError : new AiProviderError("Anthropic provider request failed");
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function backoffMs(attempt: number): number {
  return 250 * Math.pow(2, attempt);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
