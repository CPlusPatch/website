/// <reference types="deno" />

import { builtInScenarios, PRESET_NAMES } from "@cpluspatch/catalog";
import { assertEquals } from "@std/assert";

/** Names sim may spell out, by file. They're v1 and v2 format words, not catalog data. */
const ALLOWED: Record<string, string[]> = {
    // Earth hosts the legacy satellite cloud. "moon" is a legacy kind.
    "scenario.ts": ["earth", "moon"],
};

const COMMENT = /\/\*[\s\S]*?\*\/|\/\/.*$/gm;

// A template literal only counts when it has no `${}`.
const LITERAL =
    /"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\$]|\\.|\$(?!\{))*)`/g;

const root = import.meta.dirname as string;

const sourcesIn = (dir: string): string[] =>
    [...Deno.readDirSync(dir)].flatMap((entry) => {
        const path = `${dir}/${entry.name}`;

        if (entry.isDirectory) return sourcesIn(path);

        return entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")
            ? [path]
            : [];
    });

/** The catalog's names: its presets and the id of every built-in body. */
const catalogNames = (): Set<string> =>
    new Set([
        ...PRESET_NAMES,
        ...builtInScenarios.flatMap((scenario) =>
            scenario.bodies.map((body) => body.id),
        ),
    ]);

/** One line for each string literal in `source` that's one of `names`. */
export const hits = (
    path: string,
    source: string,
    names: Set<string>,
    allowed: readonly string[] = [],
): string[] => {
    // Keep the newlines of a comment so the line numbers stay right.
    const code = source.replace(COMMENT, (comment) =>
        comment.replaceAll(/[^\n]/g, ""),
    );
    const found: string[] = [];

    for (const match of code.matchAll(LITERAL)) {
        const value = match[1] ?? match[2] ?? match[3] ?? "";
        if (!names.has(value) || allowed.includes(value)) continue;

        const line = code.slice(0, match.index).split("\n").length;
        found.push(`${path}:${line}: "${value}"`);
    }

    return found;
};

Deno.test("sim has no body or preset names in its source", () => {
    const names = catalogNames();
    const found = sourcesIn(root).flatMap((path) => {
        const file = path.slice(root.length + 1);

        return hits(
            `packages/sim/src/${file}`,
            Deno.readTextFileSync(path),
            names,
            ALLOWED[file],
        );
    });

    assertEquals(found, []);
});

Deno.test("the name check finds literals and skips comments", () => {
    const names = new Set(["mars", "iss"]);
    const source = [
        '// "mars" in a comment',
        'const a = "mars";',
        "const b = 'iss';",
        "const c = `mars`;",
        // biome-ignore lint/suspicious/noTemplateCurlyInString: it's source text under test
        "const d = `${x}mars`;",
        'const e = "marsh";',
        "/* one",
        '"iss" */ const f = "iss";',
    ].join("\n");

    assertEquals(hits("x.ts", source, names), [
        'x.ts:2: "mars"',
        'x.ts:3: "iss"',
        'x.ts:4: "mars"',
        'x.ts:8: "iss"',
    ]);
});
