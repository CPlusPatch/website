import { rotateEclipticToEquatorial, type Vec3 } from "@cpluspatch/orbit";
import { finite, validatePole } from "../validate.ts";
import { type Orientation, orientationFromPole } from "./pole.ts";

/** A fixed pole (unit vector, ecliptic J2000) and a constant spin. `w0` in rad at J2000, `rate` in rad/s (negative = retrograde). W is measured from the ascending node of the body's equator on the ICRF equator, as in the IAU models. */
export type UniformRotation = {
    type: "uniform";
    pole: Vec3;
    w0: number;
    rate: number;
};

export const uniformOrientation = (
    { pole, w0, rate }: UniformRotation,
    t: number,
): Orientation => {
    const { x, y, z } = rotateEclipticToEquatorial(pole);

    return orientationFromPole(Math.atan2(y, x), Math.asin(z), w0 + rate * t);
};

export const validateUniform = (
    path: string,
    input: Record<string, unknown>,
    errors: string[],
): UniformRotation | null => {
    const before = errors.length;
    const pole = validatePole(`${path}.pole`, input.pole, errors);
    const { w0, rate } = input;
    const validW0 = finite(`${path}.w0`, w0, errors) ? w0 : null;
    const validRate = finite(`${path}.rate`, rate, errors) ? rate : null;

    if (
        errors.length > before ||
        !pole ||
        validW0 === null ||
        validRate === null
    ) {
        return null;
    }

    return { type: "uniform", pole, w0: validW0, rate: validRate };
};
