import {
  ArrowUpRight,
  Check,
  Clock3,
  ExternalLink,
  FileText,
  FolderOpen,
  Plus,
  Repeat,
} from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import type { Artifact } from "../../../packages/domain/src";
import type {
  AgentTask,
  Goal,
  Project,
  ProjectLink,
  ProjectNote,
  Routine,
  RoutineStepType,
  RunEvent,
} from "../../../packages/domain/src/agent";
import { useAgentWorkspace } from "./agent-workspace";
import {
  Button,
  Card,
  Chip,
  colors,
  Empty,
  ErrorNotice,
  Field,
  LinkRow,
  SectionHeading,
  s,
} from "./ui";
import { useWorkspace } from "./workspace";

interface ProjectSummary extends Project {
  taskCount: number;
  openTaskCount: number;
  goalCount: number;
}
interface ProjectContext {
  project: Project;
  tasks: AgentTask[];
  goals: Goal[];
  notes: ProjectNote[];
  links: ProjectLink[];
  files: Artifact[];
  activity: RunEvent[];
}
interface RoutineRun {
  task: AgentTask;
  events: RunEvent[];
}
interface RoutineDetail {
  routine: Routine;
  runs: RoutineRun[];
}

function makeStepId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const stepOptions: { capability: RoutineStepType; title: string }[] = [
  { capability: "calendar.today", title: "Check today's calendar" },
  { capability: "mail.unread", title: "Review unread email" },
  { capability: "tasks.open", title: "Check open tasks" },
  { capability: "project.summary", title: "Summarize a project" },
  { capability: "daily.plan", title: "Generate a priority summary" },
];
const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const statusText = (status: string) => status.replaceAll("_", " ");
const stamp = (value?: string | null) => (value ? new Date(value).toLocaleString() : "Not run yet");

export function ProjectsScreen() {
  const { api } = useWorkspace();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [context, setContext] = useState<ProjectContext>();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      setProjects(await api.request<ProjectSummary[]>("/api/projects"));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [api]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    let current = true;
    if (!selectedId) {
      setContext(undefined);
      return () => {
        current = false;
      };
    }
    void api
      .request<ProjectContext>(`/api/projects/${selectedId}`)
      .then((next) => {
        if (current) setContext(next);
      })
      .catch((cause) => {
        if (current) setError(cause instanceof Error ? cause.message : String(cause));
      });
    return () => {
      current = false;
    };
  }, [api, selectedId]);
  async function refreshDetail() {
    await load();
    if (selectedId) setContext(await api.request<ProjectContext>(`/api/projects/${selectedId}`));
  }
  if (creating)
    return (
      <ProjectEditor
        onCancel={() => setCreating(false)}
        onSave={async (input) => {
          const project = await api.request<Project>("/api/projects", input);
          await load();
          setCreating(false);
          setSelectedId(project.id);
        }}
      />
    );
  if (selectedId && context)
    return (
      <ProjectDetailView
        context={context}
        onBack={() => {
          setSelectedId(undefined);
          setContext(undefined);
        }}
        onRefresh={refreshDetail}
      />
    );
  return (
    <View style={{ gap: 16 }}>
      <ErrorNotice error={error} />
      <Button primary icon={Plus} onPress={() => setCreating(true)}>
        New project
      </Button>
      {projects.map((project) => (
        <Pressable
          key={project.id}
          accessibilityRole="button"
          accessibilityLabel={`Open ${project.name} project`}
          onPress={() => setSelectedId(project.id)}
        >
          <Card>
            <View style={s.between}>
              <View style={[s.row, { gap: 12, flex: 1 }]}>
                <View style={[s.iconBox, { backgroundColor: colors.sky }]}>
                  <FolderOpen size={18} color={colors.text} />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={s.heading}>{project.name}</Text>
                  <Text numberOfLines={2} style={s.small}>
                    {project.description || "No description yet"}
                  </Text>
                </View>
              </View>
              <ArrowUpRight size={17} color={colors.muted} />
            </View>
            <View style={[s.row, { gap: 8, marginTop: 15, flexWrap: "wrap" }]}>
              <Chip>{statusText(project.status)}</Chip>
              <Chip>{project.openTaskCount} open tasks</Chip>
              <Chip>{project.goalCount} goals</Chip>
            </View>
          </Card>
        </Pressable>
      ))}
      {!projects.length && (
        <Empty
          icon={FolderOpen}
          title="No projects yet"
          detail="Create a project to collect its tasks, goals, notes, files, links and working instructions."
        />
      )}
    </View>
  );
}

function ProjectEditor({
  project,
  onCancel,
  onSave,
}: {
  project?: Project;
  onCancel: () => void;
  onSave: (input: Record<string, unknown>) => Promise<void>;
}) {
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [instructions, setInstructions] = useState(project?.instructions ?? "");
  const [status, setStatus] = useState<Project["status"]>(project?.status ?? "active");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    setBusy(true);
    setError("");
    try {
      await onSave({ name, description, instructions, ...(project ? { status } : {}) });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card style={{ gap: 4 }}>
      <SectionHeading title={project ? "Edit project" : "New project"} />
      <Field
        label="Project name"
        value={name}
        onChangeText={setName}
        placeholder="OpenMuse"
        maxLength={100}
      />
      <Field
        label="Description"
        value={description}
        onChangeText={setDescription}
        placeholder="What belongs in this project?"
        multiline
        maxLength={4000}
      />
      <Field
        label="Project instructions"
        value={instructions}
        onChangeText={setInstructions}
        placeholder="Guidance for tasks in this project"
        multiline
        maxLength={4000}
      />
      {project && (
        <View style={[s.row, { flexWrap: "wrap", gap: 8, marginBottom: 12 }]}>
          {(["active", "paused", "completed"] as const).map((item) => (
            <Button key={item} small primary={status === item} onPress={() => setStatus(item)}>
              {statusText(item)}
            </Button>
          ))}
        </View>
      )}
      <ErrorNotice error={error} />
      <View style={[s.row, { gap: 8 }]}>
        <Button onPress={onCancel}>Cancel</Button>
        <Button primary busy={busy} disabled={!name.trim()} onPress={() => void save()}>
          {project ? "Save changes" : "Create project"}
        </Button>
      </View>
    </Card>
  );
}

function ProjectDetailView({
  context,
  onBack,
  onRefresh,
}: {
  context: ProjectContext;
  onBack: () => void;
  onRefresh: () => Promise<void>;
}) {
  const { api, open, workspace } = useWorkspace();
  const { data, mutate } = useAgentWorkspace();
  const [editing, setEditing] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskPrompt, setTaskPrompt] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const project = context.project;
  async function action(operation: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await operation();
      await onRefresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }
  if (editing)
    return (
      <ProjectEditor
        project={project}
        onCancel={() => setEditing(false)}
        onSave={async (input) => {
          await api.request(`/api/projects/${project.id}`, input, "PATCH");
          setEditing(false);
          await onRefresh();
        }}
      />
    );
  const unassignedTasks = (data?.tasks ?? []).filter(
    (task) => !task.projectId && !["succeeded", "failed", "cancelled"].includes(task.status),
  );
  const unassignedGoals = (data?.goals ?? []).filter(
    (goal) => !goal.projectId && goal.status !== "completed",
  );
  const unattachedFiles = workspace.files.filter((file) => !project.fileIds.includes(file.id));
  return (
    <View style={{ gap: 16 }}>
      <Button small onPress={onBack}>
        ← All projects
      </Button>
      <Card>
        <View style={s.between}>
          <View style={{ flex: 1, gap: 5 }}>
            <Text style={s.title}>{project.name}</Text>
            <Text style={s.muted}>{project.description || "No description"}</Text>
          </View>
          <Chip>{statusText(project.status)}</Chip>
        </View>
        <View style={[s.row, { flexWrap: "wrap", gap: 8, marginTop: 15 }]}>
          <Button small onPress={() => setEditing(true)}>
            Edit
          </Button>
          {project.status !== "archived" && (
            <Button
              small
              danger
              busy={busy}
              onPress={() =>
                void action(() => api.request(`/api/projects/${project.id}`, {}, "DELETE"))
              }
            >
              Archive project
            </Button>
          )}
        </View>
      </Card>
      {project.instructions ? (
        <Card>
          <SectionHeading title="Project instructions" />
          <Text style={s.muted}>{project.instructions}</Text>
          <Text style={[s.small, { marginTop: 8 }]}>
            These guide project tasks and remain subordinate to OpenMuse security and approval
            rules.
          </Text>
        </Card>
      ) : null}
      <Card style={{ gap: 8 }}>
        <SectionHeading title="Tasks" />
        {context.tasks.map((task) => (
          <View
            key={task.id}
            style={[
              s.between,
              { gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.line },
            ]}
          >
            <Pressable style={{ flex: 1 }} onPress={() => open({ type: "task", taskId: task.id })}>
              <Text style={[s.text, { fontWeight: "600" }]}>{task.title}</Text>
              <Text style={s.small}>
                {statusText(task.status)} · updated {stamp(task.updatedAt)}
              </Text>
            </Pressable>
            <Button
              small
              onPress={() =>
                void action(() =>
                  api.request(`/api/projects/${project.id}/tasks/${task.id}`, {}, "DELETE"),
                )
              }
            >
              Remove
            </Button>
          </View>
        ))}
        {!context.tasks.length && <Text style={s.muted}>No tasks linked to this project yet.</Text>}
        <Field
          label="New task title"
          value={taskTitle}
          onChangeText={setTaskTitle}
          placeholder="Prepare the next release"
        />
        <Field
          label="What should OpenMuse do?"
          value={taskPrompt}
          onChangeText={setTaskPrompt}
          placeholder="Inspect open work and prepare a release checklist"
          multiline
        />
        <Button
          primary
          busy={busy}
          disabled={!taskPrompt.trim()}
          onPress={() =>
            void action(async () => {
              await api.request<AgentTask>("/api/agent/tasks", {
                title: taskTitle.trim() || undefined,
                prompt: taskPrompt.trim(),
                projectId: project.id,
                kind: "agent",
              });
              setTaskTitle("");
              setTaskPrompt("");
            })
          }
        >
          Create project task
        </Button>
        {!!unassignedTasks.length && (
          <View style={{ gap: 7, marginTop: 8 }}>
            <Text style={s.small}>Move an existing task into this project</Text>
            {unassignedTasks.slice(0, 8).map((task) => (
              <LinkRow
                key={task.id}
                title={task.title}
                detail={statusText(task.status)}
                icon={Clock3}
                onPress={() =>
                  void action(() =>
                    api.request(`/api/projects/${project.id}/tasks`, { taskId: task.id }),
                  )
                }
              />
            ))}
          </View>
        )}
      </Card>
      <Card style={{ gap: 8 }}>
        <SectionHeading title="Goals" />
        {context.goals.map((goal) => (
          <View key={goal.id} style={[s.between, { paddingVertical: 7 }]}>
            <View style={{ flex: 1 }}>
              <Text style={s.text}>{goal.title}</Text>
              <Text style={s.small}>
                {goal.milestones.filter((item) => item.done).length} of {goal.milestones.length}{" "}
                milestones · {goal.status}
              </Text>
            </View>
            <Button
              small
              onPress={() => void action(() => mutate(`/goals/${goal.id}`, { projectId: null }))}
            >
              Remove
            </Button>
          </View>
        ))}
        {!context.goals.length && <Text style={s.muted}>No goals are linked to this project.</Text>}
        {unassignedGoals.slice(0, 8).map((goal) => (
          <LinkRow
            key={goal.id}
            title={goal.title}
            detail="Add existing goal"
            icon={Check}
            onPress={() =>
              void action(() => mutate(`/goals/${goal.id}`, { projectId: project.id }))
            }
          />
        ))}
      </Card>
      <Card style={{ gap: 8 }}>
        <SectionHeading title="Notes" />
        {context.notes.map((note) => (
          <View
            key={note.id}
            style={{ gap: 4, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.line }}
          >
            <Text style={[s.text, { fontWeight: "600" }]}>{note.title}</Text>
            <Text selectable style={s.muted}>
              {note.body}
            </Text>
          </View>
        ))}
        <Field
          label="Note title"
          value={noteTitle}
          onChangeText={setNoteTitle}
          placeholder="Decision"
        />
        <Field
          label="Note"
          value={noteBody}
          onChangeText={setNoteBody}
          placeholder="Record project-specific context"
          multiline
        />
        <Button
          busy={busy}
          disabled={!noteTitle.trim() || !noteBody.trim()}
          onPress={() =>
            void action(async () => {
              await api.request(`/api/projects/${project.id}/notes`, {
                title: noteTitle,
                body: noteBody,
              });
              setNoteTitle("");
              setNoteBody("");
            })
          }
        >
          Add note
        </Button>
      </Card>
      <Card style={{ gap: 8 }}>
        <SectionHeading title="Links" />
        {context.links.map((link) => (
          <View key={link.id} style={[s.between, { gap: 8, paddingVertical: 6 }]}>
            <Pressable
              accessibilityRole="link"
              onPress={() => void Linking.openURL(link.url)}
              style={{ flex: 1 }}
            >
              <Text style={[s.text, { color: colors.blueDark }]}>{link.title}</Text>
              <Text numberOfLines={1} style={s.small}>
                {link.url}
              </Text>
            </Pressable>
            <ExternalLink size={16} color={colors.muted} />
          </View>
        ))}
        <Field
          label="Link title"
          value={linkTitle}
          onChangeText={setLinkTitle}
          placeholder="Project documentation"
        />
        <Field
          label="URL"
          value={linkUrl}
          onChangeText={setLinkUrl}
          placeholder="https://example.com"
          autoCapitalize="none"
          keyboardType="url"
        />
        <Button
          busy={busy}
          disabled={!linkTitle.trim() || !linkUrl.trim()}
          onPress={() =>
            void action(async () => {
              await api.request(`/api/projects/${project.id}/links`, {
                title: linkTitle,
                url: linkUrl,
              });
              setLinkTitle("");
              setLinkUrl("");
            })
          }
        >
          Add link
        </Button>
      </Card>
      <Card style={{ gap: 8 }}>
        <SectionHeading title="Files" />
        {context.files.map((file) => (
          <LinkRow
            key={file.id}
            title={file.name}
            detail={file.mimeType}
            icon={FileText}
            onPress={() => open({ type: "file", file })}
          />
        ))}
        {unattachedFiles.slice(0, 8).map((file) => (
          <LinkRow
            key={`attach-${file.id}`}
            title={file.name}
            detail="Attach to project"
            icon={Plus}
            onPress={() =>
              void action(() =>
                api.request(`/api/projects/${project.id}/files`, { fileId: file.id }),
              )
            }
          />
        ))}
        {!context.files.length && !unattachedFiles.length && (
          <Text style={s.muted}>Project files you attach will appear here.</Text>
        )}
      </Card>
      <Card style={{ gap: 8 }}>
        <SectionHeading title="Recent activity" />
        {context.activity.slice(0, 12).map((event) => (
          <View
            key={event.id}
            style={[s.row, { gap: 10, alignItems: "flex-start", paddingVertical: 6 }]}
          >
            <Clock3 size={14} color={colors.muted} style={{ marginTop: 3 }} />
            <View style={{ flex: 1 }}>
              <Text style={s.text}>{event.title}</Text>
              <Text style={s.small}>
                {event.detail} · {stamp(event.date)}
              </Text>
            </View>
          </View>
        ))}
        {!context.activity.length && (
          <Text style={s.muted}>Task progress and receipts appear here.</Text>
        )}
      </Card>
      <ErrorNotice error={error} />
    </View>
  );
}

export function RoutinesScreen() {
  const { api, open } = useWorkspace();
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [detail, setDetail] = useState<RoutineDetail>();
  const [editingRoutine, setEditingRoutine] = useState<Routine | undefined>();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const [nextRoutines, nextProjects] = await Promise.all([
        api.request<Routine[]>("/api/routines"),
        api.request<ProjectSummary[]>("/api/projects"),
      ]);
      setRoutines(nextRoutines);
      setProjects(nextProjects);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [api]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    let current = true;
    if (!selectedId) {
      setDetail(undefined);
      return () => {
        current = false;
      };
    }
    void api
      .request<RoutineDetail>(`/api/routines/${selectedId}`)
      .then((next) => {
        if (current) setDetail(next);
      })
      .catch((cause) => {
        if (current) setError(cause instanceof Error ? cause.message : String(cause));
      });
    return () => {
      current = false;
    };
  }, [api, selectedId]);
  async function refreshDetail() {
    await load();
    if (selectedId) setDetail(await api.request<RoutineDetail>(`/api/routines/${selectedId}`));
  }
  if (creating || editingRoutine)
    return (
      <RoutineEditor
        routine={editingRoutine}
        projects={projects}
        onCancel={() => {
          setCreating(false);
          setEditingRoutine(undefined);
        }}
        onSave={async (input) => {
          const routine = editingRoutine
            ? await api.request<Routine>(`/api/routines/${editingRoutine.id}`, input, "PATCH")
            : await api.request<Routine>("/api/routines", input);
          await load();
          setCreating(false);
          setEditingRoutine(undefined);
          setSelectedId(routine.id);
        }}
      />
    );
  if (selectedId && detail)
    return (
      <RoutineDetailView
        detail={detail}
        projects={projects}
        onBack={() => {
          setSelectedId(undefined);
          setDetail(undefined);
        }}
        onEdit={() => setEditingRoutine(detail.routine)}
        onRefresh={refreshDetail}
        onOpenTask={(taskId) => open({ type: "task", taskId })}
      />
    );
  return (
    <View style={{ gap: 16 }}>
      <ErrorNotice error={error} />
      <Button primary icon={Plus} onPress={() => setCreating(true)}>
        New routine
      </Button>
      {routines.map((routine) => (
        <Pressable
          key={routine.id}
          accessibilityRole="button"
          onPress={() => setSelectedId(routine.id)}
        >
          <Card>
            <View style={[s.row, { gap: 12 }]}>
              <View style={[s.iconBox, { backgroundColor: colors.green }]}>
                <Repeat size={17} color={colors.text} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.heading}>{routine.name}</Text>
                <Text style={s.small}>
                  {scheduleLabel(routine)} · {routine.enabled ? "Enabled" : "Disabled"}
                </Text>
              </View>
              <Chip>{routine.enabled ? "on" : "off"}</Chip>
            </View>
            <Text style={[s.small, { marginTop: 10 }]}>
              Next: {routine.enabled ? stamp(routine.nextRunAt) : "Not scheduled"} ·{" "}
              {routine.steps.length} steps
            </Text>
          </Card>
        </Pressable>
      ))}
      {!routines.length && (
        <Empty
          icon={Repeat}
          title="No routines yet"
          detail="Create a schedule for safe, repeatable checks such as calendar, unread mail, open tasks and project summaries."
        />
      )}
    </View>
  );
}

function scheduleLabel(routine: Routine) {
  const days =
    routine.schedule.frequency === "daily"
      ? "Daily"
      : routine.schedule.daysOfWeek.map((day) => dayLabels[day]).join(", ");
  return `${days} · ${routine.schedule.time} (${routine.schedule.timeZone})`;
}

function RoutineEditor({
  routine,
  projects,
  onCancel,
  onSave,
}: {
  routine?: Routine;
  projects: ProjectSummary[];
  onCancel: () => void;
  onSave: (input: Record<string, unknown>) => Promise<void>;
}) {
  const [name, setName] = useState(routine?.name ?? "");
  const [description, setDescription] = useState(routine?.description ?? "");
  const [frequency, setFrequency] = useState<"daily" | "weekly">(
    routine?.schedule.frequency ?? "daily",
  );
  const [days, setDays] = useState<number[]>(routine?.schedule.daysOfWeek ?? [1, 2, 3, 4, 5]);
  const [time, setTime] = useState(routine?.schedule.time ?? "07:30");
  const [timeZone, setTimeZone] = useState(
    routine?.schedule.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const [projectId, setProjectId] = useState(routine?.projectId ?? "");
  const [enabled, setEnabled] = useState(routine?.enabled ?? false);
  const [steps, setSteps] = useState<{ id: string; capability: RoutineStepType; title: string }[]>(
    routine?.steps.map(({ id, capability, title }) => ({ id, capability, title })) ?? [
      { ...stepOptions[2], id: makeStepId() },
      { ...stepOptions[4], id: makeStepId() },
    ],
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  function toggleDay(day: number) {
    setDays((current) =>
      current.includes(day) ? current.filter((item) => item !== day) : [...current, day].sort(),
    );
  }
  async function save() {
    setBusy(true);
    setError("");
    try {
      await onSave({
        name,
        description,
        enabled,
        schedule: { frequency, daysOfWeek: frequency === "weekly" ? days : [], time, timeZone },
        steps: steps.map(({ capability, title }) => ({ capability, title })),
        projectId: projectId || undefined,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card style={{ gap: 4 }}>
      <SectionHeading title={routine ? `Edit ${routine.name}` : "New routine"} />
      <Field
        label="Routine name"
        value={name}
        onChangeText={setName}
        placeholder="Morning routine"
        maxLength={100}
      />
      <Field
        label="Description"
        value={description}
        onChangeText={setDescription}
        placeholder="A quick start to the day"
        multiline
        maxLength={2000}
      />
      <Text style={[s.small, { marginBottom: 8 }]}>Schedule</Text>
      <View style={[s.row, { gap: 8, marginBottom: 12 }]}>
        <Button small primary={frequency === "daily"} onPress={() => setFrequency("daily")}>
          Every day
        </Button>
        <Button small primary={frequency === "weekly"} onPress={() => setFrequency("weekly")}>
          Selected days
        </Button>
      </View>
      {frequency === "weekly" && (
        <View style={[s.row, { gap: 5, flexWrap: "wrap", marginBottom: 12 }]}>
          {dayLabels.map((label, index) => (
            <Button
              key={label}
              small
              primary={days.includes(index)}
              onPress={() => toggleDay(index)}
            >
              {label}
            </Button>
          ))}
        </View>
      )}
      <Field label="Time (24-hour)" value={time} onChangeText={setTime} placeholder="07:30" />
      <Field
        label="Time zone"
        value={timeZone}
        onChangeText={setTimeZone}
        placeholder="Asia/Calcutta"
        autoCapitalize="none"
      />
      <Text style={[s.small, { marginBottom: 8 }]}>Project (optional)</Text>
      <View style={[s.row, { gap: 8, flexWrap: "wrap", marginBottom: 12 }]}>
        <Button small primary={!projectId} onPress={() => setProjectId("")}>
          No project
        </Button>
        {projects
          .filter((project) => project.status !== "archived")
          .map((project) => (
            <Button
              key={project.id}
              small
              primary={projectId === project.id}
              onPress={() => setProjectId(project.id)}
            >
              {project.name}
            </Button>
          ))}
      </View>
      <Text style={[s.small, { marginBottom: 8 }]}>
        Ordered steps · only these built-in capabilities run
      </Text>
      {steps.map((step, index) => (
        <View key={step.id} style={[s.between, { gap: 8, paddingVertical: 5 }]}>
          <Text style={[s.text, { flex: 1 }]}>
            {index + 1}. {step.title}
          </Text>
          <Button
            small
            danger
            onPress={() => setSteps((current) => current.filter((_, i) => i !== index))}
          >
            Remove
          </Button>
        </View>
      ))}
      <View style={[s.row, { gap: 7, flexWrap: "wrap", marginVertical: 10 }]}>
        {stepOptions
          .filter((option) => option.capability !== "project.summary" || projectId)
          .map((option) => (
            <Button
              key={option.capability}
              small
              onPress={() => setSteps((current) => [...current, { ...option, id: makeStepId() }])}
            >
              {option.title}
            </Button>
          ))}
      </View>
      {routine && (
        <Button small primary={enabled} onPress={() => setEnabled(!enabled)}>
          {enabled ? "Enabled" : "Disabled"} · tap to toggle
        </Button>
      )}
      {!routine && (
        <Text style={[s.small, { marginBottom: 10 }]}>
          New routines start disabled. Save, review the steps, then enable the schedule.
        </Text>
      )}
      <ErrorNotice error={error} />
      <View style={[s.row, { gap: 8 }]}>
        <Button onPress={onCancel}>Cancel</Button>
        <Button
          primary
          busy={busy}
          disabled={
            !name.trim() ||
            !steps.length ||
            (frequency === "weekly" && !days.length) ||
            (steps.some((step) => step.capability === "project.summary") && !projectId)
          }
          onPress={() => void save()}
        >
          {routine ? "Save routine" : "Create routine"}
        </Button>
      </View>
    </Card>
  );
}

function RoutineDetailView({
  detail,
  projects,
  onBack,
  onEdit,
  onRefresh,
  onOpenTask,
}: {
  detail: RoutineDetail;
  projects: ProjectSummary[];
  onBack: () => void;
  onEdit: () => void;
  onRefresh: () => Promise<void>;
  onOpenTask: (taskId: string) => void;
}) {
  const { api } = useWorkspace();
  const routine = detail.routine;
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function update(body: unknown) {
    setBusy(true);
    setError("");
    try {
      await api.request(`/api/routines/${routine.id}`, body, "PATCH");
      await onRefresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }
  async function runNow() {
    setBusy(true);
    setError("");
    try {
      const task = await api.request<AgentTask>(`/api/routines/${routine.id}/run`, {});
      await onRefresh();
      onOpenTask(task.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }
  if (editing)
    return (
      <RoutineEditor
        routine={routine}
        projects={projects}
        onCancel={() => setEditing(false)}
        onSave={async (input) => {
          await api.request(`/api/routines/${routine.id}`, input, "PATCH");
          setEditing(false);
          await onRefresh();
        }}
      />
    );
  return (
    <View style={{ gap: 16 }}>
      <Button small onPress={onBack}>
        ← All routines
      </Button>
      <Card>
        <View style={[s.row, { gap: 12 }]}>
          <View style={[s.iconBox, { backgroundColor: colors.green }]}>
            <Repeat size={18} color={colors.text} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>{routine.name}</Text>
            <Text style={s.small}>{routine.description || "No description"}</Text>
          </View>
          <Chip>{routine.enabled ? "enabled" : "disabled"}</Chip>
        </View>
        <View style={[s.row, { flexWrap: "wrap", gap: 8, marginTop: 14 }]}>
          <Chip>{scheduleLabel(routine)}</Chip>
          {routine.projectId && (
            <Chip>
              {projects.find((project) => project.id === routine.projectId)?.name ?? "Project"}
            </Chip>
          )}
        </View>
        <Text style={[s.small, { marginTop: 10 }]}>
          Next run: {routine.enabled ? stamp(routine.nextRunAt) : "Not scheduled"} · Last run:{" "}
          {stamp(routine.lastRunAt)}
        </Text>
        <View style={[s.row, { gap: 8, flexWrap: "wrap", marginTop: 12 }]}>
          <Button primary busy={busy} icon={Clock3} onPress={() => void runNow()}>
            Run now
          </Button>
          <Button small onPress={onEdit}>
            Edit steps
          </Button>
          <Button small busy={busy} onPress={() => void update({ enabled: !routine.enabled })}>
            {routine.enabled ? "Disable" : "Enable"}
          </Button>
          <Button small danger busy={busy} onPress={() => void update({ enabled: false })}>
            Pause schedule
          </Button>
        </View>
      </Card>
      <Card style={{ gap: 8 }}>
        <SectionHeading title="Steps" />
        {routine.steps.map((step, index) => (
          <View key={step.id} style={[s.row, { gap: 10, paddingVertical: 7 }]}>
            <View
              style={[
                s.iconBox,
                { width: 30, height: 30, borderRadius: 10, backgroundColor: colors.sky },
              ]}
            >
              <Text style={s.small}>{index + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.text}>{step.title}</Text>
              <Text style={s.small}>{step.capability}</Text>
            </View>
          </View>
        ))}
        <Text style={[s.small, { marginTop: 6 }]}>
          Routine steps perform read-only checks and create a saved priority summary. External
          writes still use OpenMuse review flows.
        </Text>
      </Card>
      <Card style={{ gap: 8 }}>
        <SectionHeading title="Run history" />
        {detail.runs.map(({ task, events }) => (
          <View
            key={task.id}
            style={{ borderTopWidth: 1, borderTopColor: colors.line, paddingVertical: 10, gap: 5 }}
          >
            <Pressable accessibilityRole="button" onPress={() => onOpenTask(task.id)}>
              <Text style={[s.text, { fontWeight: "600" }]}>
                {statusText(task.status)} · {stamp(task.createdAt)}
              </Text>
              <Text style={s.small}>{task.result ?? task.error ?? task.title}</Text>
            </Pressable>
            {events.slice(-3).map((event) => (
              <Text key={event.id} style={s.small}>
                • {event.title}
                {event.detail ? ` — ${event.detail}` : ""}
              </Text>
            ))}
          </View>
        ))}
        {!detail.runs.length && (
          <Text style={s.muted}>Run this routine to create its first durable Activity record.</Text>
        )}
      </Card>
      <ErrorNotice error={error} />
    </View>
  );
}

export function DailyProjectsRoutines({
  onProjects,
  onRoutines,
}: {
  onProjects: () => void;
  onRoutines: () => void;
}) {
  const { api } = useWorkspace();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  useEffect(() => {
    let current = true;
    void Promise.all([
      api.request<ProjectSummary[]>("/api/projects"),
      api.request<Routine[]>("/api/routines"),
    ])
      .then(([nextProjects, nextRoutines]) => {
        if (current) {
          setProjects(nextProjects);
          setRoutines(nextRoutines);
        }
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [api]);
  return (
    <Card style={{ gap: 7 }}>
      <View style={s.between}>
        <Text style={s.heading}>Projects & routines</Text>
        <View style={s.row}>
          <Button small onPress={onProjects}>
            Projects
          </Button>
          <Button small onPress={onRoutines}>
            Routines
          </Button>
        </View>
      </View>
      {projects
        .filter((project) => project.status === "active" && project.openTaskCount > 0)
        .slice(0, 3)
        .map((project) => (
          <Pressable
            key={project.id}
            accessibilityRole="button"
            onPress={onProjects}
            style={[s.between, { paddingVertical: 5 }]}
          >
            <Text style={s.text}>{project.name}</Text>
            <Chip>{project.openTaskCount} open</Chip>
          </Pressable>
        ))}
      {routines
        .filter((routine) => routine.enabled)
        .slice(0, 3)
        .map((routine) => (
          <View key={routine.id} style={[s.between, { paddingVertical: 5 }]}>
            <Text style={s.text}>{routine.name}</Text>
            <Text style={s.small}>
              {routine.lastRunAt
                ? `Last ${new Date(routine.lastRunAt).toLocaleTimeString()}`
                : `Next ${routine.schedule.time}`}
            </Text>
          </View>
        ))}
      {!projects.length && !routines.length && (
        <Text style={s.small}>Add a project or routine when you're ready.</Text>
      )}
    </Card>
  );
}
