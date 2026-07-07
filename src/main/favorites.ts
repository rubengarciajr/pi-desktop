import { app } from "electron";
import { join } from "node:path";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

export interface Favorite {
  path: string;
  name: string;
}

// Favorites are user data, so they live in a file under userData — the same
// reliable location as the GitHub token. Renderer localStorage was used before
// but does not survive app restarts/updates under the file:// origin.
const FAVORITES_FILE = join(app.getPath("userData"), "favorites.json");

export function loadFavorites(): Favorite[] {
  try {
    if (!existsSync(FAVORITES_FILE)) return [];
    const parsed = JSON.parse(readFileSync(FAVORITES_FILE, "utf-8"));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (f): f is Favorite =>
        f && typeof f.path === "string" && typeof f.name === "string",
    );
  } catch {
    return [];
  }
}

export function saveFavorites(favorites: Favorite[]): { success: boolean; error?: string } {
  try {
    writeFileSync(FAVORITES_FILE, JSON.stringify(favorites, null, 2), "utf-8");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
