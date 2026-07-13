import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  compareSemver,
  idParts,
  parseSemver,
  permissionsWidened,
  publisherMatchesOwner,
  validateManifest,
  validateRegistration,
  versionFromTag,
} from "../scripts/lib/schema.js";

const config = JSON.parse(readFileSync(new URL("../registry.config.json", import.meta.url), "utf8"));

const goodReg = {
  id: "acme.weather",
  repo: "acme/silo-weather",
  description: "Weather in your status bar",
  categories: ["status-bar"],
  addedAt: "2026-07-13",
};

test("idParts splits publisher and name", () => {
  assert.deepEqual(idParts("acme.weather"), { publisher: "acme", name: "weather" });
  assert.deepEqual(idParts("acme.weather.pro"), { publisher: "acme", name: "weather.pro" });
  assert.equal(idParts("noseparator"), null);
  assert.equal(idParts("Acme.weather"), null); // lowercase only
  assert.equal(idParts(".weather"), null);
});

test("publisher must equal repo owner (case-insensitive)", () => {
  assert.equal(publisherMatchesOwner("acme", "Acme", {}), true);
  assert.equal(publisherMatchesOwner("acme", "someone-else", {}), false);
});

test("reserved namespaces map to their owning org", () => {
  const reserved = config.reservedNamespaces;
  assert.equal(publisherMatchesOwner("silo", "silo-code", reserved), true);
  assert.equal(publisherMatchesOwner("silo", "acme", reserved), false);
});

test("valid registration passes", () => {
  assert.deepEqual(validateRegistration(goodReg, { filename: "acme.weather.json", config }), []);
});

test("registration rejects squatting", () => {
  const errors = validateRegistration(
    { ...goodReg, id: "microsoft.weather" },
    { filename: "microsoft.weather.json", config },
  );
  assert.ok(errors.some((e) => e.includes('publisher "microsoft"')));
});

test("registration accepts an optional path and rejects an unsafe one", () => {
  assert.deepEqual(
    validateRegistration({ ...goodReg, path: "weather" }, { filename: "acme.weather.json", config }),
    [],
  );
  assert.ok(
    validateRegistration({ ...goodReg, path: "/weather" }, { filename: "acme.weather.json", config })
      .some((e) => e.includes("path must be")),
  );
  assert.ok(
    validateRegistration({ ...goodReg, path: "../escape" }, { filename: "acme.weather.json", config })
      .some((e) => e.includes("path must be")),
  );
});

test("registration enforces filename, categories, unknown fields", () => {
  assert.ok(validateRegistration(goodReg, { filename: "wrong.json", config }).length > 0);
  assert.ok(
    validateRegistration({ ...goodReg, categories: ["nope"] }, { filename: "acme.weather.json", config })
      .some((e) => e.includes("unknown category")),
  );
  assert.ok(
    validateRegistration({ ...goodReg, sneaky: true }, { filename: "acme.weather.json", config })
      .some((e) => e.includes('unknown field "sneaky"')),
  );
});

const goodManifest = {
  name: "silo-weather",
  version: "0.2.0",
  silo: { id: "acme.weather", main: "dist/index.js", engine: "^0.17.0", permissions: ["network"] },
};

test("valid manifest passes", () => {
  assert.deepEqual(validateManifest(goodManifest, { id: "acme.weather", config }), []);
});

test("manifest rejects id mismatch, bad main, unknown permission", () => {
  assert.ok(validateManifest(goodManifest, { id: "acme.other", config }).length > 0);
  for (const main of ["/abs/index.js", "C:\\x.js", "../escape.js", "dist/../../x.js"]) {
    const m = { ...goodManifest, silo: { ...goodManifest.silo, main } };
    assert.ok(validateManifest(m, { id: "acme.weather", config }).length > 0, main);
  }
  const m = { ...goodManifest, silo: { ...goodManifest.silo, permissions: ["root"] } };
  assert.ok(validateManifest(m, { id: "acme.weather", config }).some((e) => e.includes('"root"')));
});

test("versionFromTag accepts v-tags and name@v-tags", () => {
  assert.equal(versionFromTag("v1.2.3", "weather"), "1.2.3");
  assert.equal(versionFromTag("weather@v1.2.3", "weather"), "1.2.3");
  assert.equal(versionFromTag("other@v1.2.3", "weather"), null);
  assert.equal(versionFromTag("1.2.3", "weather"), null);
  assert.equal(versionFromTag("weather@vnot-semver", "weather"), null);
});

test("semver parse and compare", () => {
  assert.deepEqual(parseSemver("1.2.3"), { major: 1, minor: 2, patch: 3, pre: null });
  assert.equal(parseSemver("1.2"), null);
  assert.ok(compareSemver("0.10.0", "0.9.9") > 0);
  assert.ok(compareSemver("1.0.0-beta", "1.0.0") < 0);
  assert.equal(compareSemver("1.0.0", "1.0.0"), 0);
});

test("permissionsWidened", () => {
  assert.equal(permissionsWidened(["network"], ["network"]), false);
  assert.equal(permissionsWidened(["network"], []), false);
  assert.equal(permissionsWidened([], ["fs:read"]), true);
  assert.equal(permissionsWidened(undefined, ["fs:read"]), true);
});
