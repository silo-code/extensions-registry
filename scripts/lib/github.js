// Thin GitHub REST helpers. Token comes from GITHUB_TOKEN (Actions) or
// `gh auth token` locally; unauthenticated works for light use.

const API = "https://api.github.com";

function headers(token) {
  const h = {
    accept: "application/vnd.github+json",
    "user-agent": "silo-extensions-registry",
    "x-github-api-version": "2022-11-28",
  };
  if (token) h.authorization = `Bearer ${token}`;
  return h;
}

/** GET a JSON API path. Returns { status, body } — 404 is not an error. */
export async function ghJson(path, token) {
  const res = await fetch(`${API}${path}`, { headers: headers(token) });
  if (res.status === 404) return { status: 404, body: null };
  if (!res.ok) throw new Error(`GitHub API ${path} → ${res.status} ${await res.text()}`);
  return { status: res.status, body: await res.json() };
}

/** All non-draft releases for a repo (paginated). null if the repo is gone. */
export async function listReleases(repo, token) {
  const releases = [];
  for (let page = 1; page <= 10; page++) {
    const { status, body } = await ghJson(`/repos/${repo}/releases?per_page=100&page=${page}`, token);
    if (status === 404) return null;
    releases.push(...body.filter((r) => !r.draft));
    if (body.length < 100) break;
  }
  return releases;
}

/** Download a release asset (follows redirects). Enforces a size cap. */
export async function downloadAsset(url, maxBytes) {
  const res = await fetch(url, { headers: { "user-agent": "silo-extensions-registry" } });
  if (!res.ok) throw new Error(`download ${url} → ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > maxBytes) {
    throw new Error(`tarball is ${buffer.length} bytes; cap is ${maxBytes}`);
  }
  return buffer;
}
