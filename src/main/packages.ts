import { execSync, spawn, ChildProcess } from "child_process";

export interface PackageInfo {
  name: string;
  description: string;
  author: string;
  version: string;
  downloads: number;
  types: string[];
  npmUrl: string;
  repoUrl?: string;
  installSpec: string;
  publishedDate?: string;
}

export interface InstalledPackage {
  spec: string;
  name: string;
  source: string;
}

/** Search npm registry for pi-package keyword. */
export async function searchPackages(): Promise<PackageInfo[]> {
  const res = await fetch(
    "https://registry.npmjs.org/-/v1/search?text=keywords:pi-package&size=250",
    { headers: { Accept: "application/json" } }
  );
  if (!res.ok) throw new Error(`npm search failed: ${res.status}`);
  const data: any = await res.json();

  const packages: PackageInfo[] = [];

  for (const obj of data.objects || []) {
    const pkg = obj.package;
    if (!pkg) continue;

    // Parse download count from search score.
    const downloads = obj.searchScore ? Math.round(obj.searchScore) : 0;

    // Extract types from keywords.
    const keywords: string[] = pkg.keywords || [];
    const types = keywords.filter((k: string) =>
      ["extension", "skill", "theme", "prompt", "package"].includes(k)
    );
    if (types.length === 0) types.push("package");

    packages.push({
      name: pkg.name,
      description: pkg.description || "",
      author: typeof pkg.publisher === "string" ? pkg.publisher : pkg.publisher?.username || pkg.author?.name || "unknown",
      version: pkg.version,
      downloads,
      types,
      npmUrl: `https://www.npmjs.com/package/${pkg.name}`,
      repoUrl: pkg.links?.repository,
      installSpec: `npm:${pkg.name}`,
      publishedDate: pkg.date || undefined,
    });
  }

  // Sort by downloads descending.
  packages.sort((a, b) => b.downloads - a.downloads);

  return packages;
}

/** Get actual download counts from npm API (last month). */
export async function getDownloadCounts(packageNames: string[]): Promise<Record<string, number>> {
  if (packageNames.length === 0) return {};
  const results: Record<string, number> = {};
  const concurrency = 20;
  let index = 0;

  const fetchOne = async (): Promise<void> => {
    while (index < packageNames.length) {
      const i = index++;
      const name = packageNames[i];
      try {
        const res = await fetch(
          `https://api.npmjs.org/downloads/point/last-month/${encodeURIComponent(name)}`,
          { headers: { Accept: "application/json" } }
        );
        if (!res.ok) continue;
        const data: any = await res.json();
        if (data.downloads != null) {
          results[data.package || name] = data.downloads;
        }
      } catch {}
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => fetchOne()));
  return results;
}

/** Install a pi package. Returns a child process + promise. */
export function installPackage(spec: string): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const child = spawn("pi", ["install", spec], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stderr = "";
    child.stderr?.on("data", (data: Buffer) => { stderr += data.toString(); });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ success: true });
      } else {
        resolve({ success: false, error: stderr.trim() || `pi install exited with code ${code}` });
      }
    });

    child.on("error", (err) => {
      resolve({ success: false, error: err.message });
    });
  });
}

/** Remove a pi package. */
export function removePackage(spec: string): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const child = spawn("pi", ["remove", spec], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stderr = "";
    child.stderr?.on("data", (data: Buffer) => { stderr += data.toString(); });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ success: true });
      } else {
        resolve({ success: false, error: stderr.trim() || `pi remove exited with code ${code}` });
      }
    });

    child.on("error", (err) => {
      resolve({ success: false, error: err.message });
    });
  });
}

/** List installed packages by parsing pi list output. */
export function listInstalledPackages(): InstalledPackage[] {
  try {
    const output = execSync("pi list", { encoding: "utf-8", timeout: 10000, stdio: ["pipe", "pipe", "pipe"] });
    const packages: InstalledPackage[] = [];
    for (const line of output.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("pi")) continue;
      // Lines look like: "  npm:@foo/bar" or "  npm:package@version"
      const match = trimmed.match(/^(npm:|git:|https?:|\.?\/)(.+)$/);
      if (match) {
        const spec = trimmed.replace(/\s+$/, "");
        const name = spec.replace(/^npm:/, "").split("@")[0] || spec;
        packages.push({ spec, name, source: match[1] });
      }
    }
    return packages;
  } catch {
    return [];
  }
}
