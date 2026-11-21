import type { Body, State, Vec3 } from "@cpluspatch/orbit";
import { orbitPoints } from "@cpluspatch/orbit";
import type { Color, Scene } from "three";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";

/** The orbit lines of a scene. */
export type Orbits = {
    /** Moves each line to its parent's position relative to `origin`. */
    update: (origin: Vec3, states: Map<string, State>) => void;
    /** Draws the orbit of a body, or of none, thicker. */
    highlight: (id: string | null) => void;
    /** Sets the line width's screen size. */
    resize: (width: number, height: number) => void;
    /** Recolours the lines and their casings. */
    recolor: (color: (body: Body) => Color, background: Color) => void;
    /** Removes the lines and frees them. */
    dispose: () => void;
};

type Orbit = { body: Body; parent: string; line: Line2; casing: Line2 };

/** Few samples bow the chords of a big orbit off a spacecraft's path. */
const SAMPLES = 2048;

const LINE_PX = 1.5;
const SELECTED_LINE_PX = 2.5;
const CASING_PX = 4;

/** The casing is the line plus a margin, so it grows with the line. */
const casingPx = (linePx: number): number => CASING_PX + (linePx - LINE_PX);

/** One line per body that has an orbit, in km. */
export const createOrbits = (
    scene: Scene,
    bodies: Body[],
    color: (body: Body) => Color,
    background: Color,
): Orbits => {
    const orbits: Orbit[] = [];

    for (const body of bodies) {
        if (body.parent === null || body.elements === null) continue;

        const points = orbitPoints(body.elements, SAMPLES);
        const positions = new Float32Array(points.length + 3);
        for (let k = 0; k < points.length; k++) {
            positions[k] = (points[k] ?? 0) / 1000;
        }
        // Repeat the first point to close the loop.
        positions.set(positions.subarray(0, 3), points.length);

        const geometry = new LineGeometry();
        geometry.setPositions(positions);
        const material = new LineMaterial({
            linewidth: LINE_PX,
            transparent: true,
            opacity: 1,
            color: color(body),
        });
        const line = new Line2(geometry, material);
        // Keeps the line readable where it crosses a sphere.
        const casing = new Line2(
            geometry,
            new LineMaterial({
                linewidth: casingPx(LINE_PX),
                transparent: true,
                depthWrite: false,
                color: background,
            }),
        );
        casing.renderOrder = -1;

        scene.add(casing, line);
        orbits.push({ body, parent: body.parent, line, casing });
    }

    return {
        update: (origin, states) => {
            for (const { parent, line, casing } of orbits) {
                const r = states.get(parent)?.r;
                if (!r) continue;

                line.position.set(
                    (r.x - origin.x) / 1000,
                    (r.y - origin.y) / 1000,
                    (r.z - origin.z) / 1000,
                );
                casing.position.copy(line.position);
            }
        },
        highlight: (id) => {
            for (const { body, line, casing } of orbits) {
                const px = body.id === id ? SELECTED_LINE_PX : LINE_PX;
                line.material.linewidth = px;
                casing.material.linewidth = casingPx(px);
            }
        },
        resize: (width, height) => {
            for (const { line, casing } of orbits) {
                line.material.resolution.set(width, height);
                casing.material.resolution.set(width, height);
            }
        },
        recolor: (pick, background) => {
            for (const { body, line, casing } of orbits) {
                line.material.color.copy(pick(body));
                casing.material.color.copy(background);
            }
        },
        dispose: () => {
            for (const { line, casing } of orbits) {
                line.removeFromParent();
                casing.removeFromParent();
                line.geometry.dispose();
                line.material.dispose();
                casing.material.dispose();
            }
        },
    };
};
