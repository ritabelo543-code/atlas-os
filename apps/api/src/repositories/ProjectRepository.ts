import { fileURLToPath } from "node:url";
import type { Project } from "@atlas/types";
import type { CollectionStore } from "@atlas/core";
import { createJsonStore } from "../lib/storage.js";
export type { Project } from "@atlas/types";

const projectsFile = fileURLToPath(
  new URL("../../data/projects.json", import.meta.url)
);

const initialProjects: Project[] = [
  {
    id: "atlas-os",
    name: "Atlas OS",
    description: "Uma base para organizar seu trabalho.",
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export class ProjectRepository {
  constructor(private readonly store: CollectionStore<Project> = createJsonStore(projectsFile, initialProjects)) {}

  async findAll(): Promise<Project[]> {
    return (await this.store.load()).map((project) => ({
      ...project,
      description: project.description ?? "",
      updatedAt: project.updatedAt ?? project.createdAt,
    }));
  }

  async saveAll(projects: Project[]): Promise<void> {
    await this.store.save(projects);
  }
  close(): void { this.store.close?.(); }
}
