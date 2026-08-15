import type { Project, UpdateProjectInput } from "@atlas/types";
import { ProjectRepository } from "../repositories/ProjectRepository.js";

export class ProjectService {
  constructor(private readonly repository = new ProjectRepository()) {}
  async list(ownerId: string): Promise<Project[]> { return (await this.repository.findAll()).filter((project) => project.ownerId === ownerId); }
  async create(name: string, description: string, ownerId: string): Promise<Project> { const now = new Date().toISOString(); const project: Project = { id: crypto.randomUUID(), name, description, ownerId, status: "planning", createdAt: now, updatedAt: now }; const projects = await this.repository.findAll(); projects.unshift(project); await this.repository.saveAll(projects); return project; }
  async find(projectId: string, ownerId: string): Promise<Project | undefined> { return (await this.repository.findAll()).find((project) => project.id === projectId && project.ownerId === ownerId); }
  async update(projectId: string, update: UpdateProjectInput, ownerId: string): Promise<Project | undefined> { const projects = await this.repository.findAll(); const project = projects.find((item) => item.id === projectId && item.ownerId === ownerId); if (!project) return undefined; if (typeof update.name === "string" && update.name.trim()) project.name = update.name.trim(); if (typeof update.description === "string") project.description = update.description.trim(); if (update.status === "planning" || update.status === "active" || update.status === "completed") project.status = update.status; project.updatedAt = new Date().toISOString(); await this.repository.saveAll(projects); return project; }
  async delete(projectId: string, ownerId: string): Promise<boolean> { const projects = await this.repository.findAll(); const remaining = projects.filter((project) => project.id !== projectId || project.ownerId !== ownerId); if (remaining.length === projects.length) return false; await this.repository.saveAll(remaining); return true; }
  async claimUnowned(ownerId: string): Promise<number> { const projects = await this.repository.findAll(); let count = 0; for (const project of projects) if (!project.ownerId) { project.ownerId = ownerId; count++; } if (count) await this.repository.saveAll(projects); return count; }
  close(): void { this.repository.close(); }
}
