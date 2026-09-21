/**
 * Prepare the release artifacts in dist/ for a single atomic upload.
 *
 * Why this exists: electron-builder's own GitHub publisher creates the release
 * as a side effect of uploading, and when it uploads more than one artifact it
 * can race itself into creating TWO releases for the same tag — splitting the
 * assets between them. That shipped a "published" release holding only the
 * blockmap (no DMG) on v0.6.3, v0.7.1, and v0.7.3, while CI reported success
 * every time. We now build with `--publish never` and upload once, ourselves.
 *
 * Doing that means matching electron-builder's upload-time naming: the file on
 * disk is "Pi Desktop-<version>.dmg" (a space, from productName) but the name
 * recorded in latest-mac.yml — and therefore the name electron-updater fetches
 * — is "Pi-Desktop-<version>.dmg" (dashes). Uploading the on-disk name would
 * leave the manifest pointing at a file that does not exist.
 *
 * So: rename to whatever latest-mac.yml says, then verify the bytes actually
 * match the manifest's sha512 and size before anything is published.
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const projectRoot = process.cwd();
const distDir = path.join(projectRoot, "dist");
const version = require(path.join(projectRoot, "package.json")).version;

function fail(message) {
  console.error(`[prepare-release] ${message}`);
  process.exit(1);
}

const manifestPath = path.join(distDir, "latest-mac.yml");
if (!fs.existsSync(manifestPath)) fail(`Missing ${manifestPath}`);
const manifest = fs.readFileSync(manifestPath, "utf-8");

// latest-mac.yml is small and machine-generated; these three fields are all we
// need, so parse them directly rather than taking on a YAML dependency.
const expectedName = manifest.match(/^path:\s*(.+)$/m)?.[1]?.trim();
const expectedSha = manifest.match(/^sha512:\s*(.+)$/m)?.[1]?.trim();
const expectedSize = Number(manifest.match(/^\s+size:\s*(\d+)$/m)?.[1]);

if (!expectedName) fail("latest-mac.yml has no `path:` entry");
if (!expectedSha) fail("latest-mac.yml has no top-level `sha512:` entry");
if (!Number.isFinite(expectedSize)) fail("latest-mac.yml has no `size:` entry");

if (!expectedName.includes(version)) {
  fail(
    `latest-mac.yml points at "${expectedName}", which does not carry package.json version ${version}. ` +
      `Refusing to publish a manifest/build mismatch.`,
  );
}

// Pick the DMG for THIS version — dist/ can retain artifacts from earlier local
// builds, and publishing a stale one would be worse than failing.
const candidates = fs
  .readdirSync(distDir)
  .filter((f) => f.endsWith(".dmg") && f.includes(version));

if (candidates.length === 0) fail(`No .dmg for version ${version} found in ${distDir}`);
if (candidates.length > 1) {
  fail(`Multiple .dmg files for ${version} in ${distDir}: ${candidates.join(", ")}`);
}

const actualName = candidates[0];

// Rename the DMG (and its blockmap) to the names the manifest promises.
function renameToExpected(from, to) {
  if (from === to) return to;
  const fromPath = path.join(distDir, from);
  const toPath = path.join(distDir, to);
  if (!fs.existsSync(fromPath)) return null;
  fs.renameSync(fromPath, toPath);
  console.log(`[prepare-release] Renamed "${from}" -> "${to}"`);
  return to;
}

const dmgName = renameToExpected(actualName, expectedName);
const blockmapName = renameToExpected(`${actualName}.blockmap`, `${expectedName}.blockmap`);

// Verify the bytes against the manifest. If these disagree, electron-updater
// would reject the download on every user's machine after we had already
// published it — so fail the build instead.
const dmgPath = path.join(distDir, dmgName);
const bytes = fs.readFileSync(dmgPath);
const actualSha = crypto.createHash("sha512").update(bytes).digest("base64");
const actualSize = bytes.length;

if (actualSha !== expectedSha) {
  fail(`sha512 mismatch for ${dmgName}\n  manifest: ${expectedSha}\n  actual:   ${actualSha}`);
}
if (actualSize !== expectedSize) {
  fail(`size mismatch for ${dmgName}: manifest ${expectedSize}, actual ${actualSize}`);
}

console.log(`[prepare-release] Verified ${dmgName} (${actualSize} bytes) against latest-mac.yml`);

// Release notes: lift this version's section straight out of CHANGELOG.md so
// the GitHub release stops shipping an empty body.
const notesPath = path.join(distDir, "RELEASE_NOTES.md");
let notes = `Pi Desktop ${version}`;
const changelogPath = path.join(projectRoot, "CHANGELOG.md");
if (fs.existsSync(changelogPath)) {
  const changelog = fs.readFileSync(changelogPath, "utf-8");
  const escaped = version.replace(/\./g, "\\.");
  const section = changelog.match(
    new RegExp(`^## \\[${escaped}\\][^\\n]*\\n([\\s\\S]*?)(?=^## \\[|^---\\s*$)`, "m"),
  );
  if (section) {
    notes = section[1].trim();
    console.log(`[prepare-release] Release notes taken from CHANGELOG.md [${version}]`);
  } else {
    console.log(`[prepare-release] No CHANGELOG.md section for ${version}; using a minimal body`);
  }
}
notes += `\n\n**Install:** download \`${dmgName}\`, open it, and drag Pi Desktop to Applications. Existing installs can update in place from the in-app update banner.\n`;
fs.writeFileSync(notesPath, notes, "utf-8");

// Hand the resolved paths to the workflow.
const outputs = [
  `dmg=${dmgPath}`,
  `blockmap=${blockmapName ? path.join(distDir, blockmapName) : ""}`,
  `manifest=${manifestPath}`,
  `notes=${notesPath}`,
  `dmg_name=${dmgName}`,
];
if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, outputs.join("\n") + "\n");
}
for (const line of outputs) console.log(`[prepare-release] ${line}`);
