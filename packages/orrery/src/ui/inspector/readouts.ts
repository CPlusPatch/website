import type { AUnit } from "../../editing.ts";
import {
    formatAngle,
    formatDistance,
    formatDuration,
    formatSpeed,
} from "../../format.ts";
import type { Readouts } from "../../readouts.ts";
import { h, setText } from "../dom.ts";

/** The sentence for a screen reader: the apsides, the speed and the period. */
const spoken = (r: Readouts, unit: AUnit | null): string =>
    `Apoapsis ${formatDistance(r.apoapsisAltitude, unit)} up, in ${formatDuration(r.timeToApoapsis)}. Periapsis ${formatDistance(r.periapsisAltitude, unit)} up, in ${formatDuration(r.timeToPeriapsis)}. Speed ${formatSpeed(r.speed)}. Period ${formatDuration(r.period)}.`;

/** The headline readout of a card, and the cells that `refreshHeadline` fills. */
export type Headline = {
    element: HTMLElement;
    distance: HTMLElement;
    speed: HTMLElement;
    period: HTMLElement;
    anomaly: HTMLElement;
    spoken: HTMLElement;
};

/** Builds the empty headline for a body orbiting `parentName`. */
export const createHeadline = (parentName: string): Headline => {
    const [distance, speed, period, anomaly] = [
        h("span", { class: "orrery__headline-distance" }),
        h("span"),
        h("span"),
        h("span"),
    ];
    const spokenText = h("p", {
        class: "visually-hidden",
        "aria-live": "off",
    });

    return {
        element: h(
            "div",
            { class: "orrery__inspector-headline" },
            h(
                "p",
                { class: "orrery__headline-now" },
                distance,
                h(
                    "span",
                    { class: "orrery__headline-from" },
                    `from ${parentName}`,
                ),
            ),
            h(
                "dl",
                { class: "orrery__stats-grid orrery__headline-grid" },
                ...(
                    [
                        ["Speed", speed],
                        ["Period", period],
                        ["True anomaly", anomaly],
                    ] as const
                ).map(([label, value]) =>
                    h("div", {}, h("dt", {}, label), h("dd", {}, value)),
                ),
            ),
            spokenText,
        ),
        distance,
        speed,
        period,
        anomaly,
        spoken: spokenText,
    };
};

/** Writes the current readouts into the headline, in `chosen` unit or the distance's own. */
export const refreshHeadline = (
    headline: Headline,
    current: Readouts,
    chosen: AUnit | null,
): void => {
    setText(headline.distance, formatDistance(current.distance, chosen));
    setText(headline.speed, formatSpeed(current.speed));
    setText(headline.period, formatDuration(current.period));
    setText(headline.anomaly, formatAngle(current.trueAnomaly));
    setText(headline.spoken, spoken(current, chosen));
};
