/**
 * Post-publish gate: assert the release a user will actually download is intact.
 *
 * On v0.6.3, v0.7.1, and v0.7.3 the workflow reported success while the public
 * release carried only a .blockmap — no DMG. Every in-app updater would have
 * failed with "No DMG asset found in latest release" and the download link
 * 404'd, and nothing in CI noticed. This turns that silent failure red.
 *
 * Usage: node build/verify-release.cjs <tag>
 * Requires gh to be authenticated (GH_TOKEN in CI).
 */
const { execFileSync } = require("child_process");
const path = require("path");

const tag = process.argv[2];
if (!tag) {
  console.error("[verify-release] Usage: node build/verify-release.cjs <tag>");
  process.exit(1);
}

const version = require(path.join(process.cwd(), "package.json")).version;
const repo = process.env.GITHUB_REPOSITORY || "rubengarciajr/pi-desktop";

function gh(args) {
  return execFileSync("gh", args, { encoding: "utf-8" });
}

const problems = [];

// 1. Exactly one release should exist for the tag. Two means the publisher
//    raced itself again and the assets are probably split across them.
const all = JSON.parse(gh(["api", `repos/${repo}/releases`, "--paginate"]));
const matching = all.filter((r) => r.tag_name === tag);
if (matching.length === 0) {
  problems.push(`No release found for tag ${tag}`);
} else if (matching.length > 1) {
  problems.push(
    `${matching.length} releases share tag ${tag} (ids ${matching.map((r) => r.id).join(", ")}) — ` +
      `the assets are likely split between them`,
  );
}

// 2. /releases/latest is what the in-app updater queries, so check that exact
//    endpoint rather than the release we think we just made.
let latest;
try {
  latest = JSON.parse(gh(["api", `repos/${repo}/releases/latest`]));
} catch {
  problems.push("GET /releases/latest failed — no published release is visible");
}

if (latest) {
  if (latest.tag_name !== tag) {
    problems.push(`/releases/latest is ${latest.tag_name}, expected ${tag}`);
  }
  if (latest.draft) problems.push(`${tag} is still a draft`);

  const names = (latest.assets || []).map((a) => a.name);

  // This mirrors updater.ts: find an asset ending in .dmg whose name contains
  // the version. If that lookup fails here, it fails in the app too.
  const dmg = (latest.assets || []).find(
    (a) => a.name.endsWith(".dmg") && a.name.includes(version),
  );
  if (!dmg) {
    problems.push(
      `No .dmg asset containing "${version}" on ${tag}. Assets: [${names.join(", ") || "none"}]`,
    );
  } else if (dmg.state !== "uploaded") {
    problems.push(`${dmg.name} is in state "${dmg.state}", not "uploaded"`);
  } else if (dmg.size < 1_000_000) {
    problems.push(`${dmg.name} is only ${dmg.size} bytes — truncated upload?`);
  }

  if (!names.includes("latest-mac.yml")) {
    problems.push(`latest-mac.yml missing — the updater cannot verify downloads`);
  }
}

if (problems.length > 0) {
  console.error(`\n[verify-release] ${tag} is NOT publishable:\n`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  console.error("");
  process.exit(1);
}

console.log(`[verify-release] ${tag} looks good:`);
for (const a of latest.assets) console.log(`  ✓ ${a.name} (${a.size} bytes)`);
