import type { Body } from "@cpluspatch/sim";

/** The bodies from the root down to the one with `id`. */
export const focusPath = (bodies: readonly Body[], id: string): Body[] => {
    const byId = new Map(bodies.map((body) => [body.id, body]));
    const path: Body[] = [];

    for (
        let body = byId.get(id);
        body && !path.includes(body);
        body = body.parent === null ? undefined : byId.get(body.parent)
    ) {
        path.unshift(body);
    }

    return path;
};
