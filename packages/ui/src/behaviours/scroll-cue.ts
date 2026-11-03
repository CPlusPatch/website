/**
 * <ScrollCue>: marks the cue `data-offscreen` while it is out of view, so
 * its CSS can pause the arrow's nudging there (see markOffscreen).
 *
 * Root: `.scroll-cue`.
 */
import { markOffscreen } from "../lib/motion.ts";
import { behaviour } from "./behaviour.ts";

const scrollCue = behaviour(".scroll-cue", (root) => markOffscreen([root]));

export const initScrollCue = scrollCue.init;
export const initScrollCues = scrollCue.initAll;
