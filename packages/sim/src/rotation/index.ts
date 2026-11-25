import { isRecord, show } from "../validate.ts";
import {
    type IauRotation,
    iauOrientation,
    iauSpinRate,
    validateIau,
} from "./iau.ts";
import type { Orientation } from "./pole.ts";
import {
    type UniformRotation,
    uniformOrientation,
    validateUniform,
} from "./uniform.ts";

export type { IauAngle, IauRotation, Series } from "./iau.ts";
export { iauAngles } from "./iau.ts";
export type { Orientation } from "./pole.ts";
export { orientationFromPole } from "./pole.ts";
export type { UniformRotation } from "./uniform.ts";

/** How a body turns. */
export type Rotation = UniformRotation | IauRotation;

/** What every kind of rotation provides. */
type Kind<R extends Rotation> = {
    /** The body axes at `t` seconds since J2000. */
    orientation(rotation: R, t: number): Orientation;
    /** The rate of the prime-meridian angle in rad/s at `t`, signed. */
    spinRate(rotation: R, t: number): number;
    /** The clean rotation, or null after pushing `<path>.<field>: ...` errors. */
    validate(
        path: string,
        input: Record<string, unknown>,
        errors: string[],
    ): R | null;
};

// A mapped type, so adding a kind to `Rotation` fails to compile until it has an entry.
const KINDS: { [K in Rotation["type"]]: Kind<Extract<Rotation, { type: K }>> } =
    {
        uniform: {
            orientation: uniformOrientation,
            spinRate: (rotation) => rotation.rate,
            validate: validateUniform,
        },
        iau: {
            orientation: iauOrientation,
            spinRate: iauSpinRate,
            validate: validateIau,
        },
    };

// TypeScript can't link `rotation.type` to its entry, so the lookup is cast once here.
const kindOf = <R extends Rotation>(rotation: R): Kind<R> =>
    KINDS[rotation.type] as unknown as Kind<R>;

/** The body axes of `rotation` at `t` seconds since J2000. */
export const orientationAt = (rotation: Rotation, t: number): Orientation =>
    kindOf(rotation).orientation(rotation, t);

/** The rate of the prime-meridian angle of `rotation` in rad/s at `t`, signed. */
export const spinRateAt = (rotation: Rotation, t: number): number =>
    kindOf(rotation).spinRate(rotation, t);

/** Checks a body's `rotation` and returns the clean value. Pushes `<path>.<field>: ...` errors. */
export const validateRotation = (
    path: string,
    input: unknown,
    errors: string[],
): Rotation | null => {
    if (!isRecord(input)) {
        errors.push(`${path}: must be an object (got ${show(input)})`);

        return null;
    }

    const { type } = input;
    const kinds = Object.keys(KINDS) as Rotation["type"][];
    const kind = kinds.find((key) => key === type);

    if (kind === undefined) {
        errors.push(
            `${path}.type: must be one of ${kinds.map((key) => JSON.stringify(key)).join(", ")} (got ${show(type)})`,
        );

        return null;
    }

    return KINDS[kind].validate(path, input, errors);
};
