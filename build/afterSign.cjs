const { execFileSync } = require("child_process");
const path = require("path");
const fs = require("fs");

function run(command, args) {
  return execFileSync(command, args, {
    stdio: "pipe",
    encoding: "utf-8",
  });
}

/**
 * electron-builder afterSign hook.
 * Ad-hoc signs the .app bundle so Gatekeeper shows "unidentified developer"
 * (bypassable) instead of "damaged" (not bypassable without terminal).
 */
exports.default = async function (context) {
  if (context.electronPlatformName !== "darwin") return;

  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productName}.app`);
  const entitlementsPath = path.join(process.cwd(), "resources/entitlements.mac.plist");

  console.log(`[afterSign] Ad-hoc signing: ${appPath}`);

  // Remove xattr that block codesign. xattr -cr misses some system attributes,
  // so we remove them by name on every file recursively.
  const blockingAttrs = [
    "com.apple.FinderInfo",
    "com.apple.fileprovider.fpfs#P",
    "com.apple.provenance",
  ];
  const stripAttrs = (dir) => {
    // Recursively clear ALL extended attributes, then remove each known
    // codesign-blocking attr by name across the tree (xattr -cr can miss some
    // system attrs), then clear AppleDouble/FinderInfo detritus.
    try {
      run("xattr", ["-cr", dir]);
    } catch {}
    for (const attr of blockingAttrs) {
      try {
        run("xattr", ["-dr", attr, dir]);
      } catch {}
    }
    try {
      run("dot_clean", ["-m", dir]);
    } catch {}
  };

  /**
   * Strip-then-sign with retries. On iCloud/file-provider-synced folders (e.g.
   * ~/Desktop), the provider re-applies com.apple.FinderInfo between the strip
   * and the sign, so codesign fails with "...detritus not allowed". Stripping
   * immediately before each attempt and retrying wins the race.
   */
  const clearAndSign = (target, withEntitlements) => {
    const args = withEntitlements
      ? [
          "--force",
          "--sign",
          "-",
          "--options",
          "runtime",
          "--entitlements",
          entitlementsPath,
          target,
        ]
      : ["--force", "--sign", "-", target];
    const maxAttempts = 5;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      stripAttrs(target);
      try {
        run("codesign", args);
        return true;
      } catch (err) {
        if (attempt === maxAttempts) throw err;
        // brief backoff lets the file provider settle before the next strip
        try { execFileSync("sleep", ["0.4"], { stdio: "pipe" }); } catch {}
      }
    }
    return false;
  };

  try {
    // 1. Sign each framework/helper individually (with entitlements, basic fallback)
    const frameworksDir = path.join(appPath, "Contents", "Frameworks");
    if (fs.existsSync(frameworksDir)) {
      for (const entry of fs.readdirSync(frameworksDir)) {
        const entryPath = path.join(frameworksDir, entry);
        try {
          clearAndSign(entryPath, true);
          console.log(`[afterSign]   Signed: Frameworks/${entry}`);
        } catch {
          try {
            clearAndSign(entryPath, false);
            console.log(`[afterSign]   Signed (basic): Frameworks/${entry}`);
          } catch {
            console.warn(`[afterSign]   WARNING: could not sign Frameworks/${entry}`);
          }
        }
      }
    }

    // 2. Sign the root .app (retries beat the file-provider re-tag race)
    clearAndSign(appPath, true);
    console.log(`[afterSign] Successfully ad-hoc signed`);

    // 3. Verify — fatal: a release must not ship a broken signature.
    run("codesign", ["--verify", "--strict", appPath]);
    console.log(`[afterSign] Signature verified OK`);
  } catch (err) {
    console.error(`[afterSign] Signing failed: ${err.message}`);
    throw err;
  }
};
