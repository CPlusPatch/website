import type { Precession } from "../precession.ts";
import type { Body, OrbitingBody, Perturbation } from "../scenario.ts";
import { isOrbiting } from "../scenario.ts";
import { resolveJ2 } from "./j2.ts";
import { secularPrecession } from "./secular.ts";

/** The precession `perturbation` gives `body`. `body` and `parent` have their presets filled in. */
export const resolvePerturbation = (
    perturbation: Perturbation,
    body: OrbitingBody,
    parent: Body,
): Precession =>
    perturbation.type === "secular"
        ? secularPrecession(perturbation)
        : resolveJ2(body, parent);

/** The precessions of `body`'s perturbations around `parent`, in order. */
export const precessionsOf = (body: OrbitingBody, parent: Body): Precession[] =>
    (body.perturbations ?? []).map((perturbation) =>
        resolvePerturbation(perturbation, body, parent),
    );

/** The precessions of every orbiting body of `bodies` by id. The bodies have their presets filled in. */
export const precessionsByBody = (
    bodies: readonly Body[],
): Map<string, readonly Precession[]> => {
    const byId = new Map(bodies.map((body) => [body.id, body]));
    const resolved = new Map<string, readonly Precession[]>();

    for (const body of bodies) {
        const parent = isOrbiting(body)
            ? byId.get(body.orbit.parent)
            : undefined;

        if (isOrbiting(body) && parent) {
            resolved.set(body.id, precessionsOf(body, parent));
        }
    }

    return resolved;
};
