#!/usr/bin/env node
// Compile registrations + version logs + advisories into the static registry
// served from registry.getsilo.dev: dist/index.json, dist/ext/<id>.json,
// dist/readme/<id>.md, dist/advisories.json, dist/llms.txt.

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const dist = join(root, "dist");
const config = JSON.parse(readFileSync(join(root, "registry.config.json"), "utf8"));

function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}

/** `acme.weather` → "Weather" — used only when no manifest displayName exists. */
export function titleFromId(id) {
  const segment = id.slice(id.indexOf(".") + 1);
  return segment
    .split(/[-_.]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

/** Pure: assemble the index entry for one extension. Exported for tests. */
export function buildEntry(reg, record) {
  const versions = record?.versions ?? [];
  const latest = versions.find((v) => !v.yanked) ?? null;
  const status = record?.repoAvailable === false ? "unavailable" : "active";
  return {
    id: reg.id,
    name: latest?.name || titleFromId(reg.id),
    description: reg.description,
    categories: reg.categories,
    repo: reg.repo,
    status,
    ...(record?.unavailableSince ? { unavailableSince: record.unavailableSince } : {}),
    latest: latest && {
      version: latest.version,
      tarballUrl: latest.tarballUrl,
      mirrorUrl: latest.mirrorUrl,
      sha256: latest.sha256,
      size: latest.size,
      engine: latest.engine,
      permissions: latest.permissions,
      provenance: latest.provenance,
      publishedAt: latest.publishedAt,
    },
    totalDownloads: versions.reduce((sum, v) => sum + (v.downloads ?? 0), 0),
    readme: `/readme/${reg.id}.md`,
    detail: `/ext/${reg.id}.json`,
  };
}

export function buildLlmsTxt(entries, cfg) {
  const lines = [
    `# ${cfg.registryName}`,
    "",
    "> Extensions for the Silo code editor. Each entry links a machine-readable",
    "> version record and a human-readable README. Install in Silo with",
    "> `silo install <id>`; every install shows a permission-consent prompt.",
    "",
  ];
  for (const e of entries) {
    lines.push(
      `- [${e.id}](${cfg.baseUrl}${e.readme}): ${e.description} ` +
        `(permissions: ${e.latest?.permissions?.join(", ") || "none"}; ` +
        `latest: ${e.latest?.version ?? "unreleased"}; details: ${cfg.baseUrl}${e.detail})`,
    );
  }
  return `${lines.join("\n")}\n`;
}

function main() {
  rmSync(dist, { recursive: true, force: true });
  mkdirSync(join(dist, "ext"), { recursive: true });
  mkdirSync(join(dist, "readme"), { recursive: true });

  const entries = [];
  for (const file of readdirSync(join(root, "extensions")).sort()) {
    if (!file.endsWith(".json")) continue;
    const reg = readJson(join(root, "extensions", file), null);
    if (!reg) continue;
    const record = readJson(join(root, "versions", `${reg.id}.json`), null);
    entries.push(buildEntry(reg, record));

    writeFileSync(
      join(dist, "ext", `${reg.id}.json`),
      `${JSON.stringify({ ...reg, ...(record ?? { versions: [] }) }, null, 2)}\n`,
    );
    const readmePath = join(root, "readmes", `${reg.id}.md`);
    if (existsSync(readmePath)) {
      cpSync(readmePath, join(dist, "readme", `${reg.id}.md`));
    } else {
      writeFileSync(join(dist, "readme", `${reg.id}.md`), `# ${reg.id}\n\n${reg.description}\n`);
    }
  }

  const index = {
    schemaVersion: config.schemaVersion,
    name: config.registryName,
    generatedAt: new Date().toISOString(),
    extensions: entries,
  };
  writeFileSync(join(dist, "index.json"), `${JSON.stringify(index, null, 2)}\n`);
  cpSync(join(root, "advisories.json"), join(dist, "advisories.json"));
  writeFileSync(join(dist, "llms.txt"), buildLlmsTxt(entries, config));
  writeFileSync(join(dist, ".nojekyll"), "");
  writeFileSync(
    join(dist, "index.html"),
    `<!doctype html><meta charset="utf-8"><title>${config.registryName}</title>` +
      `<p>This is the data endpoint of the ${config.registryName}. ` +
      `Browse extensions at <a href="${config.websiteUrl}">${config.websiteUrl}</a> ` +
      `or fetch <a href="/index.json">index.json</a>.</p>\n`,
  );
  console.log(`built dist/ with ${entries.length} extension(s)`);
}

if (process.argv[1] === new URL(import.meta.url).pathname) main();
