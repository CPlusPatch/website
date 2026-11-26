import { type Elements, km } from "@cpluspatch/orbit";
import { type Rotation, spinRateAt } from "./rotation/index.ts";

/** A band of orbits around a body: low, medium, geosynchronous or highly elliptical. */
export type OrbitClass = "leo" | "meo" | "geo" | "heo";

/** The body an orbit is around: what its bands are measured against. `mu` is in m³/s², `radius` in m. */
export type OrbitHost = {
    mu: number;
    radius: number;
    rotation?: Rotation | undefined;
};

// The usual LEO ceiling.
const LEO_CEILING = km(2000);

// Near the radius where the period is one spin, so the satellite stays over one longitude.
const GEO_RADIUS_TOLERANCE = km(1000);
const GEO_MAX_E = 0.1;

// Elongated enough that the altitude varies widely, like Molniya (e 0.74).
const HEO_MIN_E = 0.25;

/** The band of an orbit around `host`. `elements.a` is in metres. */
export const orbitClass = (
    elements: Pick<Elements, "a" | "e" | "epoch">,
    host: OrbitHost,
): OrbitClass => {
    const { a, e } = elements;

    if (e >= HEO_MIN_E) return "heo";

    if (a * (1 + e) - host.radius < LEO_CEILING) return "leo";

    if (host.rotation && e < GEO_MAX_E) {
        const spin = Math.abs(spinRateAt(host.rotation, elements.epoch));
        // A body that doesn't turn has no synchronous orbit.
        if (spin > 0) {
            const synchronous = Math.cbrt(host.mu / spin ** 2);

            if (Math.abs(a - synchronous) < GEO_RADIUS_TOLERANCE) return "geo";
        }
    }

    return "meo";
};
