# Follow-ups

Flag any tab in [Silo](https://github.com/silo-code/silo) — an editor, a terminal, a dock panel — to come back to later, **with a reason attached**.

![The Follow-ups view in the Navigator, grouped by label, next to a green-tinted terminal tab](https://raw.githubusercontent.com/silo-code/silo-extensions/follow-ups@v0.3.1/follow-ups/assets/hero.png)

You know the feeling: fifteen tabs open across four workspaces, and you can't remember which one you were waiting on a review for, which one is blocked, and which one you just meant to read. Pinning doesn't help — a pinned tab looks exactly like every other pinned tab.

A follow-up is a **color and a name**. "Blocked." "Needs review." "In progress." The tab picks up a soft tint in that color, so you spot it in a glance; the name, the note, and everything you flagged in every other workspace live in one list in the Navigator.

## What you get

- **A flag on every tab** — one button on the editor breadcrumb and on every dock panel's toolbar, terminal included. Click it to flag with your default label; click the caret beside it to pick a different one. The button stays lit while the tab is flagged.
- **Tint you can actually see** — the flagged tab washes in your label's color and the title takes it too, so eight flagged tabs no longer look identical.
- **One list, every workspace** — the Follow-ups view in the Navigator shows everything you've flagged across every open workspace. Group it by label or by workspace, click a row to jump straight to that tab, right-click to relabel, note, or clear it without leaving the list.
- **Notes** — a line of free text per follow-up. "Waiting on Ana's reply." It shows up on the row and in the tab's menu, so the reason survives longer than your memory of it does.
- **A count where you're already looking** — each workspace gets a single line in the Workspaces panel ("3 follow-ups"), opening with a dot per label in use.
- **Right-click anywhere** — Mark, Clear, and Follow-up note live on every editor, terminal, and dock panel tab's context menu, so you never have to hunt for the button.
- **Keyboard-driven if you want it** — bind any of the four commands and they act on whatever tab you're looking at.
- **It remembers** — follow-ups survive a restart. Close the tab and the flag goes with it; nothing to clean up.

## The five labels

| Color | Default name   | Default? |
| ----- | -------------- | -------- |
| amber | Need more info | ✓        |
| green | Needs review   |          |
| red   | Blocked        |          |
| blue  | In progress    |          |
| gray  | Read later     |          |

Rename and reorder them in **Settings → Extensions → Follow-ups**, and pick which one the flag button applies. There are exactly five, one per color — that's what keeps the tint tracking your theme instead of a hardcoded shade that fights it.

## Commands

| Command                  | Does                                 |
| ------------------------ | ------------------------------------ |
| `silo.follow-ups.toggle` | Flag or unflag the tab               |
| `silo.follow-ups.mark`   | Flag it with your default label      |
| `silo.follow-ups.clear`  | Remove the flag                      |
| `silo.follow-ups.note`   | Open the note editor                 |

Each acts on the tab whose button or menu you used — or, from a keyboard shortcut, the tab you're looking at. Assign shortcuts in **Settings → Keyboard Shortcuts** (search "Follow-ups").

## Requirements

Silo **0.65 or newer**.

## Permissions

None. Follow-ups are stored locally in the extension's own storage and nothing leaves your machine.

## Good to know

- The flag button appears on a surface only while that surface's breadcrumbs are turned on. The tab right-click menu always works either way.
- Upgrading from 0.2.x keeps your editor and terminal follow-ups but drops the ones on dock panels — 0.2.x couldn't identify a panel reliably across restarts, so those were disappearing on their own anyway. 0.3.0 fixes that for good.

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
npm run typecheck
npm test             # unit tests
```

`src/lib/` is pure and imports the SDK for types only, so the unit tests never load the SDK runtime. `src/ui/` holds the React components. `src/index.tsx` is wiring: registrations, binders, and panel sections.
