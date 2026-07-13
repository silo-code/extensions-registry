# Local Web Viewer

A [Silo](https://github.com/silo-code/silo) extension that embeds local web content — dev servers, `file://` HTML, and internal tools — as dock panels alongside your code.

## What it's for

The Local Web Viewer is designed for **localhost browsing**. Use it to keep your running dev server, component storybook, local docs, or `file://` HTML pages in view without leaving Silo. Multiple panels can be open simultaneously, each pinned to a different URL.

It is **not** a general-purpose browser. Most production websites block iframe embedding via `X-Frame-Options` or CSP `frame-ancestors`, and those will show a "doesn't allow embedding" overlay instead of loading. The panel will offer to open blocked URLs in your default browser instead.

## Known limitations

- **No back/forward navigation.** SPA client-side routing (React Router, Vue Router, etc.) does not trigger iframe load events, so the panel cannot track in-frame navigation. A future proposal ([RFC 0011](https://github.com/silo-code/silo/blob/main/docs/proposals/0011-iframe-navigation-events.md)) outlines how Tauri's webview init script could solve this generically.
- **Remote sites that block iframes** show a blocked overlay. This is expected — the panel probes `X-Frame-Options` and CSP headers via a server-side HEAD request before attempting to embed.
- **SPA back/forward** requires either a future `ctx.webview` SDK surface or the loaded app emitting `window.parent.postMessage` events on route changes.

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
