// Copyright (c) 2026 Lark Technologies Pte. Ltd.
// SPDX-License-Identifier: MIT

import assert from "node:assert/strict";
import test from "node:test";

import { mirroredPath, rewriteLocalLinks } from "./generate-umbrella-skill.mjs";

test("mirroredPath nests domains and renames entrypoints", () => {
  assert.equal(mirroredPath("skills/lark-calendar/SKILL.md"), "lark-calendar/GUIDE.md");
  assert.equal(mirroredPath("skills/lark-calendar/references/create.md"), "lark-calendar/references/create.md");
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
