# GitHub Issues

Browse open and recently closed issues for the GitHub repos in your workspace — labels, assignees, and drill-in details — without leaving Silo.

## What you get

- Side panel listing issues for every unique GitHub remote in the active workspace (worktrees of the same repo collapse into one list)
- Filters: Assigned to me (default), Created by me, All open, Recently closed
- Click a row for description, labels, assignees, milestone, and comment activity
- Close (with a reason — completed or not planned) or Reopen from the detail view
- Colored label chips, matching each label's GitHub color
- Copy issue URL, issue number, or a ready-to-paste agent prompt (`#N: Title` + description + URL) — hand a task straight to a coding agent
- Polls active and background workspaces automatically (no settings page yet — intervals aren't configurable)

## Requirements

Install the [`gh` CLI](https://cli.github.com) and run `gh auth login`.

## Installing

### From a GitHub Release

1. Go to [Releases](https://github.com/silo-code/silo-extensions/releases?q=github-issues).
2. Right-click the `.tgz` asset → **Copy link address**.
3. In Silo: **Settings → Extensions**, paste the URL and click **Install**.

### From source

```sh
git clone https://github.com/silo-code/silo-extensions
cd silo-extensions/github-issues
npm install
npm run build
```

Then in Silo: **Settings → Extensions → Install from folder**, point at this directory.

## Usage

Open the **ISSUES** panel on the right. The default filter is **Assigned to me**.
Switch filters from the header menu; **Recently closed** fetches on demand.

Click a row for details. Use **Close** or **Reopen** on the detail header to
update status (Close asks whether to mark the issue completed or not
planned; both are confirmed before they run). Use the overflow menu to copy
the issue URL, number, or a formatted prompt for an agent.

If monitoring was turned off for a workspace, use **Enable** in the panel gate
to turn it back on.

## Permissions

Declared in `package.json` under `silo.permissions`:

- **`process`** — run `gh` / `git` to resolve remotes, list issues, and check authentication

## Building

```sh
npm install
npm run build        # one-shot
npm run build:watch  # watch mode
```
