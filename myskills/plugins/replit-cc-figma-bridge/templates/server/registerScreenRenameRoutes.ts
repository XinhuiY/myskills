// Express route registration for the screen rename endpoints. Mounts:
//
//   POST /api/screens/rename-flow   { flow, newFlow }
//   POST /api/screens/rename-step   { flow, step, newStep }
//
// Both return { ok: true, remap: Record<oldId, newId> } on success.
// `remap` is what the client needs to update any localStorage snapshots
// whose `screenId` embedded the old flow/step name.
//
// Pass custom `paths` if your project layout differs from the bridge skill
// defaults (`client/src/screens.ts`, `client/src/App.tsx`,
// `client/src/pages`, `SCREENS.md`).
//
// SECURITY: these endpoints rewrite source files with no authz. Only mount
// them in a local single-user dev tool. Gate or omit in production.

import type { Express, Request, Response } from "express";
import {
  renameFlow,
  renameStep,
  RenameError,
  defaultPaths,
  type ScreenEditPaths,
} from "./screensEdit";

export function registerScreenRenameRoutes(
  app: Express,
  paths: ScreenEditPaths = defaultPaths(),
): void {
  app.post("/api/screens/rename-flow", async (req: Request, res: Response) => {
    try {
      const { flow, newFlow } = req.body ?? {};
      const result = await renameFlow(flow, newFlow, paths);
      res.json({ ok: true, ...result });
    } catch (err) {
      if (err instanceof RenameError) {
        res.status(err.status).json({ ok: false, message: err.message });
      } else {
        // eslint-disable-next-line no-console
        console.error("rename-flow failed:", err);
        res.status(500).json({ ok: false, message: "Rename failed" });
      }
    }
  });

  app.post("/api/screens/rename-step", async (req: Request, res: Response) => {
    try {
      const { flow, step, newStep } = req.body ?? {};
      const result = await renameStep(flow, step, newStep, paths);
      res.json({ ok: true, ...result });
    } catch (err) {
      if (err instanceof RenameError) {
        res.status(err.status).json({ ok: false, message: err.message });
      } else {
        // eslint-disable-next-line no-console
        console.error("rename-step failed:", err);
        res.status(500).json({ ok: false, message: "Rename failed" });
      }
    }
  });
}
