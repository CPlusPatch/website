import {
    AU,
    apoapsis,
    type Elements,
    periapsis,
    trueAnomalyAt,
} from "@cpluspatch/orbit";
import {
    type AUnit,
    formatPlateDistance,
    formatScaleLength,
    formatSoon,
    listUnit,
    otherUnit,
} from "@cpluspatch/render";
import type { Readouts } from "@cpluspatch/sim";
import { type Point, plateGeometry } from "../../plate.ts";

/** The SVG's size in its own units. The CSS scales it to the card, see `styles/card.css`. */
export const WIDTH = 224;
export const HEIGHT = 158;
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

/** What a plate takes from the scene rather than from the orbit. */
export type Drawn = Pick<
    PlateData,
    "parentRadius" | "bodyColor" | "parentColor" | "unit"
>;

/** The plate of a form's draft. It has no times, as they'd be of the saved orbit. */
export const draftPlate = (
    draft: Elements,
    mu: number,
    t: number,
    drawn: Drawn,
): PlateData => ({
    a: draft.a,
    e: draft.e,
    raan: draft.raan,
    argp: draft.argp,
    trueAnomaly: trueAnomalyAt(draft, mu, t),
    periapsisAltitude: periapsis(draft) - drawn.parentRadius,
    apoapsisAltitude: apoapsis(draft) - drawn.parentRadius,
    ...drawn,
});

/** The plate of a saved orbit, with the readouts' altitudes and times. */
export const livePlate = (
    now: Pick<Elements, "a" | "e" | "raan" | "argp">,
    current: Readouts,
    drawn: Drawn,
): PlateData => ({
    a: now.a,
    e: now.e,
    raan: now.raan,
    argp: now.argp,
    trueAnomaly: current.trueAnomaly,
    periapsisAltitude: current.periapsisAltitude,
    apoapsisAltitude: current.apoapsisAltitude,
    timeToPeriapsis: current.timeToPeriapsis,
    timeToApoapsis: current.timeToApoapsis,
    ...drawn,
});

type Line = { x1: number; y1: number; x2: number; y2: number };
type Dot = { cx: number; cy: number };

/** Where an apsis and its badge are drawn. */
type ApsisView = {
    /** The marker's top left corner. */
    marker: { x: number; y: number };
    /** The badge's centre. */
    badge: { x: number; y: number };
};

/** The legend row of an apsis. The time is `null` when the plate has none. */
type LegendView = { altitude: string; time: string | null };

/** The numbers and strings of a plate's SVG and legend, rounded to a tenth. */
export type PlateView = {
    orbit: Dot & { rx: number; ry: number; transform: string };
    apsides: Line;
    radius: Line;
    parent: Dot & { r: number; fill: string };
    periapsis: ApsisView;
    apoapsis: ApsisView;
    body: Dot & { fill: string };
    /** The `points` of the arrow beside the body. */
    arrow: string;
    legend: { periapsis: LegendView; apoapsis: LegendView };
    /** True when the plate has no times, which makes the legend two lines shorter. */
    still: boolean;
    scale: { barY: number; barPx: number; text: string };
    /** The unit the plate shows. */
    unit: AUnit;
    /** The label of the unit switch. */
    unitLabel: string;
};

const round = (n: number): number => Math.round(n * 10) / 10;

const direction = (from: Point, to: Point): Point => {
    const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;

    return { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
};

/** Moves a badge out from its apsis along the line of apsides, inside the SVG. */
const placeApsis = (at: Point, outward: Point): ApsisView => {
    const edge = BADGE_HALF + BADGE_GAP;
    const x = Math.min(
        Math.max(at.x + outward.x * BADGE_OFFSET, edge),
        WIDTH - edge,
    );
    const y = Math.min(
        Math.max(at.y + outward.y * BADGE_OFFSET, 10),
        HEIGHT - 10,
    );

    return {
        marker: { x: round(at.x - 2.5), y: round(at.y - 2.5) },
        badge: { x: round(x), y: round(y) },
    };
};

/** Works out what the plate draws for `input`. */
export const plateView = (input: PlateData): PlateView => {
    const unit = listUnit(
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
        unitMetres: unit === "km" ? 1000 : AU,
    });
    const { centre, focus, body, heading, periapsis, apoapsis } = geometry;
    const along = direction(apoapsis, periapsis);

    // A triangle just outside the ring, pointing along the heading.
    const normal = { x: -heading.y, y: heading.x };
    const point = (ahead: number, aside: number): string =>
        `${round(body.x + heading.x * ahead + normal.x * aside)},${round(body.y + heading.y * ahead + normal.y * aside)}`;

    const time = (seconds: number | undefined): string | null =>
        seconds === undefined ? null : `in ${formatSoon(seconds)}`;

    return {
        orbit: {
            cx: round(centre.x),
            cy: round(centre.y),
            rx: round(geometry.rx),
            ry: round(geometry.ry),
            transform: `rotate(${round(geometry.rotation)} ${round(centre.x)} ${round(centre.y)})`,
        },
        apsides: {
            x1: round(apoapsis.x - along.x * 4),
            y1: round(apoapsis.y - along.y * 4),
            x2: round(periapsis.x + along.x * 4),
            y2: round(periapsis.y + along.y * 4),
        },
        radius: {
            x1: round(focus.x),
            y1: round(focus.y),
            x2: round(body.x),
            y2: round(body.y),
        },
        parent: {
            cx: round(focus.x),
            cy: round(focus.y),
            r: round(geometry.parentPx),
            fill: input.parentColor,
        },
        periapsis: placeApsis(periapsis, along),
        apoapsis: placeApsis(apoapsis, { x: -along.x, y: -along.y }),
        body: { cx: round(body.x), cy: round(body.y), fill: input.bodyColor },
        arrow: `${point(14.5, 0)} ${point(9.5, 3)} ${point(9.5, -3)}`,
        legend: {
            periapsis: {
                altitude: formatPlateDistance(input.periapsisAltitude, unit),
                time: time(input.timeToPeriapsis),
            },
            apoapsis: {
                altitude: formatPlateDistance(input.apoapsisAltitude, unit),
                time: time(input.timeToApoapsis),
            },
        },
        still: input.timeToPeriapsis === undefined,
        scale: {
            barY: round(geometry.scaleBar.y),
            barPx: round(geometry.scaleBar.px),
            text: formatScaleLength(geometry.scaleBar.metres, unit),
        },
        unit,
        unitLabel: `Distance unit: ${unit}. Switch to ${otherUnit(unit)}`,
    };
};
