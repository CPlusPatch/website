/**
 * @module
 * Colours for the scene: the `--orrery-*` tokens and the bodies' own colours.
 */

import {
    type Body,
    type Model,
    type OrbitClass,
    orbitClass,
} from "@cpluspatch/sim";
import { Color, SRGBColorSpace } from "three";
import { appearanceOf } from "./appearance.ts";
import { styleOf } from "./tags.ts";

/** The colours of a scene, which come from the `--orrery-*` tokens. */
export type Theme = {
    /** The colour of a body, given the body it orbits. */
    color: (body: Body, parent: Body | undefined) => Color;
    /** The colour of an Earth satellite of an orbit class. */
    classColor: (orbitClass: OrbitClass) => Color;
    /** The colour of the page behind the scene. */
    background: () => Color;
    /** The colour of the selected body's orbit and of an orbit being edited. */
    pick: () => Color;
    /** Removes the probe. */
    stop: () => void;
};

/** CSS colours by model, for the bodies of the solar system scenario. */
export const BODY_COLORS: Partial<Record<Model, string>> = {
    sun: "#ffd27a",
    mercury: "#b9b2a6",
    venus: "#e9cf98",
    earth: "#62a7ff",
    moon: "#cfd0d2",
    mars: "#ec6f4a",
    jupiter: "#dcae7c",
    saturn: "#e8d59a",
    uranus: "#93e0dc",
    neptune: "#7c8cff",
    pluto: "#c8a593",
    // Only bodies with a look of their own; grey moons keep their kind's colour.
    io: "#e6cf63",
    europa: "#dccdb2",
    ganymede: "#aa9f90",
    callisto: "#6f6a66",
    titan: "#e0a452",
    enceladus: "#eef4f7",
    triton: "#dbc1b6",
    ceres: "#a7a199",
    eris: "#e8e6e2",
    haumea: "#c9cfd4",
    makemake: "#c99877",
    vesta: "#bcae9a",
    halley: "#b5c9d6",
};

/** The token that colours Earth satellites of each orbit class. */
export const ORBIT_CLASS_COLORS: Record<OrbitClass, string> = {
    leo: "var(--orrery-orbit-leo)",
    meo: "var(--orrery-orbit-meo)",
    geo: "var(--orrery-orbit-geo)",
    heo: "var(--orrery-orbit-heo)",
};

/** The CSS colour of a body: its own, its orbit class's, its model's, then its tag's. */
export const colorOf = (body: Body, parent: Body | undefined): string => {
    const { color } = appearanceOf(body);

    if (color !== undefined) return color;

    const style = styleOf(body);

    if (style.colorByOrbitClass && parent?.model === "earth" && body.orbit) {
        return ORBIT_CLASS_COLORS[orbitClass(body.orbit.elements)];
    }

    return (
        (body.model === undefined ? undefined : BODY_COLORS[body.model]) ??
        style.color
    );
};

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

    const resolve = (css: string, fallback?: string): Color => {
        const cached = cache.get(css);
        if (cached) return cached;

        // An invalid value is ignored, which would keep the last body's colour.
        probe.style.color = "";
        probe.style.color = css;
        if (probe.style.color === "") {
            if (fallback !== undefined) return resolve(fallback);

            throw new Error(`"${css}" isn't a colour.`);
        }

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
        pick: () => resolve("var(--orrery-pick)"),
        color: (body, parent) =>
            resolve(colorOf(body, parent), styleOf(body).color),
        classColor: (orbitClass) => resolve(ORBIT_CLASS_COLORS[orbitClass]),
        stop: () => probe.remove(),
    };
};
