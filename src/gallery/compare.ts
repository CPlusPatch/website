/*
 * The bench's compare strip: the current pick as copies, in light and dark,
 * in every theme or in every style. The copies are frames of the pick's own
 * page, not the stories rendered twice, since many stories carry ids and
 * named radios that would clash. This is the pure part; bench-compare.svelte
 * renders it.
 */

import { STYLES } from "@cpluspatch/ui/styles/styles/index.ts";
import { THEMES } from "@cpluspatch/ui/styles/themes/index.ts";

export type CompareMode = "schemes" | "themes" | "styles" | "off";

export const COMPARE_MODES: { value: CompareMode; label: string }[] = [
    { value: "schemes", label: "Light + dark" },
    { value: "themes", label: "Themes" },
    { value: "styles", label: "Styles" },
    { value: "off", label: "Off" },
];

export interface Copy {
    label: string;
    params: Record<string, string>;
}

/**
 * The copies a mode shows. Only the compared setting goes in a copy's URL:
 * the rest come from the bench's look, which the bench adds.
 */
export const copies = (mode: CompareMode): Copy[] => {
    switch (mode) {
        case "schemes":
            return [
                { label: "Light", params: { scheme: "light" } },
                { label: "Dark", params: { scheme: "dark" } },
            ];
        case "themes":
            return THEMES.map((t) => ({
                label: t.label,
                params: { theme: t.value },
            }));
        case "styles":
            return STYLES.map((s) => ({
                label: s.label,
                params: { style: s.value },
            }));
        case "off":
            return [];
    }
};
