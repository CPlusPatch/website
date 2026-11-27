import type { Elements } from "@cpluspatch/orbit";
import { isOrbiting, type System } from "@cpluspatch/sim";

/** The orbit body `id` has after its next event later than `t`, and when it starts, or `null` if there is none. */
export const plannedElements = (
    system: System,
    id: string,
    t: number,
): { from: number; elements: Elements } | null => {
    if (!isOrbiting(system.body(id))) return null;

    const { to } = system.segmentAt(id, t);
    if (!Number.isFinite(to)) return null;

    const next = system.segmentAt(id, to);

    return { from: next.from, elements: system.elementsAt(id, next.from) };
};
