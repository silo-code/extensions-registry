#!/usr/bin/env node
// PR gate: validate registration files. With --base <ref> it checks only the
// files the PR touches AND enforces that the PR touches nothing else (that is
// what makes bot auto-merge safe). Without --base it validates every
// registration (used by tests / manual runs).

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { validateRegistration } from "./lib/schema.js";

const root = new URL("..", import.meta.url).pathname;
const config = JSON.parse(readFileSync(join(root, "registry.config.json"), "utf8"));

const baseIdx = process.argv.indexOf("--base");
const base = baseIdx === -1 ? null : process.argv[baseIdx + 1];

let files;
let failed = false;

if (base) {
  const diff = execFileSync("git", ["diff", "--name-status", `${base}...HEAD`], { cwd: root })
    .toString("utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [status, ...paths] = line.split("\t");
      return { status: status[0], path: paths[paths.length - 1] };
    });

  for (const { status, path } of diff) {
    if (!path.startsWith("extensions/") || !path.endsWith(".json")) {
      console.error(`✗ PR touches "${path}" — registration PRs may only add files under extensions/`);
      failed = true;
    } else if (status !== "A") {
      console.error(`✗ "${path}" is ${status === "M" ? "modified" : "deleted"} — registrations are add-only; changes need maintainer review`);
      failed = true;
    }
  }
  files = diff.filter((d) => d.path.startsWith("extensions/") && d.status === "A").map((d) => d.path);
} else {
  files = readdirSync(join(root, "extensions"))
    .filter((f) => f.endsWith(".json"))
    .map((f) => `extensions/${f}`);
}

for (const file of files) {
  let reg;
  try {
    reg = JSON.parse(readFileSync(join(root, file), "utf8"));
  } catch (err) {
    console.error(`✗ ${file}: not valid JSON (${err.message})`);
    failed = true;
    continue;
  }
  const errors = validateRegistration(reg, { filename: basename(file), config });
  if (errors.length > 0) {
    for (const e of errors) console.error(`✗ ${file}: ${e}`);
    failed = true;
  } else {
    console.log(`✓ ${file}`);
  }
}

if (failed) process.exit(1);
console.log(`${files.length} registration(s) valid`);
