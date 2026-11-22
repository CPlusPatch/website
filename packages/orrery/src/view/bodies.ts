import {
    type Body,
    type BodyKind,
    bodyOrientation,
    type State,
    type Vec3,
} from "@cpluspatch/orbit";
import {
    AmbientLight,
    CanvasTexture,
    type Color,
    Group,
    Matrix4,
    Mesh,
    MeshBasicMaterial,
    MeshStandardMaterial,
    type PerspectiveCamera,
    PointLight,
    type Scene,
    SphereGeometry,
    Sprite,
    SpriteMaterial,
    SRGBColorSpace,
    Vector3,
} from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import {
    type Dot,
    LABEL_ANCHOR_GAP_PX,
    LABEL_VERTICAL_GAP_PX,
    type LabelBox,
    labelRect,
    type Placement,
    placeLabels,
    type Rect,
} from "./geometry/labels.ts";
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
} from "./geometry/visibility.ts";
import { createMaps } from "./maps.ts";
import { type LabelRect, type PickPoint, pickLabel } from "./picking.ts";
import { spinMatrix } from "./spin.ts";

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

type Entry = {
    body: Body;
    group: Group;
    sphere: Mesh<SphereGeometry, MeshBasicMaterial | MeshStandardMaterial>;
    marker: Sprite;
    /** The root's glow, drawn with its marker. */
    halo: Sprite | null;
    label: CSS2DObject;
    /** The label's name and the "+N" count of the bodies folded into it. */
    name: HTMLElement;
    count: HTMLElement;
    /** What the label is drawn and measured with, as a key. Empty until the first update. */
    style: string;
    /** The label's width and height in px, without its offset. */
    text: { width: number; height: number };
    /** The px from the label's anchor to its box, which clears the sphere. */
    offset: number;
    /** Where the label sits, as a class modifier. */
    side: Placement;
    /** Whether the body's map has been asked for. */
    mapped: boolean;
};

type LabelStyle = {
    selected: boolean;
    big: boolean;
    hover: boolean;
    count: string;
};

const labelModifiers = ({ selected, big, hover }: LabelStyle): string[] =>
    [
        selected && "orrery__label--selected",
        big && "orrery__label--big",
        hover && "orrery__label--hover",
    ].filter((name) => name !== false);

const labelKey = (style: LabelStyle): string =>
    `${labelModifiers(style).join(" ")}|${style.count}`;

/** The label's anchor, as a CSS2D `center`, for each placement. */
const CENTERS: Record<Placement, [number, number]> = {
    right: [0, 0.5],
    left: [1, 0.5],
    above: [0.5, 1],
    below: [0.5, 0],
    hidden: [0, 0.5],
};

const HALO_SCALE = 2.5;
const HALO_OPACITY = 0.22;
const SPHERE_MIN_PX = 4;

type Shape = "disc" | "ring" | "diamond" | "square";

/** Each kind has its own shape, so colour isn't the only signal. */
const SHAPES: Record<BodyKind, Shape> = {
    star: "disc",
    planet: "disc",
    dwarf: "ring",
    moon: "diamond",
    spacecraft: "square",
};

/** The on-screen size of each kind's marker, in px. */
const MARKER_PX: Record<BodyKind, number> = {
    star: 12,
    planet: 8,
    dwarf: 7,
    moon: 9,
    spacecraft: 6,
};

const markerPx = (body: Body): number => MARKER_PX[body.kind];

const TEXTURE_PX = 64;
// Only dwarfs are rings, and the stroke shows as 1.75px at their size.
const RING_STROKE = (1.75 * TEXTURE_PX) / MARKER_PX.dwarf;
// Keeps the edge antialiasing inside the texture.
const EDGE_PX = 1;

const markerTexture = (shape: Shape | "halo"): CanvasTexture => {
    const canvas = document.createElement("canvas");
    canvas.width = TEXTURE_PX;
    canvas.height = TEXTURE_PX;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("A 2D canvas is needed to draw markers.");

    const mid = TEXTURE_PX / 2;
    const reach = mid - EDGE_PX;
    context.fillStyle = "white";
    context.strokeStyle = "white";

    if (shape === "halo") {
        const glow = context.createRadialGradient(mid, mid, 0, mid, mid, mid);
        glow.addColorStop(0, "white");
        glow.addColorStop(1, "rgba(255, 255, 255, 0)");
        context.fillStyle = glow;
        context.fillRect(0, 0, TEXTURE_PX, TEXTURE_PX);
    } else if (shape === "disc") {
        context.beginPath();
        context.arc(mid, mid, reach, 0, 2 * Math.PI);
        context.fill();
    } else if (shape === "ring") {
        context.lineWidth = RING_STROKE;
        context.beginPath();
        context.arc(mid, mid, reach - RING_STROKE / 2, 0, 2 * Math.PI);
        context.stroke();
    } else if (shape === "diamond") {
        context.beginPath();
        context.moveTo(mid, mid - reach);
        context.lineTo(mid + reach, mid);
        context.lineTo(mid, mid + reach);
        context.lineTo(mid - reach, mid);
        context.closePath();
        context.fill();
    } else {
        context.fillRect(EDGE_PX, EDGE_PX, 2 * reach, 2 * reach);
    }

    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;

    return texture;
};

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
    // Measures labels here, since a label has no layout until it's drawn.
    const probe = document.createElement("div");
    const probeName = document.createElement("span");
    probeName.className = "orrery__label-name";
    const probeCount = document.createElement("span");
    probeCount.className = "orrery__label-count";
    probe.append(probeName, probeCount);
    host.append(probe);

    for (const body of bodies) {
        const group = new Group();

        const sphere = new Mesh(
            sphereGeometry,
            body.kind === "star"
                ? new MeshBasicMaterial({ color: color(body) })
                : new MeshStandardMaterial({
                      color: color(body),
                      roughness: 1,
                  }),
        );
        sphere.scale.setScalar(body.radius / 1000);

        const marker = new Sprite(
            new SpriteMaterial({
                sizeAttenuation: false,
                map: textures[SHAPES[body.kind]],
                color: color(body),
                // Markers draw in `renderOrder`, so they mustn't hide each other.
                depthWrite: false,
            }),
        );
        const halo =
            body.parent === null
                ? new Sprite(
                      new SpriteMaterial({
                          sizeAttenuation: false,
                          map: haloTexture,
                          color: color(body),
                          opacity: HALO_OPACITY,
                          depthWrite: false,
                      }),
                  )
                : null;

        const text = document.createElement("div");
        text.className = "orrery__label";
        const name = document.createElement("span");
        name.className = "orrery__label-name";
        name.textContent = body.name;
        const count = document.createElement("span");
        count.className = "orrery__label-count";
        text.append(name, count);
        const label = new CSS2DObject(text);
        // Its left edge sits on the body.
        label.center.set(...CENTERS.right);

        group.add(sphere, marker, label);
        if (halo) group.add(halo);
        scene.add(group);
        entries.push({
            body,
            group,
            sphere,
            marker,
            halo,
            label,
            name,
            count,
            style: "",
            text: { width: 0, height: 0 },
            // Unset, so the first update writes it.
            offset: -1,
            side: "right",
            mapped: false,
        });
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
    // What each label is drawn as, and its text.
    const styles = new Map<string, LabelStyle>();

    const measure = (entry: Entry, style: LabelStyle) => {
        probe.className = [
            "orrery__label",
            "orrery__label--probe",
            ...labelModifiers(style),
        ].join(" ");
        probeName.textContent = entry.body.name;
        probeCount.textContent = style.count;
        entry.text = { width: probe.offsetWidth, height: probe.offsetHeight };
    };
    const measureAll = () => {
        for (const entry of entries) {
            const style = styles.get(entry.body.id);
            if (style) measure(entry, style);
        }
    };

    // The label's classes and text change its width, so it's measured again with them.
    const restyle = (entry: Entry, style: LabelStyle) => {
        const key = labelKey(style);
        if (key === entry.style) return;

        entry.style = key;
        styles.set(entry.body.id, style);
        const { element } = entry.label;
        element.classList.toggle("orrery__label--selected", style.selected);
        element.classList.toggle("orrery__label--big", style.big);
        element.classList.toggle("orrery__label--hover", style.hover);
        entry.count.textContent = style.count;
        measure(entry, style);
    };

    let disposed = false;
    document.fonts.ready.then(() => {
        if (!disposed) measureAll();
    });

    const rootGroup = entries.find(({ body }) => body.parent === null)?.group;
    const sun = new PointLight(undefined, 3, 0, 0);
    const ambient = new AmbientLight(undefined, 0.08);
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
                restyle(entry, {
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
                            sphere.material.needsUpdate = true;
                        });
                    }

                    const orientation = bodyOrientation(body.id, t);
                    if (orientation) {
                        spin.fromArray(spinMatrix(orientation));
                        sphere.quaternion.setFromRotationMatrix(spin);
                    }
                }
                sphere.geometry =
                    radiusPx > size.height ? fineGeometry : sphereGeometry;
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

            measureAll();
        },
        dispose: () => {
            disposed = true;
            for (const { group, sphere, marker, halo, label } of entries) {
                label.removeFromParent();
                group.removeFromParent();
                sphere.material.dispose();
                marker.material.dispose();
                halo?.material.dispose();
            }
            probe.remove();
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
