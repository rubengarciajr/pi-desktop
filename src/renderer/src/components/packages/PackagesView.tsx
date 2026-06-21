import { useState, useEffect, useCallback } from "react";
import { useAppStore } from "../../store/useAppStore";
import type { PackageInfo, InstalledPackage } from "../../../../shared/ipc";

type SortMode = "downloads" | "recent" | "az";
type TypeFilter = "all" | "extension" | "skill" | "theme" | "prompt" | "package";

export function PackagesView() {
  const [packages, setPackages] = useState<PackageInfo[]>([]);
  const [installed, setInstalled] = useState<InstalledPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [sort, setSort] = useState<SortMode>("downloads");
  const [installing, setInstalling] = useState<Record<string, boolean>>({});
  const [removing, setRemoving] = useState<Record<string, boolean>>({});

  const refreshInstalled = useCallback(() => {
    window.pi.packages.installed().then((list: InstalledPackage[]) => {
      setInstalled(list);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    window.pi.packages.search().then((pkgs: PackageInfo[]) => {
      setPackages(pkgs);
      setLoading(false);
    }).catch(() => setLoading(false));
    refreshInstalled();

    const offChanged = window.pi.events.onPackagesChanged(() => refreshInstalled());
    return () => offChanged();
  }, [refreshInstalled]);

  // Listen for installed packages changes.
  useEffect(() => {
    refreshInstalled();
  }, [packages.length]); // eslint-disable-line

  const isInstalled = (pkg: PackageInfo) =>
    installed.some((i) => i.name === pkg.name || i.spec === pkg.installSpec);

  const handleInstall = async (pkg: PackageInfo) => {
    setInstalling((s) => ({ ...s, [pkg.name]: true }));
    try {
      await window.pi.packages.install({ spec: pkg.installSpec });
    } catch {}
    setInstalling((s) => ({ ...s, [pkg.name]: false }));
    refreshInstalled();
  };

  const handleRemove = async (pkg: PackageInfo) => {
    setRemoving((s) => ({ ...s, [pkg.name]: true }));
    try {
      const installedPkg = installed.find((i) => i.name === pkg.name);
      await window.pi.packages.remove({ spec: installedPkg?.spec || pkg.installSpec });
    } catch {}
    setRemoving((s) => ({ ...s, [pkg.name]: false }));
    refreshInstalled();
  };

  // Filter + sort.
  let filtered = packages.filter((p) => {
    if (typeFilter !== "all" && !p.types.includes(typeFilter)) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.author.toLowerCase().includes(q)
      );
    }
    return true;
  });

  filtered.sort((a, b) => {
    if (sort === "downloads") return b.downloads - a.downloads;
    if (sort === "az") return a.name.localeCompare(b.name);
    if (sort === "recent") {
      const dateA = a.publishedDate ? new Date(a.publishedDate).getTime() : 0;
      const dateB = b.publishedDate ? new Date(b.publishedDate).getTime() : 0;
      return dateB - dateA;
    }
    return 0;
  });

  const resetFilters = () => {
    setSearch("");
    setTypeFilter("all");
    setSort("downloads");
  };

  return (
    <div className="flex h-full flex-col">
      <div className="drag-region h-14 shrink-0" />
      {/* Header + filters */}
      <div className="no-drag flex items-center justify-between px-6 pb-3">
        <h1 className="text-sm font-semibold">Packages</h1>
        <button
          onClick={resetFilters}
          className="rounded-lg border border-border bg-bg-hover px-3 py-1.5 text-xs text-text-muted hover:bg-bg-active"
        >
          Reset
        </button>
      </div>

      {/* Filter bar */}
      <div className="no-drag flex items-center gap-2 px-6 pb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter packages by name, description, or author"
          className="flex-1 rounded-lg border border-border bg-bg-subtle px-3 py-1.5 text-xs text-text outline-none focus:border-accent/50"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
          className="rounded-lg border border-border bg-bg-subtle px-3 py-1.5 text-xs text-text outline-none focus:border-accent/50"
        >
          <option value="all">All types</option>
          <option value="extension">Extension</option>
          <option value="skill">Skill</option>
          <option value="theme">Theme</option>
          <option value="prompt">Prompt</option>
          <option value="package">Package</option>
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortMode)}
          className="rounded-lg border border-border bg-bg-subtle px-3 py-1.5 text-xs text-text outline-none focus:border-accent/50"
        >
          <option value="downloads">Most downloads</option>
          <option value="recent">Recently published</option>
          <option value="az">A-Z</option>
        </select>
      </div>

      {/* Grid of cards */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {loading ? (
          <div className="text-sm text-text-muted">Loading packages...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-text-muted">No packages found.</p>
            <button onClick={resetFilters} className="mt-2 text-xs text-accent hover:underline">
              Reset filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((pkg) => {
              const installed = isInstalled(pkg);
              return (
                <div
                  key={pkg.name}
                  className="flex flex-col rounded-xl border-2 border-border bg-bg-subtle p-4 transition-colors hover:border-accent"
                >
                  {/* Title + types */}
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <h3 className="truncate text-sm font-semibold text-text">{pkg.name}</h3>
                    <div className="flex shrink-0 gap-1">
                      {pkg.types.map((t: string) => (
                        <span
                          key={t}
                          className="rounded-full bg-bg-hover px-1.5 py-0.5 text-[9px] text-text-faint"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Description */}
                  <p className="mb-3 line-clamp-2 flex-1 text-xs text-text-muted">
                    {pkg.description}
                  </p>

                  {/* Author + downloads */}
                  <div className="mb-3 flex items-center justify-between text-[10px] text-text-faint">
                    <span className="truncate">by {pkg.author}</span>
                    <div className="flex items-center gap-2">
                      {pkg.downloads > 0 && <span>{formatDownloads(pkg.downloads)}/mo</span>}
                      {pkg.publishedDate && <span>{relativeDate(pkg.publishedDate)}</span>}
                    </div>
                  </div>

                  {/* Action button */}
                  {installed ? (
                    <button
                      onClick={() => handleRemove(pkg)}
                      disabled={removing[pkg.name]}
                      className="w-full rounded-lg border border-danger/30 bg-danger/10 px-3 py-1.5 text-xs font-medium text-danger transition-colors hover:bg-danger/20 disabled:opacity-40"
                    >
                      {removing[pkg.name] ? "Removing..." : "Remove"}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleInstall(pkg)}
                      disabled={installing[pkg.name]}
                      className="w-full rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-40"
                    >
                      {installing[pkg.name] ? "Installing..." : "Install"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function formatDownloads(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function relativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  const diffMonth = Math.floor(diffDay / 30);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return "1d ago";
  if (diffDay < 30) return `${diffDay}d ago`;
  if (diffMonth === 1) return "1mo ago";
  return `${diffMonth}mo ago`;
}
