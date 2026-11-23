import { km } from "./constants.ts";
import type { Elements } from "./kepler.ts";

/** An Earth orbit band: low, medium, geostationary or highly elliptical. */
export type OrbitClass = "leo" | "meo" | "geo" | "heo";

// WGS 84 equatorial radius, to turn the apoapsis radius into an altitude.
const EARTH_RADIUS = km(6378.137);

// The usual LEO ceiling.
const LEO_CEILING = km(2000);

// A sidereal-day period, so the satellite stays over one longitude.
const GEO_RADIUS = km(42_164);
const GEO_RADIUS_TOLERANCE = km(1000);
const GEO_MAX_E = 0.1;

// Elongated enough that the altitude varies widely, like Molniya (e 0.74).
const HEO_MIN_E = 0.25;

/** The band of an orbit around Earth. `elements.a` is in metres. */
export const orbitClass = (elements: Elements): OrbitClass => {
    const { a, e } = elements;

    if (e >= HEO_MIN_E) return "heo";

    if (a * (1 + e) - EARTH_RADIUS < LEO_CEILING) return "leo";

    if (e < GEO_MAX_E && Math.abs(a - GEO_RADIUS) < GEO_RADIUS_TOLERANCE) {
        return "geo";
    }

    return "meo";
};
