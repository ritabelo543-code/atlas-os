import type { CreateTaskInput, Task, UpdateTaskInput } from "@atlas/types";
import { TaskRepository } from "../repositories/TaskRepository.js";

export class TaskService {
  constructor(private readonly repository = new TaskRepository()) {}
  async list(ownerId: string, projectId?: string): Promise<Task[]> { return (await this.repository.findAll()).filter((task) => task.ownerId === ownerId && (!projectId || task.projectId === projectId)); }
  async create(projectId: string, input: CreateTaskInput, ownerId: string): Promise<Task> { const now = new Date().toISOString(); const task: Task = { id: crypto.randomUUID(), projectId, ownerId, title: input.title, completed: false, priority: input.priority, dueDate: input.dueDate, createdAt: now, updatedAt: now }; const tasks = await this.repository.findAll(); tasks.unshift(task); await this.repository.saveAll(tasks); return task; }
  async update(taskId: string, input: UpdateTaskInput, ownerId: string): Promise<Task | undefined> { const tasks = await this.repository.findAll(); const task = tasks.find((item) => item.id === taskId && item.ownerId === ownerId); if (!task) return undefined; Object.assign(task, input, { updatedAt: new Date().toISOString() }); await this.repository.saveAll(tasks); return task; }
  async delete(taskId: string, ownerId: string): Promise<boolean> { const tasks = await this.repository.findAll(); const remaining = tasks.filter((task) => task.id !== taskId || task.ownerId !== ownerId); if (remaining.length === tasks.length) return false; await this.repository.saveAll(remaining); return true; }
  async deleteByProject(projectId: string, ownerId: string): Promise<void> { const tasks = await this.repository.findAll(); await this.repository.saveAll(tasks.filter((task) => task.projectId !== projectId || task.ownerId !== ownerId)); }
  async claimUnowned(ownerId: string): Promise<number> { const tasks = await this.repository.findAll(); let count = 0; for (const task of tasks) if (!task.ownerId) { task.ownerId = ownerId; count++; } if (count) await this.repository.saveAll(tasks); return count; }
  close(): void { this.repository.close(); }
}
