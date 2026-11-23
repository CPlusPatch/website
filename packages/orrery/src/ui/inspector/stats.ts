import type { BodyStats } from "../../body-stats.ts";
import {
    formatAngle,
    formatDuration,
    formatEscapeSpeed,
    formatGravity,
    formatMass,
    formatRadius,
} from "../../format.ts";
import { h } from "../dom.ts";

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

    const list = h("dl", { class: "orrery__readouts" });
    for (const [label, value] of rows) {
        list.append(
            h("dt", {}, label),
            h("dd", { class: "orrery__readout" }, value),
        );
    }

    return h(
        "section",
        { class: "orrery__body-stats" },
        h("h3", {}, "Body"),
        list,
    );
};
