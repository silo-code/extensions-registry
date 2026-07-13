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
import { rewriteReadmeMedia } from "./lib/readme.js";

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
  // Buffers downloaded this run, keyed by version — avoids a second download
  // when the top (newest) version is also newly ingested in this same pass.
  const downloadedThisRun = new Map();

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
      // Only refresh the popularity signal and backfill fields added after
      // this version was first ingested; the pinned integrity fields
      // (sha256, tarballUrl, permissions, …) are append-only and never change.
      const count = asset?.download_count ?? existing.downloads;
      if (count !== existing.downloads) {
        existing.downloads = count;
        changed = true;
      }
      if (!existing.tag) {
        existing.tag = release.tag_name;
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
      const displayName =
        (typeof manifest.displayName === "string" && manifest.displayName.trim()) ||
        (typeof manifest.name === "string" && manifest.name.trim()) ||
        null;

      record.versions.push({
        version,
        tag: release.tag_name,
        name: displayName,
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
      downloadedThisRun.set(version, { tgz, readme });
      console.log(`✓ ${reg.id}@${version} ingested (${tgz.length} bytes)`);
    } catch (err) {
      console.error(`✗ ${reg.id}@${version}: ${err.message}`);
      failures++;
    }
  }

  record.versions.sort((a, b) => compareSemver(b.version, a.version));

  // README generation (media rewriting, display name) is a display concern,
  // not an integrity one — unlike the fields above it's safe to regenerate on
  // every run, so it self-heals if the rewrite logic changes or a field was
  // missing from an older record, without touching the pinned version data.
  const top = record.versions.find((v) => !v.yanked);
  if (top) {
    try {
      let bytes = downloadedThisRun.get(top.version)?.tgz;
      let readme = downloadedThisRun.get(top.version)?.readme;
      if (bytes === undefined) {
        bytes = await downloadAsset(top.tarballUrl, config.maxTarballBytes);
        ({ readme } = readPackage(bytes));
      }
      if (!top.name) {
        const { manifest } = readPackage(bytes);
        top.name =
          (typeof manifest.displayName === "string" && manifest.displayName.trim()) ||
          (typeof manifest.name === "string" && manifest.name.trim()) ||
          null;
        changed = true;
      }
      // `top.tag` is set either just now (new version, above) or by the
      // existing-version backfill earlier in this same loop — every release
      // in `releases` is visited every run, so by this point every version
      // still present in `releases` has a tag. It's only absent if the
      // release itself vanished upstream, in which case there's no tag to
      // build a raw/blob URL from and the README is left as last-written.
      if (readme && top.tag) {
        const rewritten = rewriteReadmeMedia(readme, {
          repo: reg.repo,
          tag: top.tag,
          path: reg.path ?? "",
        });
        mkdirSync(join(root, "readmes"), { recursive: true });
        writeFileSync(join(root, "readmes", `${reg.id}.md`), rewritten);
      }
    } catch (err) {
      console.error(`✗ ${reg.id}: README refresh failed: ${err.message}`);
      failures++;
    }
  }

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
