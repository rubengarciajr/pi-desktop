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

// `InstalledPackage` (the canonical type used by the renderer) lives in
// src/shared/ipc.ts. Package install/remove/list themselves are handled by
// PiSessionManager via the SDK's DefaultPackageManager — no pi CLI involved.

/** Search npm registry for pi-package keyword. */
export async function searchPackages(): Promise<PackageInfo[]> {
  const res = await fetch(
    "https://registry.npmjs.org/-/v1/search?text=keywords:pi-package&size=250",
    { headers: { Accept: "application/json" } },
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
      ["extension", "skill", "theme", "prompt", "package"].includes(k),
    );
    if (types.length === 0) types.push("package");

    packages.push({
      name: pkg.name,
      description: pkg.description || "",
      author:
        typeof pkg.publisher === "string"
          ? pkg.publisher
          : pkg.publisher?.username || pkg.author?.name || "unknown",
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
          { headers: { Accept: "application/json" } },
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
