import type { Body } from "@cpluspatch/orbit";

/** The bodies with each one's children right after it, siblings in the order given. */
export const treeOrder = (bodies: readonly Body[]): Body[] => {
    const children = new Map<string | null, Body[]>();

    for (const body of bodies) {
        children.set(body.parent, [...(children.get(body.parent) ?? []), body]);
    }

    const walk = (parent: string | null): Body[] =>
        (children.get(parent) ?? []).flatMap((body) => [
            body,
            ...walk(body.id),
        ]);

    return walk(null);
};

/**
 * The bodies that match `query`: name prefixes first, then other substrings.
 * A blank query lists every body in the order given.
 */
export const found = (bodies: readonly Body[], query: string): Body[] => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [...bodies];

    const at = (body: Body) => body.name.toLowerCase().indexOf(needle);

    return [
        ...bodies.filter((body) => at(body) === 0),
        ...bodies.filter((body) => at(body) > 0),
    ];
};

/** `name` split around the first match of `query`, as `[before, match, after]`. */
export const marked = (
    name: string,
    query: string,
): [before: string, match: string, after: string] => {
    const needle = query.trim().toLowerCase();
    const at = needle ? name.toLowerCase().indexOf(needle) : -1;
    if (at < 0) return [name, "", ""];

    const end = at + needle.length;

    return [name.slice(0, at), name.slice(at, end), name.slice(end)];
};
