import type { Body, BodyKind, Scenario } from "@cpluspatch/orbit";
import { G } from "@cpluspatch/orbit";

/** What the Add body form collects, in the units it shows. */
export type NewBodyInput = {
    id: string;
    name: string;
    kind: BodyKind;
    parent: Body;
    radiusKm: number;
    massKg: number;
    aKm: number;
    e: number;
    iDeg: number;
};

/** A body id from `name`: lowercase letters, digits and hyphens, not in `taken`. */
export const slugId = (name: string, taken: ReadonlySet<string>): string => {
    const base =
        name
            .normalize("NFD")
            // Combining marks, so "é" becomes "e".
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "") || "body";

    let id = base;
    for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;

    return id;
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

/** The body for `input`, with its orbit set at time `t`. */
export const newBody = (input: NewBodyInput, t: number): Body => ({
    id: input.id,
    name: input.name,
    kind: input.kind,
    parent: input.parent.id,
    mu: G * input.massKg,
    radius: input.radiusKm * 1000,
    elements: {
        a: input.aKm * 1000,
        e: input.e,
        i: (input.iDeg * Math.PI) / 180,
        raan: 0,
        argp: 0,
        m0: 0,
        epoch: t,
    },
});
