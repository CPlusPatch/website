/**
 * @module
 * How the view styles a body, looked up by its tags. Nothing else branches on a tag.
 */

import type { Body } from "@cpluspatch/sim";
import type { Appearance } from "./appearance.ts";

/** A marker drawn as a plain shape. */
export type MarkerShape = "disc" | "ring" | "diamond" | "triangle" | "teardrop";

/** What a tag does to the look and behaviour of a body. */
export type TagStyle = {
    /** The name shown for the body, like "Dwarf planet". */
    label: string;
    /** The title of the group the body is listed under. */
    group: string;
    /** The CSS colour when the body has neither its own nor its preset's. */
    color: string;
    /** Whether an Earth satellite takes its orbit class's colour. */
    colorByOrbitClass: boolean;
    /** The marker's shape, or "role" for the icon of the spacecraft's role tag. */
    shape: MarkerShape | "role";
    /** The marker's size on screen in px. */
    markerPx: number;
    /** The inline SVG content of its 16-unit icon, or null to use the role's. */
    icon: string | null;
    /** Where its label sorts: 2 first, then 1, then 0. */
    labelTier: 0 | 1 | 2;
    /** Whether its label is always big. */
    major: boolean;
    /** Whether bare mode hides its marker. */
    iconMarker: boolean;
    /** Whether it shows an unnamed marker when its label is hidden. */
    needsLabel: boolean;
    /** Whether its orbit line is dimmed. */
    dimOrbit: boolean;
    /** Whether it sets how far a view of its orbit's parent reaches. */
    reach: boolean;
    /** Whether the opening view counts it. */
    opening: boolean;
    /** Whether it counts when a view frames the body it orbits. */
    framed: boolean;
    /** Whether it's a craft: a role tag names its role, and the search rail marks it apart. */
    craft: boolean;
    /** Whether its own children are listed under it. */
    nests: boolean;
    /** Whether its radius is real, and not only the size of its model. */
    sized: boolean;
    /** Whether other bodies can orbit it in the Add body form. */
    canParent: boolean;
    /** Whether it's one of the Add body form's options. */
    adder: boolean;
    /** Whether a list says "moons" for a run of these. */
    isMoon: boolean;
    /** The appearance fields the body has unless its preset or its own sets them. */
    appearance: Appearance;
};

// The defaults most tags share.
const base: TagStyle = {
    label: "",
    group: "Small bodies",
    color: "var(--orrery-muted)",
    colorByOrbitClass: false,
    shape: "triangle",
    markerPx: 8,
    icon: null,
    labelTier: 0,
    major: false,
    iconMarker: false,
    needsLabel: false,
    dimOrbit: false,
    reach: false,
    opening: false,
    framed: true,
    craft: false,
    nests: true,
    sized: true,
    canParent: true,
    adder: false,
    isMoon: false,
    appearance: {},
};

const asteroid: TagStyle = {
    ...base,
    label: "Asteroid",
    color: "var(--orrery-dim)",
    icon: '<path d="M4 4 9.5 1.5 14 5 13 9l1.5 3-6.5 2.5L2 12 1.5 7z" fill="currentColor"/>',
    iconMarker: true,
    dimOrbit: true,
    adder: true,
};

/** The style of a body with no known tag: an asteroid in muted colour, labelled "Body". */
export const FALLBACK: TagStyle = {
    ...asteroid,
    label: "Body",
    color: "var(--orrery-muted)",
    adder: false,
};

/** The style of each known tag. The first tag of a body that's here styles it. */
export const TAG_STYLES: Readonly<Record<string, TagStyle>> = {
    star: {
        ...base,
        label: "Star",
        group: "Stars",
        color: "var(--orrery-signal)",
        shape: "disc",
        markerPx: 12,
        icon: '<circle cx="8" cy="8" r="3.5" fill="currentColor"/><path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3 3l1 1M12 12l1 1M3 13l1-1M12 4l1-1" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
        labelTier: 2,
        major: true,
        reach: true,
        appearance: { glow: true },
    },
    planet: {
        ...base,
        label: "Planet",
        group: "Planets",
        color: "var(--orrery-text)",
        shape: "disc",
        icon: '<circle cx="8" cy="8" r="4.5" fill="currentColor"/><ellipse cx="8" cy="8" rx="7.3" ry="2.4" fill="none" stroke="currentColor" stroke-width="1.2" transform="rotate(-20 8 8)"/>',
        labelTier: 1,
        major: true,
        reach: true,
        opening: true,
        adder: true,
    },
    dwarf: {
        ...base,
        label: "Dwarf planet",
        group: "Dwarf planets",
        shape: "ring",
        markerPx: 7,
        icon: '<circle cx="8" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="2"/>',
        dimOrbit: true,
        adder: true,
    },
    moon: {
        ...base,
        label: "Moon",
        group: "Moons",
        shape: "diamond",
        markerPx: 9,
        icon: '<path d="M10.5 2.2A6 6 0 1 0 13.8 10 4.7 4.7 0 0 1 10.5 2.2z" fill="currentColor"/>',
        needsLabel: true,
        canParent: false,
        adder: true,
        isMoon: true,
    },
    asteroid,
    comet: {
        ...base,
        label: "Comet",
        color: "var(--orrery-dim)",
        shape: "teardrop",
        markerPx: 11,
        icon: '<path d="M3.2 8 15 1 8 12.8z" fill="currentColor" fill-opacity="0.55"/><circle cx="5" cy="11" r="3.5" fill="currentColor"/>',
        iconMarker: true,
        dimOrbit: true,
        canParent: false,
        adder: true,
    },
    spacecraft: {
        ...base,
        label: "Spacecraft",
        group: "Spacecraft",
        color: "var(--orrery-text)",
        colorByOrbitClass: true,
        shape: "role",
        markerPx: 12,
        iconMarker: true,
        needsLabel: true,
        dimOrbit: true,
        framed: false,
        craft: true,
        nests: false,
        sized: false,
        canParent: false,
        adder: true,
        appearance: { mesh: { type: "bus" } },
    },
};

/** The style of the first of `body`'s tags that has one, else `FALLBACK`. */
export const styleOf = (body: Pick<Body, "tags">): TagStyle => {
    for (const tag of body.tags) {
        const style = Object.hasOwn(TAG_STYLES, tag)
            ? TAG_STYLES[tag]
            : undefined;
        if (style) return style;
    }

    return FALLBACK;
};
