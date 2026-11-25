import type { Precession } from "../precession.ts";
import type { Secular } from "../scenario.ts";

/** The stored rates of `secular`. */
export const secularPrecession = (secular: Secular): Precession => ({
    pole: secular.pole,
    nodeRate: secular.nodeRate,
    argpRate: secular.argpRate,
});
