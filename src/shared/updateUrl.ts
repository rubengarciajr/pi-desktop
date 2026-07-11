export function validateGitHubReleaseDmgUrl(rawUrl: string, owner: string, repo: string): string {
  const url = new URL(rawUrl);
  // GitHub owners/repos are case-insensitive — compare the pathname prefix
  // case-insensitively so a URL whose casing differs from the constants is
  // still accepted (GitHub's API always returns lowercase, but this is more
  // robust for forks that might supply a differently-cased owner).
  const expectedPrefix = `/${owner}/${repo}/releases/download/`.toLowerCase();
  const pathnameLower = url.pathname.toLowerCase();
  if (
    url.protocol !== "https:" ||
    url.hostname !== "github.com" ||
    !pathnameLower.startsWith(expectedPrefix) ||
    !pathnameLower.endsWith(".dmg")
  ) {
    throw new Error("Update URL is not an official Pi Desktop DMG.");
  }
  return url.toString();
}
