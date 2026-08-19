/**
 * Platform-specific download resolution — ported from
 * apps/website/src/{platform,download-url}.ts in the main Silo monorepo so
 * this site's Download links behave the same way getsilo.dev's do (direct
 * installer link for the visitor's OS/arch, not just the releases page).
 * Kept as a plain client-side module since this site has no React.
 */

export type DownloadPlatform = "mac" | "windows" | "linux";

export type DownloadTarget = {
  platform: DownloadPlatform;
  /** Only set for mac — picks aarch64 vs x64 .dmg. */
  macArch?: "arm" | "x64";
};

export type ReleaseAsset = {
  name: string;
  browser_download_url: string;
};

const RELEASES_API = "https://api.github.com/repos/silo-code/silo/releases/latest";

type NavigatorUaData = {
  architecture?: string;
  getHighEntropyValues?: (hints: string[]) => Promise<{ architecture?: string }>;
};

/**
 * Best-effort UA/platform sniff for which Download glyph to show.
 * Defaults to mac — Silo's primary audience — when unknown.
 */
export function detectDownloadPlatform(
  ua = navigator.userAgent,
  platform = navigator.platform,
): DownloadPlatform {
  if (/Win/i.test(platform) || /Windows/i.test(ua)) return "windows";
  if (/Linux/i.test(platform) || (/Linux/i.test(ua) && !/Android/i.test(ua))) {
    return "linux";
  }
  return "mac";
}

/**
 * Best-effort OS + Mac arch sniff for which installer to offer.
 * Mac defaults to Apple Silicon (Silo's primary audience); Client Hints can
 * refine Intel vs ARM asynchronously via {@link refineDownloadTarget}.
 */
export function detectDownloadTarget(
  ua = navigator.userAgent,
  platform = navigator.platform,
): DownloadTarget {
  const os = detectDownloadPlatform(ua, platform);
  if (os !== "mac") return { platform: os };

  let macArch: "arm" | "x64" = "arm";
  if (/arm64|aarch64/i.test(ua)) {
    macArch = "arm";
  } else {
    const uaData = (navigator as Navigator & { userAgentData?: NavigatorUaData }).userAgentData;
    if (uaData?.architecture === "x86") macArch = "x64";
  }

  return { platform: "mac", macArch };
}

/**
 * Pick the user-facing installer asset (dmg / setup.exe / AppImage), not the
 * updater tarballs (.app.tar.gz) or signature files.
 */
export function pickDownloadAsset(
  assets: ReleaseAsset[],
  target: DownloadTarget,
): ReleaseAsset | undefined {
  const installers = assets.filter(
    (asset) =>
      !asset.name.endsWith(".sig") &&
      !asset.name.endsWith(".app.tar.gz") &&
      asset.name !== "latest.json",
  );

  if (target.platform === "windows") {
    return (
      installers.find((a) => /_x64-setup\.exe$/i.test(a.name)) ??
      installers.find((a) => /\.exe$/i.test(a.name))
    );
  }

  if (target.platform === "linux") {
    return (
      installers.find((a) => /_amd64\.AppImage$/i.test(a.name)) ??
      installers.find((a) => /\.AppImage$/i.test(a.name)) ??
      installers.find((a) => /_amd64\.deb$/i.test(a.name))
    );
  }

  const arch = target.macArch === "x64" ? "x64" : "aarch64";
  return (
    installers.find((a) => new RegExp(`_${arch}\\.dmg$`, "i").test(a.name)) ??
    installers.find((a) => /\.dmg$/i.test(a.name))
  );
}

/** Improve Mac arch detection using async Client Hints when available. */
export async function refineDownloadTarget(target: DownloadTarget): Promise<DownloadTarget> {
  if (target.platform !== "mac") return target;
  try {
    const uaData = (navigator as Navigator & { userAgentData?: NavigatorUaData }).userAgentData;
    if (!uaData?.getHighEntropyValues) return target;
    const { architecture } = await uaData.getHighEntropyValues(["architecture"]);
    if (architecture === "x86") return { platform: "mac", macArch: "x64" };
    if (architecture === "arm") return { platform: "mac", macArch: "arm" };
  } catch {
    // keep the sync guess
  }
  return target;
}

/**
 * Fetch the latest GitHub release and return a direct browser_download_url
 * for this machine, or null if anything fails (caller keeps the releases page).
 */
export async function fetchLatestDownloadUrl(target?: DownloadTarget): Promise<string | null> {
  const resolved = await refineDownloadTarget(target ?? detectDownloadTarget());
  try {
    const res = await fetch(RELEASES_API, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { assets?: ReleaseAsset[] };
    const asset = pickDownloadAsset(data.assets ?? [], resolved);
    return asset?.browser_download_url ?? null;
  } catch {
    return null;
  }
}
