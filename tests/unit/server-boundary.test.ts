import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Ç3d (docs/02-mimari.md, "Sunucuda kullanıcı adına erişim"): the Supabase secret key is used in
// one place in the app, src/core/server/db.ts, and that place is server-only. Whatever else
// works on the server reaches the database through it, in a user's name.

const ROOT = join(__dirname, "..", "..");

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.(ts|tsx|mts|js|mjs)$/.test(entry.name) ? [path] : [];
  });
}

const files = sources(join(ROOT, "src")).map((path) => ({
  path: relative(ROOT, path).replaceAll("\\", "/"),
  text: readFileSync(path, "utf8"),
}));

describe("the server boundary", () => {
  it("reads the secret key in src/core/server/db.ts only", () => {
    const readers = files.filter((file) => file.text.includes("SUPABASE_SECRET_KEY"));
    expect(readers.map((file) => file.path)).toEqual(["src/core/server/db.ts"]);
  });

  it("keeps everything under src/core/server server-only", () => {
    const server = files.filter((file) => file.path.startsWith("src/core/server/"));
    expect(server.length).toBeGreaterThan(0);
    for (const file of server.filter((candidate) => !candidate.path.endsWith(".test.ts"))) {
      expect(file.text, file.path).toMatch(/^import "server-only";/);
    }
  });

  it("is imported by the server's own code only: its routes and itself", () => {
    // The alias, a relative path into src/core/server, or a dynamic import of either.
    const importers = files.filter((file) =>
      /(from |import\()["'](@\/core\/server\/|(\.{1,2}\/)+(core\/)?server\/)/.test(file.text),
    );
    for (const file of importers) {
      expect(
        file.path.startsWith("src/core/server/") || file.path.startsWith("src/app/api/"),
        file.path,
      ).toBe(true);
      expect(file.text, file.path).not.toMatch(/^"use client";/);
    }
  });
});
