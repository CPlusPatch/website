import { length, type Vec3 } from "@cpluspatch/orbit";

export const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

export const show = (value: unknown): string => {
    if (typeof value === "number") {
        return String(value);
    }

    if (value === null) {
        return "null";
    }

    return typeof value === "string" ? JSON.stringify(value) : typeof value;
};

export const finite = (
    path: string,
    value: unknown,
    errors: string[],
): value is number => {
    if (typeof value === "number" && Number.isFinite(value)) {
        return true;
    }

    errors.push(`${path}: must be a finite number (got ${show(value)})`);

    return false;
};

/** Checks a unit vector at `path` and returns it, or null after pushing errors. */
export const validatePole = (
    path: string,
    pole: unknown,
    errors: string[],
): Vec3 | null => {
    if (!isRecord(pole)) {
        errors.push(`${path}: must be an object (got ${show(pole)})`);

        return null;
    }

    const { x, y, z } = pole;
    const px = finite(`${path}.x`, x, errors) ? x : null;
    const py = finite(`${path}.y`, y, errors) ? y : null;
    const pz = finite(`${path}.z`, z, errors) ? z : null;

    if (px === null || py === null || pz === null) {
        return null;
    }

    const v = { x: px, y: py, z: pz };
    const len = length(v);

    if (Math.abs(len - 1) > 1e-6) {
        errors.push(`${path}: must be a unit vector (got length ${len})`);

        return null;
    }

    // A pole that's already unit to rounding is kept, so a saved scenario loads back unchanged.
    return Math.abs(len - 1) < 1e-12
        ? v
        : { x: v.x / len, y: v.y / len, z: v.z / len };
};
