import type { Task } from "@atlas/types";
import { fileURLToPath } from "node:url";
import { createJsonStore } from "../lib/storage.js";
import type { CollectionStore } from "@atlas/core";

const tasksFile = fileURLToPath(new URL("../../data/tasks.json", import.meta.url));

export class TaskRepository {
  constructor(private readonly store: CollectionStore<Task> = createJsonStore(tasksFile)) {}
  async findAll(): Promise<Task[]> {
    return (await this.store.load()).map((task) => ({
      ...task,
      priority: task.priority ?? "medium",
      dueDate: task.dueDate ?? null,
      updatedAt: task.updatedAt ?? task.createdAt,
    }));
  }
  saveAll(tasks: Task[]): Promise<void> { return this.store.save(tasks); }
  close(): void { this.store.close?.(); }
}
