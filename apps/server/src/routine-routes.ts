import { Hono } from "hono";
import { routineInputSchema, routinePatchSchema } from "../../../packages/domain/src/agent.ts";
import type { AgentService } from "./engine/service.ts";

export function routineRoutes(service: AgentService): Hono<{ Variables: { owner: string } }> {
  const app = new Hono<{ Variables: { owner: string } }>();
  app.get("/", async (c) => c.json(await service.listRoutines(c.get("owner"))));
  app.post("/", async (c) =>
    c.json(
      await service.createRoutine(c.get("owner"), routineInputSchema.parse(await c.req.json())),
      201,
    ),
  );
  app.get("/:id", async (c) =>
    c.json(await service.routineDetail(c.get("owner"), c.req.param("id"))),
  );
  app.patch("/:id", async (c) =>
    c.json(
      await service.updateRoutine(
        c.get("owner"),
        c.req.param("id"),
        routinePatchSchema.parse(await c.req.json()),
      ),
    ),
  );
  app.delete("/:id", async (c) =>
    c.json(await service.archiveRoutine(c.get("owner"), c.req.param("id"))),
  );
  app.post("/:id/run", async (c) =>
    c.json(await service.runRoutine(c.get("owner"), c.req.param("id")), 202),
  );
  return app;
}
