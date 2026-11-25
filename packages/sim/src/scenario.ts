import {
    type Elements,
    length,
    MAX_TIME,
    MAX_YEAR,
    MIN_TIME,
    MIN_YEAR,
    wrapAngle,
} from "@cpluspatch/orbit";
import type { Model } from "./models.ts";
import { isModel } from "./models.ts";
import type { Precession } from "./precession.ts";

/** What a body is. The view colours bodies by kind. */
export type BodyKind =
    | "star"
    | "planet"
    | "dwarf"
    | "moon"
    | "asteroid"
    | "comet"
    | "spacecraft";

/** What a spacecraft does. */
export type SpacecraftRole =
    | "station"
    | "telescope"
    | "navigation"
    | "earth-observation"
    | "science";

/** The fields every body has. */
type BodyBase = {
    /** A unique slug of lowercase letters, digits and hyphens. */
    id: string;
    /** The display name. */
    name: string;
    /** What the body is. */
    kind: BodyKind;
    /** The gravitational parameter GM in m³/s², at least 0. */
    mu: number;
    /** The mean radius in metres, above 0. */
    radius: number;
    /** An optional CSS colour. */
    color?: string;
    /** What a spacecraft does. Absent means other. Only spacecraft have one. */
    role?: SpacecraftRole;
    /** The built-in look: rotation, maps, colour, atmosphere and shape. Absent means a plain body. */
    model?: Model;
};

/** The body at the root of the tree, which orbits nothing. */
export type RootBody = BodyBase & {
    parent: null;
    elements: null;
    precession?: undefined;
};

/** A body that orbits another. */
export type OrbitingBody = BodyBase & {
    /** The id of the body this one orbits. */
    parent: string;
    /** The orbit around the parent in the ecliptic J2000 frame. */
    elements: Elements;
    /** Precession of the orbit, or none for a fixed orbit. */
    precession?: Precession;
};

/** One body in a scenario. */
export type Body = RootBody | OrbitingBody;

/** A set of bodies in one tree, with an optional start time. */
export type Scenario = {
    /** Format version. */
    version: 2;
    /** The display name. */
    name: string;
    /** The initial time in seconds since J2000. Absent means now. */
    time?: number;
    /** Draws the Earth satellite catalogue around the body with model `"earth"`. Absent means no. */
    hasSatellites?: true;
    /** The bodies, in any order. Exactly one has no parent. */
    bodies: Body[];
};

/** The bodies with `model` set to the id wherever the id is a known model and no model is given. */
export const fillModels = (bodies: Body[]): Body[] =>
    bodies.map((body) =>
        isModel(body.id) && body.model === undefined
            ? { ...body, model: body.id }
            : body,
    );

/** The scenario, or every reason the input isn't one. */
export type ScenarioResult =
    | { ok: true; scenario: Scenario }
    | { ok: false; errors: string[] };

const ROLES: readonly SpacecraftRole[] = [
    "station",
    "telescope",
    "navigation",
    "earth-observation",
    "science",
];

const KINDS: readonly BodyKind[] = [
    "star",
    "planet",
    "dwarf",
    "moon",
    "asteroid",
    "comet",
    "spacecraft",
];

const SLUG = /^[a-z0-9-]+$/;

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** The longest name, in characters, for a body or a scenario. */
export const MAX_NAME = 100;

/** The most bodies a scenario can have. */
export const MAX_BODIES = 500;

const ELEMENT_FIELDS = ["a", "e", "i", "raan", "argp", "m0", "epoch"] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const show = (value: unknown): string => {
    if (typeof value === "number") {
        return String(value);
    }

    return typeof value === "string" ? JSON.stringify(value) : typeof value;
};

const finite = (
    path: string,
    value: unknown,
    errors: string[],
): value is number => {
    if (typeof value === "number" && Number.isFinite(value)) {
        return true;
    }

    errors.push(`${path}: must be a finite number (got ${show(value)})`);

    return false;
};

/** Checks one rule on a finite number and records the error if it fails. */
const inRange = (
    path: string,
    value: number,
    ok: boolean,
    rule: string,
    errors: string[],
): void => {
    if (!ok) {
        errors.push(`${path}: must be ${rule} (got ${value})`);
    }
};

const validateElements = (
    path: string,
    input: unknown,
    errors: string[],
): Elements | null => {
    if (!isRecord(input)) {
        errors.push(`${path}: must be an object or null (got ${show(input)})`);

        return null;
    }

    const before = errors.length;
    const values: Partial<Record<(typeof ELEMENT_FIELDS)[number], number>> = {};

    for (const field of ELEMENT_FIELDS) {
        const value = input[field];

        if (finite(`${path}.${field}`, value, errors)) {
            values[field] = value;
        }
    }

    const { a, e, i, raan, argp, m0, epoch } = values;

    if (epoch !== undefined) {
        inRange(
            `${path}.epoch`,
            epoch,
            epoch >= MIN_TIME && epoch <= MAX_TIME,
            `in years ${MIN_YEAR} to ${MAX_YEAR}`,
            errors,
        );
    }

    if (a !== undefined) {
        inRange(`${path}.a`, a, a > 0, "> 0", errors);
    }

    if (e !== undefined) {
        inRange(
            `${path}.e`,
            e,
            e >= 0 && e < 1,
            e < 0 ? ">= 0" : "< 1",
            errors,
        );
    }

    if (i !== undefined) {
        inRange(`${path}.i`, i, i >= 0 && i <= Math.PI, "in [0, π]", errors);
    }

    if (
        errors.length > before ||
        a === undefined ||
        e === undefined ||
        i === undefined ||
        raan === undefined ||
        argp === undefined ||
        m0 === undefined ||
        epoch === undefined
    ) {
        return null;
    }

    return {
        a,
        e,
        i,
        raan: wrapAngle(raan),
        argp: wrapAngle(argp),
        m0: wrapAngle(m0),
        epoch,
    };
};

const validatePrecession = (
    path: string,
    input: unknown,
    errors: string[],
): Precession | null => {
    if (!isRecord(input)) {
        errors.push(`${path}: must be an object (got ${show(input)})`);

        return null;
    }

    const before = errors.length;
    const { pole, nodeRate, argpRate } = input;
    let unit: Precession["pole"] | null = null;

    if (!isRecord(pole)) {
        errors.push(`${path}.pole: must be an object (got ${show(pole)})`);
    } else {
        const { x, y, z } = pole;
        const px = finite(`${path}.pole.x`, x, errors) ? x : null;
        const py = finite(`${path}.pole.y`, y, errors) ? y : null;
        const pz = finite(`${path}.pole.z`, z, errors) ? z : null;

        if (px !== null && py !== null && pz !== null) {
            const v = { x: px, y: py, z: pz };
            const len = length(v);

            if (Math.abs(len - 1) > 1e-6) {
                errors.push(
                    `${path}.pole: must be a unit vector (got length ${len})`,
                );
            } else {
                // A pole that's already unit to rounding is kept, so a saved scenario loads back unchanged.
                unit =
                    Math.abs(len - 1) < 1e-12
                        ? v
                        : { x: v.x / len, y: v.y / len, z: v.z / len };
            }
        }
    }

    const node = finite(`${path}.nodeRate`, nodeRate, errors) ? nodeRate : null;
    const apsis = finite(`${path}.argpRate`, argpRate, errors)
        ? argpRate
        : null;

    if (
        errors.length > before ||
        unit === null ||
        node === null ||
        apsis === null
    ) {
        return null;
    }

    return { pole: unit, nodeRate: node, argpRate: apsis };
};

/** Checks a body's own fields. Links between bodies are checked later. */
const validateBody = (
    index: number,
    input: unknown,
    version: 1 | 2,
    ids: Set<string>,
    errors: string[],
): Body | null => {
    if (!isRecord(input)) {
        errors.push(`bodies[${index}]: must be an object (got ${show(input)})`);

        return null;
    }

    const before = errors.length;
    const {
        id,
        name,
        kind,
        parent,
        mu,
        radius,
        elements,
        precession,
        color,
        role,
        model,
    } = input;
    const validId = typeof id === "string" && SLUG.test(id) ? id : null;
    const label = validId ?? `bodies[${index}]`;

    if (validId === null) {
        errors.push(`${label}.id: must match ${SLUG} (got ${show(id)})`);
    } else if (ids.has(validId)) {
        errors.push(`${label}.id: must be unique (got ${show(id)})`);
    } else {
        ids.add(validId);
    }

    let validName: string | null = null;

    if (typeof name !== "string") {
        errors.push(`${label}.name: must be a string (got ${show(name)})`);
    } else if (name.length > MAX_NAME) {
        errors.push(
            `${label}.name: must be at most ${MAX_NAME} characters (got ${name.length})`,
        );
    } else {
        validName = name;
    }

    const validKind = KINDS.find((k) => k === kind);

    if (validKind === undefined) {
        errors.push(
            `${label}.kind: must be one of ${KINDS.join(", ")} (got ${show(kind)})`,
        );
    }

    const validParent =
        parent === null || typeof parent === "string" ? parent : undefined;

    if (validParent === undefined) {
        errors.push(
            `${label}.parent: must be a string or null (got ${show(parent)})`,
        );
    }

    const validMu = finite(`${label}.mu`, mu, errors) ? mu : null;

    if (validMu !== null) {
        inRange(`${label}.mu`, validMu, validMu >= 0, ">= 0", errors);
    }

    const validRadius = finite(`${label}.radius`, radius, errors)
        ? radius
        : null;

    if (validRadius !== null) {
        inRange(`${label}.radius`, validRadius, validRadius > 0, "> 0", errors);
    }

    let validColor: string | undefined;

    if (color !== undefined) {
        if (typeof color !== "string") {
            errors.push(
                `${label}.color: must be a string (got ${show(color)})`,
            );
        } else if (!HEX_COLOR.test(color)) {
            errors.push(
                `${label}.color: must be a #rgb or #rrggbb colour (got ${show(color)})`,
            );
        } else {
            validColor = color;
        }
    }

    const validRole = ROLES.find((r) => r === role);

    if (role !== undefined) {
        if (validRole === undefined) {
            errors.push(
                `${label}.role: must be one of ${ROLES.join(", ")} (got ${show(role)})`,
            );
        } else if (kind !== "spacecraft") {
            errors.push(
                `${label}.role: must be absent unless kind is spacecraft`,
            );
        }
    }

    // Version 1 has no models. They're filled in from the ids afterwards.
    const validModel = version === 2 && isModel(model) ? model : undefined;

    if (version === 2 && model !== undefined && validModel === undefined) {
        errors.push(
            `${label}.model: must be one of the known models (got ${show(model)})`,
        );
    }

    let parsed: Elements | null = null;

    if (parent === null) {
        if (elements !== null) {
            errors.push(`${label}.elements: must be null when parent is null`);
        }
    } else if (elements === null) {
        errors.push(`${label}.elements: must be set when parent is set`);
    } else {
        parsed = validateElements(`${label}.elements`, elements, errors);
    }

    let parsedPrecession: Precession | null = null;

    if (precession !== undefined) {
        if (parent === null) {
            errors.push(
                `${label}.precession: must be absent when parent is null`,
            );
        } else {
            parsedPrecession = validatePrecession(
                `${label}.precession`,
                precession,
                errors,
            );
        }
    }

    if (
        errors.length > before ||
        validId === null ||
        validName === null ||
        validKind === undefined ||
        validParent === undefined ||
        validMu === null ||
        validRadius === null
    ) {
        return null;
    }

    const base = {
        id: validId,
        name: validName,
        kind: validKind,
        mu: validMu,
        radius: validRadius,
        ...(validColor === undefined ? {} : { color: validColor }),
        ...(validRole === undefined ? {} : { role: validRole }),
        ...(validModel === undefined ? {} : { model: validModel }),
    };

    if (validParent === null) {
        return { ...base, parent: null, elements: null };
    }

    // No errors were added, so a body with a parent has parsed elements.
    if (parsed === null) {
        throw new Error(`${label}: elements missing after validation`);
    }

    return {
        ...base,
        parent: validParent,
        elements: parsed,
        ...(parsedPrecession ? { precession: parsedPrecession } : {}),
    };
};

/** Checks the links between bodies: one root, known parents, no cycles. */
const validateTree = (inputs: unknown[], errors: string[]): void => {
    const parents = new Map<string, string | null>();

    for (const input of inputs) {
        const id = isRecord(input) ? input.id : undefined;
        const parent = isRecord(input) ? input.parent : undefined;
        const validId = typeof id === "string" && SLUG.test(id);

        if (validId && (parent === null || typeof parent === "string")) {
            parents.set(id, parent);
        }
    }

    const roots = [...parents.values()].filter((p) => p === null).length;

    if (roots !== 1) {
        errors.push(
            `bodies: must have exactly one root, with parent null (got ${roots})`,
        );
    }

    for (const [id, parent] of parents) {
        if (parent !== null && !parents.has(parent)) {
            errors.push(`${id}.parent: no body has the id ${show(parent)}`);
        }
    }

    // Each body is walked once: a chain stops at the first body already settled.
    const loops = new Map<string, boolean>();

    for (const id of parents.keys()) {
        const path = new Set<string>();
        let current: string | null | undefined = id;

        while (
            typeof current === "string" &&
            !loops.has(current) &&
            !path.has(current)
        ) {
            path.add(current);
            current = parents.get(current);
        }

        const looped =
            typeof current === "string" &&
            (path.has(current) || loops.get(current) === true);

        for (const step of path) loops.set(step, looped);
    }

    for (const id of parents.keys()) {
        if (loops.get(id)) {
            errors.push(`${id}.parent: the parent chain loops back on itself`);
        }
    }
};

/** Checks unknown input and returns a clean scenario with wrapped angles, or every error. */
export const validateScenario = (input: unknown): ScenarioResult => {
    if (!isRecord(input)) {
        return {
            ok: false,
            errors: [`scenario: must be an object (got ${show(input)})`],
        };
    }

    const errors: string[] = [];
    const { version, name, time, hasSatellites, bodies: inputs } = input;
    const validVersion = version === 1 || version === 2 ? version : null;

    if (validVersion === null) {
        errors.push(`version: must be 1 or 2 (got ${show(version)})`);
    }

    if (
        validVersion === 2 &&
        hasSatellites !== undefined &&
        hasSatellites !== true
    ) {
        errors.push(
            `hasSatellites: must be true when set (got ${show(hasSatellites)})`,
        );
    }

    let validName: string | null = null;

    if (typeof name !== "string") {
        errors.push(`name: must be a string (got ${show(name)})`);
    } else if (name.length > MAX_NAME) {
        errors.push(
            `name: must be at most ${MAX_NAME} characters (got ${name.length})`,
        );
    } else {
        validName = name;
    }

    let validTime: number | undefined;

    if (time !== undefined && finite("time", time, errors)) {
        validTime = time;
        inRange(
            "time",
            time,
            time >= MIN_TIME && time <= MAX_TIME,
            `in years ${MIN_YEAR} to ${MAX_YEAR}`,
            errors,
        );
    }

    const bodies: Body[] = [];

    if (!Array.isArray(inputs) || inputs.length === 0) {
        errors.push("bodies: must be a non-empty array");
    } else if (inputs.length > MAX_BODIES) {
        errors.push(
            `bodies: must have at most ${MAX_BODIES} bodies (got ${inputs.length})`,
        );
    } else {
        const ids = new Set<string>();

        for (const [index, body] of inputs.entries()) {
            const valid = validateBody(
                index,
                body,
                validVersion ?? 2,
                ids,
                errors,
            );

            if (valid) {
                bodies.push(valid);
            }
        }

        validateTree(inputs, errors);
    }

    if (errors.length > 0 || validName === null) {
        return { ok: false, errors };
    }

    // A version 1 file had no models, so Earth's id stood for them and for the satellites.
    const satellites =
        validVersion === 1
            ? bodies.some((body) => body.id === "earth")
            : hasSatellites === true;

    return {
        ok: true,
        scenario: {
            version: 2,
            name: validName,
            ...(validTime === undefined ? {} : { time: validTime }),
            ...(satellites ? { hasSatellites: true } : {}),
            bodies: validVersion === 1 ? fillModels(bodies) : bodies,
        },
    };
};

/** The bodies with every parent before its children, breadth-first from the root. */
export const sortByDepth = (scenario: Scenario): Body[] => {
    const children = new Map<string | null, Body[]>();

    for (const body of scenario.bodies) {
        const siblings = children.get(body.parent) ?? [];

        siblings.push(body);
        children.set(body.parent, siblings);
    }

    const sorted = [...(children.get(null) ?? [])];

    // The array grows while it's walked, which makes this a queue.
    for (const body of sorted) {
        sorted.push(...(children.get(body.id) ?? []));
    }

    return sorted;
};

/** Body `id` and every body that orbits it, directly or not. */
export const subtreeIds = (scenario: Scenario, id: string): string[] => {
    const ids = [id];

    // The array grows while it's walked, which makes this a queue.
    for (const parent of ids) {
        for (const body of scenario.bodies) {
            if (body.parent === parent) ids.push(body.id);
        }
    }

    return ids;
};
