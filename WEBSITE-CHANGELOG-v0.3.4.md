# Website Changelog — Pi Desktop v0.3.4 & v0.3.5

Copy for the website changelog / release-notes page. Voice matches the in-app
changelog: concise, benefit-first, plain language.

**Latest download:** https://github.com/rubengarciajr/pi-desktop/releases/latest

---

## Short version (for a compact changelog list)

### v0.3.5 — July 7, 2026

**Fixes**

- **Favorites now stick.** Favorited folders are saved to a file in the app's data folder instead of browser storage that didn't survive a relaunch. They now persist across restarts and app updates, and any favorites you already had are migrated over automatically.

### v0.3.4 — July 7, 2026

**Fixes**

- **One tab per folder.** Opening a folder that's already open now jumps to its existing tab instead of spawning a duplicate. Applies everywhere a folder can be opened — the Sessions list, favorites, the **+** tab button, drag-and-drop, the sidebar, and the macOS **New Session** menu.
- **Clickable working folder.** The folder path shown at the top of a chat is now a button — click it to reveal the folder in Finder.

---

## Expanded version (for a blog-style release post)

### Pi Desktop v0.3.5

**Your favorites finally stay put.** Favorited folders were being kept in the app's in-browser storage, which didn't reliably survive a restart or an update — so your favorites could quietly disappear. They're now written to a real file in the app's data folder, the same reliable place the app already stores your GitHub connection. Favorites persist across restarts and updates, and anything you'd already favorited is carried over the first time you launch this version.

### Pi Desktop v0.3.4

Two small quality-of-life fixes that make working across folders feel less cluttered.

**No more duplicate tabs.** Clicking a session — or re-opening a folder you already had open — used to create a fresh tab every time, leaving you with a stack of identical clones to clean up. Now Pi Desktop enforces one tab per folder: if that folder is already open, it simply brings the existing tab to the front. This is consistent across every way you can open a folder: the Sessions panel, your favorites, the **+** button, dragging a folder onto the tab bar, the sidebar's *New Session*, and the macOS menu.

**Open your working folder in one click.** The working-folder path at the top of each chat is now clickable. Click it and the folder opens in Finder — a quick way to jump from a conversation to the files it's about.

---

## In-app changelog entries (already applied to `DesktopChangelog.tsx`)

```ts
{
  version: "0.3.5",
  date: "2026-07-07",
  sections: [
    {
      title: "Fixes",
      items: [
        "Favorites now persist across restarts and app updates — they're saved to a file in the app's data folder instead of browser storage that didn't survive relaunches (your existing favorites are migrated over automatically)",
      ],
    },
  ],
},
{
  version: "0.3.4",
  date: "2026-07-07",
  sections: [
    {
      title: "Fixes",
      items: [
        "One tab per folder: opening a folder that's already open now focuses the existing tab instead of opening a duplicate — applies across the Sessions list, favorites, the + tab button, drag-and-drop, the sidebar, and the macOS New Session menu",
        "The working-folder path at the top of a chat is now clickable — click it to open the folder in Finder",
      ],
    },
  ],
},
```
