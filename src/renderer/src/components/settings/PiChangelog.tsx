import { useEffect, useState } from "react";

interface ChangelogEntry {
  version: string;
  date: string;
  sections: { title: string; items: string[] }[];
}

const CHANGELOG_URL =
  "https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/CHANGELOG.md";
const GITHUB_URL =
  "https://github.com/earendil-works/pi/blob/main/packages/coding-agent/CHANGELOG.md";

export function PiChangelog() {
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(CHANGELOG_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((md) => {
        setEntries(parseChangelog(md));
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="text-sm text-text-faint">Loading changelog...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-8 text-center">
        <p className="mb-2 text-sm text-text-muted">Could not load the changelog.</p>
        <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="text-xs text-accent hover:underline">
          View on GitHub
        </a>
      </div>
    );
  }

  // Show the 5 most recent releases.
  const recent = entries.slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-text">Pi Coding Agent</h2>
          <p className="text-xs text-text-faint">
            Recent releases from the upstream pi agent.
          </p>
        </div>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-accent hover:underline"
        >
          Full changelog
        </a>
      </div>

      {recent.map((entry) => (
        <div key={entry.version} className="rounded-lg border border-border bg-bg-subtle px-4 py-3">
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-full bg-accent/20 px-2 py-0.5 text-xs font-medium text-accent">
              {entry.version}
            </span>
            <span className="text-xs text-text-faint">{entry.date}</span>
          </div>
          <div className="space-y-2">
            {entry.sections.map((section, i) => (
              <div key={i}>
                <h3 className="mb-1 text-[11px] font-medium uppercase tracking-wider text-text-faint">
                  {section.title}
                </h3>
                <ul className="space-y-1">
                  {section.items.map((item, j) => (
                    <li key={j} className="flex gap-2 text-xs text-text-muted">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-text-faint" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Parse the pi CHANGELOG.md into structured entries. */
function parseChangelog(md: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];
  const lines = md.split("\n");

  let currentEntry: ChangelogEntry | null = null;
  let currentSection: { title: string; items: string[] } | null = null;
  let inCodeBlock = false;

  for (const line of lines) {
    // Skip code blocks.
    if (line.trim().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    // Version header: ## [0.79.9] - 2026-06-20
    const versionMatch = line.match(/^##\s*\[([^\]]+)\]\s*-?\s*(.*)/);
    if (versionMatch) {
      // Skip [Unreleased] - we only want released versions.
      if (versionMatch[1].toLowerCase() === "unreleased") {
        currentEntry = null;
        currentSection = null;
        continue;
      }
      currentEntry = {
        version: versionMatch[1],
        date: versionMatch[2].trim() || "—",
        sections: [],
      };
      entries.push(currentEntry);
      currentSection = null;
      continue;
    }

    if (!currentEntry) continue;

    // Section header: ### New Features, ### Fixed, ### Added, etc.
    const sectionMatch = line.match(/^###\s+(.*)/);
    if (sectionMatch) {
      currentSection = { title: sectionMatch[1].trim(), items: [] };
      currentEntry.sections.push(currentSection);
      continue;
    }

    // Bullet item: - some text
    if (currentSection && line.match(/^\s*[-*]\s+/)) {
      const text = line.replace(/^\s*[-*]\s+/, "").trim();
      // Clean up markdown links: [text](url) -> text
      const clean = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
      // Skip empty or very long items (usually refs)
      if (clean && clean.length < 300) {
        currentSection.items.push(clean);
      }
    }
  }

  return entries;
}
