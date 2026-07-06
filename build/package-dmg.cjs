const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const projectRoot = process.cwd();
const distDir = path.join(projectRoot, "dist");
const tempOutDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-desktop-dist-"));

const args = process.argv.slice(2);
const builderArgs = args.length > 0 ? args : ["--mac", "dmg"];

builderArgs.push(`--config.directories.output=${tempOutDir}`);

// Forward --publish to electron-builder so releases actually publish instead
// of staying as drafts. Without this, the CI step's `--publish always` is
// silently dropped (we rebuild builderArgs above from the platform flags only).
if (process.env.GITHUB_TOKEN && !builderArgs.includes("--publish")) {
  builderArgs.push("--publish", "always");
}

console.log(`[package-dmg] Building in temporary output: ${tempOutDir}`);

execFileSync("npx", ["electron-builder", ...builderArgs], {
  cwd: projectRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    CSC_IDENTITY_AUTO_DISCOVERY:
      process.env.CSC_IDENTITY_AUTO_DISCOVERY ?? "false",
  },
});

fs.mkdirSync(distDir, { recursive: true });

for (const entry of fs.readdirSync(tempOutDir)) {
  const source = path.join(tempOutDir, entry);
  const stats = fs.statSync(source);

  if (!stats.isFile()) continue;

  const destination = path.join(distDir, entry);
  fs.copyFileSync(source, destination);
  console.log(`[package-dmg] Copied ${entry} to dist/`);
}
