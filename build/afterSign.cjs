const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

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
    try {
      execSync(
        `find "${dir}" -exec xattr -c {} \\; 2>/dev/null; ` +
        blockingAttrs.map((a) => `xattr -d ${a} "${dir}" 2>/dev/null;`).join(" "),
        { stdio: "pipe", encoding: "utf-8" }
      );
    } catch {}
  };

  try {
    // 1. Sign each framework/helper individually
    const frameworksDir = path.join(appPath, "Contents", "Frameworks");
    if (fs.existsSync(frameworksDir)) {
      for (const entry of fs.readdirSync(frameworksDir)) {
        const entryPath = path.join(frameworksDir, entry);
        stripAttrs(entryPath);
        try {
          execSync(`codesign --force --sign - --options runtime --entitlements "${entitlementsPath}" "${entryPath}"`, {
            stdio: "pipe", encoding: "utf-8",
          });
          console.log(`[afterSign]   Signed: Frameworks/${entry}`);
        } catch {
          try {
            execSync(`codesign --force --sign - "${entryPath}"`, { stdio: "pipe", encoding: "utf-8" });
            console.log(`[afterSign]   Signed (basic): Frameworks/${entry}`);
          } catch {}
        }
      }
    }

    // 2. Strip blocking attrs from root .app and sign it
    stripAttrs(appPath);
    execSync(`codesign --force --sign - --options runtime --entitlements "${entitlementsPath}" "${appPath}"`, {
      stdio: "inherit",
    });
    console.log(`[afterSign] Successfully ad-hoc signed`);

    // 3. Verify (non-fatal)
    try {
      execSync(`codesign --verify --strict "${appPath}"`, { stdio: "pipe", encoding: "utf-8" });
      console.log(`[afterSign] Signature verified OK`);
    } catch {
      console.log(`[afterSign] Verification warning (non-fatal)`);
    }
  } catch (err) {
    console.error(`[afterSign] Signing failed: ${err.message}`);
    throw err;
  }
};
