# GitHub Pull Requests

Browse open and recently merged pull requests for the GitHub repos in your workspace — review state, CI checks, and drill-in details — without leaving Silo.

![PR detail view showing checks, branch, and review status](https://raw.githubusercontent.com/silo-code/silo-extensions/github-prs@v0.1.1/github-prs/assets/hero.png)

## What you get

- Side panel listing PRs for every GitHub remote in the active workspace
- Filters: My PRs (default), Needs my review, All open, Recently merged
- Click a row for CI checks, reviews, description, and activity
- At-a-glance review icons, check rollup, draft and conflict chips
- Copy PR URL, head branch, or `gh pr checkout N`
- Configurable polling for active and background workspaces

## Requirements

Install the [`gh` CLI](https://cli.github.com) and run `gh auth login`.

## Installing

### From a GitHub Release

1. Go to [Releases](https://github.com/silo-code/silo-extensions/releases?q=github-prs).
2. Right-click the `.tgz` asset → **Copy link address**.
3. In Silo: **Settings → Extensions**, paste the URL and click **Install**.

### From source

```sh
git clone https://github.com/silo-code/silo-extensions
cd silo-extensions/github-prs
npm install
npm run build
```

Then in Silo: **Settings → Extensions → Install from folder**, point at this directory.

## Usage

Open the **PRS** panel on the right. The default filter is **My PRs**. Switch filters from the header menu; **Recently merged** fetches on demand.

Click a row for details. List data shows immediately; description and activity load next. Use the overflow menu to copy the URL, branch name, or checkout command.

If monitoring was turned off for a workspace, use **Enable** in the panel gate to turn it back on.

## Settings

Open **Settings → GitHub Pull Requests**:

| Setting | Default | Description |
|---|---|---|
| Active workspace interval | 1 minute | How often to poll the active workspace |
| Inactive workspace interval | 10 minutes | How often to poll background workspaces |

## Permissions

Declared in `package.json` under `silo.permissions`:

- **`process`** — run `gh` / `git` to resolve remotes, list PRs, and check authentication

## Building

```sh
npm install
npm run build        # one-shot
npm run build:watch  # watch mode
```
