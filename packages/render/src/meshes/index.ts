/**
 * @module
 * The meshes a body can draw in place of its sphere, by the `type` of its `appearance.mesh`.
 */

import type { Body } from "@cpluspatch/sim";
import {
    Box3,
    type BufferGeometry,
    Group,
    Mesh,
    type MeshStandardMaterial,
    Sphere,
    Vector3,
} from "three";
import type { MeshAppearance } from "../appearance.ts";
import {
    bus,
    GENERIC,
    hubble,
    iss,
    juno,
    type Palette,
    palette,
    parisat,
    tiangong,
} from "../bodies/spacecraft.ts";
import {
    checkPositive,
    type FieldValidator,
    isNumber,
    isObject,
    objectOf,
    show,
} from "../layers/fields.ts";

type MeshType = {
    /** Checks the mesh's params at `path`, which is an object with a string `type`. */
    validate: (
        path: string,
        mesh: Record<string, unknown>,
        errors: string[],
    ) => void;
    build: (group: Group, m: Palette, mesh: MeshAppearance) => void;
    /** Whether it's drawn at true size, and not scaled to the body's radius. */
    trueSize: (mesh: MeshAppearance) => boolean;
};

const checkTuple =
    (length: number): FieldValidator =>
    (path, value, errors) => {
        if (
            !Array.isArray(value) ||
            value.length !== length ||
            !value.every((item) => isNumber(item) && item > 0)
        ) {
            errors.push(
                `${path}: must be ${length} numbers above 0 (got ${show(value)})`,
            );
        }
    };

const checkWings: FieldValidator = (path, value, errors) => {
    if (value !== 1 && value !== 2) {
        errors.push(`${path}: must be 1 or 2 (got ${show(value)})`);
    }
};

const checkShape: FieldValidator = (path, value, errors) => {
    if (value !== "disc" && value !== "plate") {
        errors.push(`${path}: must be "disc" or "plate" (got ${show(value)})`);
    }
};

// `objectOf` adds the field's name to the path it's given.
const checkShield = objectOf("shield", {
    shape: checkShape,
    size: checkPositive,
    thickness: checkPositive,
});

const BUS_CHECKS: Readonly<Record<string, FieldValidator>> = {
    size: checkTuple(3),
    wings: checkWings,
    wingLength: checkPositive,
    wingWidth: checkPositive,
    boom: checkPositive,
    antenna: checkTuple(2),
    dish: checkPositive,
};

const named = (build: (group: Group, m: Palette) => void): MeshType => ({
    validate: () => {},
    build,
    trueSize: () => true,
});

/** The mesh types, by the `type` of an `appearance.mesh`. */
export const MESHES: Readonly<Record<string, MeshType>> = {
    iss: named(iss),
    hubble: named(hubble),
    tiangong: named(tiangong),
    parisat: named(parisat),
    juno: named(juno),
    bus: {
        validate: (path, mesh, errors) => {
            for (const [key, check] of Object.entries(BUS_CHECKS)) {
                if (mesh[key] !== undefined)
                    check(`${path}.${key}`, mesh[key], errors);
            }

            if (mesh.shield !== undefined)
                checkShield(path, mesh.shield, errors);
        },
        build: (group, m, mesh) => bus(group, m, { ...GENERIC, ...mesh }),
        // Without a `size` it's the generic bus, drawn at the body's radius.
        trueSize: (mesh) => mesh.size !== undefined,
    },
};

const typeOf = (type: string): MeshType | undefined =>
    Object.hasOwn(MESHES, type) ? MESHES[type] : undefined;

/** Checks an `appearance.mesh`. An unknown type is valid, since it only draws the sphere. */
export const validateMesh: FieldValidator = (path, value, errors) => {
    if (!isObject(value)) {
        errors.push(`${path}.mesh: must be an object (got ${show(value)})`);

        return;
    }

    if (typeof value.type !== "string") {
        errors.push(
            `${path}.mesh.type: must be a string (got ${show(value.type)})`,
        );

        return;
    }

    const type = typeOf(value.type);
    type?.validate(`${path}.mesh`, value, errors);
};

/**
 * A mesh of `body` in km, or null for an unknown type.
 *
 * Its x is along the track, y the orbit normal and z up. Dimensions are approximate.
 */
export const createMesh = (body: Body, mesh: MeshAppearance): Group | null => {
    const type = typeOf(mesh.type);
    if (!type) return null;

    const parts = new Group();
    type.build(parts, palette(), mesh);

    // The group's origin is the body's position, so the bounding box is centred on it.
    const box = new Box3().setFromObject(parts);
    parts.position.copy(box.getCenter(new Vector3()).negate());

    const group = new Group();
    group.add(parts);

    const radius = type.trueSize(mesh)
        ? 1
        : body.mass.radius / box.getBoundingSphere(new Sphere()).radius;
    group.scale.setScalar(radius / 1000);

    return group;
};

/** Frees the geometries and materials of a mesh. */
export const disposeMesh = (group: Group): void => {
    group.traverse((object) => {
        if (!(object instanceof Mesh)) return;

        (object.geometry as BufferGeometry).dispose();
        (object.material as MeshStandardMaterial).dispose();
    });
};
