import type { CreateTaskInput, Task, UpdateTaskInput } from "@atlas/types";
import { TaskRepository } from "../repositories/TaskRepository.js";

export class TaskService {
  constructor(private readonly repository = new TaskRepository()) {}
  list(projectId?: string): Promise<Task[]> {
    return this.repository.findAll().then((tasks) => projectId ? tasks.filter((task) => task.projectId === projectId) : tasks);
  }
  async create(projectId: string, input: CreateTaskInput): Promise<Task> {
    const now = new Date().toISOString();
    const task: Task = { id: crypto.randomUUID(), projectId, title: input.title, completed: false, priority: input.priority, dueDate: input.dueDate, createdAt: now, updatedAt: now };
    const tasks = await this.repository.findAll();
    tasks.unshift(task);
    await this.repository.saveAll(tasks);
    return task;
  }
  async update(taskId: string, input: UpdateTaskInput): Promise<Task | undefined> {
    const tasks = await this.repository.findAll();
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return undefined;
    Object.assign(task, input, { updatedAt: new Date().toISOString() });
    await this.repository.saveAll(tasks);
    return task;
  }
  async delete(taskId: string): Promise<boolean> {
    const tasks = await this.repository.findAll();
    const remaining = tasks.filter((task) => task.id !== taskId);
    if (remaining.length === tasks.length) return false;
    await this.repository.saveAll(remaining);
    return true;
  }
  async deleteByProject(projectId: string): Promise<void> {
    const tasks = await this.repository.findAll();
    await this.repository.saveAll(tasks.filter((task) => task.projectId !== projectId));
  }
}
