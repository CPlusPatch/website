import {
    type AUnit,
    formatDistance,
    formatDuration,
    formatSpeed,
} from "@cpluspatch/render";
import type { Readouts } from "@cpluspatch/sim";

/** The sentence for a screen reader: the apsides, the speed and the period. */
export const spoken = (r: Readouts, unit: AUnit | null): string =>
    `Apoapsis ${formatDistance(r.apoapsisAltitude, unit)} up, in ${formatDuration(r.timeToApoapsis)}. Periapsis ${formatDistance(r.periapsisAltitude, unit)} up, in ${formatDuration(r.timeToPeriapsis)}. Speed ${formatSpeed(r.speed)}. Period ${formatDuration(r.period)}.`;
