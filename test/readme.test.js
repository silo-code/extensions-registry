import assert from "node:assert/strict";
import { test } from "node:test";
import { rewriteReadmeMedia } from "../scripts/lib/readme.js";

const opts = { repo: "acme/silo-weather", tag: "v1.2.0", path: "" };

test("rewrites a relative image to raw.githubusercontent.com", () => {
  const out = rewriteReadmeMedia("![screenshot](assets/shot.png)", opts);
  assert.equal(
    out,
    "![screenshot](https://raw.githubusercontent.com/acme/silo-weather/v1.2.0/assets/shot.png)",
  );
});

test("rewrites a relative link to the repo's blob view", () => {
  const out = rewriteReadmeMedia("[license](LICENSE)", opts);
  assert.equal(
    out,
    "[license](https://github.com/acme/silo-weather/blob/v1.2.0/LICENSE)",
  );
});

test("joins a subdirectory path for multi-extension repos", () => {
  const out = rewriteReadmeMedia("![x](assets/shot.png)", { ...opts, path: "system-monitor" });
  assert.equal(
    out,
    "![x](https://raw.githubusercontent.com/acme/silo-weather/v1.2.0/system-monitor/assets/shot.png)",
  );
});

test("strips a leading ./ before joining", () => {
  const out = rewriteReadmeMedia("![x](./assets/shot.png)", { ...opts, path: "system-monitor" });
  assert.match(out, /system-monitor\/assets\/shot\.png/);
});

test("leaves absolute URLs, anchors, and mailto untouched", () => {
  const md = [
    "![abs](https://example.com/a.png)",
    "[anchor](#usage)",
    "[email](mailto:a@b.com)",
    "![proto-relative](//example.com/a.png)",
  ].join("\n");
  assert.equal(rewriteReadmeMedia(md, opts), md);
});

test("handles a title attribute after the URL", () => {
  const out = rewriteReadmeMedia('![x](assets/shot.png "A title")', opts);
  assert.equal(
    out,
    '![x](https://raw.githubusercontent.com/acme/silo-weather/v1.2.0/assets/shot.png "A title")',
  );
});

test("rewrites multiple images independently", () => {
  const out = rewriteReadmeMedia("![a](a.png)\n\ntext\n\n![b](b.png)", opts);
  assert.match(out, /raw\.githubusercontent\.com\/acme\/silo-weather\/v1\.2\.0\/a\.png/);
  assert.match(out, /raw\.githubusercontent\.com\/acme\/silo-weather\/v1\.2\.0\/b\.png/);
});
