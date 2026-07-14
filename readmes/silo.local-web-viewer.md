# Local Web Viewer

A [Silo](https://github.com/silo-code/silo) extension that embeds local web content — dev servers, `file://` HTML, and internal tools — as dock panels alongside your code.

## What it's for

The Local Web Viewer is designed for **localhost browsing**. Use it to keep your running dev server, component storybook, local docs, or `file://` HTML pages in view without leaving Silo. Multiple panels can be open simultaneously, each pinned to a different URL.

It is **not** a general-purpose browser. Most production websites block iframe embedding via `X-Frame-Options` or CSP `frame-ancestors`, and those will show a "doesn't allow embedding" overlay instead of loading. The panel will offer to open blocked URLs in your default browser instead.

## Back/forward navigation

The panel tracks in-frame navigation — including SPA client-side routing (React Router, Vue Router, etc.) — via the `ctx.webview` bridge's navigation events, and maintains its own history stack (persisted across workspace switches and app restarts) rather than relying on the iframe's own session history.

## Screenshot & annotate

Click the camera icon in the toolbar to capture the page:

- **Visible area** — captures what's currently in the frame.
- **Full page** — captures the entire scrollable page, not just the visible viewport.
- **Select region** — drag a marquee over the part of the page you want.
- **Capture element** — pick a specific DOM element (same picker used for "Pick element").

Every capture opens an annotation modal where you can draw over the screenshot (freehand, a few pen colors, undo/clear) before copying the result to the clipboard.

## Known limitations

- **Remote sites that block iframes** show a blocked overlay. This is expected — the panel probes `X-Frame-Options` and CSP headers via a server-side HEAD request before attempting to embed.
- **Screenshot capture is still being verified on Windows and Linux.** It's known-working on macOS. On Windows, capturing currently fails with `Screenshot failed — see Output for details.` in the extension's Output panel — this points at the host's `ctx.webview` capture implementation, not this extension's code, and is being investigated. If you hit this, please attach the Output panel error to a bug report.

## Uses `ctx.webview`

This extension is built on the `ctx.webview` bridge. `ctx.webview.attach(iframe)` returns a `WebFrame` that the panel uses for `onNavigate` (drives back/forward history tracking), `onBlocked` (detects embeds the host itself refused to load), `exec` (reads `document.title`), and the screenshot tools — `capture`, `captureRect`, `captureFullPage`, and `pickElement`. Back/forward tracking and screenshots only work because of this bridge; when a capture fails (see Known limitations), the error originates here, not in this extension's own code.

## Uses `ctx.net`

This extension uses `ctx.net.fetchHeaders()` — a server-side HTTP client exposed by Silo that bypasses browser CORS — to read `X-Frame-Options` and `Content-Security-Policy` response headers before loading a URL. This avoids the poor UX of letting a blocked iframe load silently.

## Installing

### From a GitHub Release

1. Go to [Releases](https://github.com/silo-code/silo-extensions/releases?q=local-web-viewer).
2. Right-click the `.tgz` asset → **Copy link address**.
3. In Silo: **Settings → Extensions**, paste the URL and click **Install**.

### From source

```sh
git clone https://github.com/silo-code/silo-extensions
cd silo-extensions/local-web-viewer
npm install
npm run build
```

Then in Silo: **Settings → Extensions → Install from folder**, point at this directory.

## Opening a panel

- **Via the menu**: click the `+` button in the dock area and choose **New Local Web Viewer**.
- **Via the command palette**: run `Local Web Viewer: Open`.

Type a URL in the address bar and press **Enter**. `http://` is prepended automatically if you omit the scheme.

## Building

```sh
npm install
npm run build        # one-shot
npm run build:watch  # watch mode
```

Output goes to `dist/index.js`. The bundle externalizes `react`, `react/jsx-runtime`, and `@silo-code/sdk` — the Silo host supplies those at load time.
