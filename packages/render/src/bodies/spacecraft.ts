/**
 * @module
 * Low-poly models of the Earth satellites, at true size.
 */

import type { Body } from "@cpluspatch/sim";
import {
    Box3,
    BoxGeometry,
    type BufferGeometry,
    CylinderGeometry,
    Group,
    Mesh,
    MeshStandardMaterial,
    Sphere,
    Vector3,
} from "three";

type Palette = Record<
    "white" | "grey" | "dark" | "gold" | "array",
    MeshStandardMaterial
>;

type Axis = "x" | "y" | "z";

type Vec = [number, number, number];

type Bus = {
    /** The bus's size along x, y and z, in m. */
    size: Vec;
    /** The wings on the mast along y, 1 or 2. */
    wings: 1 | 2;
    wingLength: number;
    wingWidth: number;
    /** The length of a boom along -x, in m. */
    boom?: number;
    /** An Earth-facing antenna panel on -z, as its width and depth. */
    antenna?: [number, number];
    /** The diameter of a high-gain dish on a stub on +x, in m. */
    dish?: number;
    /** A heat shield below the bus on -z. */
    shield?: { shape: "disc" | "plate"; size: number; thickness: number };
};

const MAST = 0.6;

// A fill from the camera's upper left, so unlit faces aren't black. The emissive sets its
// strength and the albedo its colour: a flat tint made every part the same blue-grey. The
// grey mixed in keeps dark arrays from going black.
const fill = (shader: { fragmentShader: string }): void => {
    shader.fragmentShader = shader.fragmentShader.replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        totalEmissiveRadiance *= mix(vec3(0.3), diffuseColor.rgb, 0.8) * (0.15 + 0.85 * max(dot(normal, normalize(vec3(-0.5, 0.6, 0.6))), 0.0));`,
    );
};

// Dark parts get a stronger fill, or their back faces drop to the sky's black.
const material = (
    color: number,
    roughness: number,
    emissive = 0x4d4d4d,
): MeshStandardMaterial => {
    const made = new MeshStandardMaterial({
        color,
        roughness,
        metalness: 0,
        emissive,
        emissiveIntensity: 1,
    });
    made.onBeforeCompile = fill;

    return made;
};

const palette = (): Palette => ({
    white: material(0xe6e6e8, 0.5),
    grey: material(0x8e9299, 0.6),
    dark: material(0x25262b, 0.8, 0xb3b3b3),
    gold: material(0xb8903a, 0.6),
    array: material(0x1f2838, 0.85, 0xb3b3b3),
});

const box = (
    group: Group,
    material: MeshStandardMaterial,
    [w, d, h]: Vec,
    [x, y, z]: Vec,
): Mesh => {
    const mesh = new Mesh(new BoxGeometry(w, d, h), material);
    mesh.position.set(x, y, z);
    group.add(mesh);

    return mesh;
};

// A cylinder along `axis`, `length` long.
const cylinder = (
    group: Group,
    material: MeshStandardMaterial,
    axis: Axis,
    radius: number,
    length: number,
    [x, y, z]: Vec,
): Mesh => {
    const geometry = new CylinderGeometry(radius, radius, length, 16, 1);
    if (axis === "x") geometry.rotateZ(Math.PI / 2);
    if (axis === "z") geometry.rotateX(Math.PI / 2);
    const mesh = new Mesh(geometry, material);
    mesh.position.set(x, y, z);
    group.add(mesh);

    return mesh;
};

// Dimensions are approximate.
const iss = (group: Group, m: Palette, amber: MeshStandardMaterial): void => {
    // Pressurised modules from the Progress at the aft end to a visiting capsule.
    const modules: [MeshStandardMaterial, number, number][] = [
        [m.grey, 7, 1.35],
        [m.white, 13.1, 2.1],
        [m.white, 12.6, 2.05],
        [m.white, 5.5, 2.3],
        [m.white, 8.5, 2.15],
        [m.white, 7.2, 2.2],
        [m.white, 11.2, 2.2],
        [m.grey, 8, 2],
    ];
    let x = -43.5;
    for (const [material, length, radius] of modules) {
        cylinder(group, material, "x", radius, length, [x + length / 2, 0, 0]);
        x += length;
    }

    const trussX = -1;
    const trussZ = 3.8;
    box(group, m.grey, [3, 3, trussZ], [trussX, 0, trussZ / 2]);
    box(group, m.grey, [3.2, 109, 3.2], [trussX, 0, trussZ]);

    // Four pairs of wings, one pair each side of the truss at two stations.
    for (const side of [-1, 1]) {
        for (const station of [34, 47]) {
            for (const end of [-1, 1]) {
                const cx = trussX + end * (1.7 + 17.5);
                const cy = side * station;
                box(group, amber, [35, 12, 0.2], [cx, cy, trussZ]);

                // Dark seams so the wing reads as a grid of cells, not a slab.
                for (let k = -4; k <= 4; k++) {
                    box(
                        group,
                        m.dark,
                        [0.3, 12, 0.24],
                        [cx + k * 3.9, cy, trussZ],
                    );
                }
                box(group, m.dark, [35, 0.3, 0.24], [cx, cy, trussZ]);
            }
        }

        box(group, m.white, [0.15, 14, 4], [trussX + 2.4, side * 17, trussZ]);
        box(group, m.white, [0.15, 14, 4], [trussX - 2.4, side * 17, trussZ]);
    }
};

const hubble = (group: Group, m: Palette): void => {
    cylinder(group, m.gold, "x", 2.1, 4.5, [-4.35, 0, 0]);
    cylinder(group, m.white, "x", 2.1, 8.7, [2.25, 0, 0]);
    cylinder(group, m.dark, "x", 1.85, 0.2, [6.6, 0, 0]);

    for (const side of [-1, 1]) {
        box(group, m.grey, [0.3, MAST, 0.3], [-1, side * (2.1 + MAST / 2), 0]);
        box(
            group,
            m.array,
            [2.6, 7.1, 0.1],
            [-1, side * (2.1 + MAST + 3.55), 0],
        );
    }
};

const tiangong = (group: Group, m: Palette): void => {
    // Greyer than the shared white so the modules stand out from bright cloud.
    const hull = material(0xd0d2d6, 0.5);
    cylinder(group, hull, "x", 2.1, 16.6, [0, 0, 0]);
    cylinder(group, m.grey, "x", 1.4, 3, [9.8, 0, 0]);

    // The lab modules hang off the forward node, one each way.
    for (const side of [-1, 1]) {
        cylinder(group, hull, "y", 2.1, 17.9, [8.3, side * 11.05, 0]);
        box(group, m.grey, [0.4, MAST, 0.4], [8.3, side * (20 + MAST / 2), 0]);
        for (const end of [-1, 1]) {
            box(
                group,
                m.array,
                [3.2, 7.5, 0.1],
                [8.3 + end * 1.8, side * (20 + MAST + 3.75), 0],
            );
        }
    }
};

// The Ariane 6 upper stage, 5.4 m across and 11.6 m long, with a 3U CubeSat still on its side.
const parisat = (group: Group, m: Palette): void => {
    cylinder(group, m.white, "x", 2.7, 11.6, [0, 0, 0]);
    box(group, m.gold, [0.34, 0.1, 0.1], [4, 2.75, 0]);
};

// A shallow dish on a stub, from `base` on a face towards +axis and opening that way.
const dish = (
    group: Group,
    m: Palette,
    axis: "x" | "z",
    diameter: number,
    base: number,
): void => {
    const stub = 0.4;
    const depth = diameter * 0.2;
    const at = (offset: number): Vec =>
        axis === "x" ? [base + offset, 0, 0] : [0, 0, base + offset];
    cylinder(group, m.grey, axis, 0.05, stub, at(stub / 2));

    const geometry = new CylinderGeometry(diameter / 2, 0.1, depth, 16, 1);
    if (axis === "x") geometry.rotateZ(-Math.PI / 2);
    else geometry.rotateX(Math.PI / 2);
    const mesh = new Mesh(geometry, m.white);
    mesh.position.set(...at(stub + depth / 2));
    group.add(mesh);
};

// The spin-stabilised hexagonal bus, with three wings 120 degrees apart around z.
const juno = (group: Group, m: Palette): void => {
    const radius = 1.75;
    // The wings meet the hexagon's flat faces, which are closer in than its corners.
    const apothem = radius * Math.cos(Math.PI / 6);
    const height = 3.5;
    const hex = new CylinderGeometry(radius, radius, height, 6, 1);
    hex.rotateX(Math.PI / 2);
    group.add(new Mesh(hex, m.gold));
    dish(group, m, "z", 2.5, height / 2);

    for (let k = 0; k < 3; k++) {
        const angle = (k * 2 * Math.PI) / 3;
        // One wing has a panel fewer, and the magnetometer boom in its place.
        const length = k === 2 ? 7 : 8.9;
        const reach = apothem + length / 2;
        const wing = box(
            group,
            m.array,
            [length, 2.65, 0.08],
            [reach * Math.cos(angle), reach * Math.sin(angle), 0],
        );
        wing.rotation.z = angle;

        if (k === 2) {
            const tip = apothem + length + 0.25;
            box(
                group,
                m.dark,
                [0.5, 0.5, 0.5],
                [tip * Math.cos(angle), tip * Math.sin(angle), 0],
            );
        }
    }
};

const bus = (group: Group, m: Palette, config: Bus): void => {
    const [bx, by, bz] = config.size;
    box(group, m.gold, config.size, [0, 0, 0]);

    // One wing sits on the +y mast. Two have one each side.
    const sides = config.wings === 2 ? [-1, 1] : [1];
    for (const side of sides) {
        box(
            group,
            m.grey,
            [0.2, MAST, 0.2],
            [0, side * (by / 2 + MAST / 2), 0],
        );
        box(
            group,
            m.array,
            [config.wingWidth, config.wingLength, 0.08],
            [0, side * (by / 2 + MAST + config.wingLength / 2), 0],
        );
    }

    if (config.boom) {
        cylinder(group, m.grey, "x", 0.08, config.boom, [
            -(bx / 2 + config.boom / 2),
            0,
            0,
        ]);
        box(group, m.dark, [0.3, 0.3, 0.3], [-(bx / 2 + config.boom), 0, 0]);
    }

    if (config.antenna) {
        const [w, d] = config.antenna;
        box(group, m.grey, [w, d, 0.1], [0, 0, -(bz / 2 + 0.05)]);
    }

    if (config.dish) dish(group, m, "x", config.dish, bx / 2);

    if (config.shield) {
        const { shape, size, thickness } = config.shield;
        const z = -(bz / 2 + thickness / 2);
        if (shape === "disc")
            cylinder(group, m.white, "z", size / 2, thickness, [0, 0, z]);
        else box(group, m.white, [size, size, thickness], [0, 0, z]);
    }
};

// Each spacecraft's bus, by preset.
const BUSES: Readonly<Record<string, Bus>> = {
    "landsat-9": {
        size: [3, 2.4, 4.3],
        wings: 1,
        wingLength: 9.4,
        wingWidth: 2.6,
    },
    "gps-biii-1": {
        size: [2.5, 2.5, 2.5],
        wings: 2,
        wingLength: 6.65,
        wingWidth: 1.9,
        antenna: [1.6, 1.6],
    },
    "goes-19": {
        size: [6, 5.6, 3.9],
        wings: 1,
        wingLength: 12,
        wingWidth: 3,
        boom: 8,
    },
    "meridian-10": {
        size: [1.5, 1.5, 2.5],
        wings: 2,
        wingLength: 3.75,
        wingWidth: 1.8,
    },
    mro: {
        size: [3, 2.5, 2.5],
        wings: 2,
        wingLength: 5.35,
        wingWidth: 2.53,
        dish: 3,
    },
    "mars-express": {
        size: [1.5, 1.8, 1.4],
        wings: 2,
        wingLength: 5.3,
        wingWidth: 1.9,
        dish: 1.6,
    },
    "mars-odyssey": {
        size: [2.2, 1.7, 2.6],
        wings: 1,
        wingLength: 3.4,
        wingWidth: 2.1,
        dish: 1.3,
        boom: 6.2,
    },
    tgo: {
        size: [3.2, 2, 2],
        wings: 2,
        wingLength: 7.5,
        wingWidth: 2.2,
        dish: 2.2,
    },
    hope: {
        size: [2.4, 2.9, 2.4],
        wings: 2,
        wingLength: 2.5,
        wingWidth: 1.8,
        dish: 1.85,
    },
    lro: {
        size: [1.9, 1.9, 2.7],
        wings: 1,
        wingLength: 3.3,
        wingWidth: 2.4,
        dish: 0.75,
    },
    "chandrayaan-2": {
        size: [3.2, 2.2, 2.2],
        wings: 1,
        wingLength: 3,
        wingWidth: 2,
        dish: 1,
    },
    danuri: {
        size: [2.14, 1.82, 2.19],
        wings: 2,
        wingLength: 2.3,
        wingWidth: 1.2,
        dish: 2.6,
    },
    "parker-solar-probe": {
        size: [1, 1, 1.4],
        wings: 2,
        wingLength: 1.1,
        wingWidth: 0.6,
        shield: { shape: "disc", size: 2.3, thickness: 0.115 },
    },
    "solar-orbiter": {
        size: [2.5, 3.1, 2.7],
        wings: 2,
        wingLength: 6.5,
        wingWidth: 1.2,
        dish: 1.1,
        boom: 4.4,
        shield: { shape: "plate", size: 3.1, thickness: 0.3 },
    },
};

const GENERIC: Bus = {
    size: [2, 2, 2],
    wings: 2,
    wingLength: 3,
    wingWidth: 1.5,
};

const busOf = (model: string | undefined): Bus =>
    (model === undefined ? undefined : BUSES[model]) ?? GENERIC;

/**
 * A model of `body` in km, nadir-pointing when it's turned by `lvlhMatrix`.
 *
 * Its x is along the track, y the orbit normal and z up. Dimensions are approximate.
 */
export const createSpacecraftModel = (body: Body): Group => {
    const parts = new Group();
    const m = palette();
    const amber = material(0xc99a2e, 0.35);
    amber.metalness = 0.5;

    const { preset } = body;

    if (preset === "iss") iss(parts, m, amber);
    else if (preset === "hubble") hubble(parts, m);
    else if (preset === "tiangong") tiangong(parts, m);
    else if (preset === "parisat") parisat(parts, m);
    else if (preset === "juno") juno(parts, m);
    else bus(parts, m, busOf(preset));

    // The group's origin is the body's position, so the bounding box is centred on it.
    const box = new Box3().setFromObject(parts);
    parts.position.copy(box.getCenter(new Vector3()).negate());

    const group = new Group();
    group.add(parts);

    // A spacecraft without a model of its own is drawn at the size it declares.
    const known =
        preset !== undefined &&
        (Object.hasOwn(BUSES, preset) ||
            ["iss", "hubble", "tiangong", "parisat", "juno"].includes(preset));
    const radius = known
        ? 1
        : body.mass.radius / box.getBoundingSphere(new Sphere()).radius;
    group.scale.setScalar(radius / 1000);

    return group;
};

/** Frees the geometries and materials of a model. */
export const disposeModel = (group: Group): void => {
    group.traverse((object) => {
        if (!(object instanceof Mesh)) return;

        (object.geometry as BufferGeometry).dispose();
        (object.material as MeshStandardMaterial).dispose();
    });
};
