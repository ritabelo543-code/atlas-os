import type { AiProvider, AiRequest, AiResult, CollectionStore } from "./index.js";
import type { AtlasAgent, MemoryItem, PluginManifest } from "@atlas/types";

const AI_SYSTEM_PROMPT = "Return JSON with recommendation, rationale, confidence (0..1), nextSteps (string array). Reply with only the JSON object, no prose, no markdown fences.";
function parseAiResult(raw: string): AiResult {
  const parsed = JSON.parse(raw) as AiResult;
  if (!parsed.recommendation || !parsed.rationale || !Array.isArray(parsed.nextSteps) || typeof parsed.confidence !== "number") throw new Error("AI provider returned an invalid response");
  return { ...parsed, confidence: Math.max(0, Math.min(1, parsed.confidence)) };
}
function aiRequestBody(request: AiRequest): unknown { return { mission: { title: request.mission.title, objective: request.mission.objective, context: request.mission.context }, knowledge: request.knowledge, memory: request.memory }; }

export class AnthropicAiProvider implements AiProvider {
  readonly name = "anthropic"; readonly mode = "live" as const;
  private readonly timeoutMs: number; private readonly maxRetries: number;
  constructor(readonly model: string, private readonly apiKey: string, private readonly baseUrl = "https://api.anthropic.com/v1", options: { timeoutMs?: number; maxRetries?: number } = {}) {
    this.timeoutMs = options.timeoutMs ?? 20_000; this.maxRetries = options.maxRetries ?? 2;
  }
  async generate(request: AiRequest): Promise<AiResult> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/messages`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-api-key": this.apiKey, "anthropic-version": "2023-06-01" },
          signal: controller.signal,
          body: JSON.stringify({ model: this.model, max_tokens: 1024, system: AI_SYSTEM_PROMPT, messages: [{ role: "user", content: JSON.stringify(aiRequestBody(request)) }] }),
        });
        if (!response.ok) {
          const excerpt = (await response.text().catch(() => "")).slice(0, 200);
          const error = new Error(`Anthropic provider request failed (${response.status}): ${excerpt}`);
          if (response.status === 429 || response.status >= 500) { lastError = error; if (attempt < this.maxRetries) { await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt)); continue; } }
          throw error;
        }
        const body = await response.json() as { content?: Array<{ type?: string; text?: string }> };
        const text = body.content?.find((block) => block.type === "text")?.text ?? body.content?.[0]?.text;
        if (!text) throw new Error("Anthropic provider returned an empty response");
        return parseAiResult(text);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") { lastError = new Error(`Anthropic provider request timed out after ${this.timeoutMs}ms`); if (attempt < this.maxRetries) { continue; } throw lastError; }
        if ((error as { message?: string })?.message?.startsWith("Anthropic provider request failed")) throw error;
        lastError = error; if (attempt < this.maxRetries) { await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt)); continue; }
        throw error;
      } finally { clearTimeout(timer); }
    }
    throw lastError instanceof Error ? lastError : new Error("Anthropic provider request failed");
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
