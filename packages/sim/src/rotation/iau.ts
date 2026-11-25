import { DAY, deg } from "@cpluspatch/orbit";
import { finite, isRecord, show } from "../validate.ts";
import { type Orientation, orientationFromPole } from "./pole.ts";

// Degrees and Julian centuries or days, not SI, so the tables can be checked against NAIF's pck00011.tpc.

/** A polynomial plus periodic terms, in degrees. Time is Julian centuries for ra and dec, days for w. */
export type Series = {
    /** Constant, linear and quadratic coefficients; 1 to 3 values. */
    poly: number[];
    /** One coefficient per entry of `angles`: sine terms for ra and w, cosine terms for dec. */
    periodic?: number[];
};

/** An angle's constant (deg), rate (deg per Julian century) and optional quadratic (deg per century²). */
export type IauAngle = [number, number] | [number, number, number];

export type IauRotation = {
    type: "iau";
    ra: Series;
    dec: Series;
    w: Series;
    angles?: IauAngle[];
};

const evaluate = (
    { poly, periodic = [] }: Series,
    x: number,
    angles: IauAngle[],
    trig: (x: number) => number,
    T: number,
): number =>
    (poly[0] ?? 0) +
    (poly[1] ?? 0) * x +
    (poly[2] ?? 0) * x * x +
    angles.reduce(
        (sum, [e0, rate, quadratic = 0], k) =>
            sum +
            (periodic[k] ?? 0) * trig(deg(e0 + rate * T + quadratic * T * T)),
        0,
    );

/** The pole (`ra`, `dec`) and prime meridian `w` in degrees at `d` days since J2000. */
export const iauAngles = (
    rotation: IauRotation,
    d: number,
): { ra: number; dec: number; w: number } => {
    const T = d / 36525;
    const angles = rotation.angles ?? [];

    return {
        ra: evaluate(rotation.ra, T, angles, Math.sin, T),
        dec: evaluate(rotation.dec, T, angles, Math.cos, T),
        w: evaluate(rotation.w, d, angles, Math.sin, T),
    };
};

// `t` is UTC-based but IAU models use TDB. The ~69 s offset turns Earth by ~0.3°, which is fine here.
export const iauOrientation = (
    rotation: IauRotation,
    t: number,
): Orientation => {
    const { ra, dec, w } = iauAngles(rotation, t / DAY);

    return orientationFromPole(deg(ra), deg(dec), deg(w));
};

/** The rate of `w` in rad/s, signed. */
export const iauSpinRate = (rotation: IauRotation, t: number): number => {
    const d = t / DAY;

    // A span of one day averages out the periodic terms of the moon models.
    const perDay =
        iauAngles(rotation, d + 0.5).w - iauAngles(rotation, d - 0.5).w;

    return deg(perDay) / DAY;
};

const validateNumbers = (
    path: string,
    input: unknown,
    min: number,
    max: number,
    errors: string[],
): number[] | null => {
    if (!Array.isArray(input)) {
        errors.push(`${path}: must be an array (got ${show(input)})`);

        return null;
    }

    if (input.length < min || input.length > max) {
        errors.push(
            `${path}: must have ${min === max ? min : `${min} to ${max}`} numbers (got ${input.length})`,
        );

        return null;
    }

    const before = errors.length;

    input.forEach((value: unknown, i) => {
        finite(`${path}[${i}]`, value, errors);
    });

    return errors.length > before ? null : (input as number[]);
};

const validateSeries = (
    path: string,
    input: unknown,
    // Undefined when the rotation has no angles, null when they didn't validate.
    angleCount: number | undefined | null,
    errors: string[],
): Series | null => {
    if (!isRecord(input)) {
        errors.push(`${path}: must be an object (got ${show(input)})`);

        return null;
    }

    const { poly, periodic } = input;
    const parsedPoly = validateNumbers(`${path}.poly`, poly, 1, 3, errors);
    let parsedPeriodic: number[] | null | undefined;

    if (periodic !== undefined) {
        parsedPeriodic = validateNumbers(
            `${path}.periodic`,
            periodic,
            0,
            Number.POSITIVE_INFINITY,
            errors,
        );

        if (angleCount === undefined) {
            errors.push(
                `${path}.periodic: must be omitted unless the rotation has angles`,
            );

            parsedPeriodic = null;
        } else if (
            parsedPeriodic &&
            angleCount !== null &&
            parsedPeriodic.length > angleCount
        ) {
            errors.push(
                `${path}.periodic: must have at most ${angleCount} numbers, one per angle (got ${parsedPeriodic.length})`,
            );

            parsedPeriodic = null;
        }
    }

    if (!parsedPoly || parsedPeriodic === null) {
        return null;
    }

    return {
        poly: [...parsedPoly],
        ...(parsedPeriodic ? { periodic: [...parsedPeriodic] } : {}),
    };
};

const validateAngles = (
    path: string,
    input: unknown,
    errors: string[],
): IauAngle[] | null => {
    if (!Array.isArray(input)) {
        errors.push(`${path}: must be an array (got ${show(input)})`);

        return null;
    }

    const parsed: IauAngle[] = [];
    const before = errors.length;

    input.forEach((item: unknown, i) => {
        const angle = validateNumbers(`${path}[${i}]`, item, 2, 3, errors);

        if (angle) {
            parsed.push([...angle] as IauAngle);
        }
    });

    return errors.length > before ? null : parsed;
};

export const validateIau = (
    path: string,
    input: Record<string, unknown>,
    errors: string[],
): IauRotation | null => {
    const before = errors.length;
    const angles =
        input.angles === undefined
            ? undefined
            : validateAngles(`${path}.angles`, input.angles, errors);
    const count = angles === null ? null : angles?.length;
    const ra = validateSeries(`${path}.ra`, input.ra, count, errors);
    const dec = validateSeries(`${path}.dec`, input.dec, count, errors);
    const w = validateSeries(`${path}.w`, input.w, count, errors);

    if (errors.length > before || !ra || !dec || !w) {
        return null;
    }

    return { type: "iau", ra, dec, w, ...(angles ? { angles } : {}) };
};
