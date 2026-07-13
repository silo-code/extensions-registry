import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { readPackage, sha256 } from "../scripts/lib/tarball.js";

function makeTarball({ withReadme = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "registry-test-"));
  const pkgDir = join(dir, "package");
  mkdirSync(join(pkgDir, "dist"), { recursive: true });
  const manifest = {
    name: "silo-test-ext",
    version: "1.0.0",
    silo: { id: "acme.test", main: "dist/index.js" },
  };
  writeFileSync(join(pkgDir, "package.json"), JSON.stringify(manifest));
  writeFileSync(join(pkgDir, "dist", "index.js"), "export const extension = {};");
  if (withReadme) writeFileSync(join(pkgDir, "README.md"), "# Test extension\n");
  const tgz = join(dir, "pkg.tgz");
  execFileSync("tar", ["-czf", tgz, "-C", dir, "package"]);
  return { tgz, manifest };
}

test("readPackage extracts manifest and README from an npm-layout tarball", () => {
  const { tgz, manifest } = makeTarball();
  const { manifest: parsed, readme } = readPackage(readFileSync(tgz));
  assert.deepEqual(parsed, manifest);
  assert.equal(readme, "# Test extension\n");
});

test("readPackage tolerates a missing README", () => {
  const { tgz } = makeTarball({ withReadme: false });
  const { readme } = readPackage(readFileSync(tgz));
  assert.equal(readme, null);
});

test("readPackage rejects a tarball without package.json", () => {
  const dir = mkdtempSync(join(tmpdir(), "registry-test-"));
  mkdirSync(join(dir, "package"));
  writeFileSync(join(dir, "package", "other.txt"), "hi");
  const tgz = join(dir, "bad.tgz");
  execFileSync("tar", ["-czf", tgz, "-C", dir, "package"]);
  assert.throws(() => readPackage(readFileSync(tgz)), /no package\/package\.json/);
});

test("sha256 is stable", () => {
  assert.equal(
    sha256(Buffer.from("silo")),
    "30ec2f855071fb404f5ced96a5b0743d61a6adeeaacd7c6445240c5d52e18b57",
  );
});
