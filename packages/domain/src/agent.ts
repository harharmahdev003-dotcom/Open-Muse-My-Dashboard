import { z } from "zod";

export type TaskStatus =
  | "queued"
  | "running"
  | "waiting_approval"
  | "waiting_input"
  | "scheduled"
  | "paused"
  | "succeeded"
  | "failed"
  | "cancelled";
export interface Evidence {
  id: string;
  kind: "mail" | "file" | "web" | "user";
  title: string;
  excerpt: string;
  url?: string;
}
export interface TaskStep {
  id: string;
  title: string;
  status: "pending" | "running" | "succeeded" | "failed" | "waiting";
  detail?: string;
}
export interface AgentTask {
  id: string;
  title: string;
  prompt: string;
  kind: "agent" | "document" | "monitor" | "finance" | "plan" | "routine";
  status: TaskStatus;
  goalId?: string;
  projectId?: string;
  routineId?: string;
  plan: TaskStep[];
  evidence: Evidence[];
  input: Record<string, unknown>;
  state: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  nextRunAt?: string;
  leaseId?: string | null;
  leaseUntil?: string | null;
  attempts: number;
  actionId?: string | null;
  result?: string;
  error?: string | null;
  question?: string;
  artifactIds: string[];
}
export interface RunEvent {
  id: string;
  taskId: string;
  date: string;
  kind: "plan" | "step" | "observation" | "approval" | "result" | "error" | "status";
  title: string;
  detail: string;
}
export interface Goal {
  id: string;
  title: string;
  description: string;
  category: string;
  projectId?: string;
  status: "active" | "paused" | "completed";
  milestones: { id: string; title: string; done: boolean }[];
  createdAt: string;
}
export interface Monitor {
  id: string;
  taskId: string;
  title: string;
  url: string;
  condition: "change" | "contains" | "price_below";
  value: string;
  intervalMinutes: number;
  status: "active" | "paused" | "stopped";
  nextCheckAt: string;
  lastCheckedAt?: string;
  lastValue?: string;
  lastHash?: string;
  error?: string;
  checks: number;
}
export interface Idea {
  id: string;
  title: string;
  reason: string;
  evidence: Evidence[];
  prompt: string;
  kind: AgentTask["kind"];
  input: Record<string, unknown>;
  status: "new" | "dismissed" | "accepted";
  taskId?: string;
  createdAt: string;
}
export interface AgentMemory {
  id: string;
  text: string;
  source: string;
  createdAt: string;
}
export interface AgentArtifact {
  id: string;
  taskId: string;
  kind: "plan" | "comparison" | "finance" | "report";
  title: string;
  summary: string;
  data: Record<string, unknown>;
  createdAt: string;
}
export interface AgentNotification {
  id: string;
  taskId?: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
}
export interface AgentIdentity {
  name: string;
  tone: "warm" | "concise" | "thoughtful";
  avatar?: "sky" | "sand" | "lilac";
  showChatUpdates?: boolean;
}
export interface AgentWorkspace {
  tasks: AgentTask[];
  goals: Goal[];
  monitors: Monitor[];
  ideas: Idea[];
  memories: AgentMemory[];
  artifacts: AgentArtifact[];
  notifications: AgentNotification[];
  identity: AgentIdentity;
  worker: { running: boolean; lastTickAt?: string };
}

export type ProjectStatus = "active" | "paused" | "completed" | "archived";
export interface Project {
  id: string;
  name: string;
  description: string;
  instructions: string;
  status: ProjectStatus;
  fileIds: string[];
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}
export interface ProjectNote {
  id: string;
  projectId: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}
export interface ProjectLink {
  id: string;
  projectId: string;
  title: string;
  url: string;
  createdAt: string;
}
export const projectInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(4000).default(""),
  instructions: z.string().trim().max(4000).default(""),
});
export const projectPatchSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    description: z.string().trim().max(4000).optional(),
    instructions: z.string().trim().max(4000).optional(),
    status: z.enum(["active", "paused", "completed", "archived"]).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "Provide at least one project field");
export const projectNoteSchema = z.object({
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(20000),
});
export const projectLinkSchema = z.object({
  title: z.string().trim().min(1).max(160),
  url: z.url().max(4096),
});

export const routineStepTypes = [
  "calendar.today",
  "mail.unread",
  "tasks.open",
  "project.summary",
  "daily.plan",
] as const;
export type RoutineStepType = (typeof routineStepTypes)[number];
export interface RoutineStep {
  id: string;
  capability: RoutineStepType;
  title: string;
}
export interface RoutineSchedule {
  frequency: "daily" | "weekly";
  daysOfWeek: number[];
  time: string;
  timeZone: string;
}
export interface Routine {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  schedule: RoutineSchedule;
  steps: RoutineStep[];
  projectId?: string;
  createdAt: string;
  updatedAt: string;
  nextRunAt?: string | null;
  pendingRunAt?: string | null;
  lastRunAt?: string;
  lastTaskId?: string;
  lastRunStatus?: TaskStatus;
  archivedAt?: string;
}
const routineScheduleSchema = z
  .object({
    frequency: z.enum(["daily", "weekly"]),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).max(7).default([]),
    time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
    timeZone: z.string().min(1).max(100),
  })
  .superRefine((schedule, ctx) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: schedule.timeZone });
    } catch {
      ctx.addIssue({ code: "custom", message: "Choose a valid time zone", path: ["timeZone"] });
    }
    if (schedule.frequency === "weekly" && schedule.daysOfWeek.length === 0)
      ctx.addIssue({ code: "custom", message: "Choose at least one day of the week" });
    if (new Set(schedule.daysOfWeek).size !== schedule.daysOfWeek.length)
      ctx.addIssue({ code: "custom", message: "Remove duplicate days of the week" });
  });
const routineStepsSchema = z
  .array(
    z.object({
      capability: z.enum(routineStepTypes),
      title: z.string().trim().min(1).max(160),
    }),
  )
  .min(1)
  .max(12);
export const routineInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(2000).default(""),
  enabled: z.boolean().default(false),
  schedule: routineScheduleSchema,
  steps: routineStepsSchema,
  projectId: z.string().optional(),
});
export const routinePatchSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(2000).optional(),
  enabled: z.boolean().optional(),
  schedule: routineScheduleSchema.optional(),
  steps: routineStepsSchema.optional(),
  projectId: z.string().nullable().optional(),
});
export type RoutineInput = z.infer<typeof routineInputSchema>;
export type RoutinePatch = z.infer<typeof routinePatchSchema>;
export const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  prompt: z.string().trim().min(1).max(12000),
  kind: z.enum(["agent", "document", "monitor", "finance", "plan", "routine"]).default("agent"),
  goalId: z.string().optional(),
  projectId: z.string().optional(),
  input: z.record(z.string(), z.unknown()).default({}),
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export const monitorInputSchema = z
  .object({
    title: z.string().min(1).max(160),
    url: z.url().max(4096),
    condition: z.enum(["change", "contains", "price_below"]).default("change"),
    value: z.string().max(300).default(""),
    intervalMinutes: z.number().int().min(1).max(10080).default(15),
  })
  .superRefine((v, c) => {
    if (v.condition !== "change" && !v.value.trim())
      c.addIssue({ code: "custom", message: "Enter a condition value" });
    if (
      v.condition === "price_below" &&
      (!Number.isFinite(Number(v.value)) || Number(v.value) <= 0)
    )
      c.addIssue({ code: "custom", message: "Enter a positive price" });
  });
export const goalInputSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().max(4000).default(""),
  category: z.string().max(80).default("Personal"),
  projectId: z.string().optional(),
  milestones: z.array(z.string().min(1).max(200)).max(20).default([]),
});
