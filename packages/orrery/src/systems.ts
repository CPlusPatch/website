import { period } from "@cpluspatch/orbit";
import { styleOf } from "@cpluspatch/render";
import type { Body } from "@cpluspatch/sim";

/** One line in a group. A nested row is a child of the row above it. */
export type Row = { body: Body; nested: boolean };

/** A titled run of rows. */
export type Group = { label: string; rows: Row[] };

/** The group titles in display order. The tag table says which one a body is in. */
const GROUPS: readonly string[] = [
    "Stars",
    "Planets",
    "Dwarf planets",
    "Small bodies",
    "Moons",
    "Spacecraft",
];

const unknown = (id: string): Error => new Error(`There is no body "${id}".`);

const find = (bodies: readonly Body[], id: string): Body => {
    const body = bodies.find((candidate) => candidate.id === id);
    if (!body) throw unknown(id);

    return body;
};

const childrenOf = (bodies: readonly Body[], id: string): Body[] =>
    bodies.filter((body) => body.orbit?.parent === id);

/** The groups that hold `children`, with `nest` giving the rows that follow each child. */
const grouped = (
    children: readonly Body[],
    nest: (child: Body) => Body[],
): Group[] =>
    GROUPS.map((label) => ({
        label,
        rows: children
            .filter((child) => styleOf(child).group === label)
            .flatMap((child) => [
                { body: child, nested: false },
                ...nest(child).map((body) => ({ body, nested: true })),
            ]),
    })).filter((group) => group.rows.length > 0);

/** The root of the tree and its direct children in groups. */
export const leftPane = (
    bodies: readonly Body[],
): { root: Body; groups: Group[] } => {
    const root = bodies.find((body) => body.orbit === undefined);
    if (!root) throw new Error("There is no root body.");

    return { root, groups: grouped(childrenOf(bodies, root.id), () => []) };
};

/** The children of `id` in groups, each one but spacecraft followed by its own children. */
export const system = (bodies: readonly Body[], id: string): Group[] => {
    find(bodies, id);

    return grouped(childrenOf(bodies, id), (child) =>
        styleOf(child).nests ? childrenOf(bodies, child.id) : [],
    );
};

/** The names between the root and the body, joined with " › ". Empty for the root and its children. */
export const path = (bodies: readonly Body[], id: string): string => {
    const names: string[] = [];
    let parent = find(bodies, id).orbit?.parent ?? null;

    while (parent !== null) {
        const ancestor = find(bodies, parent);
        parent = ancestor.orbit?.parent ?? null;

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
        body.orbit ? [{ body, distance: Math.abs(body.orbit.elements.a) }] : [],
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
    const { orbit } = body;
    const parent = orbit ? find(bodies, orbit.parent) : null;

    return {
        period:
            parent && orbit && orbit.elements.e < 1
                ? period(orbit.elements, parent.mass.mu + body.mass.mu)
                : null,
        // A spacecraft's radius is only its model's size.
        radius: styleOf(body).sized ? body.mass.radius : null,
    };
};
