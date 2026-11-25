import { applyBurn, type Burn, type Elements } from "@cpluspatch/orbit";
import type { Document } from "./document.ts";
import { elementsAt } from "./precession.ts";
import type { Body, Scenario } from "./scenario.ts";
import { subtreeIds, validateScenario } from "./scenario.ts";

/** The fields of a body that `update-body` can change. */
export type BodyPatch = Partial<
    Pick<Body, "name" | "kind" | "mu" | "radius" | "color" | "role" | "model">
>;

/** One edit to a document. */
export type Command =
    | { type: "add-body"; body: Body }
    /** Removes the body and every body that orbits it. */
    | { type: "remove-body"; id: string }
    | { type: "update-body"; id: string; patch: BodyPatch }
    | { type: "set-orbit"; bodyId: string; t: number; elements: Elements }
    | { type: "schedule-burn"; bodyId: string; t: number; dv: Burn }
    | { type: "load"; doc: Document };

/** The document after a command, or every reason it can't be applied. */
export type DocumentResult =
    | { ok: true; doc: Document }
    | { ok: false; errors: string[] };

const PATCH_KEYS = [
    "name",
    "kind",
    "mu",
    "radius",
    "color",
    "role",
    "model",
] as const;

const BURN_FAILURES = {
    escape: "the burn would leave the parent's gravity",
    degenerate: "the burn would leave no orbit to describe",
};

const fail = (...errors: string[]): DocumentResult => ({ ok: false, errors });

/** Validates `scenario`, since every change has to leave a scenario the loader would accept. */
const finish = (
    scenario: Scenario,
    timeline: Document["timeline"],
): DocumentResult => {
    const result = validateScenario(scenario);

    return result.ok
        ? { ok: true, doc: { scenario: result.scenario, timeline } }
        : fail(...result.errors);
};

/** `scenario` with body `id` on a fixed orbit of `elements`, dropping any precession. */
const withOrbit = (
    scenario: Scenario,
    id: string,
    elements: Elements,
): Scenario => ({
    ...scenario,
    bodies: scenario.bodies.map((body) => {
        if (body.id !== id || body.parent === null) return body;

        const { precession: _dropped, ...fixed } = body;

        return { ...fixed, elements };
    }),
});

const setOrbit = (
    doc: Document,
    bodyId: string,
    elements: Elements,
): DocumentResult =>
    finish(withOrbit(doc.scenario, bodyId, elements), doc.timeline);

/** Applies `cmd` to `doc` without changing `doc`. Bad input returns errors, it never throws. */
export const apply = (doc: Document, cmd: Command): DocumentResult => {
    const { scenario, timeline } = doc;

    if (cmd.type === "load") {
        return finish(cmd.doc.scenario, cmd.doc.timeline);
    }

    if (cmd.type === "add-body") {
        return finish(
            { ...scenario, bodies: [...scenario.bodies, cmd.body] },
            timeline,
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
        // Only the patch keys are copied, so a patch with `parent` or `elements` can't change them.
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
        );
    }

    if (cmd.type === "remove-body") {
        if (body.parent === null) return fail(`id: "${id}" is the root.`);

        const gone = new Set(subtreeIds(scenario, id));

        return finish(
            {
                ...scenario,
                bodies: scenario.bodies.filter(
                    (candidate) => !gone.has(candidate.id),
                ),
            },
            timeline,
        );
    }

    if (body.parent === null) {
        return fail(
            cmd.type === "set-orbit"
                ? `bodyId: "${id}" has no parent to orbit.`
                : `bodyId: "${id}" has no orbit to burn on.`,
        );
    }

    // `t` isn't used until the timeline lands: the change applies now.
    if (cmd.type === "set-orbit") return setOrbit(doc, id, cmd.elements);

    const parent = scenario.bodies.find(
        (candidate) => candidate.id === body.parent,
    );

    if (!parent)
        return fail(`bodyId: there is no body ${JSON.stringify(body.parent)}`);

    const burned = applyBurn(
        elementsAt(body, cmd.t),
        parent.mu + body.mu,
        cmd.t,
        cmd.dv,
    );

    if (!burned.ok) {
        return fail(
            `bodyId: can't burn "${id}": ${BURN_FAILURES[burned.reason]}`,
        );
    }

    return setOrbit(doc, id, burned.elements);
};
