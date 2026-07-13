# Silo Extension Registry

The git-backed registry behind [extensions.getsilo.dev](https://extensions.getsilo.dev).
Design: [RFC 0014](https://github.com/silo-code/silo/blob/main/docs/proposals/0014-extension-registry.md).

**The registry is data, not a service.** This repo compiles to a static JSON
index served from `registry.getsilo.dev` (GitHub Pages). The website and the
Silo app are readers of that index; the only writer is CI, and every write is
a commit — `git log` is the audit log.

## How publishing works

1. **Register once** — add `extensions/<id>.json` via PR (the
   [website form](https://extensions.getsilo.dev/publish) pre-fills it). A bot
   validates and auto-merges. The one hard rule: the id must be
   `<publisher>.<name>` where `publisher` equals the GitHub owner of your
   repo — your registry identity *is* your GitHub identity.
2. **Publish forever after** — cut a GitHub Release on your repo (tag
   `vX.Y.Z`, or `<name>@vX.Y.Z` for multi-extension repos) with the npm-pack
   `.tgz` attached. The
   [publish-extension-action](https://github.com/silo-code/publish-extension-action)
   does this on `git push --tags`. The ingest workflow here notices the
   release, validates the tarball, pins its sha256, and republishes the index.

## Layout

| Path                  | What                                                            | Written by      |
| --------------------- | --------------------------------------------------------------- | --------------- |
| `extensions/<id>.json`| Registrations (id, repo binding, description, categories)       | PRs (auto-merged) |
| `versions/<id>.json`  | Append-only version logs (tarball URL, **sha256 pin**, permissions, provenance, downloads) | CI only |
| `readmes/<id>.md`     | READMEs extracted from the newest tarball at ingest              | CI only         |
| `advisories.json`     | Kill-switch feed (`warn` / `disable`), polled by the app        | Maintainers     |
| `registry.config.json`| Schema constants: known permissions, categories, reserved namespaces, caps | Maintainers |
| `scripts/`            | `validate-registration` (PR gate), `ingest`, `build-index`      | —               |
| `dist/` (generated)   | The published registry: `index.json`, `ext/<id>.json`, `readme/<id>.md`, `llms.txt` | `npm run build` |

## Endpoints (registry.getsilo.dev)

- `/index.json` — the whole catalog (poll with `If-None-Match`; steady state is a 304)
- `/ext/<id>.json` — full version history for one extension
- `/readme/<id>.md` — version-pinned README
- `/advisories.json` — security advisories
- `/llms.txt` — agent-readable index

## Integrity model

- Version records are **append-only**; a re-tagged release with a different
  digest is rejected at ingest, never overwritten.
- The Silo app verifies the pinned sha256 before installing.
- `provenance: "attested"` means the tarball carries a verified GitHub
  build-provenance attestation (publishers get this for free via the publish
  action). Unattested versions still publish — they just don't get the badge.
- Extensions run unsandboxed (see RFC 0006's threat model): the registry
  provides *distribution* trust, not *execution* trust. Install extensions
  you trust.

## Local development

```sh
npm test                                   # unit tests (node:test, no deps)
node scripts/validate-registration.js      # validate all registrations
GITHUB_TOKEN=$(gh auth token) npm run ingest   # pull new releases locally
npm run build                              # compile dist/
```

## Reporting a malicious or broken extension

Open an issue. Maintainers can yank versions (blocks new installs) or commit
an advisory with `action: "disable"` (deactivates existing installs on next
launch) — no PR required in an incident.
