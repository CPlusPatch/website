/**
 * @module
 * Colours for the scene, taken from the site's CSS tokens.
 */

import type { Body, BodyKind } from "@cpluspatch/orbit";
import { Color, SRGBColorSpace } from "three";

/** The colours of a scene, which follow the site's theme. */
export type Theme = {
    /** The colour of a body. */
    color: (body: Body) => Color;
    /** The colour of the page behind the scene. */
    background: () => Color;
    /** Stops watching for theme changes and removes the probe. */
    stop: () => void;
};

const KIND_COLORS: Record<BodyKind, string> = {
    // The accent is too pale on a light background.
    star: "light-dark(var(--color-warning), var(--color-warning-accent))",
    planet: "var(--color-primary)",
    dwarf: "var(--color-secondary)",
    moon: "var(--color-text-muted)",
    spacecraft: "var(--color-success)",
};

/** Whether a change to the root element can change the theme's colours. */
const mayRetheme = (record: MutationRecord): boolean =>
    record.attributeName === "style" ||
    record.attributeName === "class" ||
    record.attributeName?.startsWith("data-") === true;

/** Colours for `container`, calling `onChange` when the site's theme changes. */
export const createTheme = (
    container: HTMLElement,
    onChange: () => void,
): Theme => {
    // Inside the container so it inherits its `color-scheme`.
    const probe = document.createElement("span");
    probe.hidden = true;
    container.append(probe);

    // The tokens are `light-dark()`, which only a computed colour resolves.
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("A 2D canvas is needed to read colours.");

    const cache = new Map<string, Color>();

    const resolve = (css: string): Color => {
        const cached = cache.get(css);
        if (cached) return cached;

        // An invalid value is ignored, which would keep the last body's colour.
        probe.style.color = "";
        probe.style.color = css;
        if (probe.style.color === "")
            throw new Error(`"${css}" isn't a colour.`);

        // The computed colour may be `oklch()`, which three.js can't parse.
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = getComputedStyle(probe).color;
        context.fillRect(0, 0, 1, 1);
        const [r = 0, g = 0, b = 0] = context.getImageData(0, 0, 1, 1).data;

        const color = new Color().setRGB(
            r / 255,
            g / 255,
            b / 255,
            SRGBColorSpace,
        );
        cache.set(css, color);

        return color;
    };

    const changed = () => {
        cache.clear();
        onChange();
    };

    const mutations = new MutationObserver((records) => {
        if (records.some(mayRetheme)) changed();
    });
    mutations.observe(document.documentElement, { attributes: true });

    // The Display menu applies themes with `:has()` on radio inputs, which changes no attribute.
    let pending = 0;
    const onInput = () => {
        cancelAnimationFrame(pending);
        // The styles apply after the event.
        pending = requestAnimationFrame(changed);
    };
    document.addEventListener("change", onInput);

    const scheme = matchMedia("(prefers-color-scheme: dark)");
    scheme.addEventListener("change", changed);

    return {
        background: () => resolve("var(--color-bg)"),
        color: (body) => resolve(body.color ?? KIND_COLORS[body.kind]),
        stop: () => {
            mutations.disconnect();
            document.removeEventListener("change", onInput);
            cancelAnimationFrame(pending);
            scheme.removeEventListener("change", changed);
            probe.remove();
        },
    };
};
