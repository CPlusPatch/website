import { period } from "@cpluspatch/orbit";
import type { Body, BodyKind } from "@cpluspatch/sim";

/** One line in a group. A nested row is a child of the row above it. */
export type Row = { body: Body; nested: boolean };

/** A titled run of rows. */
export type Group = { label: string; rows: Row[] };

/** The groups in display order, with the kinds each one holds. */
const GROUPS: readonly { label: string; kinds: readonly BodyKind[] }[] = [
    { label: "Stars", kinds: ["star"] },
    { label: "Planets", kinds: ["planet"] },
    { label: "Dwarf planets", kinds: ["dwarf"] },
    { label: "Small bodies", kinds: ["asteroid", "comet"] },
    { label: "Moons", kinds: ["moon"] },
    { label: "Spacecraft", kinds: ["spacecraft"] },
];

const unknown = (id: string): Error => new Error(`There is no body "${id}".`);

const find = (bodies: readonly Body[], id: string): Body => {
    const body = bodies.find((candidate) => candidate.id === id);
    if (!body) throw unknown(id);

    return body;
};

const childrenOf = (bodies: readonly Body[], id: string): Body[] =>
    bodies.filter((body) => body.parent === id);

/** The groups that hold `children`, with `nest` giving the rows that follow each child. */
const grouped = (
    children: readonly Body[],
    nest: (child: Body) => Body[],
): Group[] =>
    GROUPS.map(({ label, kinds }) => ({
        label,
        rows: children
            .filter((child) => kinds.includes(child.kind))
            .flatMap((child) => [
                { body: child, nested: false },
                ...nest(child).map((body) => ({ body, nested: true })),
            ]),
    })).filter((group) => group.rows.length > 0);

/** The root of the tree and its direct children in groups. */
export const leftPane = (
    bodies: readonly Body[],
): { root: Body; groups: Group[] } => {
    const root = bodies.find((body) => body.parent === null);
    if (!root) throw new Error("There is no root body.");

    return { root, groups: grouped(childrenOf(bodies, root.id), () => []) };
};

/** The children of `id` in groups, each one but spacecraft followed by its own children. */
export const system = (bodies: readonly Body[], id: string): Group[] => {
    find(bodies, id);

    return grouped(childrenOf(bodies, id), (child) =>
        child.kind === "spacecraft" ? [] : childrenOf(bodies, child.id),
    );
};

/** The names between the root and the body, joined with " › ". Empty for the root and its children. */
export const path = (bodies: readonly Body[], id: string): string => {
    const names: string[] = [];
    let parent = find(bodies, id).parent;

    while (parent !== null) {
        const ancestor = find(bodies, parent);
        parent = ancestor.parent;

        // The root is left out.
        if (parent !== null) names.unshift(ancestor.name);
    }

    return names.join(" › ");
};

/**
 * Where the children of `id` sit on a log scale of orbit size, or null with no children. Ticks
 * fall on powers of ten of `unit` metres, so they read as decades in the unit shown.
 */
export const rail = (
    bodies: readonly Body[],
    id: string,
    unit = 1,
): {
    marks: { body: Body; at: number }[];
    ticks: { distance: number; at: number }[];
    lo: number;
    hi: number;
} | null => {
    const distances = childrenOf(bodies, id).flatMap((body) =>
        body.elements ? [{ body, distance: Math.abs(body.elements.a) }] : [],
    );
    if (distances.length === 0) return null;

    const lo = Math.min(...distances.map(({ distance }) => distance));
    const hi = Math.max(...distances.map(({ distance }) => distance));
    const at = (distance: number): number =>
        lo === hi
            ? 0.5
            : (Math.log(distance) - Math.log(lo)) /
              (Math.log(hi) - Math.log(lo));
    const ticks: { distance: number; at: number }[] = [];

    if (lo !== hi) {
        // The slack covers float error in the log10 at the ends.
        const first = Math.ceil(Math.log10((lo / unit) * (1 - 1e-4)));
        const last = Math.floor(Math.log10((hi / unit) * (1 + 1e-4)));

        for (let power = first; power <= last; power++) {
            const distance = unit * 10 ** power;
            ticks.push({
                distance,
                at: Math.min(1, Math.max(0, at(distance))),
            });
        }
    }

    return {
        marks: distances.map(({ body, distance }) => ({
            body,
            at: at(distance),
        })),
        ticks,
        lo,
        hi,
    };
};

/** The orbital period in seconds and the radius in metres, each null when there isn't one. */
export const facts = (
    bodies: readonly Body[],
    id: string,
): { period: number | null; radius: number | null } => {
    const body = find(bodies, id);
    const { elements } = body;
    const parent = body.parent === null ? null : find(bodies, body.parent);

    return {
        period:
            parent && elements && elements.e < 1
                ? period(elements, parent.mu + body.mu)
                : null,
        // A spacecraft's radius is only its model's size.
        radius: body.kind === "spacecraft" ? null : body.radius,
    };
};
