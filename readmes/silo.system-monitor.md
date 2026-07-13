# System Monitor

A [Silo](https://github.com/silo-code/silo) extension that keeps CPU and memory usage visible at a glance — without leaving your editor. Works on **macOS, Linux, and Windows**.

![System Monitor panel showing memory donut chart and CPU history graph](assets/screenshot.png)

## What you get

- **Side panel** — a dedicated SYSTEM tab with a memory donut chart and a scrolling CPU history graph (User vs System split)
- **Status bar readouts** — compact live counters at the bottom of the window that stay visible even when the panel is closed
- **Configurable** — choose which metrics appear, on which surfaces, and in what order via Settings or the in-panel gear icon
- **Persistent settings** — your choices are saved across restarts and apply to all workspaces automatically

## Cross-platform

The extension is a reference implementation for writing platform-aware Silo
extensions. It asks the host which OS it's running on via `ctx.system.getInfo()`
and selects a matching **collector** (`src/collectors/`) — each one a small,
unit-tested module with a pure parser:

| Platform | CPU source | Memory source | Memory donut |
| --- | --- | --- | --- |
| **macOS** | `iostat -c` | `vm_stat` + `sysctl hw.memsize` | App / Wired / Cache / Free |
| **Linux** | `/proc/stat` (read via `ctx.files`, no subprocess) | `/proc/meminfo` | Used / Cache / Free |
| **Windows** | PowerShell `Get-Counter` | PowerShell `Get-CimInstance` | Used / Free |

The CPU User/System split is preserved on all three platforms. Memory categories
differ per OS, so the donut renders whatever segments the active collector
reports rather than a fixed list. Adding a platform means adding one collector
and a case in `selectCollector` — the union type from the SDK makes a missing
case a compile error.

### Permissions

Declared in `package.json` under `silo.permissions`:

- **`process`** — run `iostat` / `vm_stat` / PowerShell on macOS and Windows.
- **`fs:read`** — read `/proc/stat` and `/proc/meminfo` on Linux (these live
  outside the workspace). Reading `/proc` rather than shelling out also avoids
  subprocess-spawn restrictions under sandboxed Linux packaging.

## Installing

### From a GitHub Release

1. Go to [Releases](https://github.com/silo-code/silo-extensions/releases?q=system-monitor).
2. Right-click the `.tgz` asset → **Copy link address**.
3. In Silo: **Settings → Extensions**, paste the URL and click **Install**.

### From source

```sh
git clone https://github.com/silo-code/silo-extensions
cd silo-extensions/system-monitor
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
