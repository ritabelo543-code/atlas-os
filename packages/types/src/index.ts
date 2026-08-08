export const PROJECT_STATUSES = ["planning", "active", "completed"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export const TASK_PRIORITIES = ["low", "medium", "high"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export type Project = {
  id: string; name: string; description: string; status: ProjectStatus;
  createdAt: string; updatedAt: string;
};
export type Task = {
  id: string; projectId: string; title: string; completed: boolean;
  priority: TaskPriority; dueDate: string | null; createdAt: string; updatedAt: string;
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
};
export type MissionStatus = "pending" | "running" | "completed" | "failed";
export type Mission = {
  id: string; title: string; objective: string; context: string; status: MissionStatus;
  createdAt: string; updatedAt: string; decisionId: string | null;
};
export type CreateMissionInput = Pick<Mission, "title" | "objective" | "context">;
export type Decision = {
  id: string; missionId: string; recommendation: string; rationale: string;
  confidence: number; nextSteps: string[]; outcome: "recommendation" | "insufficient_data";
  knowledgeIds: string[]; provider: string; model: string; createdAt: string;
  memoryIds?: string[];
  assumptions?: string[]; evidence?: Array<{ source: string; detail: string }>; risks?: string[]; alternatives?: string[];
};
export type AuditEntry = {
  id: string; timestamp: string; module: string; action: string;
  context: Record<string, string | number | boolean | null>; result: "allowed" | "denied" | "success" | "failure";
};
export type MemoryScope = "temporary" | "persistent";
export type MemoryItem = {
  id: string; scope: MemoryScope; missionId: string | null; source: string;
  content: string; summary: string; relevance: number; confidence: number;
  tags: string[]; expiresAt: string | null; createdAt: string; updatedAt: string;
};
export type AtlasAgent = { id: string; name: "CEO Agent" | "Architect Agent" | "Developer Agent" | "Knowledge Agent" | "QA Agent"; role: string; status: "registered" | "disabled" };
export type PluginManifest = { id: string; name: string; version: string; enabled: boolean; capabilities: string[] };
export type OperationLog = AuditEntry & { severity: "info" | "warning" | "error" };
