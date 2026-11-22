import type { Body, Elements, State, Vec3 } from "@cpluspatch/orbit";
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
    /** Draws the line of `body` again from its new elements. */
    rebuild: (body: Body) => void;
    /** Draws a dashed line for `elements` around the parent of `body`, or none with `null`. */
    ghost: (body: Body, elements: Elements | null) => void;
    /** Sets the line width's screen size. */
    resize: (width: number, height: number) => void;
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

/** The closed loop of an orbit's points, in km. */
const orbitPositions = (elements: Elements): Float32Array => {
    const points = orbitPoints(elements, SAMPLES);
    const positions = new Float32Array(points.length + 3);
    for (let k = 0; k < points.length; k++) {
        positions[k] = (points[k] ?? 0) / 1000;
    }
    // Repeat the first point to close the loop.
    positions.set(positions.subarray(0, 3), points.length);

    return positions;
};

/** The line geometry of an orbit, in km. */
const orbitGeometry = (elements: Elements): LineGeometry => {
    const geometry = new LineGeometry();
    geometry.setPositions(orbitPositions(elements));

    return geometry;
};

/** The length of a polyline of x, y, z triples. */
const pathLength = (positions: Float32Array): number => {
    let total = 0;
    for (let k = 3; k < positions.length; k += 3) {
        total += Math.hypot(
            (positions[k] ?? 0) - (positions[k - 3] ?? 0),
            (positions[k + 1] ?? 0) - (positions[k - 2] ?? 0),
            (positions[k + 2] ?? 0) - (positions[k - 1] ?? 0),
        );
    }

    return total;
};

/** The dashes and gaps along a ghost line, so an orbit has this many of each. */
const GHOST_DASHES = 160;

/** One line per body that has an orbit, in km. */
export const createOrbits = (
    scene: Scene,
    bodies: Body[],
    color: (body: Body) => Color,
    background: Color,
): Orbits => {
    const orbits: Orbit[] = [];
    let ghost: { body: Body; parent: string; line: Line2 } | null = null;
    // The ghost may be made after the last resize.
    let size = { width: 0, height: 0 };

    for (const body of bodies) {
        if (body.parent === null || body.elements === null) continue;

        const geometry = orbitGeometry(body.elements);
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
        ghost: (body, elements) => {
            if (!elements || body.parent === null) {
                if (ghost) ghost.line.visible = false;
                return;
            }

            const positions = orbitPositions(elements);
            const geometry = new LineGeometry();
            geometry.setPositions(positions);
            const dash = pathLength(positions) / GHOST_DASHES;

            if (!ghost) {
                const material = new LineMaterial({
                    linewidth: SELECTED_LINE_PX,
                    dashed: true,
                    transparent: true,
                });
                material.resolution.set(size.width, size.height);
                const line = new Line2(geometry, material);
                scene.add(line);
                ghost = { body, parent: body.parent, line };
            } else {
                ghost.line.geometry.dispose();
                ghost.line.geometry = geometry;
            }
            ghost.body = body;
            ghost.parent = body.parent;
            ghost.line.material.dashSize = dash;
            ghost.line.material.gapSize = dash;
            ghost.line.material.color.copy(color(body));
            ghost.line.computeLineDistances();
            ghost.line.visible = true;
        },
        rebuild: (body) => {
            const orbit = orbits.find(
                (candidate) => candidate.body.id === body.id,
            );
            if (!orbit || !body.elements) return;

            const geometry = orbitGeometry(body.elements);
            orbit.line.geometry.dispose();
            orbit.line.geometry = geometry;
            orbit.casing.geometry = geometry;
            orbit.body = body;
        },
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

            if (ghost) {
                const r = states.get(ghost.parent)?.r;
                if (r) {
                    ghost.line.position.set(
                        (r.x - origin.x) / 1000,
                        (r.y - origin.y) / 1000,
                        (r.z - origin.z) / 1000,
                    );
                }
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
            size = { width, height };
            ghost?.line.material.resolution.set(width, height);
            for (const { line, casing } of orbits) {
                line.material.resolution.set(width, height);
                casing.material.resolution.set(width, height);
            }
        },
        dispose: () => {
            if (ghost) {
                ghost.line.removeFromParent();
                ghost.line.geometry.dispose();
                ghost.line.material.dispose();
            }
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
