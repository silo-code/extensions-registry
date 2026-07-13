// Build-time data access: the site builds against the compiled registry in
// ../dist (produced by `node ../scripts/build-index.js`, which runs first in
// the npm scripts — so a bare checkout builds with no extra steps).

import { readFileSync } from "node:fs";
import { join } from "node:path";

const distDir = new URL("../../../dist", import.meta.url).pathname;
const rootDir = new URL("../../..", import.meta.url).pathname;

export const config = JSON.parse(readFileSync(join(rootDir, "registry.config.json"), "utf8"));
export const index = JSON.parse(readFileSync(join(distDir, "index.json"), "utf8"));
export const advisories = JSON.parse(readFileSync(join(distDir, "advisories.json"), "utf8")).advisories;

export function extensionDetail(id) {
  return JSON.parse(readFileSync(join(distDir, "ext", `${id}.json`), "utf8"));
}

export function extensionReadme(id) {
  return readFileSync(join(distDir, "readme", `${id}.md`), "utf8");
}

export function advisoriesFor(id) {
  return advisories.filter((a) => a.id === id);
}
