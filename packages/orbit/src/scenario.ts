import type { Elements } from "./kepler.ts";
import { wrapAngle } from "./kepler.ts";
import type { Precession } from "./precession.ts";
import { length } from "./vec.ts";

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

/** One body in a scenario. */
export type Body = {
    /** A unique slug of lowercase letters, digits and hyphens. */
    id: string;
    /** The display name. */
    name: string;
    /** What the body is. */
    kind: BodyKind;
    /** The id of the body this one orbits, or null for the root. */
    parent: string | null;
    /** The gravitational parameter GM in m³/s², at least 0. */
    mu: number;
    /** The mean radius in metres, above 0. */
    radius: number;
    /** The orbit around the parent in the ecliptic J2000 frame, or null for the root. */
    elements: Elements | null;
    /** Precession of the orbit, or none for a fixed orbit. */
    precession?: Precession;
    /** An optional CSS colour. */
    color?: string;
    /** What a spacecraft does. Absent means other. Only spacecraft have one. */
    role?: SpacecraftRole;
};

/** A set of bodies in one tree, with an optional start time. */
export type Scenario = {
    /** Format version. */
    version: 1;
    /** The display name. */
    name: string;
    /** The initial time in seconds since J2000. Absent means now. */
    time?: number;
    /** The bodies, in any order. Exactly one has no parent. */
    bodies: Body[];
};

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
        const ok = [
            finite(`${path}.pole.x`, x, errors),
            finite(`${path}.pole.y`, y, errors),
            finite(`${path}.pole.z`, z, errors),
        ];

        if (ok.every(Boolean)) {
            const v = { x: x as number, y: y as number, z: z as number };
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

    finite(`${path}.nodeRate`, nodeRate, errors);
    finite(`${path}.argpRate`, argpRate, errors);

    if (errors.length > before || unit === null) {
        return null;
    }

    return {
        pole: unit,
        nodeRate: nodeRate as number,
        argpRate: argpRate as number,
    };
};

/** Checks a body's own fields. Links between bodies are checked later. */
const validateBody = (
    index: number,
    input: unknown,
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
    } = input;
    const validId = typeof id === "string" && SLUG.test(id);
    const label = validId ? id : `bodies[${index}]`;

    if (!validId) {
        errors.push(`${label}.id: must match ${SLUG} (got ${show(id)})`);
    } else if (ids.has(id)) {
        errors.push(`${label}.id: must be unique (got ${show(id)})`);
    } else {
        ids.add(id);
    }

    if (typeof name !== "string") {
        errors.push(`${label}.name: must be a string (got ${show(name)})`);
    }

    if (!KINDS.includes(kind as BodyKind)) {
        errors.push(
            `${label}.kind: must be one of ${KINDS.join(", ")} (got ${show(kind)})`,
        );
    }

    if (parent !== null && typeof parent !== "string") {
        errors.push(
            `${label}.parent: must be a string or null (got ${show(parent)})`,
        );
    }

    if (finite(`${label}.mu`, mu, errors)) {
        inRange(`${label}.mu`, mu, mu >= 0, ">= 0", errors);
    }

    if (finite(`${label}.radius`, radius, errors)) {
        inRange(`${label}.radius`, radius, radius > 0, "> 0", errors);
    }

    if (color !== undefined && typeof color !== "string") {
        errors.push(`${label}.color: must be a string (got ${show(color)})`);
    }

    if (role !== undefined) {
        if (!ROLES.includes(role as SpacecraftRole)) {
            errors.push(
                `${label}.role: must be one of ${ROLES.join(", ")} (got ${show(role)})`,
            );
        } else if (kind !== "spacecraft") {
            errors.push(
                `${label}.role: must be absent unless kind is spacecraft`,
            );
        }
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

    if (errors.length > before) {
        return null;
    }

    return {
        id: id as string,
        name: name as string,
        kind: kind as BodyKind,
        parent: parent as string | null,
        mu: mu as number,
        radius: radius as number,
        elements: parsed,
        ...(parsedPrecession ? { precession: parsedPrecession } : {}),
        ...(color === undefined ? {} : { color: color as string }),
        ...(role === undefined ? {} : { role: role as SpacecraftRole }),
    };
};

/** Checks the links between bodies: one root, known parents, no cycles. */
const validateTree = (inputs: unknown[], errors: string[]): void => {
    const parents = new Map<string, string | null>();
    const labels: string[] = [];

    for (const [index, input] of inputs.entries()) {
        const id = isRecord(input) ? input.id : undefined;
        const parent = isRecord(input) ? input.parent : undefined;
        const validId = typeof id === "string" && SLUG.test(id);

        labels.push(validId ? id : `bodies[${index}]`);

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

    for (const id of parents.keys()) {
        let current = parents.get(id);
        let steps = 0;

        while (typeof current === "string" && steps <= parents.size) {
            current = parents.get(current);
            steps++;
        }

        if (steps > parents.size) {
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
    const { version, name, time, bodies: inputs } = input;

    if (version !== 1) {
        errors.push(`version: must be 1 (got ${show(version)})`);
    }

    if (typeof name !== "string") {
        errors.push(`name: must be a string (got ${show(name)})`);
    }

    if (time !== undefined) {
        finite("time", time, errors);
    }

    const bodies: Body[] = [];

    if (!Array.isArray(inputs) || inputs.length === 0) {
        errors.push("bodies: must be a non-empty array");
    } else {
        const ids = new Set<string>();

        for (const [index, body] of inputs.entries()) {
            const valid = validateBody(index, body, ids, errors);

            if (valid) {
                bodies.push(valid);
            }
        }

        validateTree(inputs, errors);
    }

    if (errors.length > 0) {
        return { ok: false, errors };
    }

    return {
        ok: true,
        scenario: {
            version: 1,
            name: name as string,
            ...(time === undefined ? {} : { time: time as number }),
            bodies,
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
