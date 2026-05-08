// Source-file editor for renaming flows and steps in the SCREENS registry.
//
// A "screen" lives across four surfaces (per the replit-cc-figma-bridge
// skill): a row in `<screensTs>`, a `<Route>` / branch in `<appTsx>`, the
// page .tsx file itself, and a row in `<screensMd>`. Renaming has to update
// all four in lockstep so the mapping stays consistent.
//
// Atomicity strategy: compute every file's new contents in memory first,
// verify the expected number of replacements happened on each surface, and
// only commit any writes once every check passes. True multi-file fs
// atomicity isn't possible in vanilla node, but this eliminates the most
// likely failure mode (format drift causing a silent no-op on one surface
// while another succeeds). If the regexes ever stop matching due to a
// code-style change, the endpoint fails LOUDLY before touching anything.
//
// Authorization: these endpoints intentionally have NO authz. They rewrite
// source files and are intended only for local single-user dev tools (like
// a Replit preview where the user owns the repo). DO NOT expose these
// endpoints in any environment where someone other than the repo owner can
// hit them.
//
// Snapshots are stored client-side only (localStorage); the client remaps
// their screenIds itself after a successful rename, using the remap map
// returned from these functions.

import { promises as fs } from "fs";
import path from "path";

export interface ScreenEditPaths {
  // Where the SCREENS registry lives, e.g. "client/src/screens.ts".
  screensTs: string;
  // App entry containing the routing branches with `// SCREEN:` anchors,
  // e.g. "client/src/App.tsx".
  appTsx: string;
  // Directory containing per-screen page .tsx files (recursively scanned
  // for `// SCREEN:` anchors), e.g. "client/src/pages".
  pagesDir: string;
  // Markdown registry mirror, e.g. "SCREENS.md".
  screensMd: string;
}

export function defaultPaths(projectRoot: string = process.cwd()): ScreenEditPaths {
  return {
    screensTs: path.join(projectRoot, "client/src/screens.ts"),
    appTsx: path.join(projectRoot, "client/src/App.tsx"),
    pagesDir: path.join(projectRoot, "client/src/pages"),
    screensMd: path.join(projectRoot, "SCREENS.md"),
  };
}

const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9 _-]{0,49}$/;

export class RenameError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function escRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function validateName(name: string, label: string): void {
  if (typeof name !== "string" || !NAME_RE.test(name)) {
    throw new RenameError(
      `${label} must be 1–50 chars, alphanumeric + spaces / hyphens / underscores`,
    );
  }
}

async function walkTsx(dir: string): Promise<string[]> {
  const out: string[] = [];
  let entries: import("fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walkTsx(full)));
    else if (e.isFile() && e.name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

async function tsxFilesWithAnchors(paths: ScreenEditPaths): Promise<string[]> {
  const pages = await walkTsx(paths.pagesDir);
  return [paths.appTsx, ...pages];
}

interface Registry {
  rows: { flow: string; step: string }[];
}

function parseRegistry(text: string): Registry {
  const rows: { flow: string; step: string }[] = [];
  const re = /\{\s*flow:\s*"([^"]+)",\s*step:\s*"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) rows.push({ flow: m[1], step: m[2] });
  return { rows };
}

function replaceAllCount(
  text: string,
  pattern: RegExp,
  replacement: string,
): { text: string; count: number } {
  let count = 0;
  const updated = text.replace(pattern, (_match, ...rest) => {
    count++;
    return replacement.replace(/\$(\d+)/g, (_, n) => {
      const idx = parseInt(n, 10) - 1;
      return (rest[idx] as string | undefined) ?? "";
    });
  });
  return { text: updated, count };
}

function renameStepInMarkdown(
  md: string,
  flow: string,
  oldStep: string,
  newStep: string,
): { text: string; idHits: number } {
  const oldId = `\`${flow}/${oldStep}\``;
  const newId = `\`${flow}/${newStep}\``;
  let idHits = 0;
  const out = md
    .split("\n")
    .map((line) => {
      if (line.includes(oldId)) {
        const stepCellRe = new RegExp(`\\| ${escRe(oldStep)}(\\s*\\|)`);
        line = line.replace(stepCellRe, `| ${newStep}$1`);
      }
      const before = line;
      const updated = line.split(oldId).join(newId);
      if (updated !== before) idHits += before.split(oldId).length - 1;
      return updated;
    })
    .join("\n");
  return { text: out, idHits };
}

function renameFlowInMarkdown(
  md: string,
  oldFlow: string,
  newFlow: string,
): { text: string; idHits: number; cellHits: number } {
  const idPrefixRe = new RegExp("`" + escRe(oldFlow) + "/", "g");
  const idStep = replaceAllCount(md, idPrefixRe, "`" + newFlow + "/");
  const flowCellRe = new RegExp(
    "^\\| " + escRe(oldFlow) + "(\\s*\\|)",
    "gm",
  );
  const cellStep = replaceAllCount(idStep.text, flowCellRe, `| ${newFlow}$1`);
  return { text: cellStep.text, idHits: idStep.count, cellHits: cellStep.count };
}

interface PlannedWrite {
  path: string;
  content: string;
}

async function commit(writes: PlannedWrite[]): Promise<void> {
  for (const w of writes) {
    await fs.writeFile(w.path, w.content, "utf-8");
  }
}

export async function renameStep(
  flow: string,
  oldStep: string,
  newStep: string,
  paths: ScreenEditPaths = defaultPaths(),
): Promise<{ remap: Record<string, string> }> {
  validateName(flow, "flow");
  validateName(oldStep, "step");
  validateName(newStep, "newStep");
  if (oldStep === newStep) return { remap: {} };

  const screensText = await fs.readFile(paths.screensTs, "utf-8");
  const { rows } = parseRegistry(screensText);
  if (!rows.some((r) => r.flow === flow && r.step === oldStep)) {
    throw new RenameError(`Screen "${flow}/${oldStep}" not found`, 404);
  }
  if (rows.some((r) => r.flow === flow && r.step === newStep)) {
    throw new RenameError(
      `A step named "${newStep}" already exists in "${flow}"`,
      409,
    );
  }

  const writes: PlannedWrite[] = [];

  // 1. screens.ts — exactly one row should match.
  const rowRe = new RegExp(
    `(\\{\\s*flow:\\s*"${escRe(flow)}",\\s*step:\\s*)"${escRe(oldStep)}"`,
    "g",
  );
  const screensPlan = replaceAllCount(screensText, rowRe, `$1"${newStep}"`);
  if (screensPlan.count !== 1) {
    throw new RenameError(
      `Expected 1 row in screens.ts for "${flow}/${oldStep}", found ${screensPlan.count}`,
      500,
    );
  }
  writes.push({ path: paths.screensTs, content: screensPlan.text });

  // 2 & 3. Anchor comments in App.tsx + any page files. The bridge skill
  // (`screen-picker.md`) requires at least one `// SCREEN:` anchor per
  // screen — above the host-component branch. Projects that also keep a
  // page-file copy of the anchor (this app does) will produce more
  // matches; we only assert ≥1 so single-anchor projects still rename.
  const anchorRe = new RegExp(
    `SCREEN:\\s*${escRe(flow)}\\s*/\\s*${escRe(oldStep)}\\s*\\(`,
    "g",
  );
  let anchorTotal = 0;
  for (const f of await tsxFilesWithAnchors(paths)) {
    const text = await fs.readFile(f, "utf-8");
    const plan = replaceAllCount(
      text,
      anchorRe,
      `SCREEN: ${flow} / ${newStep} (`,
    );
    anchorTotal += plan.count;
    if (plan.count > 0) writes.push({ path: f, content: plan.text });
  }
  if (anchorTotal < 1) {
    throw new RenameError(
      `Expected ≥1 anchor comment for "${flow} / ${oldStep}" across .tsx files, found 0. The bridge skill requires a "// SCREEN: <Flow> / <Step> (see SCREENS.md)" anchor above each branch.`,
      500,
    );
  }

  // 4. SCREENS.md — at least one screen-id mention.
  const md = await fs.readFile(paths.screensMd, "utf-8");
  const mdPlan = renameStepInMarkdown(md, flow, oldStep, newStep);
  if (mdPlan.idHits < 1) {
    throw new RenameError(
      `Expected SCREENS.md to mention "${flow}/${oldStep}", found ${mdPlan.idHits}`,
      500,
    );
  }
  writes.push({ path: paths.screensMd, content: mdPlan.text });

  await commit(writes);
  return { remap: { [`${flow}/${oldStep}`]: `${flow}/${newStep}` } };
}

export async function renameFlow(
  oldFlow: string,
  newFlow: string,
  paths: ScreenEditPaths = defaultPaths(),
): Promise<{ remap: Record<string, string> }> {
  validateName(oldFlow, "flow");
  validateName(newFlow, "newFlow");
  if (oldFlow === newFlow) return { remap: {} };

  const screensText = await fs.readFile(paths.screensTs, "utf-8");
  const { rows } = parseRegistry(screensText);
  const affected = rows.filter((r) => r.flow === oldFlow);
  if (affected.length === 0) {
    throw new RenameError(`Flow "${oldFlow}" not found`, 404);
  }
  if (rows.some((r) => r.flow === newFlow)) {
    throw new RenameError(`Flow "${newFlow}" already exists`, 409);
  }

  const writes: PlannedWrite[] = [];

  const flowRe = new RegExp(`flow:\\s*"${escRe(oldFlow)}"`, "g");
  const screensPlan = replaceAllCount(
    screensText,
    flowRe,
    `flow: "${newFlow}"`,
  );
  if (screensPlan.count !== affected.length) {
    throw new RenameError(
      `Expected ${affected.length} flow refs in screens.ts, found ${screensPlan.count}`,
      500,
    );
  }
  writes.push({ path: paths.screensTs, content: screensPlan.text });

  // Anchor comments — at least one per affected step (host-branch anchor
  // is mandatory per the bridge skill; page-file anchors are optional).
  const anchorRe = new RegExp(`SCREEN:\\s*${escRe(oldFlow)}\\s*/`, "g");
  let anchorTotal = 0;
  for (const f of await tsxFilesWithAnchors(paths)) {
    const text = await fs.readFile(f, "utf-8");
    const plan = replaceAllCount(text, anchorRe, `SCREEN: ${newFlow} /`);
    anchorTotal += plan.count;
    if (plan.count > 0) writes.push({ path: f, content: plan.text });
  }
  if (anchorTotal < affected.length) {
    throw new RenameError(
      `Expected ≥${affected.length} anchor comments for flow "${oldFlow}", found ${anchorTotal}. Each screen must have a "// SCREEN: <Flow> / <Step> (see SCREENS.md)" anchor above its branch.`,
      500,
    );
  }

  const md = await fs.readFile(paths.screensMd, "utf-8");
  const mdPlan = renameFlowInMarkdown(md, oldFlow, newFlow);
  if (mdPlan.idHits < affected.length) {
    throw new RenameError(
      `Expected ≥${affected.length} screen-id refs in SCREENS.md, found ${mdPlan.idHits}`,
      500,
    );
  }
  writes.push({ path: paths.screensMd, content: mdPlan.text });

  await commit(writes);

  const remap: Record<string, string> = {};
  for (const r of affected) {
    remap[`${oldFlow}/${r.step}`] = `${newFlow}/${r.step}`;
  }
  return { remap };
}
