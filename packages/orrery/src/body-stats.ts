import type { Scenario } from "@cpluspatch/orbit";
import {
    dot,
    elementsAt,
    G,
    rotationPeriod,
    spinAxis,
} from "@cpluspatch/orbit";

/** What a body is made of and how it spins, in SI units. A value is null when it has none. */
export type BodyStats = {
    /** The mass in kg. */
    mass: number | null;
    /** The mean radius in metres. */
    radius: number | null;
    /** The gravity at the surface in m/s². */
    gravity: number | null;
    /** The speed needed to leave the surface in m/s. */
    escapeSpeed: number | null;
    /** The sidereal rotation period in seconds. */
    day: number | null;
    /** The angle between the spin axis and the orbit normal in radians, in [0, π]. */
    tilt: number | null;
};

/** The stats of body `id` at time `t`. */
export const bodyStats = (
    scenario: Scenario,
    id: string,
    t: number,
): BodyStats => {
    const body = scenario.bodies.find((candidate) => candidate.id === id);
    if (!body) throw new Error(`There is no body "${id}".`);

    const massive = body.mu > 0;
    // A spacecraft's radius is nominal.
    const sized = body.kind !== "spacecraft";

    const axis = spinAxis(body.model, t);
    const elements = body.parent === null ? null : elementsAt(body, t);
    // The root has no orbit, so its tilt is from the ecliptic pole.
    const normal = elements
        ? {
              x: Math.sin(elements.i) * Math.sin(elements.raan),
              y: -Math.sin(elements.i) * Math.cos(elements.raan),
              z: Math.cos(elements.i),
          }
        : { x: 0, y: 0, z: 1 };

    return {
        mass: massive ? body.mu / G : null,
        radius: sized ? body.radius : null,
        gravity: massive ? body.mu / body.radius ** 2 : null,
        escapeSpeed: massive ? Math.sqrt((2 * body.mu) / body.radius) : null,
        day: rotationPeriod(body.model, t),
        tilt: axis
            ? Math.acos(Math.min(1, Math.max(-1, dot(axis, normal))))
            : null,
    };
};
