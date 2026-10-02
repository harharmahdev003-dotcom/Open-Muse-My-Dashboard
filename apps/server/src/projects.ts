import { randomUUID } from "node:crypto";
import type {
  AgentTask,
  Goal,
  Project,
  ProjectLink,
  ProjectNote,
  RunEvent,
} from "../../../packages/domain/src/agent.ts";
import type { Artifact } from "../../../packages/domain/src/index.ts";
import type { Store } from "./db.ts";
import { AppError } from "./errors.ts";

const now = () => new Date().toISOString();
export interface ProjectSummary extends Project {
  taskCount: number;
  openTaskCount: number;
  goalCount: number;
}

export class ProjectsService {
  constructor(private readonly db: Store) {}

  async list(owner: string): Promise<ProjectSummary[]> {
    const [projects, tasks, goals] = await Promise.all([
      this.db.list<Project>(owner, "projects"),
      this.db.list<AgentTask>(owner, "tasks"),
      this.db.list<Goal>(owner, "goals"),
    ]);
    return projects
      .map((project) => {
        const relatedTasks = tasks.filter((task) => task.projectId === project.id);
        return {
          ...project,
          taskCount: relatedTasks.length,
          openTaskCount: relatedTasks.filter(
            (task) => !["succeeded", "failed", "cancelled"].includes(task.status),
          ).length,
          goalCount: goals.filter((goal) => goal.projectId === project.id).length,
        };
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(owner: string, id: string): Promise<Project> {
    const project = await this.db.get<Project>(owner, "projects", id);
    if (!project) throw new AppError("Project not found", 404);
    return project;
  }

  async resolve(owner: string, query: string) {
    const projects = (await this.db.list<Project>(owner, "projects")).filter(
      (project) => project.status !== "archived",
    );
    const exact = projects.filter(
      (project) =>
        project.id === query ||
        project.name.trim().toLocaleLowerCase() === query.trim().toLocaleLowerCase(),
    );
    if (exact.length === 1) return { project: exact[0] };
    if (exact.length > 1)
      return { ambiguous: true as const, candidates: exact.map(({ id, name }) => ({ id, name })) };
    return { project: null };
  }

  async context(owner: string, id: string) {
    const project = await this.get(owner, id);
    const [allTasks, allGoals, allNotes, allLinks, allEvents] = await Promise.all([
      this.db.list<AgentTask>(owner, "tasks"),
      this.db.list<Goal>(owner, "goals"),
      this.db.list<ProjectNote>(owner, "project-notes"),
      this.db.list<ProjectLink>(owner, "project-links"),
      this.db.list<RunEvent>(owner, "run-events"),
    ]);
    const tasks = allTasks
      .filter((task) => task.projectId === id)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const taskIds = new Set(tasks.map((task) => task.id));
    const fileResults = await Promise.all(
      project.fileIds.slice(0, 20).map((fileId) => this.db.get<Artifact>(owner, "files", fileId)),
    );
    return {
      project,
      tasks: tasks.slice(0, 30),
      goals: allGoals.filter((goal) => goal.projectId === id).slice(0, 20),
      notes: allNotes
        .filter((note) => note.projectId === id)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 30),
      links: allLinks
        .filter((link) => link.projectId === id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 30),
      files: fileResults
        .filter((file): file is Artifact => Boolean(file))
        .map(({ url, ...file }) => file),
      activity: allEvents
        .filter((event) => taskIds.has(event.taskId))
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 30),
    };
  }

  async create(owner: string, input: { name: string; description: string; instructions: string }) {
    const stamp = now();
    const project: Project = {
      id: randomUUID(),
      ...input,
      status: "active",
      fileIds: [],
      createdAt: stamp,
      updatedAt: stamp,
    };
    await this.db.insertIfAbsent(owner, "projects", project);
    return project;
  }

  async update(
    owner: string,
    id: string,
    patch: Partial<Pick<Project, "name" | "description" | "instructions" | "status">>,
  ) {
    const project = await this.get(owner, id);
    const saved: Project = {
      ...project,
      ...patch,
      updatedAt: now(),
      ...(patch.status === "archived" ? { archivedAt: project.archivedAt ?? now() } : {}),
    };
    if (patch.status && patch.status !== "archived") delete saved.archivedAt;
    await this.db.put(owner, "projects", saved);
    return saved;
  }

  async archive(owner: string, id: string) {
    return this.update(owner, id, { status: "archived" });
  }

  async addNote(owner: string, projectId: string, input: { title: string; body: string }) {
    await this.get(owner, projectId);
    const stamp = now();
    const note: ProjectNote = {
      id: randomUUID(),
      projectId,
      ...input,
      createdAt: stamp,
      updatedAt: stamp,
    };
    await this.db.put(owner, "project-notes", note);
    return note;
  }

  async notes(owner: string, projectId: string) {
    await this.get(owner, projectId);
    return (await this.db.list<ProjectNote>(owner, "project-notes"))
      .filter((note) => note.projectId === projectId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async addLink(owner: string, projectId: string, input: { title: string; url: string }) {
    await this.get(owner, projectId);
    const url = new URL(input.url);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password)
      throw new AppError("Use a public HTTP(S) link", 422);
    const link: ProjectLink = {
      id: randomUUID(),
      projectId,
      ...input,
      url: url.href,
      createdAt: now(),
    };
    await this.db.put(owner, "project-links", link);
    return link;
  }

  async links(owner: string, projectId: string) {
    await this.get(owner, projectId);
    return (await this.db.list<ProjectLink>(owner, "project-links"))
      .filter((link) => link.projectId === projectId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async attachTask(owner: string, projectId: string, taskId: string) {
    const [project, task] = await Promise.all([
      this.get(owner, projectId),
      this.db.get<AgentTask>(owner, "tasks", taskId),
    ]);
    if (!task) throw new AppError("Task not found", 404);
    if (project.status === "archived")
      throw new AppError("Archived projects cannot accept tasks", 409);
    const updated = { ...task, projectId, updatedAt: now() };
    await this.db.put(owner, "tasks", updated);
    return updated;
  }

  async detachTask(owner: string, projectId: string, taskId: string) {
    await this.get(owner, projectId);
    const task = await this.db.get<AgentTask>(owner, "tasks", taskId);
    if (!task || task.projectId !== projectId) throw new AppError("Project task not found", 404);
    const { projectId: _projectId, ...rest } = task;
    const updated = { ...rest, updatedAt: now() };
    await this.db.put(owner, "tasks", updated);
    return updated;
  }

  async attachFile(owner: string, projectId: string, fileId: string) {
    const [project, file] = await Promise.all([
      this.get(owner, projectId),
      this.db.get<Artifact>(owner, "files", fileId),
    ]);
    if (!file) throw new AppError("File not found", 404);
    if (project.status === "archived")
      throw new AppError("Archived projects cannot accept files", 409);
    const updated = {
      ...project,
      fileIds: [...new Set([...project.fileIds, fileId])],
      updatedAt: now(),
    };
    await this.db.put(owner, "projects", updated);
    return updated;
  }

  async detachFile(owner: string, projectId: string, fileId: string) {
    const project = await this.get(owner, projectId);
    const updated = {
      ...project,
      fileIds: project.fileIds.filter((id) => id !== fileId),
      updatedAt: now(),
    };
    await this.db.put(owner, "projects", updated);
    return updated;
  }
}
