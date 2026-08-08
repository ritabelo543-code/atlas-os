import type { AtlasStatus, AuditEntry, Decision, KnowledgeItem, MemoryItem, Mission } from "@atlas/types";
import { MemoryManager } from "./v02.js";
export { AgentRegistry, MemoryManager, PluginRegistry, resolveAiProvider } from "./v02.js";

export interface CollectionStore<T> { load(): Promise<T[]>; save(items: T[]): Promise<void> }
export type AtlasEventMap = { "mission.created": Mission; "mission.completed": Mission; "decision.created": Decision; "knowledge.created": KnowledgeItem };
export class EventBus<Events extends object = AtlasEventMap> {
  private listeners = new Map<keyof Events, Set<(payload: never) => void>>();
  subscribe<K extends keyof Events>(event: K, listener: (payload: Events[K]) => void): () => void {
    const set = this.listeners.get(event) ?? new Set(); set.add(listener as (payload: never) => void); this.listeners.set(event, set);
    return () => set.delete(listener as (payload: never) => void);
  }
  publish<K extends keyof Events>(event: K, payload: Events[K]): void { for (const listener of this.listeners.get(event) ?? []) listener(payload as never); }
}

export type AiRequest = { mission: Mission; knowledge: KnowledgeItem[]; memory: MemoryItem[] };
export type AiResult = { recommendation: string; rationale: string; confidence: number; nextSteps: string[] };
export interface AiProvider { readonly name: string; readonly model: string; readonly mode: "live" | "mock"; generate(request: AiRequest): Promise<AiResult> }
export class MockAiProvider implements AiProvider {
  readonly name = "atlas-dev"; readonly model = "deterministic-v1"; readonly mode = "mock" as const;
  async generate({ mission, knowledge, memory }: AiRequest): Promise<AiResult> {
    const evidence = knowledge.length || memory.length ? `Foram encontrados ${knowledge.length} registro(s) de conhecimento e ${memory.length} memória(s) relevante(s).` : "Não há conhecimento histórico diretamente relacionado.";
    const contextCount = knowledge.length + memory.length;
    return { recommendation: `Validar a hipótese de “${mission.objective}” com um experimento pequeno e mensurável.`, rationale: `${evidence} O caminho recomendado reduz risco antes de ampliar investimento.`, confidence: contextCount ? Math.min(.85, .55 + contextCount * .08) : .42, nextSteps: ["Definir uma métrica de sucesso", "Executar um teste de baixo custo", "Registrar os resultados no Atlas"] };
  }
}
export class CompatibleAiProvider implements AiProvider {
  readonly mode = "live" as const;
  constructor(readonly name: string, readonly model: string, private readonly apiKey: string, private readonly baseUrl: string) {}
  async generate({ mission, knowledge, memory }: AiRequest): Promise<AiResult> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` }, body: JSON.stringify({ model: this.model, response_format: { type: "json_object" }, messages: [{ role: "system", content: "Return JSON with recommendation, rationale, confidence (0..1), nextSteps (string array)." }, { role: "user", content: JSON.stringify({ mission: { title: mission.title, objective: mission.objective, context: mission.context }, knowledge, memory }) }] }) });
    if (!response.ok) throw new Error(`AI provider request failed (${response.status})`);
    const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const parsed = JSON.parse(body.choices?.[0]?.message?.content ?? "{}") as AiResult;
    if (!parsed.recommendation || !parsed.rationale || !Array.isArray(parsed.nextSteps) || typeof parsed.confidence !== "number") throw new Error("AI provider returned an invalid response");
    return { ...parsed, confidence: Math.max(0, Math.min(1, parsed.confidence)) };
  }
}

export class KnowledgeEngine {
  constructor(private readonly store: CollectionStore<KnowledgeItem>, private readonly events: EventBus) {}
  async add(input: Omit<KnowledgeItem, "id" | "createdAt">): Promise<KnowledgeItem> { const item = { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() }; const items = await this.store.load(); items.unshift(item); await this.store.save(items); this.events.publish("knowledge.created", item); return item; }
  async search(query: string, limit = 5): Promise<KnowledgeItem[]> { const terms = query.toLowerCase().split(/\W+/).filter((term) => term.length > 2); const items = await this.store.load(); return items.map((item) => ({ item, score: terms.reduce((score, term) => score + (`${item.summary} ${item.content} ${item.context}`.toLowerCase().includes(term) ? 1 : 0), 0) + item.confidence / 10 })).filter(({ score }) => score > 0).sort((a, b) => b.score - a.score).slice(0, limit).map(({ item }) => item); }
}
export class Guardian {
  constructor(private readonly auditStore: CollectionStore<AuditEntry>) {}
  async record(module: string, action: string, context: AuditEntry["context"], result: AuditEntry["result"]): Promise<void> { const entries = await this.auditStore.load(); entries.unshift({ id: crypto.randomUUID(), timestamp: new Date().toISOString(), module, action, context, result }); await this.auditStore.save(entries.slice(0, 1000)); }
  validateMission(mission: Mission): boolean { return mission.title.trim().length > 0 && mission.objective.trim().length >= 10; }
}

export class AtlasCore {
  private lifecycle: AtlasStatus["lifecycle"] = "stopped"; private startedAt: string | null = null;
  readonly events = new EventBus(); readonly knowledge: KnowledgeEngine; readonly guardian: Guardian; readonly memory: MemoryManager;
  constructor(private readonly provider: AiProvider, private readonly stores: { missions: CollectionStore<Mission>; decisions: CollectionStore<Decision>; knowledge: CollectionStore<KnowledgeItem>; audit: CollectionStore<AuditEntry>; memory: CollectionStore<MemoryItem> }) { this.knowledge = new KnowledgeEngine(stores.knowledge, this.events); this.guardian = new Guardian(stores.audit); this.memory = new MemoryManager(stores.memory); }
  async start(): Promise<void> { if (this.lifecycle === "running") return; this.lifecycle = "starting"; await Promise.all(Object.values(this.stores).map((store) => store.load())); this.startedAt = new Date().toISOString(); this.lifecycle = "running"; }
  async stop(): Promise<void> { this.lifecycle = "stopping"; this.lifecycle = "stopped"; }
  status(): AtlasStatus { return { lifecycle: this.lifecycle, version: "0.2.0", startedAt: this.startedAt, modules: ["event-bus", "knowledge", "decision", "guardian", "memory", "agents", "plugins"].map((name) => ({ name, status: this.lifecycle === "running" ? "ready" : "stopped" })), ai: { provider: this.provider.name, model: this.provider.model, mode: this.provider.mode } }; }
  async createMission(input: Pick<Mission, "title" | "objective" | "context">): Promise<Mission> { const now = new Date().toISOString(); const mission: Mission = { ...input, id: crypto.randomUUID(), status: "pending", createdAt: now, updatedAt: now, decisionId: null }; if (!this.guardian.validateMission(mission)) { await this.guardian.record("guardian", "mission.create", { title: mission.title }, "denied"); throw new Error("Mission did not pass guardian validation"); } const missions = await this.stores.missions.load(); missions.unshift(mission); await this.stores.missions.save(missions); await this.guardian.record("missions", "mission.create", { missionId: mission.id }, "success"); this.events.publish("mission.created", mission); return mission; }
  listMissions(): Promise<Mission[]> { return this.stores.missions.load(); }
  async getMission(id: string): Promise<Mission | undefined> { return (await this.stores.missions.load()).find((mission) => mission.id === id); }
  async getDecision(id: string): Promise<Decision | undefined> { return (await this.stores.decisions.load()).find((decision) => decision.id === id); }
  listDecisions(): Promise<Decision[]> { return this.stores.decisions.load(); }
  listKnowledge(): Promise<KnowledgeItem[]> { return this.stores.knowledge.load(); }
  listAudit(): Promise<AuditEntry[]> { return this.stores.audit.load(); }
  listMemory(): Promise<MemoryItem[]> { return this.memory.list(); }
  async executeMission(id: string): Promise<Decision | undefined> {
    const missions = await this.stores.missions.load(); const mission = missions.find((item) => item.id === id); if (!mission) return undefined;
    mission.status = "running"; mission.updatedAt = new Date().toISOString(); await this.stores.missions.save(missions);
    try {
      const query = `${mission.title} ${mission.objective} ${mission.context}`;
      const [knowledge, memory] = await Promise.all([this.knowledge.search(query), this.memory.context(query, mission.id)]);
      const result = await this.provider.generate({ mission, knowledge, memory });
      const insufficient = result.confidence < .3;
      const decision: Decision = { id: crypto.randomUUID(), missionId: mission.id, recommendation: insufficient ? "Dados insuficientes para uma recomendação segura." : result.recommendation, rationale: result.rationale, confidence: result.confidence, nextSteps: result.nextSteps, outcome: insufficient ? "insufficient_data" : "recommendation", knowledgeIds: knowledge.map((item) => item.id), memoryIds: memory.map((item) => item.id), provider: this.provider.name, model: this.provider.model, createdAt: new Date().toISOString() };
      const decisions = await this.stores.decisions.load(); decisions.unshift(decision); await this.stores.decisions.save(decisions);
      await this.memory.remember({ scope: "persistent", missionId: mission.id, source: `mission:${mission.id}`, content: `${mission.title}. ${mission.objective}. Decisão: ${decision.recommendation}`, summary: decision.rationale, relevance: decision.confidence, confidence: decision.confidence, tags: query.toLowerCase().split(/\W+/).filter((term) => term.length > 3).slice(0, 12) });
      mission.status = "completed"; mission.decisionId = decision.id; mission.updatedAt = new Date().toISOString(); await this.stores.missions.save(missions);
      await this.guardian.record("decision", "decision.create", { missionId: mission.id, decisionId: decision.id, provider: this.provider.name, model: this.provider.model, memoryReused: memory.length }, "success");
      this.events.publish("decision.created", decision); this.events.publish("mission.completed", mission); return decision;
    } catch (error) {
      mission.status = "failed"; mission.updatedAt = new Date().toISOString(); await this.stores.missions.save(missions);
      await this.guardian.record("decision", "decision.create", { missionId: mission.id, provider: this.provider.name, model: this.provider.model }, "failure"); throw error;
    }
  }
}
