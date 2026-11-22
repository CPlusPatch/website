/**
 * @module
 * The picked orbit's apsides and numbers, drawn as DOM over the scene.
 */

import type { Elements, State, Vec3 } from "@cpluspatch/orbit";
import { elementsAt, orbitPoints } from "@cpluspatch/orbit";
import { type PerspectiveCamera, Vector3 } from "three";
import {
    formatDistance,
    formatDuration,
    formatSoon,
    formatSpeed,
} from "../format.ts";
import { readouts } from "../readouts.ts";
import { h, setText } from "../ui/dom.ts";
import type { Units } from "../units.ts";
import type { World } from "../world.ts";
import type { Rect } from "./geometry/labels.ts";
import {
    blockSpots,
    type Clearance,
    firstClear,
    firstClearStack,
    noteSpots,
    READOUTS_MIN_ORBIT_PX,
} from "./geometry/notes.ts";
import { orbitShown, projectedRadiusPx } from "./geometry/visibility.ts";
import { createMeasure } from "./measure.ts";

/** What the readouts need each frame. */
export type ReadoutsFrame = {
    camera: PerspectiveCamera;
    /** The floating origin, in metres. */
    origin: Vec3;
    states: Map<string, State>;
    viewport: { width: number; height: number };
    /** Whether a ghost or the grips show. */
    hidden: boolean;
    /** The boxes the scene's labels took, by body id. */
    labels: ReadonlyMap<string, Rect>;
    /** Rects that notes keep out of. */
    blocked: readonly Rect[];
};

/** The picked orbit's flags and notes. */
export type SceneReadouts = {
    /** Moves the flags and notes, or hides them when the orbit is small or `hidden` is set. */
    update: (frame: ReadoutsFrame) => void;
    /** Removes the flags and notes. */
    dispose: () => void;
};

/** Samples are uniform in eccentric anomaly, so index 0 is the periapsis. */
const SAMPLES = 180;
const AP_INDEX = SAMPLES / 2;

/** The px between the lines of the speed and period block. */
const BLOCK_LINE_PX = 16;

const FLAG_PAD_PX = 10;
const APSIS_NOTE_GAP_PX = 8;
const BLOCK_GAP_PX = 10;

/** An orbit's samples in km, relative to its parent. */
const sampled = new WeakMap<Elements, Float64Array>();

const samplesOf = (elements: Elements): Float64Array => {
    let points = sampled.get(elements);
    if (!points) {
        points = orbitPoints(elements, SAMPLES).map((metres) => metres / 1000);
        sampled.set(elements, points);
    }

    return points;
};

type Apsis = {
    flag: HTMLElement;
    note: HTMLElement;
    index: number;
    name: string;
};

const move = (element: HTMLElement, x: number, y: number) => {
    element.style.transform = `translate(${x}px, ${y}px)`;
};

/** The flags and notes of the picked orbit, in `host`. */
export const createReadouts = (
    container: HTMLElement,
    host: HTMLElement,
    world: World,
    units: Units,
): SceneReadouts => {
    const apsides: Apsis[] = [
        { name: "Pe", index: 0 },
        { name: "Ap", index: AP_INDEX },
    ].map(({ name, index }) => ({
        name,
        index,
        flag: h("div", { class: "orrery__flag", hidden: "" }, name),
        note: h("div", { class: "orrery__note", hidden: "" }),
    }));
    const block = [
        h("div", { class: "orrery__note", hidden: "" }),
        h("div", { class: "orrery__note", hidden: "" }),
    ];
    const everything = [
        ...apsides.flatMap(({ flag, note }) => [flag, note]),
        ...block,
    ];
    host.append(...everything);

    const flagFont = createMeasure(apsides[0]?.flag ?? host);
    const noteFont = createMeasure(block[0] ?? host);
    let disposed = false;
    document.fonts.ready.then(() => {
        if (disposed) return;

        flagFont.refresh();
        noteFont.refresh();
    });

    const view = new Vector3();
    const base = new Vector3();
    // The orbit's screen points as x, y pairs, closed. A point behind the camera is NaN.
    const line = new Float64Array(2 * (SAMPLES + 1));
    const taken: Rect[] = [];
    const viewport = { width: 0, height: 0 };
    const apsisClearance: Clearance = {
        viewport,
        taken,
        line,
        gap: APSIS_NOTE_GAP_PX,
    };
    const blockClearance: Clearance = { ...apsisClearance, gap: BLOCK_GAP_PX };
    let shown = false;

    const setShown = (next: boolean) => {
        if (next === shown) return;

        shown = next;
        container.toggleAttribute("data-readouts", next);
        if (!next) for (const element of everything) element.hidden = true;
    };

    // Writes the screen point of a point `rel` km from `base` into `line`.
    const project = (
        camera: PerspectiveCamera,
        rel: Float64Array,
        k: number,
    ) => {
        view.set(
            base.x + (rel[3 * k] ?? 0),
            base.y + (rel[3 * k + 1] ?? 0),
            base.z + (rel[3 * k + 2] ?? 0),
        );
        view.applyMatrix4(camera.matrixWorldInverse);
        // A point behind the camera projects to a mirrored spot.
        if (view.z >= 0) {
            line[2 * k] = Number.NaN;
            line[2 * k + 1] = Number.NaN;

            return;
        }

        view.applyMatrix4(camera.projectionMatrix);
        line[2 * k] = (view.x * 0.5 + 0.5) * viewport.width;
        line[2 * k + 1] = (0.5 - view.y * 0.5) * viewport.height;
    };

    return {
        update: ({
            camera,
            origin,
            states,
            viewport: size,
            hidden,
            labels,
            blocked,
        }) => {
            const { selected } = world;
            const body =
                selected === null
                    ? undefined
                    : world.scenario.bodies.find(({ id }) => id === selected);
            const elements = body ? elementsAt(body, world.clock.t) : null;
            const parentR = body?.parent
                ? states.get(body.parent)?.r
                : undefined;
            if (hidden || !body || !elements || !parentR) {
                setShown(false);
                return;
            }

            viewport.width = size.width;
            viewport.height = size.height;
            base.set(
                (parentR.x - origin.x) / 1000,
                (parentR.y - origin.y) / 1000,
                (parentR.z - origin.z) / 1000,
            );
            const aPx = projectedRadiusPx(
                elements.a / 1000,
                camera.position.distanceTo(base),
                (camera.fov * Math.PI) / 180,
                size.height,
            );
            const numbers = readouts(
                world.scenario,
                body.id,
                states,
                world.clock.t,
            );
            if (
                !numbers ||
                aPx <= READOUTS_MIN_ORBIT_PX ||
                !orbitShown(aPx, size.width, size.height, true)
            ) {
                setShown(false);
                return;
            }
            setShown(true);

            const rel = samplesOf(elements);
            let sumX = 0;
            let sumY = 0;
            let count = 0;
            for (let k = 0; k < SAMPLES; k++) {
                project(camera, rel, k);
                const x = line[2 * k] ?? Number.NaN;
                const y = line[2 * k + 1] ?? Number.NaN;
                if (Number.isNaN(x + y)) continue;

                sumX += x;
                sumY += y;
                count++;
            }
            line[2 * SAMPLES] = line[0] ?? Number.NaN;
            line[2 * SAMPLES + 1] = line[1] ?? Number.NaN;
            const cx = sumX / count;
            const cy = sumY / count;

            taken.length = 0;
            taken.push(...blocked, ...labels.values());

            const points = apsides.map((apsis) => {
                const x = line[2 * apsis.index] ?? Number.NaN;
                const y = line[2 * apsis.index + 1] ?? Number.NaN;
                const visible =
                    x >= 0 && x <= size.width && y >= 0 && y <= size.height;
                apsis.flag.hidden = !visible;
                if (!visible) return null;

                move(apsis.flag, x, y);
                const width = flagFont.width(apsis.name) + FLAG_PAD_PX;
                // Matches the flag's 28px lift and 16px box in scene.css.
                taken.push({
                    left: x - width / 2,
                    top: y - 28,
                    right: x + width / 2,
                    bottom: y - 12,
                });

                return { x, y };
            });

            apsides.forEach((apsis, k) => {
                const point = points[k];
                const [altitude, time] =
                    apsis.index === 0
                        ? [numbers.periapsisAltitude, numbers.timeToPeriapsis]
                        : [numbers.apoapsisAltitude, numbers.timeToApoapsis];
                const text = `${formatDistance(altitude, units.get())} · in ${formatSoon(time)}`;
                setText(apsis.note, text);
                const spot =
                    point && count > 0
                        ? firstClear(
                              noteSpots(
                                  point.x,
                                  point.y,
                                  cx,
                                  cy,
                                  noteFont.width(text),
                              ),
                              apsisClearance,
                          )
                        : null;
                apsis.note.hidden = !spot;
                if (!spot) return;

                move(apsis.note, spot.left, spot.top);
                taken.push(spot);
            });

            const tag = labels.get(body.id);
            const lines = [
                formatSpeed(numbers.speed),
                `Period ${formatDuration(numbers.period)}`,
            ];
            const stack = tag
                ? firstClearStack(
                      blockSpots(
                          tag,
                          lines.map((text) => noteFont.width(text)),
                          BLOCK_LINE_PX,
                      ),
                      blockClearance,
                  )
                : null;
            block.forEach((element, k) => {
                const spot = stack?.[k];
                element.hidden = !spot;
                if (!spot) return;

                setText(element, lines[k] ?? "");
                move(element, spot.left, spot.top);
            });
        },
        dispose: () => {
            disposed = true;
            setShown(false);
            for (const element of everything) element.remove();
        },
    };
};
