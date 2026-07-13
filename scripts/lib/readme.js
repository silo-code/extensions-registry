// READMEs are extracted from a tarball, which strips all repo context — a
// relative `![](assets/screenshot.png)` has nowhere to resolve once served
// from registry.getsilo.dev. Rewrite relative image/link targets to absolute
// GitHub URLs (raw content for images, blob view for links) so the README
// renders correctly wherever it's read: the website, the app's fetched copy,
// or a raw markdown consumer (llms.txt, an agent).

const ABSOLUTE_OR_SPECIAL = /^([a-z][a-z0-9+.-]*:|#|\/\/)/i;

/** Join a repo subpath (may be "") with a relative markdown target, `./`-stripped. */
function resolve(dir, target) {
  const cleaned = target.replace(/^\.\//, "");
  return dir ? `${dir}/${cleaned}` : cleaned;
}

/**
 * Rewrite every relative image/link target in `markdown` to point at GitHub:
 * images → `raw.githubusercontent.com` (renders inline), links → the repo's
 * `blob` view (renders as a page). Absolute URLs, anchors, and `mailto:`
 * links are left untouched.
 *
 * `path` is the subdirectory within `repo` the package lives in (multi-
 * extension repos), or "" for repo root.
 */
export function rewriteReadmeMedia(markdown, { repo, tag, path = "" }) {
  const dir = path.replace(/^\/+|\/+$/g, "");
  const rawBase = `https://raw.githubusercontent.com/${repo}/${tag}/`;
  const blobBase = `https://github.com/${repo}/blob/${tag}/`;

  return markdown.replace(
    /(!?)\[([^\]]*)\]\(([^)\s]+)((?:\s+"[^"]*")?)\)/g,
    (full, bang, text, url, title) => {
      if (ABSOLUTE_OR_SPECIAL.test(url)) return full;
      const base = bang ? rawBase : blobBase;
      return `${bang}[${text}](${base}${resolve(dir, url)}${title})`;
    },
  );
}
