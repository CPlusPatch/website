import { dateText } from "@cpluspatch/render";
import type { Lifetime } from "@cpluspatch/sim";

/** The dates a body exists between, or `null` when it has no bound. */
export const lifetimeText = (lifetime: Lifetime | undefined): string | null => {
    const { from, to } = lifetime ?? {};

    if (from !== undefined && to !== undefined) {
        return `${dateText(from)} to ${dateText(to)}`;
    }
    if (from !== undefined) return `From ${dateText(from)}`;
    if (to !== undefined) return `Until ${dateText(to)}`;

    return null;
};
