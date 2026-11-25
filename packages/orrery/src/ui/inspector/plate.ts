import { AU, type Elements } from "@cpluspatch/orbit";
import type { AUnit } from "../../editing.ts";
import {
    formatPlateDistance,
    formatScaleLength,
    formatSoon,
    listUnit,
} from "../../format.ts";
import { type Point, plateGeometry } from "../../plate.ts";
import type { Readouts } from "../../readouts.ts";
import type { Units } from "../../units.ts";
import { otherUnit } from "../../units.ts";
import { h, setText } from "../dom.ts";

const SVG_NS = "http://www.w3.org/2000/svg";

/** The SVG's size in its own units. The CSS scales it to the card, see `styles/card.css`. */
const WIDTH = 224;
const HEIGHT = 158;
/** Half a badge's width, and the gap it keeps to the drawing's left and right edges. */
const BADGE_HALF = 9;
const BADGE_GAP = 12;
/** How far a badge sits out from its apsis. */
const BADGE_OFFSET = 16;
// The side pad holds a badge at its offset without clamping, so it never covers its apsis.
const SIDE_PAD = BADGE_HALF + BADGE_GAP + BADGE_OFFSET;
const BOX = {
    x: SIDE_PAD,
    y: 20,
    width: WIDTH - 2 * SIDE_PAD,
    height: 118,
};
const SCALE_MAX_PX = 44;

/** What a plate draws. */
export type PlateData = Pick<Elements, "a" | "e" | "raan" | "argp"> &
    Pick<Readouts, "periapsisAltitude" | "apoapsisAltitude"> &
    /** Without the times, the legend shows the altitudes only. */
    Partial<Pick<Readouts, "timeToPeriapsis" | "timeToApoapsis">> & {
        /** The body's true anomaly in radians. */
        trueAnomaly: number;
        /** The parent's radius in metres. */
        parentRadius: number;
        bodyColor: string;
        parentColor: string;
        /** The unit the reader chose, or `null` while the plate picks one. */
        unit: AUnit | null;
    };

/** The plate of a card, and the nodes that `refreshPlate` updates. */
export type Plate = {
    element: HTMLElement;
    orbit: SVGElement;
    apsides: SVGElement;
    radius: SVGElement;
    parent: SVGElement;
    periapsis: Apsis;
    apoapsis: Apsis;
    ring: SVGElement;
    dot: SVGElement;
    arrow: SVGElement;
    legend: { periapsis: LegendRow; apoapsis: LegendRow };
    scale: HTMLElement;
    bar: HTMLElement;
    number: HTMLElement;
    unitSwitch: HTMLButtonElement;
    /** The unit the switch shows, `null` before the first refresh. */
    shown: AUnit | null;
};

type Apsis = { marker: SVGElement; badge: SVGElement };
type LegendRow = { altitude: HTMLElement; time: HTMLElement };

const svg = (
    tag: string,
    attributes: Record<string, string> = {},
    ...children: SVGElement[]
): SVGElement => {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [name, value] of Object.entries(attributes)) {
        node.setAttribute(name, value);
    }
    node.append(...children);

    return node;
};

/** Sets attributes that differ, so an unchanged plate leaves the DOM alone. */
const set = (node: Element, attributes: Record<string, string>): void => {
    for (const [name, value] of Object.entries(attributes)) {
        if (node.getAttribute(name) !== value) node.setAttribute(name, value);
    }
};

const round = (n: number): string => String(Math.round(n * 10) / 10);

const direction = (from: Point, to: Point): Point => {
    const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;

    return { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
};

const createApsis = (name: string): Apsis => {
    // The baseline sits 4 units below the badge centre.
    const label = svg("text", {
        class: "orrery__plate-badge",
        "text-anchor": "middle",
        y: "4",
    });
    label.textContent = name;
    const badge = svg(
        "g",
        {},
        svg("rect", {
            width: "18",
            height: "15",
            x: "-9",
            y: "-7.5",
            fill: "var(--orrery-signal)",
        }),
        label,
    );

    return {
        marker: svg("rect", {
            width: "5",
            height: "5",
            fill: "var(--orrery-signal)",
        }),
        badge,
    };
};

const createLegendRow = (name: string): [HTMLElement, LegendRow] => {
    const altitude = h("span", { class: "orrery__plate-altitude" });
    const time = h("span", { class: "orrery__plate-time" });

    return [
        h(
            "div",
            { class: "orrery__plate-apsis" },
            h("span", { class: "orrery__plate-name" }, name),
            altitude,
            time,
        ),
        { altitude, time },
    ];
};

/** Builds the empty plate for `bodyName` orbiting `parentName`. */
export const createPlate = (
    units: Units,
    bodyName: string,
    parentName: string,
): Plate => {
    const orbit = svg("ellipse", {
        fill: "none",
        stroke: "var(--orrery-pick)",
        "stroke-width": "1.5",
    });
    const apsides = svg("line", {
        stroke: "var(--orrery-dim)",
        "stroke-dasharray": "3 3",
    });
    const radius = svg("line", {
        stroke: "var(--orrery-text)",
        "stroke-width": "1",
    });
    const parent = svg("circle");
    const periapsis = createApsis("Pe");
    const apoapsis = createApsis("Ap");
    const ring = svg("circle", {
        r: "7.5",
        fill: "none",
        stroke: "var(--orrery-pick)",
        "stroke-width": "1.25",
    });
    const dot = svg("circle", {
        r: "4",
        stroke: "var(--orrery-ground)",
        "stroke-width": "1.5",
    });
    const arrow = svg("polygon", { fill: "var(--orrery-text)" });
    const drawing = svg(
        "svg",
        {
            viewBox: `0 0 ${WIDTH} ${HEIGHT}`,
            role: "img",
            "aria-label": `Orbit of ${bodyName} around ${parentName}, to scale.`,
        },
        orbit,
        apsides,
        radius,
        parent,
        periapsis.marker,
        periapsis.badge,
        apoapsis.marker,
        apoapsis.badge,
        ring,
        dot,
        arrow,
    );

    const [periapsisRow, periapsisLegend] = createLegendRow("Pe");
    const [apoapsisRow, apoapsisLegend] = createLegendRow("Ap");
    const legend = h(
        "div",
        { class: "orrery__plate-legend", "aria-hidden": "true" },
        periapsisRow,
        apoapsisRow,
    );

    const bar = h("span", { class: "orrery__plate-bar" });
    const number = h("span", { "aria-hidden": "true" });
    const unitSwitch = h("button", {
        type: "button",
        class: "orrery__unit-switch",
    });
    const scale = h(
        "div",
        { class: "orrery__plate-scale" },
        bar,
        number,
        unitSwitch,
    );

    const plate: Plate = {
        element: h(
            "figure",
            { class: "orrery__plate" },
            drawing,
            legend,
            scale,
        ),
        orbit,
        apsides,
        radius,
        parent,
        periapsis,
        apoapsis,
        ring,
        dot,
        arrow,
        legend: { periapsis: periapsisLegend, apoapsis: apoapsisLegend },
        scale,
        bar,
        number,
        unitSwitch,
        shown: null,
    };
    unitSwitch.addEventListener("click", () => {
        if (plate.shown) units.toggle(plate.shown);
    });

    return plate;
};

/** Sets a custom property only when it changes, since refreshes run every tick. */
const setStyle = (node: HTMLElement, name: string, value: string): void => {
    if (node.style.getPropertyValue(name) !== value) {
        node.style.setProperty(name, value);
    }
};

/** Moves a badge out from its apsis along the line of apsides, inside the SVG. */
const placeApsis = (apsis: Apsis, at: Point, outward: Point): void => {
    const edge = BADGE_HALF + BADGE_GAP;
    const x = Math.min(
        Math.max(at.x + outward.x * BADGE_OFFSET, edge),
        WIDTH - edge,
    );
    const y = Math.min(
        Math.max(at.y + outward.y * BADGE_OFFSET, 10),
        HEIGHT - 10,
    );

    set(apsis.marker, { x: round(at.x - 2.5), y: round(at.y - 2.5) });
    set(apsis.badge, { transform: `translate(${round(x)} ${round(y)})` });
};

/** Draws `input` into the plate. */
export const refreshPlate = (plate: Plate, input: PlateData): void => {
    const shown = listUnit(
        [input.periapsisAltitude, input.apoapsisAltitude],
        input.unit,
    );
    const geometry = plateGeometry({
        a: input.a,
        e: input.e,
        raan: input.raan,
        argp: input.argp,
        trueAnomaly: input.trueAnomaly,
        parentRadius: input.parentRadius,
        box: BOX,
        scaleMaxPx: SCALE_MAX_PX,
        unitMetres: shown === "km" ? 1000 : AU,
    });
    const { centre, focus, body, heading, periapsis, apoapsis } = geometry;

    set(plate.orbit, {
        cx: round(centre.x),
        cy: round(centre.y),
        rx: round(geometry.rx),
        ry: round(geometry.ry),
        transform: `rotate(${round(geometry.rotation)} ${round(centre.x)} ${round(centre.y)})`,
    });

    const along = direction(apoapsis, periapsis);
    set(plate.apsides, {
        x1: round(apoapsis.x - along.x * 4),
        y1: round(apoapsis.y - along.y * 4),
        x2: round(periapsis.x + along.x * 4),
        y2: round(periapsis.y + along.y * 4),
    });
    set(plate.radius, {
        x1: round(focus.x),
        y1: round(focus.y),
        x2: round(body.x),
        y2: round(body.y),
    });
    set(plate.parent, {
        cx: round(focus.x),
        cy: round(focus.y),
        r: round(geometry.parentPx),
        fill: input.parentColor,
    });

    placeApsis(plate.periapsis, periapsis, along);
    placeApsis(plate.apoapsis, apoapsis, { x: -along.x, y: -along.y });

    set(plate.ring, { cx: round(body.x), cy: round(body.y) });
    set(plate.dot, {
        cx: round(body.x),
        cy: round(body.y),
        fill: input.bodyColor,
    });

    // A triangle just outside the ring, pointing along the heading.
    const normal = { x: -heading.y, y: heading.x };
    const point = (ahead: number, aside: number): string =>
        `${round(body.x + heading.x * ahead + normal.x * aside)},${round(body.y + heading.y * ahead + normal.y * aside)}`;
    set(plate.arrow, {
        points: `${point(14.5, 0)} ${point(9.5, 3)} ${point(9.5, -3)}`,
    });

    const rows = [
        [
            plate.legend.periapsis,
            input.periapsisAltitude,
            input.timeToPeriapsis,
        ],
        [plate.legend.apoapsis, input.apoapsisAltitude, input.timeToApoapsis],
    ] as const;
    for (const [row, altitude, time] of rows) {
        setText(row.altitude, formatPlateDistance(altitude, shown));
        if (time !== undefined) setText(row.time, `in ${formatSoon(time)}`);
    }
    plate.element.classList.toggle(
        "orrery__plate--still",
        input.timeToPeriapsis === undefined,
    );

    setStyle(plate.scale, "--plate-bar-y", round(geometry.scaleBar.y));
    setStyle(plate.scale, "--plate-bar-px", round(geometry.scaleBar.px));
    setText(plate.number, formatScaleLength(geometry.scaleBar.metres, shown));

    // Rewriting the button's text would drop its focus, so only a change does.
    if (plate.shown !== shown) {
        plate.shown = shown;
        plate.unitSwitch.textContent = shown;
        plate.unitSwitch.setAttribute(
            "aria-label",
            `Distance unit: ${shown}. Switch to ${otherUnit(shown)}`,
        );
    }
};
