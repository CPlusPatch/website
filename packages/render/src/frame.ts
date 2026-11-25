import type { Vec3 } from "@cpluspatch/orbit";
import type { Orientation, Snapshot, System } from "@cpluspatch/sim";

/** One evaluation of the scenario: the compiled system and its snapshot at one time. */
export type Frame = { system: System; snapshot: Snapshot };

const vec = (data: Float64Array, at: number): Vec3 => ({
    x: data[at] ?? Number.NaN,
    y: data[at + 1] ?? Number.NaN,
    z: data[at + 2] ?? Number.NaN,
});

/** The position of body `id` relative to the root, or undefined for an unknown id. */
export const positionOf = (frame: Frame, id: string): Vec3 | undefined => {
    const i = frame.system.index.get(id);

    return i === undefined ? undefined : vec(frame.snapshot.r, 3 * i);
};

/** The velocity of body `id` relative to the root, or undefined for an unknown id. */
export const velocityOf = (frame: Frame, id: string): Vec3 | undefined => {
    const i = frame.system.index.get(id);

    return i === undefined ? undefined : vec(frame.snapshot.v, 3 * i);
};

/** The body axes of `id`, or null for an unknown id or a body without rotation. */
export const orientationOf = (frame: Frame, id: string): Orientation | null => {
    const i = frame.system.index.get(id);
    if (i === undefined) return null;

    const at = 9 * i;
    if (Number.isNaN(frame.snapshot.orientation[at])) return null;

    return {
        x: vec(frame.snapshot.orientation, at),
        y: vec(frame.snapshot.orientation, at + 3),
        z: vec(frame.snapshot.orientation, at + 6),
    };
};
