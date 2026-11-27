import type { Colors } from "./draw.ts";

/** Reads the strip's colours and fonts from the custom properties in `style`. */
export const readColors = (
    style: Pick<CSSStyleDeclaration, "getPropertyValue">,
): Colors => {
    const read = (name: string) => style.getPropertyValue(name).trim();

    return {
        rule: read("--orrery-rule"),
        frame: read("--orrery-frame"),
        dim: read("--orrery-dim"),
        muted: read("--orrery-muted"),
        go: read("--orrery-go"),
        text: read("--orrery-text"),
        signal: read("--orrery-signal"),
        pick: read("--orrery-pick"),
        ground: read("--orrery-ground"),
        fontUi: read("--orrery-font-ui"),
        fontData: read("--orrery-font-data"),
    };
};
