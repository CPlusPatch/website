/** One astronomical unit, in metres (exact, IAU 2012). */
export const AU = 149_597_870_700;

/** Seconds in a day. */
export const DAY = 86_400;

/** The J2000 epoch (2000-01-01 12:00 UTC) as Unix milliseconds. */
export const J2000_UNIX_MS = 946_728_000_000;

/** The obliquity of the ecliptic at J2000, in radians (84381.448 arcseconds). */
export const OBLIQUITY_J2000 = ((84381.448 / 3600) * Math.PI) / 180;

/** The gravitational constant, in m³ kg⁻¹ s⁻². */
export const G = 6.6743e-11;

/** Kilometres to metres. */
export const km = (x: number): number => x * 1000;
