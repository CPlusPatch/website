/// <reference types="deno" />

import { assertEquals } from "@std/assert";

type SourceFile = { path: string; source: string };

/** What each package must not import. Imports point down only. */
const FORBIDDEN: Record<string, string[]> = {
    orbit: ["sim", "catalog", "render", "orrery", "three", "svelte"],
    sim: ["catalog", "render", "orrery", "three", "svelte"],
    catalog: ["render", "orrery", "three", "svelte"],
    render: ["orrery", "catalog", "svelte"],
    orrery: [],
};

/** Packages whose test files may import catalog, for the built-in scenarios as fixtures. */
const CATALOG_IN_TESTS = new Set(["sim", "render"]);

const IMPORT = /\b(?:from|import|new URL)\s*\(?\s*["']([^"']+)["']/g;

// Comments can quote an import, like `from "three"` in prose.
const COMMENT = /\/\*[\s\S]*?\*\/|\/\/.*$/gm;

/** The package or library a specifier points at, or `null` for anything else. */
const targetOf = (path: string, specifier: string): string | null => {
    if (specifier.startsWith(".")) {
        const resolved = new URL(specifier, `file:///${path}`).pathname;

        return /^\/packages\/([^/]+)\//.exec(resolved)?.[1] ?? null;
    }

    return (
        /^(?:@cpluspatch\/([^/]+)|(three|svelte))(?:\/|$)/
            .exec(specifier)
            ?.slice(1)
            .find(Boolean) ?? null
    );
};

/** One line for each import that breaks the package rules. */
export const violations = (files: SourceFile[]): string[] => {
    const found: string[] = [];

    for (const { path, source } of files) {
        const own = /^packages\/([^/]+)\//.exec(path)?.[1];
        const forbidden = own ? FORBIDDEN[own] : undefined;
        if (!own || !forbidden) continue;

        if (path.endsWith(".svelte") && own !== "orrery") {
            found.push(`${path}: .svelte files belong in packages/orrery`);
        }

        const isTest = path.endsWith(".test.ts");
        for (const [, specifier] of source
            .replace(COMMENT, "")
            .matchAll(IMPORT)) {
            const target = targetOf(path, specifier as string);
            if (!target || target === own || !forbidden.includes(target))
                continue;
            if (isTest && target === "catalog" && CATALOG_IN_TESTS.has(own))
                continue;

            found.push(
                `${path}: ${own} must not import ${target} ("${specifier}")`,
            );
        }
    }

    return found;
};

const root = import.meta.dirname as string;

const sourcesIn = (dir: string, path: string): SourceFile[] => {
    const files: SourceFile[] = [];

    try {
        for (const entry of Deno.readDirSync(dir)) {
            if (entry.name === "node_modules") continue;

            const child = `${dir}/${entry.name}`;
            const childPath = `${path}/${entry.name}`;
            if (entry.isDirectory) {
                files.push(...sourcesIn(child, childPath));
            } else if (/\.(ts|svelte)$/.test(entry.name)) {
                files.push({
                    path: childPath,
                    source: Deno.readTextFileSync(child),
                });
            }
        }
    } catch (error) {
        if (!(error instanceof Deno.errors.NotFound)) throw error;
    }

    return files;
};

Deno.test("the packages import only what their layer allows", () => {
    const files = Object.keys(FORBIDDEN).flatMap((name) =>
        ["src", "scripts"].flatMap((folder) =>
            sourcesIn(
                `${root}/${name}/${folder}`,
                `packages/${name}/${folder}`,
            ),
        ),
    );

    assertEquals(violations(files), []);
});

Deno.test("an import of a higher package is reported, absolute or relative", () => {
    const found = violations([
        {
            path: "packages/sim/src/x.ts",
            source: `import { a } from "@cpluspatch/render";`,
        },
        {
            path: "packages/render/src/b.ts",
            source: `export * from "../../orrery/src/y.ts";`,
        },
        {
            path: "packages/orbit/src/c.ts",
            source: `const m = await import("@cpluspatch/sim/x");`,
        },
        {
            path: "packages/sim/src/d.ts",
            source: `import "three/addons/x.js";`,
        },
        {
            path: "packages/render/src/f.ts",
            source: `const u = new URL("../../orrery/src/assets/x.bin", import.meta.url);`,
        },
        {
            path: "packages/sim/src/g.ts",
            source: `// Unlike render, this never imports from "three".\nimport { b } from "./b.ts";`,
        },
        {
            path: "packages/orrery/src/e.ts",
            source: `import { a } from "@cpluspatch/render";`,
        },
    ]);

    assertEquals(found.length, 5);
    assertEquals(
        found.map((line) => line.split(":")[0]),
        [
            "packages/sim/src/x.ts",
            "packages/render/src/b.ts",
            "packages/orbit/src/c.ts",
            "packages/sim/src/d.ts",
            "packages/render/src/f.ts",
        ],
    );
});

Deno.test("only test files in sim and render may import catalog", () => {
    const source = `import { solarSystem } from "@cpluspatch/catalog";`;

    assertEquals(
        violations([{ path: "packages/render/src/a.test.ts", source }]),
        [],
    );
    assertEquals(
        violations([{ path: "packages/sim/src/a.test.ts", source }]),
        [],
    );
    assertEquals(
        violations([{ path: "packages/render/src/a.ts", source }]).length,
        1,
    );
    assertEquals(
        violations([{ path: "packages/orbit/src/a.test.ts", source }]).length,
        1,
    );
});

Deno.test("a .svelte file outside orrery is reported", () => {
    assertEquals(
        violations([{ path: "packages/render/src/a.svelte", source: "" }])
            .length,
        1,
    );
    assertEquals(
        violations([{ path: "packages/orrery/src/a.svelte", source: "" }]),
        [],
    );
});
