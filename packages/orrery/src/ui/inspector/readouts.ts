import type { AUnit } from "../../editing.ts";
import {
    distanceParts,
    formatAngle,
    formatDistance,
    formatDuration,
    formatSoon,
    formatSpeed,
} from "../../format.ts";
import type { Readouts } from "../../readouts.ts";
import { otherUnit, type Units } from "../../units.ts";
import { h, setText } from "../dom.ts";

/** A readout row: a distance in metres, which gets a unit switch, or finished text. */
type Row = { label: (parent: string) => string } & (
    | { metres: (r: Readouts) => number }
    | { text: (r: Readouts) => string }
);

const FIELDS: Row[] = [
    { label: (parent) => `Distance to ${parent}`, metres: (r) => r.distance },
    { label: () => "Speed", text: (r) => formatSpeed(r.speed) },
    { label: () => "Period", text: (r) => formatDuration(r.period) },
    {
        label: () => "Periapsis altitude",
        metres: (r) => r.periapsisAltitude,
    },
    { label: () => "Apoapsis altitude", metres: (r) => r.apoapsisAltitude },
    { label: () => "True anomaly", text: (r) => formatAngle(r.trueAnomaly) },
];

/** The apsides line, as `Ap 408 km in 41d`, and the sentence for a screen reader. */
const apsides = (
    r: Readouts,
    unit: AUnit | null,
): { parts: string[]; spoken: string } => ({
    parts: [
        `Ap ${formatDistance(r.apoapsisAltitude, unit)} in ${formatSoon(r.timeToApoapsis)}`,
        `Pe ${formatDistance(r.periapsisAltitude, unit)} in ${formatSoon(r.timeToPeriapsis)}`,
        formatSpeed(r.speed),
    ],
    spoken: `Apoapsis ${formatDistance(r.apoapsisAltitude, unit)} up, in ${formatDuration(r.timeToApoapsis)}. Periapsis ${formatDistance(r.periapsisAltitude, unit)} up, in ${formatDuration(r.timeToPeriapsis)}. Speed ${formatSpeed(r.speed)}. Period ${formatDuration(r.period)}.`,
});

/** The readout elements of a card, and the cells that `refreshReadoutRows` fills. */
export type ReadoutRows = {
    /** The apsides line, the sentence for a screen reader and the list, in card order. */
    elements: HTMLElement[];
    values: HTMLElement[];
    // The switch of each distance row, or none for the rows that aren't distances.
    switches: (HTMLButtonElement | null)[];
    line: HTMLElement[];
    spoken: HTMLElement;
};

/** Builds the empty readout rows for a body orbiting `parentName`. */
export const createReadoutRows = (
    parentName: string,
    units: Units,
): ReadoutRows => {
    const values: HTMLElement[] = [];
    const switches: (HTMLButtonElement | null)[] = [];

    const [ap, pe, speed] = [h("span"), h("span"), h("span")];
    const line = [ap, pe, speed];
    const spoken = h("p", { class: "visually-hidden", "aria-live": "off" });
    const list = h("dl", { class: "orrery__readouts" });
    for (const row of FIELDS) {
        const dd = h("dd", { class: "orrery__readout" });

        if ("metres" in row) {
            // The text is filled in by `refreshReadoutRows`, which knows the unit.
            const number = h("span");
            const control = h("button", {
                type: "button",
                class: "orrery__unit-switch",
                // The row's label, so the switches don't all read the same.
                "data-row": row.label(parentName),
            });
            control.addEventListener("click", () =>
                units.set(
                    otherUnit(control.textContent === "km" ? "km" : "AU"),
                ),
            );
            dd.append(number, " ", control);
            values.push(number);
            switches.push(control);
        } else {
            values.push(dd);
            switches.push(null);
        }
        list.append(h("dt", {}, row.label(parentName)), dd);
    }

    return {
        elements: [
            h(
                "p",
                { class: "orrery__orbit-line", "aria-hidden": "true" },
                ap,
                pe,
                speed,
            ),
            spoken,
            list,
        ],
        values,
        switches,
        line,
        spoken,
    };
};

/** Writes the current readouts into the rows, in `chosen` unit or each distance's own. */
export const refreshReadoutRows = (
    rows: ReadoutRows,
    current: Readouts,
    chosen: AUnit | null,
): void => {
    FIELDS.forEach((row, k) => {
        const cell = rows.values[k];
        if (!cell) return;

        if (!("metres" in row)) {
            setText(cell, row.text(current));
            return;
        }

        const [number, unit] = distanceParts(row.metres(current), chosen);
        setText(cell, number);

        // Rewritten only when the unit changes, so a pressed switch keeps its focus.
        const control = rows.switches[k];
        if (control && control.textContent !== unit) {
            const other = otherUnit(unit);
            control.textContent = unit;
            control.setAttribute(
                "aria-label",
                `${control.dataset.row} in ${unit}. Show distances in ${other}`,
            );
            control.title = `Show in ${other} (U)`;
        }
    });

    const text = apsides(current, chosen);
    text.parts.forEach((part, k) => {
        const span = rows.line[k];
        if (span) setText(span, part);
    });
    setText(rows.spoken, text.spoken);
};
