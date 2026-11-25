import { dot, G } from "@cpluspatch/orbit";
import { styleOf } from "@cpluspatch/render";
import {
    isOrbiting,
    rotationPeriod,
    type System,
    spinAxis,
} from "@cpluspatch/sim";

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
export const bodyStats = (system: System, id: string, t: number): BodyStats => {
    // The system's body has its preset's rotation filled in.
    const body = system.body(id);

    const massive = body.mass.mu > 0;
    // A spacecraft's radius is nominal.
    const { sized } = styleOf(body);

    const axis = spinAxis(body.rotation, t);
    const elements = isOrbiting(body) ? system.elementsAt(id, t) : null;
    // The root has no orbit, so its tilt is from the ecliptic pole.
    const normal = elements
        ? {
              x: Math.sin(elements.i) * Math.sin(elements.raan),
              y: -Math.sin(elements.i) * Math.cos(elements.raan),
              z: Math.cos(elements.i),
          }
        : { x: 0, y: 0, z: 1 };

    return {
        mass: massive ? body.mass.mu / G : null,
        radius: sized ? body.mass.radius : null,
        gravity: massive ? body.mass.mu / body.mass.radius ** 2 : null,
        escapeSpeed: massive
            ? Math.sqrt((2 * body.mass.mu) / body.mass.radius)
            : null,
        day: rotationPeriod(body.rotation, t),
        tilt: axis
            ? Math.acos(Math.min(1, Math.max(-1, dot(axis, normal))))
            : null,
    };
};
