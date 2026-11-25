import type { Elements } from "@cpluspatch/orbit";

/** An element the editor changes. */
export type Field = "a" | "e" | "i" | "raan" | "argp" | "m";

/** An orbit the scene draws grips on while it's edited. */
export type GripTarget = {
    id: string;
    /** The orbit before the edit, for the change shown while dragging. */
    original: Elements;
    /** The orbit the grips sit on: the draft if it's valid, else `null`, which hides them. */
    elements: () => Elements | null;
    /** The lowest periapsis a drag allows, in metres. */
    minPeriapsis: number;
    /** The mean anomaly of `el` at the editor's current time, in radians. */
    meanAnomaly: (el: Elements) => number;
    /** Writes dragged values (metres or radians) into the fields and redraws the ghost. */
    set: (change: Partial<Record<Field, number>>) => void;
};

/** What an editor draws in the scene. */
export type EditScene = {
    /** Draws an orbit for a body, or none with `null`. */
    ghost: (id: string, elements: Elements | null) => void;
    /** Shows grips on an orbit, or none with `null`. */
    grips: (target: GripTarget | null) => void;
};
