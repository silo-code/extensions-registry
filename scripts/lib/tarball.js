// Minimal gzip+tar reading — enough to pull package.json and README.md out of
// an npm-pack tarball without any dependencies.

import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";

export function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

/**
 * Extract named entries from a gzipped tarball buffer.
 * `wanted` is a list of tar entry paths (npm layout: "package/package.json").
 * Returns a Map<path, Buffer> of the entries that were found.
 * Handles ustar long names (prefix field) and pax extended headers.
 */
export function extractEntries(tgzBuffer, wanted) {
  const tar = gunzipSync(tgzBuffer);
  const found = new Map();
  const want = new Set(wanted);
  let offset = 0;
  let paxPath = null;

  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((b) => b === 0)) break; // end-of-archive

    const readStr = (start, len) => {
      const raw = header.subarray(start, start + len);
      const end = raw.indexOf(0);
      return raw.subarray(0, end === -1 ? len : end).toString("utf8");
    };
    const size = parseInt(readStr(124, 12).trim() || "0", 8);
    const type = String.fromCharCode(header[156] || 48);
    const prefix = readStr(345, 155);
    let name = readStr(0, 100);
    if (prefix) name = `${prefix}/${name}`;
    if (paxPath !== null) {
      name = paxPath;
      paxPath = null;
    }

    const body = tar.subarray(offset + 512, offset + 512 + size);
    if (type === "x") {
      // pax extended header: records like "27 path=package/foo.js\n"
      const text = body.toString("utf8");
      const m = /(?:^|\n)\d+ path=([^\n]+)\n/.exec(text);
      if (m) paxPath = m[1];
    } else if ((type === "0" || type === "\0") && want.has(name)) {
      found.set(name, Buffer.from(body));
    }

    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return found;
}

/** Pull the manifest (package.json) and README.md out of an npm-pack tarball. */
export function readPackage(tgzBuffer) {
  const entries = extractEntries(tgzBuffer, [
    "package/package.json",
    "package/README.md",
    "package/readme.md",
  ]);
  const manifestBuf = entries.get("package/package.json");
  if (!manifestBuf) throw new Error("tarball has no package/package.json");
  const readmeBuf = entries.get("package/README.md") ?? entries.get("package/readme.md") ?? null;
  return {
    manifest: JSON.parse(manifestBuf.toString("utf8")),
    readme: readmeBuf ? readmeBuf.toString("utf8") : null,
  };
}
