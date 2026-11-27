import { AU, wrapAngle } from "@cpluspatch/orbit";
import {
    type AUnit,
    DEGREES,
    type Field,
    fromMetres,
    toMetres,
} from "@cpluspatch/render";

export type Spec = {
    field: Field;
    label: string;
    unit: string;
    step: number;
    decimals: number;
};

/** What a field holds as typed: its text and the number the browser reads from it. */
export type Typed = { text: string; number: number };

/** A typed semi-major axis with its exact size, which the text only rounds. */
export type Exact = { metres: number; text: string };

/** The step and decimals of the semi-major axis, which depend on the unit and the size. */
export const aScale = (
    unit: AUnit,
    a: number,
): { step: number; decimals: number } => {
    if (unit === "km") return { step: 1000, decimals: 0 };

    // Four significant digits, so a small orbit in AU doesn't read as zero.
    const magnitude = Math.floor(Math.log10(a / AU));

    return {
        step: Math.min(0.05, 10 ** (magnitude - 1)),
        decimals: Math.max(4, 3 - magnitude),
    };
};

/** The fields of the form in order, with the semi-major axis `a` in `unit`. */
export const specs = (unit: AUnit, a: number): Spec[] => [
    { field: "a", label: "Semi-major axis", unit, ...aScale(unit, a) },
    { field: "e", label: "Eccentricity", unit: "", step: 0.01, decimals: 5 },
    { field: "i", label: "Inclination", unit: "°", step: 1, decimals: 2 },
    { field: "raan", label: "Ascending node", unit: "°", step: 5, decimals: 2 },
    {
        field: "argp",
        label: "Argument of periapsis",
        unit: "°",
        step: 5,
        decimals: 2,
    },
    { field: "m", label: "Mean anomaly now", unit: "°", step: 5, decimals: 2 },
];

/** A displayed value as metres or radians. */
export const toSi = (field: Field, x: number, unit: AUnit): number => {
    if (field === "a") return toMetres(x, unit);

    return field === "e" ? x : x / DEGREES;
};

/** Metres or radians as the displayed value. */
export const toDisplay = (field: Field, si: number, unit: AUnit): number => {
    if (field === "a") return fromMetres(si, unit);

    return field === "e" ? si : si * DEGREES;
};

/** `typed` in metres or radians, with the exact size for a semi-major axis that has one. */
export const siOf = (
    field: Field,
    typed: Typed,
    unit: AUnit,
    exact: Exact | null,
): number =>
    field === "a" && exact?.text === typed.text
        ? exact.metres
        : toSi(field, typed.number, unit);

/** Where the fields began, for `changedFields`. */
export type Baseline = {
    /** The start text of each field. */
    starts: ReadonlyMap<Field, string>;
    exact: Exact | null;
    /** The original semi-major axis, in metres. */
    a: number;
    unit: AUnit;
};

/** The fields that differ from their start, in metres or radians, in the order of `fields`. */
export const changedFields = (
    fields: readonly Field[],
    typed: (field: Field) => Typed | undefined,
    { starts, exact, a, unit }: Baseline,
): [Field, number][] => {
    const changed: [Field, number][] = [];

    for (const field of fields) {
        const value = typed(field);
        if (!value) continue;

        // A typed value can round to the start text after a unit switch.
        const same =
            field === "a" && exact?.text === value.text
                ? exact.metres === a
                : value.text === starts.get(field);
        if (same) continue;

        changed.push([field, siOf(field, value, unit, exact)]);
    }

    return changed;
};

/**
 * The text a grip drag writes into `field` for `si`, which is in metres or radians.
 * `meanNow` is the mean anomaly now, and `start` the start text of the mean anomaly.
 */
export const dragText = (
    field: Field,
    si: number,
    unit: AUnit,
    decimals: number,
    meanNow: number,
    start: string,
): string => {
    // The start text, so a swap and swap back leave the mean anomaly moving with the clock.
    if (
        field === "m" &&
        Math.abs(wrapAngle(si - meanNow + Math.PI) - Math.PI) < 1e-9
    )
        return start;

    return toDisplay(field, si, unit).toFixed(decimals);
};

/** The text of the semi-major axis after a unit switch, and the exact size to keep with it. */
export const switchedA = (
    untouched: boolean,
    metres: number,
    unit: AUnit,
    decimals: number,
    start: string,
): { text: string; exact: Exact | null } | null => {
    if (untouched) return { text: start, exact: null };
    if (!Number.isFinite(metres)) return null;

    const text = fromMetres(metres, unit).toFixed(decimals);

    return { text, exact: { metres, text } };
};
