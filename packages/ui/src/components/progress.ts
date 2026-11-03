import { type ClassValue, cx } from "../lib/classes.ts";
import type { Tone } from "../lib/tone.ts";

export interface ProgressOptions {
    /** Without one, it takes the colour of where it sits. */
    tone?: Tone;
    class?: ClassValue;
}

/** The classes of a <Progress>. */
export const progressClasses = ({
    tone,
    class: className,
}: ProgressOptions = {}): string[] =>
    cx("progress", tone && `tone-${tone}`, className);
