import { bodyOrientation } from "../orientation.ts";
import { j2Precession, type Precession } from "../precession.ts";
import type { Body, OrbitingBody } from "../scenario.ts";

// Missing data gives no drift, and the validator reports it when it has presets.
const NONE: Precession = {
    pole: { x: 0, y: 0, z: 1 },
    nodeRate: 0,
    argpRate: 0,
};

/** The J2 drift of `body` around `parent`, from the parent's gravity and its pole at the epoch. */
export const resolveJ2 = (body: OrbitingBody, parent: Body): Precession => {
    const { gravity, rotation } = parent;
    const axes = bodyOrientation(rotation, body.orbit.elements.epoch);

    if (!gravity || !axes) return NONE;

    return j2Precession(
        body.orbit.elements,
        parent.mass.mu,
        gravity.j2,
        gravity.radius,
        axes.z,
    );
};
