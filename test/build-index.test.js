import assert from "node:assert/strict";
import { test } from "node:test";
import { buildEntry, buildLlmsTxt, titleFromId } from "../scripts/build-index.js";

const reg = {
  id: "acme.weather",
  repo: "acme/silo-weather",
  description: "Weather in your status bar",
  categories: ["status-bar"],
  addedAt: "2026-07-13",
};

const version = (v, extra = {}) => ({
  version: v,
  tag: `v${v}`,
  name: null,
  tarballUrl: `https://example.com/${v}.tgz`,
  mirrorUrl: null,
  sha256: "abc",
  size: 1,
  engine: "^0.17.0",
  permissions: ["network"],
  permissionsWidened: false,
  provenance: "none",
  publishedAt: "2026-07-13T00:00:00Z",
  downloads: 10,
  yanked: null,
  ...extra,
});

test("buildEntry picks the newest non-yanked version as latest", () => {
  const record = { repoAvailable: true, versions: [version("0.3.0", { yanked: { at: "x", reason: "bad" } }), version("0.2.0")] };
  const entry = buildEntry(reg, record);
  assert.equal(entry.latest.version, "0.2.0");
  assert.equal(entry.status, "active");
  assert.equal(entry.totalDownloads, 20);
});

test("buildEntry handles no versions and unavailable repos", () => {
  assert.equal(buildEntry(reg, null).latest, null);
  const entry = buildEntry(reg, { repoAvailable: false, unavailableSince: "2026-07-01T00:00:00Z", versions: [] });
  assert.equal(entry.status, "unavailable");
  assert.equal(entry.unavailableSince, "2026-07-01T00:00:00Z");
});

test("buildEntry prefers the manifest display name, falling back to a title-cased id", () => {
  const withName = buildEntry(reg, { repoAvailable: true, versions: [version("1.0.0", { name: "Weather Pro" })] });
  assert.equal(withName.name, "Weather Pro");

  const withoutName = buildEntry(reg, { repoAvailable: true, versions: [version("1.0.0")] });
  assert.equal(withoutName.name, "Weather");

  assert.equal(buildEntry(reg, null).name, "Weather");
});

test("titleFromId title-cases the name segment", () => {
  assert.equal(titleFromId("acme.weather"), "Weather");
  assert.equal(titleFromId("silo.system-monitor"), "System Monitor");
  assert.equal(titleFromId("silo.docs-panel"), "Docs Panel");
});

test("llms.txt lists each extension with permissions and links", () => {
  const cfg = { registryName: "Test Registry", baseUrl: "https://r.example" };
  const txt = buildLlmsTxt([buildEntry(reg, { repoAvailable: true, versions: [version("0.2.0")] })], cfg);
  assert.match(txt, /# Test Registry/);
  assert.match(txt, /\[acme\.weather\]\(https:\/\/r\.example\/readme\/acme\.weather\.md\)/);
  assert.match(txt, /permissions: network/);
});
