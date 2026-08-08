export const PROJECT_STATUSES = ["planning", "active", "completed"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export const TASK_PRIORITIES = ["low", "medium", "high"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export type Project = {
  id: string; name: string; description: string; status: ProjectStatus;
  createdAt: string; updatedAt: string;
  ownerId?: string;
};
export type Task = {
  id: string; projectId: string; title: string; completed: boolean;
  priority: TaskPriority; dueDate: string | null; createdAt: string; updatedAt: string;
  ownerId?: string;
};
export type CreateProjectInput = Pick<Project, "name" | "description">;
export type UpdateProjectInput = Partial<Pick<Project, "name" | "description" | "status">>;
export type CreateTaskInput = Pick<Task, "title" | "priority" | "dueDate">;
export type UpdateTaskInput = Partial<Pick<Task, "title" | "completed" | "priority" | "dueDate">>;
export type ApiError = { error: string; message: string; statusCode: number; requestId?: string };
export type HealthResponse = {
  status: "ok" | "degraded"; service: "atlas-api"; version: string;
  timestamp: string; uptimeSeconds: number; storage: "ok" | "error";
};

export type AtlasLifecycle = "stopped" | "starting" | "running" | "stopping" | "error";
export type AtlasStatus = {
  lifecycle: AtlasLifecycle; version: string; startedAt: string | null;
  modules: Array<{ name: string; status: "ready" | "stopped" | "error" }>;
  ai: { provider: string; model: string; mode: "live" | "mock" };
};
export type KnowledgeItem = {
  id: string; content: string; summary: string; source: string; context: string;
  createdAt: string; confidence: number; metadata: Record<string, string>;
  category?: string; tags?: string[]; relatedKnowledgeIds?: string[]; relevanceScore?: number;
  updatedAt?: string; updateHistory?: Array<{ timestamp: string; action: string }>;
  namespace?: string; projectId?: string | null; internalReferences?: string[];
  ownerId?: string;
};
export type MissionStatus = "pending" | "running" | "completed" | "failed";
export type Mission = {
  id: string; title: string; objective: string; context: string; status: MissionStatus;
  createdAt: string; updatedAt: string; decisionId: string | null;
  ownerId?: string;
};
export type CreateMissionInput = Pick<Mission, "title" | "objective" | "context">;
export type Decision = {
  id: string; missionId: string; recommendation: string; rationale: string;
  confidence: number; nextSteps: string[]; outcome: "recommendation" | "insufficient_data";
  knowledgeIds: string[]; provider: string; model: string; createdAt: string;
  memoryIds?: string[];
  assumptions?: string[]; evidence?: Array<{ source: string; detail: string }>; risks?: string[]; alternatives?: string[];
  alternativeAnalysis?: Array<{ option: string; impact: "low" | "medium" | "high"; cost: "low" | "medium" | "high"; risk: string; confidence: number }>;
  executionPlan?: string[]; adjustedConfidence?: number;
  ownerId?: string;
};
export type AuditEntry = {
  id: string; timestamp: string; module: string; action: string;
  context: Record<string, string | number | boolean | null>; result: "allowed" | "denied" | "success" | "failure";
  ownerId?: string;
};
export type MemoryScope = "temporary" | "persistent";
export type MemoryItem = {
  id: string; scope: MemoryScope; missionId: string | null; source: string;
  content: string; summary: string; relevance: number; confidence: number;
  tags: string[]; priority?: number; favorite?: boolean; relatedMemoryIds?: string[];
  expiresAt: string | null; createdAt: string; updatedAt: string;
  ownerId?: string;
};
export type AtlasUser = { id: string; email: string; name: string; role: "admin" | "member"; createdAt: string };
export type AuthSession = { token: string; user: AtlasUser; expiresAt: string };
export type AgentState = "registered" | "idle" | "running" | "stopped" | "failed" | "cancelled";
export type AtlasAgent = { id: string; name: string; role: string; status: AgentState; permissions?: string[]; currentMissionId?: string | null; provider?: string | null; memoryUsed?: number; startedAt?: string | null; elapsedMs?: number };
export type PluginManifest = { id: string; name: string; version: string; enabled: boolean; capabilities: string[]; permissions?: string[]; status?: "loaded" | "unloaded" | "error" };
export type AgentExecution = { id: string; agentId: string; missionId: string; ownerId?: string; state: AgentState; startedAt: string; finishedAt: string | null; elapsedMs: number; memoryUsed: number; provider: string | null; error: string | null };
export type OperationLog = AuditEntry & { severity: "info" | "warning" | "error" };

export type EvidenceValueKind = "confirmed" | "estimated" | "calculated" | "simulated";
export type MarketEvidence = { id: string; source: string; url?: string; observedAt: string; excerpt: string; valueKind: EvidenceValueKind; confidence: number };
export type MarketSignal = { id: string; ownerId: string; researchId: string; kind: "trend" | "seasonality" | "noise" | "demand" | "competition"; label: string; direction: "rising" | "stable" | "falling" | "unknown"; evidenceIds: string[]; observedAt: string };
export type AffiliateOffer = { id: string; ownerId: string; researchId: string; name: string; provider: string; url?: string; commission?: number; commissionKind?: EvidenceValueKind; notes: string; createdAt: string };
export type OpportunityStatus = "candidate" | "qualified" | "rejected" | "testing";
export type OpportunityScoreComponents = { demand: number; commercialIntent: number; competition: number; monetization: number; margin: number; effort: number; risk: number; evidenceQuality: number; confidence: number; scalability: number };
export type MarketOpportunity = { id: string; ownerId: string; researchId: string; market: string; niche: string; audience: string; painOrDesire: string; offerId?: string; evidenceIds: string[]; channels: string[]; demandEstimate?: number; competitionIntensity?: number; monetizationPotential?: number; effortEstimate?: number; risk?: number; confidence: number; score: number; scoreComponents: OpportunityScoreComponents; rankingRationale: string; status: OpportunityStatus; discoveredAt: string; updatedAt: string; dataKind: EvidenceValueKind };
export type MarketResearch = { id: string; ownerId: string; query: string; market: string; niche: string; audience: string; startedBy: string; status: "completed" | "failed"; input: { painOrDesire: string; channels: string[] }; sourceIds: string[]; signalIds: string[]; offerIds: string[]; opportunityIds: string[]; logicVersion: string; startedAt: string; completedAt: string; durationMs: number; dataKind: EvidenceValueKind; error?: string };
export type CreateMarketResearchInput = { query: string; market: string; niche: string; audience: string; painOrDesire: string; channels: string[]; evidence: Array<Omit<MarketEvidence, "id">>; offers: Array<Pick<AffiliateOffer, "name" | "provider" | "url" | "commission" | "commissionKind" | "notes">>; metrics: Partial<OpportunityScoreComponents>; dataKind: EvidenceValueKind };

export type FunnelStage = "awareness" | "consideration" | "conversion";
export type ContentChannel = "blog" | "email" | "instagram" | "tiktok" | "youtube" | "pinterest" | "landing-page" | "other";
export type ContentFormat = "article" | "social-post" | "email" | "video-script" | "landing-page" | "creative-brief";
export type ContentStatus = "draft" | "in_review" | "approved" | "rejected";
export type ContentPlan = { id: string; ownerId: string; opportunityId: string; offerId?: string; audience: string; painOrDesire: string; objective: string; funnelStage: FunnelStage; channels: ContentChannel[]; keywords: string[]; tone: string; status: "active" | "completed"; createdAt: string; updatedAt: string };
export type ContentVariant = { title: string; hook: string; cta: string };
export type ContentAsset = { id: string; ownerId: string; planId: string; opportunityId: string; channel: ContentChannel; format: ContentFormat; title: string; body: string; cta: string; keywords: string[]; variants: ContentVariant[]; designBrief?: string; status: ContentStatus; generatedBy: string[]; generationMode: "deterministic" | "ai"; createdAt: string; updatedAt: string; reviewedAt?: string; reviewNotes?: string };
export type CreateContentPlanInput = { opportunityId: string; objective: string; funnelStage: FunnelStage; channels: ContentChannel[]; keywords: string[]; tone: string };
export type GenerateContentInput = { planId: string; channel: ContentChannel; format: ContentFormat; instructions?: string };

export type DistributionMode = "dry_run" | "live";
export type DistributionStatus = "draft" | "approved" | "scheduled" | "completed" | "failed" | "cancelled";
export type DistributionCampaign = { id: string; ownerId: string; assetId: string; opportunityId: string; channel: ContentChannel; destination: string; scheduledAt: string; status: DistributionStatus; mode: DistributionMode; trackingUrl: string; utm: { source: string; medium: string; campaign: string; content: string }; approvedAt?: string; executedAt?: string; externalId?: string; result?: { delivered: boolean; detail: string }; createdAt: string; updatedAt: string };
export type CreateDistributionInput = { assetId: string; channel: ContentChannel; destination: string; scheduledAt: string; targetUrl: string; campaignName: string; mode?: DistributionMode };

export type CampaignMetrics = { impressions: number; clicks: number; conversions: number; cost: number; revenue: number };
export type PerformanceRecord = { id: string; ownerId: string; campaignId: string; assetId: string; opportunityId: string; metrics: CampaignMetrics; ctr: number; conversionRate: number; cac: number | null; roi: number | null; profit: number; dataKind: EvidenceValueKind; source: string; observedAt: string; createdAt: string };
export type LearningInsight = { id: string; ownerId: string; opportunityId: string; recordIds: string[]; winnerRecordId?: string; summary: string; recommendation: string; confidence: number; dataKind: EvidenceValueKind; createdAt: string };
export type CreatePerformanceInput = { campaignId: string; metrics: CampaignMetrics; dataKind: EvidenceValueKind; source: string; observedAt: string };

export type ScalePolicy = { id: string; ownerId: string; name: string; maxTotalBudget: number; maxDailyBudget: number; maxIncreasePercent: number; minRoiPercent: number; minConversions: number; maxCac: number; requireConfirmedData: boolean; requireHumanApproval: true; liveExecutionEnabled: false; createdAt: string; updatedAt: string };
export type ScaleAction = "scale" | "hold" | "stop";
export type ScaleProposal = { id: string; ownerId: string; policyId: string; insightId: string; opportunityId: string; action: ScaleAction; rationale: string; currentBudget: number; proposedBudget: number; riskFlags: string[]; dataKind: EvidenceValueKind; status: "draft" | "approved" | "rejected" | "simulated"; createdAt: string; updatedAt: string; approvedAt?: string; simulatedAt?: string };
export type CreateScalePolicyInput = Pick<ScalePolicy, "name" | "maxTotalBudget" | "maxDailyBudget" | "maxIncreasePercent" | "minRoiPercent" | "minConversions" | "maxCac"> & { requireConfirmedData?: boolean };
export type CreateScaleProposalInput = { policyId: string; insightId: string; currentBudget: number };
