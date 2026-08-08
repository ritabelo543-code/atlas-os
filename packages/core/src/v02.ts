import type { AiProvider, CollectionStore } from "./index.js";
import type { AtlasAgent, MemoryItem, PluginManifest } from "@atlas/types";

export class MemoryManager {
  constructor(private readonly store: CollectionStore<MemoryItem>, private readonly retentionDays = 30, private readonly maxItems = 500) {}
  async remember(input: Omit<MemoryItem, "id" | "createdAt" | "updatedAt" | "expiresAt"> & { expiresAt?: string | null }): Promise<MemoryItem> {
    const now = new Date();
    const item: MemoryItem = { ...input, id: crypto.randomUUID(), createdAt: now.toISOString(), updatedAt: now.toISOString(), expiresAt: input.expiresAt ?? (input.scope === "temporary" ? new Date(now.getTime() + this.retentionDays * 86400000).toISOString() : null) };
    const items = (await this.store.load()).filter((entry) => !entry.expiresAt || entry.expiresAt > now.toISOString());
    const duplicate = items.find((entry) => entry.content.trim().toLowerCase() === item.content.trim().toLowerCase());
    if (duplicate) return duplicate;
    items.unshift(item); await this.store.save(items.slice(0, this.maxItems)); return item;
  }
  async context(query: string, excludeMissionId?: string, limit = 5): Promise<MemoryItem[]> {
    const now = new Date().toISOString();
    const terms = new Set(query.toLowerCase().split(/\W+/).filter((term) => term.length > 2));
    return (await this.store.load())
      .filter((item) => (!item.expiresAt || item.expiresAt > now) && item.missionId !== excludeMissionId)
      .map((item) => ({ item, score: [...terms].reduce((score, term) => score + (`${item.summary} ${item.content} ${item.tags.join(" ")}`.toLowerCase().includes(term) ? 1 : 0), 0) + item.relevance + item.confidence / 10 }))
      .filter(({ score }) => score > 1).sort((a, b) => b.score - a.score).slice(0, limit).map(({ item }) => item);
  }
  list(): Promise<MemoryItem[]> { return this.store.load(); }
}
export class AgentRegistry { private readonly agents: AtlasAgent[] = [{ id:"ceo",name:"CEO Agent",role:"Strategic direction",status:"registered" },{ id:"architect",name:"Architect Agent",role:"System design",status:"registered" },{ id:"developer",name:"Developer Agent",role:"Implementation support",status:"registered" },{ id:"knowledge",name:"Knowledge Agent",role:"Knowledge curation",status:"registered" },{ id:"qa",name:"QA Agent",role:"Quality assurance",status:"registered" }]; list(): AtlasAgent[] { return [...this.agents]; } }
export class PluginRegistry { private readonly plugins: PluginManifest[] = ["GitHub","Gmail","Google Calendar","Slack","Notion","REST APIs"].map((name) => ({ id:name.toLowerCase().replace(/\s+/g,"-"),name,version:"planned",enabled:false,capabilities:[] })); list(): PluginManifest[] { return [...this.plugins]; } }
export function resolveAiProvider(config: { provider?: string; model?: string; apiKey?: string; baseUrl?: string }, fallback: AiProvider, createCompatible: (name: string, model: string, key: string, baseUrl: string) => AiProvider): AiProvider { if (!config.apiKey || config.provider === "mock") return fallback; const provider = config.provider ?? "openai"; const urls: Record<string,string> = { openai:"https://api.openai.com/v1", deepseek:"https://api.deepseek.com/v1", ollama:"http://localhost:11434/v1", claude:"https://api.anthropic.com/v1", gemini:"https://generativelanguage.googleapis.com/v1beta/openai" }; return createCompatible(provider, config.model ?? "gpt-5-mini", config.apiKey, config.baseUrl ?? urls[provider] ?? urls.openai); }
