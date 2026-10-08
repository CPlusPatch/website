#!/usr/bin/env -S deno run --allow-read
/// <reference types="deno" />
/**
 * Usage: cli.ts <palette config> [--check]
 *
 *   (default)   print each theme's token block + a contrast audit
 *   --check     verify the theme files still match the config (CI-safe)
 *
 * This deliberately does not write the theme files itself: they carry
 * explanatory comments that a generator would trample.
 */

import { type AuditRow, audit } from "./audit.ts";
import { findDrift, formatBlock } from "./css.ts";
import { generate } from "./generate.ts";
import type { PaletteConfig } from "./types.ts";

const formatAudit = (rows: AuditRow[]): string => {
    const width = Math.max(...rows.map((row) => row.label.length)) + 1;
    return rows
        .flatMap(({ scheme, label, ratio, min, ok }, i) => [
            ...(scheme !== rows[i - 1]?.scheme ? [`[${scheme}]`] : []),
            `  ${ok ? "ok " : "FAIL"} ${label.padEnd(width)}${ratio.toFixed(2)} (min ${min})`,
        ])
        .join("\n");
};

const configPath = Deno.args.find((arg) => !arg.startsWith("--"));
if (!configPath) {
    console.error("Usage: cli.ts <palette config> [--check]");
    Deno.exit(2);
}
const check = Deno.args.includes("--check");

const configUrl = new URL(configPath, `file://${Deno.cwd()}/`);
const palette: PaletteConfig = (await import(configUrl.href)).default;
const configDir = configPath.slice(0, configPath.lastIndexOf("/") + 1);

let drifted = false;

for (const theme of palette.themes) {
    const tokens = generate(theme, palette);
    const file = `${configDir}${theme.file}`;

    if (!check) {
        console.log(`/* ${theme.name} -> ${file} */`);
        console.log(formatBlock(tokens));
        console.log(
            `\n/* Contrast audit\n${formatAudit(audit(tokens, theme))}\n*/\n`,
        );
        continue;
    }

    const css = await Deno.readTextFile(new URL(theme.file, configUrl));
    const drift = findDrift(css, tokens);
    if (drift.length === 0) {
        console.log(`✓ ${file} matches ${configPath} (${tokens.size} tokens).`);
        continue;
    }

    drifted = true;
    console.error(`${file} has drifted from ${configPath}:\n`);
    for (const [name, value] of drift) {
        console.error(`  ${name}\n    expected ${value}`);
    }
    console.error("\nRe-run `deno run theme` and paste the block back in.\n");
}

if (drifted) Deno.exit(1);
