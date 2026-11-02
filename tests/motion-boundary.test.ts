import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { expect, it } from "vitest";

it("parent route dependency trees do not import animation libraries or vendor animation", () => {
  const seen = new Set<string>();
  function walk(file: string) {
    if (seen.has(file)) return;
    seen.add(file);
    const source = readFileSync(file, "utf8");
    for (const [, name] of source.matchAll(/(?:from\s+|import\s*)["']([^"']+)["']/g)) {
      expect(name, file).not.toMatch(/^(motion(?:\/|$)|gsap|three|ogl)|components\/vendor/);
      if (!name.startsWith("@/") && !name.startsWith(".")) continue;
      const base = name.startsWith("@/") ? resolve(name.slice(2)) : resolve(dirname(file), name);
      const imported = [base + ".ts", base + ".tsx", join(base, "index.ts"), join(base, "index.tsx")].find(existsSync);
      if (imported) walk(imported);
    }
  }
  for (const folder of ["app/(parent)", "app/(public)/pay", "app/(public)/mock-gateway"]) {
    for (const entry of readdirSync(folder, { recursive: true, encoding: "utf8" })) if (/\.(ts|tsx)$/.test(entry)) walk(resolve(folder, entry));
  }
  expect(seen.size).toBeGreaterThan(10);
});
