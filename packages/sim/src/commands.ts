import type { Burn, Elements } from "@cpluspatch/orbit";
import type { Document, TimelineEvent } from "./document.ts";
import type { Presets } from "./presets.ts";
import type { Body, Scenario } from "./scenario.ts";
import { isOrbiting, subtreeIds, validateScenario } from "./scenario.ts";
import { validateTimeline } from "./timeline/validate.ts";

/** The fields of a body that `update-body` can change. */
export type BodyPatch = Partial<
    Pick<Body, "name" | "tags" | "mass" | "appearance" | "preset">
>;

/** One edit to a document. */
export type Command =
    | { type: "add-body"; body: Body }
    /** Removes the body and every body that orbits it. */
    | { type: "remove-body"; id: string }
    | { type: "update-body"; id: string; patch: BodyPatch }
    | { type: "set-orbit"; bodyId: string; t: number; elements: Elements }
    | { type: "schedule-burn"; bodyId: string; t: number; dv: Burn }
    /** Removes a timeline event, so the body's orbit follows the events that are left. */
    | { type: "remove-event"; id: string }
    | { type: "load"; doc: Document };

/** The document after a command, or every reason it can't be applied. */
export type DocumentResult =
    | { ok: true; doc: Document }
    | { ok: false; errors: string[] };

const PATCH_KEYS = ["name", "tags", "mass", "appearance", "preset"] as const;

const fail = (...errors: string[]): DocumentResult => ({ ok: false, errors });

/** `doc`'s scenario with `timeline` checked against it. The scenario is already valid, so it's kept as it is. */
const withTimeline = (
    scenario: Scenario,
    timeline: unknown,
    presets: Presets,
): DocumentResult => {
    const events = validateTimeline(timeline, scenario, presets);

    return events.ok
        ? { ok: true, doc: { scenario, timeline: events.timeline } }
        : fail(...events.errors);
};

/** Validates `scenario` and `timeline`, since every change has to leave a document the loader would accept. */
const finish = (
    scenario: Scenario,
    timeline: unknown,
    presets: Presets,
): DocumentResult => {
    const result = validateScenario(scenario, { presets });

    return result.ok
        ? withTimeline(result.scenario, timeline, presets)
        : fail(...result.errors);
};

/** An id for a new event: `e` and one more than the largest number among the existing `e<n>` ids. */
const nextEventId = (timeline: readonly TimelineEvent[]): string => {
    let largest = 0;

    for (const { id } of timeline) {
        const n = /^e(\d+)$/.exec(id)?.[1];

        if (n !== undefined) largest = Math.max(largest, Number(n));
    }

    return `e${largest + 1}`;
};

/** Applies `cmd` to `doc` without changing `doc`. Bad input returns errors, it never throws. */
export const apply = (
    doc: Document,
    cmd: Command,
    presets: Presets,
): DocumentResult => {
    const { scenario, timeline } = doc;

    if (cmd.type === "load") {
        return finish(cmd.doc.scenario, cmd.doc.timeline, presets);
    }

    if (cmd.type === "remove-event") {
        if (!timeline.some((event) => event.id === cmd.id)) {
            return fail(`id: there is no event ${JSON.stringify(cmd.id)}`);
        }

        return withTimeline(
            scenario,
            timeline.filter((event) => event.id !== cmd.id),
            presets,
        );
    }

    if (cmd.type === "add-body") {
        return finish(
            { ...scenario, bodies: [...scenario.bodies, cmd.body] },
            timeline,
            presets,
        );
    }

    const id =
        cmd.type === "remove-body" || cmd.type === "update-body"
            ? cmd.id
            : cmd.bodyId;
    const body = scenario.bodies.find((candidate) => candidate.id === id);
    const field =
        cmd.type === "remove-body" || cmd.type === "update-body"
            ? "id"
            : "bodyId";

    if (!body) return fail(`${field}: there is no body ${JSON.stringify(id)}`);

    if (cmd.type === "update-body") {
        // Only the patch keys are copied, so a patch with `orbit` can't change them.
        const changes: Record<string, unknown> = {};

        for (const key of PATCH_KEYS) {
            if (key in cmd.patch) changes[key] = cmd.patch[key];
        }

        return finish(
            {
                ...scenario,
                bodies: scenario.bodies.map((candidate) =>
                    candidate === body
                        ? ({ ...body, ...changes } as Body)
                        : candidate,
                ),
            },
            timeline,
            presets,
        );
    }

    if (cmd.type === "remove-body") {
        if (body.orbit === undefined) return fail(`id: "${id}" is the root.`);

        const gone = new Set(subtreeIds(scenario, id));
        const { clouds, ...rest } = scenario;
        const kept = clouds?.filter((cloud) => !gone.has(cloud.host)) ?? [];

        return finish(
            {
                ...rest,
                ...(kept.length ? { clouds: kept } : {}),
                bodies: scenario.bodies.filter(
                    (candidate) => !gone.has(candidate.id),
                ),
            },
            timeline.filter((event) => !gone.has(event.bodyId)),
            presets,
        );
    }

    if (!isOrbiting(body)) {
        return fail(
            cmd.type === "set-orbit"
                ? `bodyId: "${id}" has no parent to orbit.`
                : `bodyId: "${id}" has no orbit to burn on.`,
        );
    }

    const eventId = nextEventId(timeline);

    if (cmd.type === "set-orbit") {
        return withTimeline(
            scenario,
            [
                ...timeline,
                {
                    type: "set-orbit",
                    id: eventId,
                    bodyId: id,
                    t: cmd.t,
                    elements: cmd.elements,
                },
            ],
            presets,
        );
    }

    const parent = scenario.bodies.find(
        (candidate) => candidate.id === body.orbit.parent,
    );

    if (!parent)
        return fail(
            `bodyId: there is no body ${JSON.stringify(body.orbit.parent)}`,
        );

    return withTimeline(
        scenario,
        [
            ...timeline,
            { type: "burn", id: eventId, bodyId: id, t: cmd.t, dv: cmd.dv },
        ],
        presets,
    );
};
