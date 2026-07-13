#!/usr/bin/env node
// Ingest: for every registered extension, find new GitHub Releases, download
// and validate their tarballs, pin sha256 digests, and append version records.
// The only writer of versions/ and readmes/. Run by CI (cron + dispatch) or
// locally: GITHUB_TOKEN=$(gh auth token) node scripts/ingest.js [id...]

import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { downloadAsset, listReleases } from "./lib/github.js";
import { compareSemver, permissionsWidened, validateManifest, versionFromTag } from "./lib/schema.js";
import { readPackage, sha256 } from "./lib/tarball.js";

const root = new URL("..", import.meta.url).pathname;
const config = JSON.parse(readFileSync(join(root, "registry.config.json"), "utf8"));
const token = process.env.GITHUB_TOKEN || undefined;
const onlyIds = process.argv.slice(2);

/** Best-effort provenance check via the gh CLI; "none" when unverifiable. */
function verifyProvenance(tgzPath, repo) {
  try {
    execFileSync("gh", ["attestation", "verify", tgzPath, "--repo", repo], {
      stdio: "pipe",
      env: { ...process.env, GH_TOKEN: token ?? "" },
    });
    return "attested";
  } catch {
    return "none";
  }
}

function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}

let failures = 0;

for (const file of readdirSync(join(root, "extensions")).sort()) {
  if (!file.endsWith(".json")) continue;
  const reg = readJson(join(root, "extensions", file), null);
  if (!reg) continue;
  if (onlyIds.length > 0 && !onlyIds.includes(reg.id)) continue;

  const name = reg.id.slice(reg.id.indexOf(".") + 1);
  const versionsPath = join(root, "versions", `${reg.id}.json`);
  const record = readJson(versionsPath, { id: reg.id, repo: reg.repo, versions: [] });
  let changed = false;

  let releases;
  try {
    releases = await listReleases(reg.repo, token);
  } catch (err) {
    console.error(`✗ ${reg.id}: listing releases failed: ${err.message}`);
    failures++;
    continue;
  }

  // Availability: a vanished/private repo is index state, not an error.
  const available = releases !== null;
  const lastCheckedAt = new Date().toISOString();
  if (record.repoAvailable !== available) changed = true;
  record.repoAvailable = available;
  if (!available && !record.unavailableSince) record.unavailableSince = lastCheckedAt;
  if (available && record.unavailableSince) delete record.unavailableSince;
  record.lastCheckedAt = lastCheckedAt;

  for (const release of releases ?? []) {
    const version = versionFromTag(release.tag_name, name);
    if (!version) continue;
    const asset = release.assets.find((a) => a.name.endsWith(".tgz"));

    const existing = record.versions.find((v) => v.version === version);
    if (existing) {
      // Only refresh the popularity signal; pinned fields are append-only.
      const count = asset?.download_count ?? existing.downloads;
      if (count !== existing.downloads) {
        existing.downloads = count;
        changed = true;
      }
      continue;
    }

    if (!asset) {
      console.error(`✗ ${reg.id}@${version}: release has no .tgz asset — skipped`);
      failures++;
      continue;
    }

    try {
      const tgz = await downloadAsset(asset.browser_download_url, config.maxTarballBytes);
      const { manifest, readme } = readPackage(tgz);
      const errors = validateManifest(manifest, { id: reg.id, config });
      if (manifest.version !== version) {
        errors.push(`package version "${manifest.version}" does not match tag version "${version}"`);
      }
      if (errors.length > 0) {
        console.error(`✗ ${reg.id}@${version}: ${errors.join("; ")}`);
        failures++;
        continue;
      }

      const tmpPath = join(mkdirSync(join(tmpdir(), `ingest-${Date.now()}`), { recursive: true }), asset.name);
      writeFileSync(tmpPath, tgz);
      const latest = record.versions[0];

      record.versions.push({
        version,
        tarballUrl: asset.browser_download_url,
        mirrorUrl: null,
        sha256: sha256(tgz),
        size: tgz.length,
        engine: manifest.silo.engine ?? null,
        permissions: manifest.silo.permissions ?? [],
        permissionsWidened: latest ? permissionsWidened(latest.permissions, manifest.silo.permissions) : false,
        provenance: verifyProvenance(tmpPath, reg.repo),
        publishedAt: release.published_at,
        downloads: asset.download_count ?? 0,
        yanked: null,
      });
      changed = true;

      // README of the newest version wins.
      if (readme && compareSemver(version, record.versions[0].version) >= 0) {
        mkdirSync(join(root, "readmes"), { recursive: true });
        writeFileSync(join(root, "readmes", `${reg.id}.md`), readme);
      }
      console.log(`✓ ${reg.id}@${version} ingested (${tgz.length} bytes)`);
    } catch (err) {
      console.error(`✗ ${reg.id}@${version}: ${err.message}`);
      failures++;
    }
  }

  record.versions.sort((a, b) => compareSemver(b.version, a.version));
  if (changed) {
    mkdirSync(join(root, "versions"), { recursive: true });
    writeFileSync(versionsPath, `${JSON.stringify(record, null, 2)}\n`);
  }
}

// Failed individual versions shouldn't block the rest of the sweep, but CI
// should surface them.
if (failures > 0) {
  console.error(`${failures} version(s) failed ingest`);
  process.exitCode = 2;
}
