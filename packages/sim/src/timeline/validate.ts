import type { Burn } from "@cpluspatch/orbit";
import type { TimelineEvent } from "../document.ts";
import { expandPresets, type Presets } from "../presets.ts";
import type { Scenario } from "../scenario.ts";
import { validateElements } from "../scenario.ts";
import { finite, isRecord, show } from "../validate.ts";
import { segmentsByBody } from "./segments.ts";

/** The result of `validateTimeline`: the clean events, or every reason they're invalid. */
export type TimelineResult =
    | { ok: true; timeline: TimelineEvent[] }
    | { ok: false; errors: string[] };

const BURN_FIELDS = ["prograde", "normal", "radial"] as const;

const validateBurn = (
    path: string,
    input: unknown,
    errors: string[],
): Burn | null => {
    if (!isRecord(input)) {
        errors.push(`${path}: must be an object (got ${show(input)})`);

        return null;
    }

    const before = errors.length;
    const values: Partial<Burn> = {};

    for (const field of BURN_FIELDS) {
        const value = input[field];

        if (finite(`${path}.${field}`, value, errors)) values[field] = value;
    }

    const { prograde, normal, radial } = values;

    if (
        errors.length > before ||
        prograde === undefined ||
        normal === undefined ||
        radial === undefined
    ) {
        return null;
    }

    return { prograde, normal, radial };
};

const validateEvent = (
    path: string,
    input: unknown,
    scenario: Scenario,
    ids: Set<string>,
    errors: string[],
): TimelineEvent | null => {
    if (!isRecord(input)) {
        errors.push(`${path}: must be an object (got ${show(input)})`);

        return null;
    }

    const before = errors.length;
    const { type, id, bodyId, t } = input;

    if (type !== "burn" && type !== "set-orbit") {
        errors.push(
            `${path}.type: must be "burn" or "set-orbit" (got ${show(type)})`,
        );
    }

    if (typeof id !== "string" || id === "") {
        errors.push(`${path}.id: must be a non-empty string (got ${show(id)})`);
    } else if (ids.has(id)) {
        errors.push(`${path}.id: must be unique (got ${show(id)})`);
    } else {
        ids.add(id);
    }

    const body = scenario.bodies.find((candidate) => candidate.id === bodyId);

    if (!body) {
        errors.push(`${path}.bodyId: there is no body ${show(bodyId)}`);
    } else if (body.orbit === undefined) {
        errors.push(`${path}.bodyId: "${body.id}" has no orbit`);
    }

    const time = finite(`${path}.t`, t, errors) ? t : null;

    if (type === "burn") {
        const dv = validateBurn(`${path}.dv`, input.dv, errors);

        return errors.length > before ||
            dv === null ||
            time === null ||
            typeof id !== "string" ||
            typeof bodyId !== "string"
            ? null
            : { type, id, bodyId, t: time, dv };
    }

    if (type === "set-orbit") {
        const elements = validateElements(
            `${path}.elements`,
            input.elements,
            errors,
        );

        return errors.length > before ||
            elements === null ||
            time === null ||
            typeof id !== "string" ||
            typeof bodyId !== "string"
            ? null
            : { type, id, bodyId, t: time, elements };
    }

    return null;
};

/**
 * Checks `input` as the timeline of `scenario` and returns the clean events. Every burn has to
 * succeed on the orbit the events before it leave. `scenario` must be valid.
 */
export const validateTimeline = (
    input: unknown,
    scenario: Scenario,
    presets: Presets,
): TimelineResult => {
    if (!Array.isArray(input)) {
        return {
            ok: false,
            errors: [`timeline: must be an array (got ${show(input)})`],
        };
    }

    const errors: string[] = [];
    const ids = new Set<string>();
    const timeline: TimelineEvent[] = [];

    for (const [i, raw] of input.entries()) {
        const event = validateEvent(
            `timeline[${i}]`,
            raw,
            scenario,
            ids,
            errors,
        );

        if (event) timeline.push(event);
    }

    if (errors.length > 0) return { ok: false, errors };

    const result = segmentsByBody(
        expandPresets(scenario, presets).bodies,
        timeline,
    );

    return result.ok ? { ok: true, timeline } : result;
};
