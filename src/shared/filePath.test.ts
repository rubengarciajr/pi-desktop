import { describe, expect, it } from "vitest";
import {
  looksLikePath,
  basename,
  resolveAbsolute,
  toRelative,
  segmentTextByPaths,
} from "./filePath";

describe("looksLikePath", () => {
  it("matches absolute, home, and explicit-relative paths", () => {
    expect(looksLikePath("/Users/rubenchis/Desktop/RubenchisMD-1.2.2.dmg")).toBe(true);
    expect(looksLikePath("~/Desktop/notes.txt")).toBe(true);
    expect(looksLikePath("./src/main/index.ts")).toBe(true);
    expect(looksLikePath("../shared/filePath.ts")).toBe(true);
  });

  it("matches bare filenames with a real extension", () => {
    expect(looksLikePath("View.tsx")).toBe(true);
    expect(looksLikePath("favorites.json")).toBe(true);
    expect(looksLikePath("index.html")).toBe(true);
  });

  it("matches multi-segment relative dir paths", () => {
    expect(looksLikePath("src/renderer/src/components")).toBe(true);
    expect(looksLikePath("src/main/ipc.ts")).toBe(true);
  });

  it("rejects URLs", () => {
    expect(looksLikePath("https://github.com/a/b")).toBe(false);
    expect(looksLikePath("http://example.com/path")).toBe(false);
    expect(looksLikePath("file:///Users/x")).toBe(false);
    expect(looksLikePath("www.example.com")).toBe(false);
  });

  it("rejects dates, fractions, and version numbers", () => {
    expect(looksLikePath("7/7/2026")).toBe(false);
    expect(looksLikePath("1/2")).toBe(false);
    expect(looksLikePath("0.3.6")).toBe(false);
    expect(looksLikePath("1.2.2")).toBe(false);
    expect(looksLikePath("v0.3.6")).toBe(false);
  });

  it("rejects prose word-pairs and plain words", () => {
    expect(looksLikePath("and/or")).toBe(false);
    expect(looksLikePath("hello")).toBe(false);
    expect(looksLikePath("some words here")).toBe(false);
  });

  it("ignores trailing punctuation when deciding", () => {
    expect(looksLikePath("src/main/ipc.ts.")).toBe(true);
    expect(looksLikePath("(favorites.json)")).toBe(true);
  });
});

describe("basename", () => {
  it("returns the final segment", () => {
    expect(basename("/a/b/c.txt")).toBe("c.txt");
    expect(basename("/a/b/c/")).toBe("c");
    expect(basename("file.ts")).toBe("file.ts");
  });
});

describe("resolveAbsolute", () => {
  it("passes absolute and home paths through", () => {
    expect(resolveAbsolute("/a/b.ts", "/root")).toBe("/a/b.ts");
    expect(resolveAbsolute("~/x.ts", "/root")).toBe("~/x.ts");
  });

  it("joins relative paths onto cwd", () => {
    expect(resolveAbsolute("src/a.ts", "/root")).toBe("/root/src/a.ts");
    expect(resolveAbsolute("./src/a.ts", "/root")).toBe("/root/src/a.ts");
  });

  it("returns the path unchanged when there is no cwd", () => {
    expect(resolveAbsolute("src/a.ts")).toBe("src/a.ts");
  });
});

describe("toRelative", () => {
  it("strips the cwd prefix", () => {
    expect(toRelative("/root/src/a.ts", "/root")).toBe("src/a.ts");
    expect(toRelative("src/a.ts", "/root")).toBe("src/a.ts");
  });

  it("falls back to absolute when outside cwd", () => {
    expect(toRelative("/other/a.ts", "/root")).toBe("/other/a.ts");
  });

  it("returns the raw path when there is no cwd", () => {
    expect(toRelative("/root/a.ts")).toBe("/root/a.ts");
  });
});

describe("segmentTextByPaths", () => {
  it("is loss-less when rejoined", () => {
    const text = "Created src/main/ipc.ts and View.tsx here.";
    const segs = segmentTextByPaths(text);
    expect(segs.map((s) => s.value).join("")).toBe(text);
  });

  it("flags path tokens and keeps trailing punctuation as plain text", () => {
    const segs = segmentTextByPaths("see favorites.json.");
    const paths = segs.filter((s) => s.isPath).map((s) => s.value);
    expect(paths).toEqual(["favorites.json"]);
  });

  it("does not flag prose", () => {
    const segs = segmentTextByPaths("this and/or that on 7/7/2026");
    expect(segs.some((s) => s.isPath)).toBe(false);
  });
});
