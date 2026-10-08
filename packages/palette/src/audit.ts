/**
 * Contrast audit of generated tokens against the minimums they must meet.
 */

import { contrast } from "./contrast.ts";
import type { Tokens } from "./generate.ts";
import { SCHEMES, type Scheme, type Theme } from "./types.ts";

/** WCAG 1.4.3 (AA) minimum for body text. */
const TEXT_MIN = 4.5;

export interface AuditRow {
    scheme: Scheme;
    label: string;
    ratio: number;
    min: number;
    ok: boolean;
}

export const audit = (tokens: Tokens, theme: Theme): AuditRow[] => {
    const rows: AuditRow[] = [];
    for (const scheme of SCHEMES) {
        const resolve = (name: string) => {
            const value = tokens.get(name);
            if (!value) throw new Error(`--color-${name} was never generated`);
            return value[scheme];
        };
        const bg = resolve("bg");
        const on = resolve("on-accent");
        const check = (label: string, ratio: number, min: number) =>
            rows.push({ scheme, label, ratio, min, ok: ratio >= min });

        check("text / bg", contrast(resolve("text"), bg), TEXT_MIN);
        check("text-muted / bg", contrast(resolve("text-muted"), bg), TEXT_MIN);
        for (const [name, spec] of Object.entries(theme.borders)) {
            check(`${name} / bg`, contrast(resolve(name), bg), spec.ratio);
        }
        for (const name of Object.keys(theme.hues)) {
            const c = resolve(name);
            // Each role must work as text on the page AND as a fill under
            // --color-on-accent, so take the worse of the two.
            const worst = Math.min(contrast(c, bg), contrast(c, on));
            check(`${name} (text & fill)`, worst, TEXT_MIN);
        }
    }
    return rows;
};
