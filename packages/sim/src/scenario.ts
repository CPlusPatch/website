import {
    type Elements,
    MAX_TIME,
    MAX_YEAR,
    MIN_TIME,
    MIN_YEAR,
    wrapAngle,
} from "@cpluspatch/orbit";
import type { Model } from "./models.ts";
import { isModel } from "./models.ts";
import type { Precession } from "./precession.ts";
import { type Rotation, validateRotation } from "./rotation/index.ts";
import { finite, isRecord, show, validatePole } from "./validate.ts";

/** What a body is made of. */
export type Mass = {
    /** The gravitational parameter GM in m³/s², at least 0. */
    mu: number;
    /** The mean radius in metres, above 0. */
    radius: number;
};

/** The orbit of a body around another. */
export type BodyOrbit = {
    /** The id of the body this one orbits. */
    parent: string;
    /** The orbit around the parent in the ecliptic J2000 frame. */
    elements: Elements;
};

/** The orbit turning about a fixed pole. */
export type Secular = { type: "secular" } & Precession;

/** A force acting on an orbit besides its parent's gravity. */
export type Perturbation = Secular;

/** One body in a scenario. */
export type Body = {
    /** A unique slug of lowercase letters, digits and hyphens. */
    id: string;
    /** The display name. */
    name: string;
    /** Labels only. The renderer styles bodies by them, first match first. */
    tags: string[];
    mass: Mass;
    /** The orbit. Absent for the root, which orbits nothing. */
    orbit?: BodyOrbit;
    /** Applied in order. At most one of each type. Only allowed with an orbit. */
    perturbations?: Perturbation[];
    /** Opaque to sim. The renderer validates it. */
    appearance?: unknown;
    /** The built-in preset: rotation, maps, colour, atmosphere and shape. Absent means a plain body. */
    preset?: Model;
    /** How the body turns. Absent means the preset's rotation, if it has one. */
    rotation?: Rotation;
};

/** A body that orbits another. */
export type OrbitingBody = Body & { orbit: BodyOrbit };

/** Whether `body` orbits another body. */
export const isOrbiting = (body: Body): body is OrbitingBody =>
    body.orbit !== undefined;

/** A catalogue of small bodies drawn around `host`. `source` names the catalogue, like `"celestrak-snapshot"`. */
export type Cloud = { id: string; host: string; source: string };

/** A set of bodies in one tree, with an optional start time. */
export type Scenario = {
    /** Format version. */
    version: 3;
    /** The display name. */
    name: string;
    /** The initial time in seconds since J2000. Absent means now. */
    time?: number;
    /** The small-body catalogues to draw. Absent means none. */
    clouds?: Cloud[];
    /** The bodies, in any order. Exactly one has no orbit. */
    bodies: Body[];
};

/** The bodies with `preset` set to the id wherever the id is a known model and no preset is given. */
export const fillModels = (bodies: Body[]): Body[] =>
    bodies.map((body) =>
        isModel(body.id) && body.preset === undefined
            ? { ...body, preset: body.id }
            : body,
    );

/** The scenario, or every reason the input isn't one. */
export type ScenarioResult =
    | { ok: true; scenario: Scenario }
    | { ok: false; errors: string[] };

// Version 1 and 2 had a kind and a role. They become tags on load.
const ROLES: readonly string[] = [
    "station",
    "telescope",
    "navigation",
    "earth-observation",
    "science",
];

const KINDS: readonly string[] = [
    "star",
    "planet",
    "dwarf",
    "moon",
    "asteroid",
    "comet",
    "spacecraft",
];

const SLUG = /^[a-z0-9-]+$/;

const MAX_TAGS = 8;

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** The longest name, in characters, for a body or a scenario. */
export const MAX_NAME = 100;

/** The most bodies a scenario can have. */
export const MAX_BODIES = 500;

const ELEMENT_FIELDS = ["a", "e", "i", "raan", "argp", "m0", "epoch"] as const;

/** Checks a body's `appearance` and returns the clean value. Pushes `<path>.<field>: ...` errors. */
export type AppearanceValidator = (
    path: string,
    input: unknown,
    errors: string[],
) => unknown;

/** Options for `validateScenario`. */
export type ValidateOptions = { appearance?: AppearanceValidator };

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
    const unit = validatePole(`${path}.pole`, pole, errors);

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

const validatePerturbations = (
    path: string,
    input: unknown,
    root: boolean,
    errors: string[],
): Perturbation[] => {
    if (!Array.isArray(input)) {
        errors.push(`${path}: must be an array (got ${show(input)})`);

        return [];
    }

    if (root) {
        errors.push(`${path}: must be absent when orbit is absent`);

        return [];
    }

    const seen = new Set<unknown>();
    const parsed: Perturbation[] = [];

    input.forEach((item: unknown, i) => {
        const itemPath = `${path}[${i}]`;

        if (!isRecord(item)) {
            errors.push(`${itemPath}: must be an object (got ${show(item)})`);

            return;
        }

        const { type } = item;

        if (type !== "secular") {
            errors.push(
                `${itemPath}.type: must be one of "secular" (got ${show(type)})`,
            );

            return;
        }

        if (seen.has(type)) {
            errors.push(`${itemPath}.type: must be unique (got ${show(type)})`);

            return;
        }

        seen.add(type);

        const rates = validatePrecession(itemPath, item, errors);

        if (rates) parsed.push({ type, ...rates });
    });

    return parsed;
};

const validateClouds = (
    input: unknown,
    bodyIds: Set<string>,
    errors: string[],
): Cloud[] => {
    if (!Array.isArray(input)) {
        errors.push(`clouds: must be an array (got ${show(input)})`);

        return [];
    }

    const seen = new Set<string>();
    const parsed: Cloud[] = [];

    input.forEach((item: unknown, i) => {
        const path = `clouds[${i}]`;

        if (!isRecord(item)) {
            errors.push(`${path}: must be an object (got ${show(item)})`);

            return;
        }

        const { id, host, source } = item;
        const before = errors.length;

        if (typeof id !== "string" || !SLUG.test(id)) {
            errors.push(`${path}.id: must match ${SLUG} (got ${show(id)})`);
        } else if (seen.has(id)) {
            errors.push(`${path}.id: must be unique (got ${show(id)})`);
        } else {
            seen.add(id);
        }

        if (typeof host !== "string") {
            errors.push(`${path}.host: must be a string (got ${show(host)})`);
        } else if (!bodyIds.has(host)) {
            errors.push(`${path}.host: there is no body ${show(host)}`);
        }

        if (typeof source !== "string" || !SLUG.test(source)) {
            errors.push(
                `${path}.source: must match ${SLUG} (got ${show(source)})`,
            );
        }

        if (
            errors.length === before &&
            typeof id === "string" &&
            typeof host === "string" &&
            typeof source === "string"
        ) {
            parsed.push({ id, host, source });
        }
    });

    return parsed;
};

const validateTags = (
    path: string,
    input: unknown,
    errors: string[],
): string[] | undefined => {
    if (!Array.isArray(input) || input.length < 1 || input.length > MAX_TAGS) {
        errors.push(
            `${path}: must be an array of 1 to ${MAX_TAGS} tags (got ${show(input)})`,
        );

        return undefined;
    }

    const before = errors.length;
    const seen = new Set<string>();

    for (const [index, tag] of input.entries()) {
        if (typeof tag !== "string" || !SLUG.test(tag)) {
            errors.push(
                `${path}[${index}]: must match ${SLUG} (got ${show(tag)})`,
            );
        } else if (seen.has(tag)) {
            errors.push(`${path}: must be unique (got ${show(tag)} twice)`);
        } else {
            seen.add(tag);
        }
    }

    return errors.length > before ? undefined : [...seen];
};

/** Checks `mu` and `radius`, which sit at `path` in a version 3 body and on the body before that. */
const validateMass = (
    path: string,
    mu: unknown,
    radius: unknown,
    errors: string[],
): Mass | null => {
    const validMu = finite(`${path}.mu`, mu, errors) ? mu : null;

    if (validMu !== null) {
        inRange(`${path}.mu`, validMu, validMu >= 0, ">= 0", errors);
    }

    const validRadius = finite(`${path}.radius`, radius, errors)
        ? radius
        : null;

    if (validRadius !== null) {
        inRange(`${path}.radius`, validRadius, validRadius > 0, "> 0", errors);
    }

    if (validMu === null || validRadius === null) return null;

    return { mu: validMu, radius: validRadius };
};

/** Checks a body's own fields. Links between bodies are checked later. */
const validateBody = (
    index: number,
    input: unknown,
    version: 1 | 2 | 3,
    ids: Set<string>,
    errors: string[],
    options: ValidateOptions,
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
        tags,
        parent,
        mu,
        radius,
        elements,
        mass,
        orbit,
        precession,
        perturbations,
        color,
        appearance,
        role,
        model,
        preset,
        rotation,
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

    let validTags: string[] | undefined;

    if (version === 3) {
        validTags = validateTags(`${label}.tags`, tags, errors);
    } else {
        const validKind = KINDS.find((k) => k === kind);

        if (validKind === undefined) {
            errors.push(
                `${label}.kind: must be one of ${KINDS.join(", ")} (got ${show(kind)})`,
            );
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

        if (validKind !== undefined) {
            validTags =
                validRole === undefined ? [validKind] : [validKind, validRole];
        }
    }

    // Version 3 nests these as `mass` and `orbit`. Older versions have them flat on the body.
    let validParent: string | null | undefined;
    let validMass: Mass | null = null;
    let root: boolean;
    let rawElements: unknown;
    let elementsPath: string;

    if (version === 3) {
        root = orbit === undefined;
        validParent = root ? null : undefined;
        rawElements = isRecord(orbit) ? orbit.elements : undefined;
        elementsPath = `${label}.orbit.elements`;

        if (!isRecord(mass)) {
            errors.push(`${label}.mass: must be an object (got ${show(mass)})`);
        } else {
            validMass = validateMass(
                `${label}.mass`,
                mass.mu,
                mass.radius,
                errors,
            );
        }

        if (orbit !== undefined && !isRecord(orbit)) {
            errors.push(
                `${label}.orbit: must be an object (got ${show(orbit)})`,
            );
        } else if (isRecord(orbit)) {
            if (typeof orbit.parent === "string") {
                validParent = orbit.parent;
            } else {
                errors.push(
                    `${label}.orbit.parent: must be a string (got ${show(orbit.parent)})`,
                );
            }

            if (!isRecord(rawElements)) {
                errors.push(
                    `${elementsPath}: must be an object (got ${show(rawElements)})`,
                );
            }
        }
    } else {
        root = parent === null;
        validParent =
            parent === null || typeof parent === "string" ? parent : undefined;
        rawElements = elements;
        elementsPath = `${label}.elements`;

        if (validParent === undefined) {
            errors.push(
                `${label}.parent: must be a string or null (got ${show(parent)})`,
            );
        }

        validMass = validateMass(label, mu, radius, errors);
    }

    let validAppearance: unknown;

    if (version === 3) {
        if (appearance !== undefined) {
            if (!isRecord(appearance)) {
                errors.push(
                    `${label}.appearance: must be an object (got ${show(appearance)})`,
                );
            } else {
                validAppearance =
                    options.appearance === undefined
                        ? appearance
                        : options.appearance(
                              `${label}.appearance`,
                              appearance,
                              errors,
                          );
            }
        }
    } else if (color !== undefined) {
        if (typeof color !== "string") {
            errors.push(
                `${label}.color: must be a string (got ${show(color)})`,
            );
        } else if (!HEX_COLOR.test(color)) {
            errors.push(
                `${label}.color: must be a #rgb or #rrggbb colour (got ${show(color)})`,
            );
        } else {
            validAppearance = { color };
        }
    }

    // Version 1 has no presets. They're filled in from the ids afterwards.
    // Version 2 called the field `model`.
    const [presetKey, presetInput] =
        version === 3 ? ["preset", preset] : ["model", model];
    const validPreset =
        version >= 2 && isModel(presetInput) ? presetInput : undefined;

    if (
        version >= 2 &&
        presetInput !== undefined &&
        validPreset === undefined
    ) {
        errors.push(
            `${label}.${presetKey}: must be one of the known ${presetKey}s (got ${show(presetInput)})`,
        );
    }

    // Versions 1 and 2 have no rotation field.
    const validRotation =
        version === 3 && rotation !== undefined
            ? validateRotation(`${label}.rotation`, rotation, errors)
            : null;

    let parsed: Elements | null = null;

    if (version === 3) {
        if (isRecord(rawElements)) {
            parsed = validateElements(elementsPath, rawElements, errors);
        }
    } else if (root) {
        if (elements !== null) {
            errors.push(`${label}.elements: must be null when parent is null`);
        }
    } else if (elements === null) {
        errors.push(`${label}.elements: must be set when parent is set`);
    } else {
        parsed = validateElements(elementsPath, elements, errors);
    }

    let parsedPerturbations: Perturbation[] = [];

    if (version === 3) {
        if (perturbations !== undefined) {
            parsedPerturbations = validatePerturbations(
                `${label}.perturbations`,
                perturbations,
                root,
                errors,
            );
        }
    } else if (precession !== undefined) {
        if (root) {
            errors.push(
                `${label}.precession: must be absent when parent is null`,
            );
        } else {
            const parsedPrecession = validatePrecession(
                `${label}.precession`,
                precession,
                errors,
            );

            if (parsedPrecession) {
                parsedPerturbations = [
                    { type: "secular", ...parsedPrecession },
                ];
            }
        }
    }

    if (
        errors.length > before ||
        validId === null ||
        validName === null ||
        validTags === undefined ||
        validParent === undefined ||
        validMass === null
    ) {
        return null;
    }

    const base = {
        id: validId,
        name: validName,
        tags: validTags,
        mass: validMass,
        ...(validAppearance === undefined
            ? {}
            : { appearance: validAppearance }),
        ...(validPreset === undefined ? {} : { preset: validPreset }),
        ...(validRotation ? { rotation: validRotation } : {}),
    };

    if (validParent === null) {
        return base;
    }

    // No errors were added, so a body with a parent has parsed elements.
    if (parsed === null) {
        throw new Error(`${label}: elements missing after validation`);
    }

    return {
        ...base,
        orbit: { parent: validParent, elements: parsed },
        ...(parsedPerturbations.length > 0
            ? { perturbations: parsedPerturbations }
            : {}),
    };
};

/** Checks the links between bodies: one root, known parents, no cycles. */
const validateTree = (
    inputs: unknown[],
    version: 1 | 2 | 3,
    errors: string[],
): void => {
    const parents = new Map<string, string | null>();
    const field = version === 3 ? "orbit.parent" : "parent";

    for (const input of inputs) {
        const id = isRecord(input) ? input.id : undefined;
        const validId = typeof id === "string" && SLUG.test(id);
        let parent: unknown;

        if (!isRecord(input)) {
            parent = undefined;
        } else if (version === 3) {
            // No orbit means root.
            parent =
                input.orbit === undefined
                    ? null
                    : isRecord(input.orbit)
                      ? input.orbit.parent
                      : undefined;
        } else {
            parent = input.parent;
        }

        if (validId && (parent === null || typeof parent === "string")) {
            parents.set(id, parent);
        }
    }

    const roots = [...parents.values()].filter((p) => p === null).length;

    if (roots !== 1) {
        errors.push(
            version === 3
                ? `bodies: must have exactly one root, with no orbit (got ${roots})`
                : `bodies: must have exactly one root, with parent null (got ${roots})`,
        );
    }

    for (const [id, parent] of parents) {
        if (parent !== null && !parents.has(parent)) {
            errors.push(`${id}.${field}: no body has the id ${show(parent)}`);
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
            errors.push(
                `${id}.${field}: the parent chain loops back on itself`,
            );
        }
    }
};

/** Checks unknown input and returns a clean scenario with wrapped angles, or every error. */
export const validateScenario = (
    input: unknown,
    options: ValidateOptions = {},
): ScenarioResult => {
    if (!isRecord(input)) {
        return {
            ok: false,
            errors: [`scenario: must be an object (got ${show(input)})`],
        };
    }

    const errors: string[] = [];
    const {
        version,
        name,
        time,
        hasSatellites,
        clouds: inputClouds,
        bodies: inputs,
    } = input;
    const validVersion =
        version === 1 || version === 2 || version === 3 ? version : null;

    if (validVersion === null) {
        errors.push(`version: must be 1, 2 or 3 (got ${show(version)})`);
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
                options,
            );

            if (valid) {
                bodies.push(valid);
            }
        }

        validateTree(inputs, validVersion ?? 2, errors);
    }

    // Version 3 only: older files get their cloud from `hasSatellites` or the Earth id.
    const parsedClouds =
        validVersion === 3 && inputClouds !== undefined
            ? validateClouds(
                  inputClouds,
                  new Set(bodies.map((body) => body.id)),
                  errors,
              )
            : [];

    if (errors.length > 0 || validName === null) {
        return { ok: false, errors };
    }

    // A version 1 file had no models, so Earth's id stood for them and for the satellites.
    const filled = validVersion === 1 ? fillModels(bodies) : bodies;
    const earth = filled.find((body) => body.preset === "earth");
    let clouds = parsedClouds;

    if (
        validVersion !== 3 &&
        earth &&
        (validVersion === 1 || hasSatellites === true)
    ) {
        clouds = [
            { id: "satellites", host: earth.id, source: "celestrak-snapshot" },
        ];
    }

    return {
        ok: true,
        scenario: {
            version: 3,
            name: validName,
            ...(validTime === undefined ? {} : { time: validTime }),
            ...(clouds.length ? { clouds } : {}),
            bodies: filled,
        },
    };
};

/** The bodies with every parent before its children, breadth-first from the root. */
export const sortByDepth = (scenario: Scenario): Body[] => {
    const children = new Map<string | null, Body[]>();

    for (const body of scenario.bodies) {
        const siblings = children.get(body.orbit?.parent ?? null) ?? [];

        siblings.push(body);
        children.set(body.orbit?.parent ?? null, siblings);
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
            if (body.orbit?.parent === parent) ids.push(body.id);
        }
    }

    return ids;
};
