/**
 * Writing tokens into an existing stylesheet.
 */

import type { Tokens } from "./generate.ts";
import type { Pair } from "./types.ts";

export const START_MARKER = "palette:start";
export const END_MARKER = "palette:end";

const DECLARATION = /^(\s*)--color-([\w-]+):\s*(.+);\s*$/;

const toValue = ({ light, dark }: Pair) => `light-dark(${light}, ${dark})`;

export interface StylesheetUpdate {
    css: string;
    /** One line per added (+), removed (-) or changed (~) declaration. */
    changes: string[];
}

/**
 * Bring the `--color-*` declarations between the start and end markers in
 * line with `tokens`. Values are rewritten in place, so hand-written comments
 * and ordering survive; declarations for tokens that no longer exist are
 * dropped, and new ones go just before the end marker.
 */
export const updateStylesheet = (
    css: string,
    tokens: Tokens,
): StylesheetUpdate => {
    const lines = css.split("\n");
    const start = lines.findIndex((line) => line.includes(START_MARKER));
    const end = lines.findIndex((line) => line.includes(END_MARKER));
    if (start === -1 || end < start) {
        throw new Error(
            `expected /* ${START_MARKER} */ ... /* ${END_MARKER} */ markers`,
        );
    }

    const changes: string[] = [];
    const region: string[] = [];
    const seen = new Set<string>();

    for (const line of lines.slice(start + 1, end)) {
        const match = line.match(DECLARATION);
        if (!match) {
            region.push(line);
            continue;
        }
        const [, indent, name, current] = match;
        const pair = tokens.get(name);
        if (!pair) {
            changes.push(`- --color-${name}`);
            continue;
        }
        seen.add(name);
        const value = toValue(pair);
        if (value !== current) {
            changes.push(`~ --color-${name}: ${current} -> ${value}`);
        }
        region.push(`${indent}--color-${name}: ${value};`);
    }

    const indent = lines[end].match(/^\s*/)?.[0] ?? "";
    for (const [name, pair] of tokens) {
        if (seen.has(name)) continue;
        changes.push(`+ --color-${name}`);
        region.push(`${indent}--color-${name}: ${toValue(pair)};`);
    }

    return {
        css: [
            ...lines.slice(0, start + 1),
            ...region,
            ...lines.slice(end),
        ].join("\n"),
        changes,
    };
};
