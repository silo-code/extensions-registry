// Pure validation logic for the registry — no I/O. Everything here is unit-tested.

/** Split an extension id into { publisher, name }, or null if malformed. */
export function idParts(id) {
  if (typeof id !== "string") return null;
  const m = /^([a-z0-9][a-z0-9-]*)\.([a-z0-9][a-z0-9._-]*)$/.exec(id);
  if (!m) return null;
  return { publisher: m[1], name: m[2] };
}

/**
 * The identity rule: the id's publisher segment must equal the GitHub owner
 * of the bound repo (case-insensitive), or be a reserved namespace mapped to
 * that owner.
 */
export function publisherMatchesOwner(publisher, repoOwner, reservedNamespaces = {}) {
  const owner = repoOwner.toLowerCase();
  const pub = publisher.toLowerCase();
  if (pub === owner) return true;
  return (reservedNamespaces[pub] ?? "").toLowerCase() === owner;
}

/** Validate a registration record. Returns a list of error strings (empty = valid). */
export function validateRegistration(reg, { filename, config }) {
  const errors = [];
  if (typeof reg !== "object" || reg === null || Array.isArray(reg)) {
    return ["registration must be a JSON object"];
  }

  const parts = idParts(reg.id);
  if (!parts) {
    errors.push(
      `id must be "<publisher>.<name>" (lowercase; publisher [a-z0-9-], name [a-z0-9._-]); got ${JSON.stringify(reg.id)}`,
    );
  }
  if (filename !== undefined && reg.id !== undefined && filename !== `${reg.id}.json`) {
    errors.push(`file must be named "${reg.id}.json"; got "${filename}"`);
  }

  const repoMatch = typeof reg.repo === "string" && /^([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+)$/.exec(reg.repo);
  if (!repoMatch) {
    errors.push(`repo must be "<owner>/<name>"; got ${JSON.stringify(reg.repo)}`);
  } else if (parts && !publisherMatchesOwner(parts.publisher, repoMatch[1], config.reservedNamespaces)) {
    errors.push(
      `id publisher "${parts.publisher}" must equal the GitHub owner of the bound repo ("${repoMatch[1]}")`,
    );
  }

  if (typeof reg.description !== "string" || reg.description.trim().length === 0) {
    errors.push("description is required");
  } else if (reg.description.length > config.maxDescriptionLength) {
    errors.push(`description must be <= ${config.maxDescriptionLength} chars`);
  }

  if (!Array.isArray(reg.categories) || reg.categories.length === 0) {
    errors.push("categories must be a non-empty array");
  } else {
    if (reg.categories.length > config.maxCategories) {
      errors.push(`at most ${config.maxCategories} categories`);
    }
    for (const c of reg.categories) {
      if (!config.categories.includes(c)) {
        errors.push(`unknown category "${c}" (known: ${config.categories.join(", ")})`);
      }
    }
  }

  if (typeof reg.addedAt !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(reg.addedAt)) {
    errors.push('addedAt must be a "YYYY-MM-DD" date');
  }

  if (reg.path !== undefined) {
    if (
      typeof reg.path !== "string" ||
      reg.path.startsWith("/") ||
      reg.path.split("/").includes("..")
    ) {
      errors.push('path must be a relative subdirectory (no leading "/", no "..")');
    }
  }

  const known = new Set(["id", "repo", "description", "categories", "addedAt", "path"]);
  for (const key of Object.keys(reg)) {
    if (!known.has(key)) errors.push(`unknown field "${key}"`);
  }
  return errors;
}

/**
 * Validate a package manifest (the package.json from inside a tarball)
 * against its registration. Mirrors the rules the app's ExtensionManager
 * enforces, so nothing the registry publishes can fail at install time.
 */
export function validateManifest(pkg, { id, config }) {
  const errors = [];
  const silo = pkg?.silo;
  if (typeof silo !== "object" || silo === null) return ['manifest has no "silo" key'];

  if (silo.id !== id) {
    errors.push(`manifest silo.id "${silo.id}" does not match registered id "${id}"`);
  }
  if (typeof silo.main !== "string" || silo.main.length === 0) {
    errors.push("silo.main is required");
  } else if (
    silo.main.startsWith("/") ||
    /^[A-Za-z]:/.test(silo.main) ||
    silo.main.split(/[\\/]/).includes("..")
  ) {
    errors.push(`silo.main must be a relative path without ".."; got "${silo.main}"`);
  }
  if (typeof pkg.version !== "string" || parseSemver(pkg.version) === null) {
    errors.push(`package version must be exact semver; got ${JSON.stringify(pkg.version)}`);
  }
  if (silo.permissions !== undefined) {
    if (!Array.isArray(silo.permissions)) {
      errors.push("silo.permissions must be an array");
    } else {
      for (const p of silo.permissions) {
        if (!config.knownPermissions.includes(p)) errors.push(`unknown permission "${p}"`);
      }
    }
  }
  if (silo.engine !== undefined && !/^[\^~]?\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(silo.engine)) {
    errors.push(`silo.engine must be a "^x.y.z" / "~x.y.z" / "x.y.z" range; got "${silo.engine}"`);
  }
  return errors;
}

/** Parse "x.y.z(-pre)" into comparable parts, or null. */
export function parseSemver(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(v);
  if (!m) return null;
  return { major: +m[1], minor: +m[2], patch: +m[3], pre: m[4] ?? null };
}

/** Compare two exact semver strings. Prereleases sort before their release. */
export function compareSemver(a, b) {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) return String(a).localeCompare(String(b));
  for (const k of ["major", "minor", "patch"]) {
    if (pa[k] !== pb[k]) return pa[k] - pb[k];
  }
  if (pa.pre === pb.pre) return 0;
  if (pa.pre === null) return 1;
  if (pb.pre === null) return -1;
  return pa.pre.localeCompare(pb.pre);
}

/**
 * Extract a version from a release tag for the extension `name`.
 * Accepts "v1.2.3" (single-extension repos) and "<name>@v1.2.3"
 * (multi-extension repos). Returns the version string or null.
 */
export function versionFromTag(tag, name) {
  let m = /^v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/.exec(tag);
  if (m) return m[1];
  if (tag.startsWith(`${name}@v`)) {
    const v = tag.slice(name.length + 2);
    return parseSemver(v) ? v : null;
  }
  return null;
}

/** True when `next` requests permissions that `prev` did not have. */
export function permissionsWidened(prev, next) {
  const before = new Set(prev ?? []);
  return (next ?? []).some((p) => !before.has(p));
}
