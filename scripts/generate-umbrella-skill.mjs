#!/usr/bin/env node
// Copyright (c) 2026 Lark Technologies Pte. Ltd.
// SPDX-License-Identifier: MIT

import { createHash } from "node:crypto";
import { access, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skillsRoot = path.join(repositoryRoot, "skills");
const umbrellaRoot = path.join(skillsRoot, "lark");
const referencesRoot = path.join(umbrellaRoot, "references");
const outputRoot = path.join(referencesRoot, "subskills");
const routingPath = path.join(referencesRoot, "routing.md");
const lockPath = path.join(referencesRoot, "source.lock.json");
const domainsPath = path.join(repositoryRoot, "scripts", "umbrella-domains.json");
const repositoryBlobBase = "https://github.com/maplezzk/lark-cli/blob/main/";
const localLink = /(?<!!)\[([^\]]*)\]\((?![a-z][a-z0-9+.-]*:|\/\/|#|\$|\{)([^)\s#]+)(#[^)\s]+)?\)/gi;

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function posix(value) {
  return value.split(path.sep).join("/");
}

function sourceParts(sourcePath) {
  const normalized = path.posix.normalize(sourcePath);
  const parts = normalized.split("/");
  if (normalized !== sourcePath || parts.length < 3 || parts[0] !== "skills" || !parts[1].startsWith("lark-")) {
    throw new Error(`Invalid umbrella source path: ${sourcePath}`);
  }
  return parts;
}

export function mirroredPath(sourcePath) {
  const [, skill, ...relative] = sourceParts(sourcePath);
  if (relative.at(-1) === "SKILL.md") relative[relative.length - 1] = "GUIDE.md";
  return path.posix.join(skill, ...relative);
}

function relativeTarget(sourcePath, linkedSourcePath) {
  return path.posix.relative(path.posix.dirname(mirroredPath(sourcePath)), mirroredPath(linkedSourcePath));
}

export function rewriteLocalLinks(markdown, sourcePath, sourcePaths) {
  const owningSkill = sourceParts(sourcePath)[1];
  return markdown.replace(localLink, (match, label, target, fragment = "") => {
    const linked = path.posix.normalize(path.posix.join(path.posix.dirname(sourcePath), target));
    let resolved = sourcePaths.has(linked) ? linked : null;

    if (!resolved && target.endsWith("SKILL.md")) {
      const skill = target.match(/(?:^|\/)(lark-[^/]+)\/SKILL\.md$/)?.[1];
      const canonical = skill ? `skills/${skill}/SKILL.md` : null;
      if (canonical && sourcePaths.has(canonical)) resolved = canonical;
    }

    if (!resolved) {
      const basename = path.posix.basename(linked);
      const candidates = [...sourcePaths].filter((candidate) => candidate.startsWith(`skills/${owningSkill}/`) && path.posix.basename(candidate) === basename);
      if (candidates.length === 1) resolved = candidates[0];
    }

    if (!resolved && linked !== ".." && !linked.startsWith("../") && !linked.startsWith("skills/")) {
      return `[${label}](${repositoryBlobBase}${linked}${fragment})`;
    }
    if (!resolved) return match;
    return `[${label}](${relativeTarget(sourcePath, resolved)}${fragment})`;
  });
}

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function walk(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const target = path.join(root, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Symlink is not allowed in umbrella source: ${target}`);
    if (entry.isDirectory()) files.push(...await walk(target));
    else if (entry.isFile() && entry.name !== ".DS_Store") files.push(target);
  }
  return files;
}

async function discoverSources() {
  const entries = await readdir(skillsRoot, { withFileTypes: true });
  const domains = entries.filter((entry) => entry.isDirectory() && entry.name.startsWith("lark-")).map((entry) => entry.name).sort();
  const files = [];
  for (const domain of domains) {
    const root = path.join(skillsRoot, domain);
    if (!await exists(path.join(root, "SKILL.md"))) throw new Error(`Missing SKILL.md for ${domain}`);
    for (const file of await walk(root)) files.push({
      sourcePath: posix(path.relative(repositoryRoot, file)),
      content: await readFile(file),
    });
  }
  return { domains, files };
}

function validateManifest(manifest, discoveredDomains) {
  if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest.domains)) throw new Error("Invalid umbrella domains manifest");
  const names = manifest.domains.map(({ name }) => name);
  if (new Set(names).size !== names.length) throw new Error("Duplicate umbrella domain");
  if (JSON.stringify([...names].sort()) !== JSON.stringify(discoveredDomains)) throw new Error("Umbrella domain manifest does not cover all skills/lark-* sources");
  for (const domain of manifest.domains) {
    if (!Array.isArray(domain.intents) || domain.intents.length === 0) throw new Error(`Missing intents for ${domain.name}`);
    for (const dependency of domain.requires ?? []) {
      if (!names.includes(dependency)) throw new Error(`Unknown dependency ${dependency} for ${domain.name}`);
    }
  }
  return manifest;
}

function renderRouting(manifest) {
  const format = (values, fallback = "—") => values?.join("；") || fallback;
  const userDomains = manifest.domains.filter(({ internal }) => !internal).sort((left, right) => left.name.localeCompare(right.name));
  const internalDomains = manifest.domains.filter(({ internal }) => internal).sort((left, right) => left.name.localeCompare(right.name));
  const rows = userDomains.map((domain) => `| [\`${domain.name}\`](subskills/${domain.name}/GUIDE.md) | ${format(domain.intents)} | ${format(domain.notFor)} | ${format(domain.requires)} |`);
  const internalRows = internalDomains.map((domain) => `| [\`${domain.name}\`](subskills/${domain.name}/GUIDE.md) | ${format(domain.intents)} |`);
  return `# Lark domain routing\n\n先选择覆盖当前执行步骤的最小 domain 集合，再读取对应 \`GUIDE.md\`；不要预读其他 domain。\n\n## User-facing domains\n\n| Domain | Use for | Do not use for | Required domains |\n| --- | --- | --- | --- |\n${rows.join("\n")}\n\n## Internal support domains\n\n仅在当前步骤确实涉及对应支持能力时加载。\n\n| Domain | Use for |\n| --- | --- |\n${internalRows.join("\n")}\n`;
}

async function treeMap(root) {
  if (!await exists(root)) return new Map();
  const result = new Map();
  for (const file of await walk(root)) result.set(posix(path.relative(root, file)), await readFile(file));
  return result;
}

function assertSameTree(expected, actual, label) {
  const expectedNames = [...expected.keys()].sort();
  const actualNames = [...actual.keys()].sort();
  if (JSON.stringify(expectedNames) !== JSON.stringify(actualNames)) throw new Error(`${label} file set is stale`);
  for (const name of expectedNames) {
    if (!expected.get(name).equals(actual.get(name))) throw new Error(`${label} content is stale: ${name}`);
  }
}

async function validateLocalLinks(root) {
  for (const file of await walk(root)) {
    if (path.extname(file).toLowerCase() !== ".md") continue;
    const content = await readFile(file, "utf8");
    for (const match of content.matchAll(localLink)) {
      const target = match[2];
      if (!target.includes("/") && path.posix.extname(target) === "") continue;
      const resolved = path.resolve(path.dirname(file), target);
      if (!resolved.startsWith(`${path.resolve(root)}${path.sep}`) || !await exists(resolved)) {
        throw new Error(`Broken local link in ${posix(path.relative(root, file))}: ${target}`);
      }
    }
  }
}

async function buildStaging(staging, sources) {
  const sourcePaths = new Set(sources.files.map(({ sourcePath }) => sourcePath));
  const records = [];
  for (const file of sources.files) {
    const targetPath = mirroredPath(file.sourcePath);
    const output = path.extname(file.sourcePath).toLowerCase() === ".md"
      ? Buffer.from(rewriteLocalLinks(file.content.toString("utf8"), file.sourcePath, sourcePaths))
      : file.content;
    const target = path.join(staging, ...targetPath.split("/"));
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, output);
    records.push({
      sourcePath: file.sourcePath,
      targetPath,
      sourceSha256: sha256(file.content),
      outputSha256: sha256(output),
    });
  }
  await validateLocalLinks(staging);
  const sourceDigest = sha256(JSON.stringify(records.map(({ sourcePath, sourceSha256 }) => ({ sourcePath, sourceSha256 }))));
  const bundleDigest = sha256(JSON.stringify(records.map(({ targetPath, outputSha256 }) => ({ targetPath, outputSha256 }))));
  return { records, sourceDigest, bundleDigest };
}

export async function generateUmbrella({ check = false } = {}) {
  const sources = await discoverSources();
  const manifest = validateManifest(JSON.parse(await readFile(domainsPath, "utf8")), sources.domains);
  await mkdir(referencesRoot, { recursive: true });
  const staging = await mkdtemp(path.join(referencesRoot, ".subskills-staging-"));
  try {
    const result = await buildStaging(staging, sources);
    const routing = renderRouting(manifest);
    const lock = `${JSON.stringify({
      schemaVersion: 1,
      source: "skills/lark-*",
      skills: sources.domains,
      sourceSha256: result.sourceDigest,
      bundleSha256: result.bundleDigest,
      files: result.records,
    }, null, 2)}\n`;

    if (check) {
      assertSameTree(await treeMap(staging), await treeMap(outputRoot), "umbrella subskills");
      if (!await exists(routingPath) || await readFile(routingPath, "utf8") !== routing) throw new Error("umbrella routing is stale");
      if (!await exists(lockPath) || await readFile(lockPath, "utf8") !== lock) throw new Error("umbrella source lock is stale");
      return { status: "verified", domains: sources.domains.length, files: result.records.length };
    }

    const backup = path.join(referencesRoot, ".subskills-backup");
    await rm(backup, { recursive: true, force: true });
    if (await exists(outputRoot)) await rename(outputRoot, backup);
    try {
      await rename(staging, outputRoot);
    } catch (error) {
      if (await exists(backup)) await rename(backup, outputRoot);
      throw error;
    }
    await rm(backup, { recursive: true, force: true });
    await writeFile(routingPath, routing);
    await writeFile(lockPath, lock);
    return { status: "generated", domains: sources.domains.length, files: result.records.length };
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const unknown = process.argv.slice(2).filter((arg) => arg !== "--check");
  if (unknown.length > 0) throw new Error(`Unknown arguments: ${unknown.join(", ")}`);
  const result = await generateUmbrella({ check: process.argv.includes("--check") });
  console.log(`Umbrella skill ${result.status}: ${result.domains} domains, ${result.files} files.`);
}
