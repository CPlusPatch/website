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

/** The top of the semi-major axis slider, which starts at 0. */
export const SLIDER_MAX = 1000;

/** The longest semi-major axis the editor allows, in metres. */
export const A_MAX = 100 * AU;

/** The unit a semi-major axis is shown in. */
export type AUnit = "km" | "AU";

/** The shortest semi-major axis the editor allows around a parent, in metres. */
export const aMin = (parentRadius: number): number => 1.01 * parentRadius;

/** `x` limited to the range from `min` to `max`. */
export const clamp = (x: number, min: number, max: number): number =>
    Math.min(Math.max(x, min), max);

/** The slider position, from 0 to `SLIDER_MAX`, of `a` on a log scale from `min` to `max`. */
export const aToSlider = (a: number, min: number, max: number): number =>
    clamp(Math.log(a / min) / Math.log(max / min), 0, 1) * SLIDER_MAX;

/** The semi-major axis at slider position `x` on a log scale from `min` to `max`. */
export const sliderToA = (x: number, min: number, max: number): number =>
    min * (max / min) ** clamp(x / SLIDER_MAX, 0, 1);

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
