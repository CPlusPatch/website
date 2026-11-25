import {
    type Elements,
    meanAnomalyAt,
    periapsis,
    reepoch,
    wrapAngle,
} from "@cpluspatch/orbit";
import { type AUnit, type Field, fromMetres } from "@cpluspatch/render";
import { A_MAX } from "@cpluspatch/sim";

/** The shortest semi-major axis the editor allows around a parent, in metres. */
export const aMin = (parentRadius: number): number => 1.01 * parentRadius;

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
 * The limits of `a` are shown in `a.unit`, and `a` is required for the `"a"` field only.
 */
export const fieldError = (
    field: Field,
    value: number,
    a?: { aMin: number; unit: AUnit },
): string | null => {
    if (!Number.isFinite(value)) return "Enter a number.";

    if (field === "a") {
        if (!a) throw new Error(`The limits of "a" are missing.`);
        if (value >= a.aMin && value <= A_MAX) return null;

        const { aMin, unit } = a;
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
