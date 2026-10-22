// Copyright (c) 2026 Lark Technologies Pte. Ltd.
// SPDX-License-Identifier: MIT

import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { mirroredPath, rewriteLocalLinks } from "./generate-umbrella-skill.mjs";

test("mirroredPath nests domains and renames entrypoints", () => {
  assert.equal(mirroredPath("skills/lark-calendar/SKILL.md"), "lark-calendar/GUIDE.md");
  assert.equal(mirroredPath("skills/lark-calendar/references/create.md"), "lark-calendar/references/create.md");
});

test("umbrella long references keep readable paths and rewritten links", () => {
  const examples = [
    ["skills/lark-approval/references/lark-approval-instance-form-control-parameters.md", "lark-approval/instance-form-control-parameters.md"],
    ["skills/lark-drive/references/lark-drive-workflow-topic-move-collector-resolve-verify.md", "lark-drive/workflow-topic-move-collector-resolve-verify.md"],
  ];
  for (const [source, target] of examples) assert.equal(mirroredPath(source), target);

  const source = examples[1][0];
  assert.equal(
    rewriteLocalLinks("See [workflow](lark-drive-workflow-topic-move-collector-resolve-verify.md).", "skills/lark-drive/references/start.md", new Set([source])),
    "See [workflow](../workflow-topic-move-collector-resolve-verify.md).",
  );
});

test("mirroredPath rejects references that remain too long", () => {
  assert.throws(
    () => mirroredPath(`skills/lark-drive/references/${"x".repeat(100)}.md`),
    /exceeds suite archive limit/,
  );
});

test("generateUmbrella rejects colliding compacted paths", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "lark-umbrella-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await Promise.all([
    mkdir(path.join(root, "scripts"), { recursive: true }),
    mkdir(path.join(root, "skills/lark-approval/references"), { recursive: true }),
  ]);
  const script = path.join(root, "scripts/generate-umbrella-skill.mjs");
  await Promise.all([
    copyFile(new URL("./generate-umbrella-skill.mjs", import.meta.url), script),
    writeFile(path.join(root, "scripts/umbrella-domains.json"), JSON.stringify({ schemaVersion: 1, domains: [{ name: "lark-approval", intents: ["approval"] }] })),
    writeFile(path.join(root, "skills/lark-approval/SKILL.md"), "# Approval\n"),
    writeFile(path.join(root, "skills/lark-approval/references/lark-approval-instance-form-control-parameters.md"), "# Long reference\n"),
    writeFile(path.join(root, "skills/lark-approval/instance-form-control-parameters.md"), "# Conflicting reference\n"),
  ]);
  const { generateUmbrella } = await import(pathToFileURL(script).href);
  await assert.rejects(generateUmbrella(), /Duplicate umbrella target path/);
});

test("rewriteLocalLinks resolves cross-domain skill links", () => {
  const sources = new Set([
    "skills/lark-calendar/SKILL.md",
    "skills/lark-task/SKILL.md",
  ]);
  const input = "See [tasks](../lark-task/SKILL.md).";
  assert.equal(rewriteLocalLinks(input, "skills/lark-calendar/SKILL.md", sources), "See [tasks](../lark-task/GUIDE.md).");
});

test("rewriteLocalLinks preserves repository source references", () => {
  const input = "See [source](../../../events/im/message_receive.go).";
  assert.equal(
    rewriteLocalLinks(input, "skills/lark-event/references/event.md", new Set()),
    "See [source](https://github.com/maplezzk/lark-cli/blob/main/events/im/message_receive.go).",
  );
});
