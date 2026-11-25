import {
    formatAngle,
    formatDuration,
    formatEscapeSpeed,
    formatGravity,
    formatMass,
    formatRadius,
    h,
} from "@cpluspatch/render";
import type { BodyStats } from "../../body-stats.ts";

/** The stats section of the card, or null if the body has none to show. */
export const createStatsSection = (stats: BodyStats): HTMLElement | null => {
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
    if (rows.length === 0) return null;

    const list = h(
        "dl",
        { class: "orrery__stats-grid" },
        ...rows.map(([label, value]) =>
            h("div", {}, h("dt", {}, label), h("dd", {}, value)),
        ),
    );

    return h(
        "section",
        { class: "orrery__body-stats" },
        h("h3", {}, "Body"),
        list,
    );
};
