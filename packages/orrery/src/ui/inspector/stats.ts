import {
    formatAngle,
    formatDuration,
    formatEscapeSpeed,
    formatGravity,
    formatMass,
    formatRadius,
} from "@cpluspatch/render";
import type { BodyStats } from "../../body-stats.ts";

/** The label and text of each stat the body has, in the order the card lists them. */
export const statRows = (
    stats: BodyStats,
): [label: string, value: string][] => {
    const rows: [label: string, value: string][] = [];
    if (stats.mass !== null) rows.push(["Mass", formatMass(stats.mass)]);
    if (stats.radius !== null)
        rows.push(["Radius", formatRadius(stats.radius)]);
    if (stats.gravity !== null) {
        rows.push(["Surface gravity", formatGravity(stats.gravity)]);
    }
    if (stats.escapeSpeed !== null) {
        rows.push(["Escape speed", formatEscapeSpeed(stats.escapeSpeed)]);
    }
    if (stats.day !== null) rows.push(["Day", formatDuration(stats.day)]);
    if (stats.tilt !== null) rows.push(["Axial tilt", formatAngle(stats.tilt)]);

    return rows;
};
