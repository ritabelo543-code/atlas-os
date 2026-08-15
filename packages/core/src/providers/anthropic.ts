import type { AiProvider, AiRequest, AiResult } from "../index.js";

export interface AnthropicProviderOptions {
  timeoutMs?: number;
  maxRetries?: number;
  fetchImpl?: typeof fetch;
}

const DEFAULT_BASE_URL = "https://api.anthropic.com";
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 2;
const ANTHROPIC_VERSION = "2023-06-01";

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

  async generate({ mission, knowledge, memory }: AiRequest): Promise<AiResult> {
    const systemPrompt =
      'Voce e o motor de decisao do Atlas OS. Responda SOMENTE com um objeto JSON valido, sem texto adicional, sem markdown, no formato exato: {"recommendation": string, "rationale": string, "confidence": number entre 0 e 1, "nextSteps": string[]}.';

    const userPayload = JSON.stringify({
      mission: { title: mission.title, objective: mission.objective, context: mission.context },
      knowledge,
      memory,
    });

    const body = JSON.stringify({
      model: this.model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userPayload }],
    });

    const responseText = await this.requestWithRetry(body);
    return this.parseResult(responseText);
  }

  private async requestWithRetry(body: string): Promise<string> {
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
          throw new Error("Anthropic provider authentication failed (invalid or missing API key)");
        }

        if (response.status === 429 || response.status >= 500) {
          if (attempt < this.maxRetries) {
            await delay(backoffMs(attempt));
            continue;
          }
          throw new Error(`Anthropic provider request failed after retries (status ${response.status})`);
        }

        if (!response.ok) {
          throw new Error(`Anthropic provider request failed (status ${response.status})`);
        }

        const data = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
        const text = (data.content ?? [])
          .filter((block) => block.type === "text" && typeof block.text === "string")
          .map((block) => block.text)
          .join("")
          .trim();

        if (!text) throw new Error("Anthropic provider returned an empty response");
        return text;
      } catch (error) {
        clearTimeout(timeoutHandle);
        lastError = error;
        if (isAbortError(error)) {
          if (attempt < this.maxRetries) {
            await delay(backoffMs(attempt));
            continue;
          }
          throw new Error(`Anthropic provider request timed out after ${this.timeoutMs}ms`);
        }
        if (error instanceof Error && error.message.includes("authentication failed")) throw error;
        if (attempt < this.maxRetries) {
          await delay(backoffMs(attempt));
          continue;
        }
        throw error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error("Anthropic provider request failed");
  }

  private parseResult(text: string): AiResult {
    const cleaned = text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    let parsed: Partial<AiResult>;
    try {
      parsed = JSON.parse(cleaned) as Partial<AiResult>;
    } catch {
      throw new Error("Anthropic provider returned a response that was not valid JSON");
    }
    if (
      typeof parsed.recommendation !== "string" ||
      typeof parsed.rationale !== "string" ||
      typeof parsed.confidence !== "number" ||
      !Array.isArray(parsed.nextSteps)
    ) {
      throw new Error("Anthropic provider returned an invalid response shape");
    }
    return {
      recommendation: parsed.recommendation,
      rationale: parsed.rationale,
      confidence: Math.max(0, Math.min(1, parsed.confidence)),
      nextSteps: parsed.nextSteps.filter((step): step is string => typeof step === "string"),
    };
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