import { OVERRIDES } from "../styles/overrides.ts";
import { STORAGE_KEY } from "./display.ts";

/**
 * The Display menu's choices that change the whole page's look: the theme
 * and each override, saved under these names and painted onto <html> as
 * data-<name>.
 */
export const PAINTED = ["theme", ...OVERRIDES.map(({ name }) => name)];

/**
 * A script for the <head>, to inline as it is (`<script is:inline
 * set:html={themeInitScript}>` in Astro, or the same with v-html and
 * {@html}). It sets the theme and overrides picked in the Display menu on
 * another page on <html>, as data-<name>, before first paint, so the page
 * doesn't flash the defaults. The menu takes over from these once it loads
 * (see bindDisplayMenu in display.ts).
 *
 * Self-contained, so it can be inlined anywhere. Blocked storage, or nothing
 * saved yet, leaves the page as it is.
 */
export const themeInitScript = `try {
    const choices = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) ?? "{}");
    const root = document.documentElement;
    for (const name of ${JSON.stringify(PAINTED)}) {
        const attr = "data-" + name;
        if (typeof choices[name] === "string" && !root.hasAttribute(attr))
            root.setAttribute(attr, choices[name]);
    }
} catch {}`;
