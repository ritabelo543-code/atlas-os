import type { Project, UpdateProjectInput } from "@atlas/types";
import { ProjectRepository } from "../repositories/ProjectRepository.js";

export class ProjectService {
  constructor(
    private readonly repository = new ProjectRepository()
  ) {}

  async list(): Promise<Project[]> {
    return this.repository.findAll();
  }

  async create(
    name: string,
    description: string
  ): Promise<Project> {
    const project: Project = {
      id: crypto.randomUUID(),
      name,
      description,
      status: "planning",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const projects = await this.repository.findAll();

    projects.unshift(project);

    await this.repository.saveAll(projects);

    return project;
  }

  async find(projectId: string): Promise<Project | undefined> {
    return (await this.repository.findAll()).find((project) => project.id === projectId);
  }

  async update(projectId: string, update: UpdateProjectInput): Promise<Project | undefined> {
    const projects = await this.repository.findAll();
    const project = projects.find((item) => item.id === projectId);
    if (!project) return undefined;
    if (typeof update.name === "string" && update.name.trim()) project.name = update.name.trim();
    if (typeof update.description === "string") project.description = update.description.trim();
    if (update.status === "planning" || update.status === "active" || update.status === "completed") project.status = update.status;
    project.updatedAt = new Date().toISOString();
    await this.repository.saveAll(projects);
    return project;
  }

  async delete(projectId: string): Promise<boolean> {
    const projects = await this.repository.findAll();
    const remaining = projects.filter((project) => project.id !== projectId);
    if (remaining.length === projects.length) return false;
    await this.repository.saveAll(remaining);
    return true;
  }
}
