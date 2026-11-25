/** One astronomical unit, in metres (exact, IAU 2012). */
export const AU = 149_597_870_700;

/** Seconds in a day. */
export const DAY = 86_400;

/** The J2000 epoch (2000-01-01 12:00 UTC) as Unix milliseconds. */
export const J2000_UNIX_MS = 946_728_000_000;

/** Degrees to radians. */
export const deg = (x: number): number => (x * Math.PI) / 180;

/** The obliquity of the ecliptic at J2000, in radians (84381.448 arcseconds). */
export const OBLIQUITY_J2000 = deg(84381.448 / 3600);

/** The gravitational constant, in m³ kg⁻¹ s⁻². */
export const G = 6.6743e-11;

/** Kilometres to metres. */
export const km = (x: number): number => x * 1000;

/** Earth's equatorial radius in metres (WGS 72/84), the one TLE altitudes are measured from. */
export const EARTH_RADIUS = km(6378.137);

// From WGS 84 / EGM2008.
/** The J2 of Earth's geopotential. */
export const EARTH_J2 = 1.08262668e-3;
