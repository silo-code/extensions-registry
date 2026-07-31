# Follow-ups

A [Silo](https://github.com/silo-code/silo) extension for marking CenterDock
editor and terminal tabs to come back to later — a lightweight “I interrupted
this” flag with a Workspaces panel rollup.

## What you get

- **Toolbar toggle** — icon-only Flag on the editor/terminal breadcrumb bar
  (when breadcrumbs are on); pressed when the active tab is marked
- **Tab context menus** — “Mark as follow-up” / “Clear follow-up” on editor and
  terminal tabs (always available, including when breadcrumbs are off)
- **Tab flag** — a warn-colored Flag indicator on marked tabs
- **Workspace rollup** — a status row (`1 follow-up` / `N follow-ups`) when a
  workspace has at least one marked tab
- **Survives restart** — marks persist while the panel still exists; closing the
  tab clears that follow-up

## Permissions

None — marks are stored in extension global storage and painted via the public
toolbar / tab-adornment / workspace-status SDK surfaces.

## Installing

### From a GitHub Release

1. Go to [Releases](https://github.com/silo-code/silo-extensions/releases?q=follow-ups).
2. Right-click the `.tgz` asset → **Copy link address**.
3. In Silo: **Settings → Extensions**, paste the URL and click **Install**.

### From source

```sh
git clone https://github.com/silo-code/silo-extensions
cd silo-extensions/follow-ups
npm install
npm run build
```

Then in Silo: **Settings → Extensions → Install from folder**, point at this directory.

## Building

```sh
npm install
npm run build        # one-shot
npm run build:watch  # watch mode
npm test             # unit tests
```
