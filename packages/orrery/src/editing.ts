import type { Elements } from "@cpluspatch/orbit";
import {
    AU,
    meanAnomalyAt,
    periapsis,
    reepoch,
    wrapAngle,
} from "@cpluspatch/orbit";

/** An element the editor changes. */
export type Field = "a" | "e" | "i" | "raan" | "argp" | "m";

/** The longest semi-major axis the editor allows, in metres. */
export const A_MAX = 100 * AU;

/** The unit a semi-major axis is shown in. */
export type AUnit = "km" | "AU";

/** Degrees in a radian. */
export const DEGREES = 180 / Math.PI;

/** The shortest semi-major axis the editor allows around a parent, in metres. */
export const aMin = (parentRadius: number): number => 1.01 * parentRadius;

/** The unit a semi-major axis of `a` metres is shown in: km under 0.1 AU. */
export const aUnit = (a: number): AUnit => (a < 0.1 * AU ? "km" : "AU");

/** A distance in metres in `unit`. */
export const fromMetres = (m: number, unit: AUnit): number =>
    unit === "km" ? m / 1000 : m / AU;

/** A distance in `unit` in metres. */
export const toMetres = (x: number, unit: AUnit): number =>
    unit === "km" ? x * 1000 : x * AU;

/** The elements with `field` set to `value` (metres or radians), keeping the mean anomaly at `t`. */
export const editElements = (
    el: Elements,
    mu: number,
    t: number,
    field: Field,
    value: number,
): Elements => {
    // Moving the epoch to `t` first means the body doesn't jump when a, e, i, Ω or ω change.
    const now = reepoch(el, mu, t);

    switch (field) {
        case "a":
            return { ...now, a: value };
        case "e":
            return { ...now, e: value };
        case "i":
            return { ...now, i: value };
        case "raan":
            return { ...now, raan: wrapAngle(value) };
        case "argp":
            return { ...now, argp: wrapAngle(value) };
        case "m":
            return { ...now, m0: wrapAngle(value) };
    }
};

/** The value of `field` at time `t`, in metres or radians. */
export const fieldValue = (
    el: Elements,
    mu: number,
    t: number,
    field: Field,
): number => (field === "m" ? meanAnomalyAt(el, mu, t) : el[field]);

/** Whether the orbit's periapsis is below the parent's surface. */
export const passesThroughParent = (
    el: Elements,
    parentRadius: number,
): boolean => periapsis(el) < parentRadius;

/** The elements after the edits in `changes` (metres or radians), keeping the mean anomaly at `t`. */
export const draftElements = (
    el: Elements,
    mu: number,
    t: number,
    changes: Partial<Record<Field, number>>,
): Elements => {
    let draft = el;

    for (const field of ["a", "e", "i", "raan", "argp", "m"] as const) {
        const value = changes[field];
        if (value !== undefined) {
            draft = editElements(draft, mu, t, field, value);
        }
    }

    return draft;
};

const limit = (x: number, decimals: number): string =>
    new Intl.NumberFormat("en", { maximumFractionDigits: decimals }).format(x);

/**
 * Why `value` is wrong for `field`, or `null` if it's fine. `value` is in metres or radians.
 * The limits of `a` are shown in `unit`.
 */
export const fieldError = (
    field: Field,
    value: number,
    aMin: number,
    unit: AUnit = "km",
): string | null => {
    if (!Number.isFinite(value)) return "Enter a number.";

    if (field === "a" && (value < aMin || value > A_MAX)) {
        const decimals = unit === "km" ? 0 : 4;
        const scale = 10 ** decimals;
        // Rounded inwards, so the limits shown are values the field accepts.
        const low = Math.ceil(fromMetres(aMin, unit) * scale) / scale;
        const high = Math.floor(fromMetres(A_MAX, unit) * scale) / scale;

        return `Must be between ${limit(low, decimals)} and ${limit(high, decimals)} ${unit}.`;
    }
    if (field === "e" && (value < 0 || value > 0.99)) {
        return "Must be at least 0 and at most 0.99.";
    }
    // A little slack, since 180° as radians can land a bit over π.
    if (field === "i" && (value < 0 || value > Math.PI + 1e-9)) {
        return "Must be between 0° and 180°.";
    }

    return null;
};
