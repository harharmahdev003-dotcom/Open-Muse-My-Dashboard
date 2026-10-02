import { Hono } from "hono";
import { z } from "zod";
import {
  projectInputSchema,
  projectLinkSchema,
  projectNoteSchema,
  projectPatchSchema,
} from "../../../packages/domain/src/agent.ts";
import type { AgentService } from "./engine/service.ts";

export function projectRoutes(service: AgentService): Hono<{ Variables: { owner: string } }> {
  const app = new Hono<{ Variables: { owner: string } }>();
  app.get("/", async (c) => c.json(await service.projects.list(c.get("owner"))));
  app.post("/", async (c) =>
    c.json(
      await service.projects.create(c.get("owner"), projectInputSchema.parse(await c.req.json())),
      201,
    ),
  );
  app.get("/:id", async (c) =>
    c.json(await service.projects.context(c.get("owner"), c.req.param("id"))),
  );
  app.patch("/:id", async (c) =>
    c.json(
      await service.projects.update(
        c.get("owner"),
        c.req.param("id"),
        projectPatchSchema.parse(await c.req.json()),
      ),
    ),
  );
  // Deletion archives the project; related tasks, goals, files and notes are retained.
  app.delete("/:id", async (c) =>
    c.json(await service.projects.archive(c.get("owner"), c.req.param("id"))),
  );
  app.get("/:id/notes", async (c) =>
    c.json(await service.projects.notes(c.get("owner"), c.req.param("id"))),
  );
  app.post("/:id/notes", async (c) =>
    c.json(
      await service.projects.addNote(
        c.get("owner"),
        c.req.param("id"),
        projectNoteSchema.parse(await c.req.json()),
      ),
      201,
    ),
  );
  app.get("/:id/links", async (c) =>
    c.json(await service.projects.links(c.get("owner"), c.req.param("id"))),
  );
  app.post("/:id/links", async (c) =>
    c.json(
      await service.projects.addLink(
        c.get("owner"),
        c.req.param("id"),
        projectLinkSchema.parse(await c.req.json()),
      ),
      201,
    ),
  );
  app.post("/:id/tasks", async (c) => {
    const { taskId } = z.object({ taskId: z.string().min(1).max(200) }).parse(await c.req.json());
    return c.json(await service.projects.attachTask(c.get("owner"), c.req.param("id"), taskId));
  });
  app.delete("/:id/tasks/:taskId", async (c) =>
    c.json(
      await service.projects.detachTask(c.get("owner"), c.req.param("id"), c.req.param("taskId")),
    ),
  );
  app.post("/:id/files", async (c) => {
    const { fileId } = z.object({ fileId: z.string().min(1).max(200) }).parse(await c.req.json());
    return c.json(await service.projects.attachFile(c.get("owner"), c.req.param("id"), fileId));
  });
  app.delete("/:id/files/:fileId", async (c) =>
    c.json(
      await service.projects.detachFile(c.get("owner"), c.req.param("id"), c.req.param("fileId")),
    ),
  );
  return app;
}
