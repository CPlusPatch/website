import {
    type Body,
    bodyOrientation,
    type State,
    type Vec3,
} from "@cpluspatch/orbit";
import {
    AmbientLight,
    type CanvasTexture,
    type Color,
    Matrix4,
    type PerspectiveCamera,
    PointLight,
    type Scene,
    SphereGeometry,
    Vector3,
} from "three";
import {
    type Dot,
    LABEL_ANCHOR_GAP_PX,
    LABEL_VERTICAL_GAP_PX,
    type LabelBox,
    labelRect,
    type Placement,
    placeLabels,
    type Rect,
} from "../geometry/labels.ts";
import {
    type Anchor,
    foldOrbits,
    hiddenBehindSpheres,
    hiddenMarkers,
    labelRank,
    labelShownForOrbit,
    type MarkerPoint,
    projectedRadiusPx,
    type Sphere,
} from "../geometry/visibility.ts";
import { createMaps } from "../maps.ts";
import { type LabelRect, type PickPoint, pickLabel } from "../picking.ts";
import { spinMatrix } from "../spin.ts";
import { createEntry, type Entry } from "./entry.ts";
import { CENTERS, createLabels } from "./labels.ts";
import { HALO_SCALE, markerPx, markerTexture, type Shape } from "./markers.ts";

/** The bodies of a scene: a sphere, a marker and a label each, and the light. */
export type Bodies = {
    /** Places every body relative to `origin` at clock time `t` and picks what to show. Labels keep out of `blocked`. Returns where the shown bodies are on screen. */
    update: (
        camera: PerspectiveCamera,
        t: number,
        origin: Vec3,
        focus: string,
        selected: string | null,
        states: Map<string, State>,
        blocked: Rect[],
    ) => PickPoint[];
    /** The boxes the shown labels took in the last update, by body id, in px from the canvas's top left. */
    placed: () => ReadonlyMap<string, Rect>;
    /** The body whose shown label holds a point, in px from the canvas's top left. */
    labelAt: (x: number, y: number, canvas: DOMRect) => string | null;
    /** Marks the label of the hovered body, or clears it. */
    hover: (id: string | null) => void;
    /** Sizes the markers for a viewport. */
    resize: (camera: PerspectiveCamera, width: number, height: number) => void;
    /** Removes the bodies and frees them. */
    dispose: () => void;
};

const SPHERE_MIN_PX = 4;

/** How the spheres are textured. */
export type BodyOptions = {
    /** Whether to load the maps. */
    maps: boolean;
    /** The anisotropy of each map. */
    anisotropy: number;
};

/** The bodies of a scenario, in km, with their labels measured in `host`. */
export const createBodies = (
    scene: Scene,
    host: HTMLElement,
    bodies: Body[],
    color: (body: Body) => Color,
    options: BodyOptions,
): Bodies => {
    const sphereGeometry = new SphereGeometry(1, 128, 64);
    // Up close, as from the ISS, 128 segments show as facets on Earth's limb.
    const fineGeometry = new SphereGeometry(1, 512, 256);
    // One texture per shape, shared by every body of that shape.
    const textures: Record<Shape, CanvasTexture> = {
        disc: markerTexture("disc"),
        ring: markerTexture("ring"),
        diamond: markerTexture("diamond"),
        square: markerTexture("square"),
    };
    const haloTexture = markerTexture("halo");
    const entries: Entry[] = [];
    const maps = createMaps(options.anisotropy);
    const spin = new Matrix4();
    const styling = createLabels(host, entries);

    for (const body of bodies) {
        const entry = createEntry(
            body,
            color,
            sphereGeometry,
            textures,
            haloTexture,
        );
        scene.add(entry.group);
        entries.push(entry);
    }

    // Bigger bodies draw later, and the root last.
    const drawSize = (body: Body) =>
        body.parent === null ? Infinity : body.radius;
    [...entries]
        .sort((a, b) => drawSize(a.body) - drawSize(b.body))
        .forEach(({ marker }, rank) => {
            marker.renderOrder = rank + 1;
        });

    let hoverId: string | null = null;
    let placements = new Map<string, Placement>();
    const placed = new Map<string, Rect>();

    let disposed = false;
    document.fonts.ready.then(() => {
        if (!disposed) styling.measureAll();
    });

    const rootGroup = entries.find(({ body }) => body.parent === null)?.group;
    const sun = new PointLight(undefined, 3, 0, 0);
    const ambient = new AmbientLight(undefined, 0.04);
    scene.add(sun, ambient);

    const view = new Vector3();
    let size = { width: 1, height: 1 };

    return {
        update: (camera, t, origin, focus, selected, states, blocked) => {
            const fov = (camera.fov * Math.PI) / 180;
            const keep = new Set([focus]);
            if (selected) keep.add(selected);

            // An orbit's size on screen sets what folds and which labels show.
            const orbitPx = new Map<string, number>();
            for (const { body } of entries) {
                const parentR = body.parent && states.get(body.parent)?.r;
                if (!body.elements || !body.parent || !parentR) continue;

                view.set(
                    (parentR.x - origin.x) / 1000,
                    (parentR.y - origin.y) / 1000,
                    (parentR.z - origin.z) / 1000,
                );
                orbitPx.set(
                    body.id,
                    projectedRadiusPx(
                        body.elements.a / 1000,
                        camera.position.distanceTo(view),
                        fov,
                        size.height,
                    ),
                );
            }
            const folds = foldOrbits(
                entries.flatMap(({ body }) => {
                    const aPx = orbitPx.get(body.id);

                    return body.parent && aPx !== undefined
                        ? [{ id: body.id, parent: body.parent, aPx }]
                        : [];
                }),
                keep,
            );
            const folded = new Set([...folds.values()].flat());
            const names = new Map(
                entries.map(({ body }) => [body.id, body.name]),
            );
            const anchors: Anchor[] = [];
            const spheres: Sphere[] = [];
            const labels: LabelBox[] = [];
            const markers: MarkerPoint[] = [];
            const dots: Dot[] = [];
            const picks: PickPoint[] = [];

            for (const entry of entries) {
                const { body, group, sphere, marker, halo, label } = entry;
                const r = states.get(body.id)?.r;
                if (!r) continue;

                if (folded.has(body.id)) {
                    sphere.visible = false;
                    marker.visible = false;
                    if (halo) halo.visible = false;
                    continue;
                }

                const hovered = body.id === hoverId;
                const children = folds.get(body.id) ?? [];
                const major =
                    body.kind === "star" ||
                    body.kind === "planet" ||
                    body.id === focus;
                styling.restyle(entry, {
                    selected: body.id === selected,
                    big: major,
                    hover: hovered,
                    count: !children.length
                        ? ""
                        : hovered
                          ? `+ ${children.map((id) => names.get(id)).join(", ")}`
                          : `+${children.length}`,
                });

                group.position.set(
                    (r.x - origin.x) / 1000,
                    (r.y - origin.y) / 1000,
                    (r.z - origin.z) / 1000,
                );

                const depth = camera.position.distanceTo(group.position);
                const radiusPx = projectedRadiusPx(
                    body.radius / 1000,
                    depth,
                    fov,
                    size.height,
                );
                const big = radiusPx >= SPHERE_MIN_PX;
                sphere.visible = big;
                if (big) {
                    if (options.maps && !entry.mapped) {
                        entry.mapped = true;
                        maps.load(body.id, (map) => {
                            sphere.material.map = map;
                            sphere.material.color.set(0xffffff);
                            // The Sun is its own light, so it keeps its colours.
                            sphere.material.toneMapped = body.kind !== "star";
                            sphere.material.needsUpdate = true;
                        });
                        entry.extras.load(maps);
                    }

                    const orientation = bodyOrientation(body.id, t);
                    if (orientation) {
                        spin.fromArray(spinMatrix(orientation));
                        sphere.quaternion.setFromRotationMatrix(spin);
                    }
                }
                sphere.geometry =
                    radiusPx > size.height ? fineGeometry : sphereGeometry;
                if (big && entry.mapped)
                    entry.extras.update(camera, sphere.geometry);
                marker.visible = !big;
                if (halo) halo.visible = !big;

                // Pushes the label from the disc's or marker's centre to its edge.
                const offset =
                    LABEL_ANCHOR_GAP_PX +
                    Math.round(big ? radiusPx : markerPx(body) / 2);
                if (offset !== entry.offset) {
                    entry.offset = offset;
                    label.element.style.setProperty(
                        "--orrery-label-offset",
                        `${offset}px`,
                    );
                    label.element.style.setProperty(
                        "--orrery-label-offset-y",
                        `${offset + LABEL_VERTICAL_GAP_PX}px`,
                    );
                }

                // A point behind the camera projects to a mirrored spot.
                view.copy(group.position).applyMatrix4(
                    camera.matrixWorldInverse,
                );
                if (view.z >= 0) continue;

                const pos = { x: view.x, y: view.y, z: view.z };
                view.applyMatrix4(camera.projectionMatrix);
                const x = (view.x * 0.5 + 0.5) * size.width;
                const y = (0.5 - view.y * 0.5) * size.height;

                picks.push({
                    id: body.id,
                    x,
                    y,
                    depth,
                    radius: big ? radiusPx : markerPx(body) / 2,
                });
                anchors.push({ id: body.id, pos });
                if (
                    labelShownForOrbit(
                        orbitPx.get(body.id),
                        keep.has(body.id) || hovered,
                    )
                ) {
                    labels.push({
                        id: body.id,
                        x,
                        y,
                        width: entry.text.width,
                        height: entry.text.height,
                        offset,
                        disc: big,
                        rank: labelRank(body.kind, body.mu),
                        big: major,
                    });
                }
                if (big) {
                    spheres.push({
                        id: body.id,
                        pos,
                        radius: body.radius / 1000,
                    });
                } else {
                    markers.push({ id: body.id, x, y, radius: body.radius });
                    dots.push({ id: body.id, x, y, size: markerPx(body) / 2 });
                }
            }

            const behind = hiddenBehindSpheres(anchors, spheres, keep);
            const covered = hiddenMarkers(markers, keep);
            placements = placeLabels(
                labels.filter(({ id }) => !behind.has(id)),
                size,
                focus,
                dots.filter(({ id }) => !covered.has(id)),
                [selected, hoverId].filter((id) => id !== null),
                placements,
                blocked,
            );

            const boxes = new Map(labels.map((box) => [box.id, box]));
            placed.clear();
            for (const entry of entries) {
                const { body, marker, halo, label } = entry;
                const placement = placements.get(body.id) ?? "hidden";
                const box = boxes.get(body.id);
                if (box && placement !== "hidden") {
                    placed.set(body.id, labelRect(box, placement));
                }
                label.visible = placement !== "hidden";
                // A hidden label isn't drawn, so its side can wait.
                if (placement !== "hidden" && placement !== entry.side) {
                    const { classList } = label.element;
                    classList.remove(`orrery__label--${entry.side}`);
                    classList.add(`orrery__label--${placement}`);
                    label.center.set(...CENTERS[placement]);
                    entry.side = placement;
                }

                if (covered.has(body.id)) {
                    marker.visible = false;
                    if (halo) halo.visible = false;
                }
            }

            if (rootGroup) sun.position.copy(rootGroup.position);

            return picks.filter(
                ({ id }) => !behind.has(id) && !covered.has(id),
            );
        },
        placed: () => placed,
        labelAt: (x, y, canvas) => {
            const rects: LabelRect[] = [];
            for (const { body, label } of entries) {
                if (!label.visible) continue;

                const box = label.element.getBoundingClientRect();
                rects.push({
                    id: body.id,
                    left: box.left - canvas.left,
                    top: box.top - canvas.top,
                    right: box.right - canvas.left,
                    bottom: box.bottom - canvas.top,
                });
            }

            return pickLabel(rects, x, y);
        },
        hover: (id) => {
            if (id === hoverId) return;

            hoverId = id;
        },
        resize: (camera, width, height) => {
            size = { width, height };
            const scale = (pixels: number) =>
                (pixels * 2 * Math.tan((camera.fov * Math.PI) / 360)) / height;
            for (const { body, marker, halo } of entries) {
                const markerScale = scale(markerPx(body));
                marker.scale.set(markerScale, markerScale, 1);
                halo?.scale.set(
                    markerScale * HALO_SCALE,
                    markerScale * HALO_SCALE,
                    1,
                );
            }

            styling.measureAll();
        },
        dispose: () => {
            disposed = true;
            for (const {
                group,
                sphere,
                marker,
                halo,
                label,
                extras,
            } of entries) {
                extras.dispose();
                label.removeFromParent();
                group.removeFromParent();
                sphere.material.dispose();
                marker.material.dispose();
                halo?.material.dispose();
            }
            styling.dispose();
            sun.removeFromParent();
            ambient.removeFromParent();
            sphereGeometry.dispose();
            fineGeometry.dispose();
            for (const texture of Object.values(textures)) texture.dispose();
            haloTexture.dispose();
            maps.dispose();
        },
    };
};
