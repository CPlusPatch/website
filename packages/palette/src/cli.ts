#!/usr/bin/env -S deno run --allow-read --allow-write
/// <reference types="deno" />
/**
 * Usage: cli.ts <palette config> [--check]
 *
 *   (default)   write each theme's tokens into its stylesheet and print a
 *               contrast audit
 *   --check     change nothing; fail if a stylesheet is out of date (CI-safe)
 *
 * Either way, any failed contrast check exits non-zero.
 */

import { type AuditRow, audit } from "./audit.ts";
import { updateStylesheet } from "./css.ts";
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

let failed = false;

for (const theme of palette.themes) {
    const tokens = generate(theme, palette);
    const file = `${configDir}${theme.file}`;
    const fileUrl = new URL(theme.file, configUrl);
    const { css, changes } = updateStylesheet(
        await Deno.readTextFile(fileUrl),
        tokens,
    );
    const rows = audit(tokens, theme);
    const auditFailed = rows.some((row) => !row.ok);
    failed ||= auditFailed;

    if (check) {
        if (changes.length > 0) {
            failed = true;
            console.error(`${file} is out of date with ${configPath}:`);
            for (const change of changes) console.error(`  ${change}`);
            console.error("Run `deno run theme` to update it.\n");
        }
        if (auditFailed) {
            console.error(`${theme.name} fails its contrast audit:`);
            console.error(`${formatAudit(rows.filter((row) => !row.ok))}\n`);
        }
        if (changes.length === 0 && !auditFailed) {
            console.log(`✓ ${file} is up to date (${tokens.size} tokens).`);
        }
        continue;
    }

    if (changes.length > 0) {
        await Deno.writeTextFile(fileUrl, css);
        console.log(`Updated ${file}:`);
        for (const change of changes) console.log(`  ${change}`);
    } else {
        console.log(`${file} is up to date (${tokens.size} tokens).`);
    }
    console.log(`\nContrast audit (${theme.name})\n${formatAudit(rows)}\n`);
}

if (failed) Deno.exit(1);
