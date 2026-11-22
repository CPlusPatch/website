/**
 * @module
 * Colours for the scene: the `--orrery-*` tokens and the bodies' own colours.
 */

import type { Body, BodyKind } from "@cpluspatch/orbit";
import { Color, SRGBColorSpace } from "three";

/** The colours of a scene, which come from the `--orrery-*` tokens. */
export type Theme = {
    /** The colour of a body. */
    color: (body: Body) => Color;
    /** The colour of the page behind the scene. */
    background: () => Color;
    /** Removes the probe. */
    stop: () => void;
};

/** CSS colours by body id, for the bodies of the solar system scenario. */
export const BODY_COLORS: Record<string, string> = {
    sun: "#ffd27a",
    mercury: "#b9b2a6",
    venus: "#e9cf98",
    earth: "#62a7ff",
    moon: "#cfd0d2",
    iss: "#f2f2ee",
    mars: "#ec6f4a",
    jupiter: "#dcae7c",
    saturn: "#e8d59a",
    uranus: "#93e0dc",
    neptune: "#7c8cff",
    pluto: "#c8a593",
};

const KIND_COLORS: Record<BodyKind, string> = {
    star: "var(--orrery-signal)",
    planet: "var(--orrery-text)",
    dwarf: "var(--orrery-muted)",
    moon: "var(--orrery-muted)",
    spacecraft: "var(--orrery-text)",
};

/** The CSS colour of a body: its own, then its id's, then its kind's. */
export const colorOf = (body: Body): string =>
    body.color ?? BODY_COLORS[body.id] ?? KIND_COLORS[body.kind];

/** Colours for `container`. */
export const createTheme = (container: HTMLElement): Theme => {
    // Inside the container, so the tokens resolve as they do for its content.
    const probe = document.createElement("span");
    probe.hidden = true;
    container.append(probe);

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

    return {
        background: () => resolve("var(--orrery-ground)"),
        color: (body) => resolve(colorOf(body)),
        stop: () => probe.remove(),
    };
};
