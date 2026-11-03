import { type ClassValue, cx } from "../lib/classes.ts";
import type { Tone } from "../lib/tone.ts";

export interface StatusOptions {
    tone?: Tone;
    pulse?: boolean;
    class?: ClassValue;
}

/** The classes of a <Status>'s wrapper. */
export const statusClasses = ({ class: className }: StatusOptions = {}) =>
    cx("status", className);

/** The classes of a <Status>'s light. */
export const statusLightClasses = ({
    tone,
    pulse = false,
}: StatusOptions = {}): string[] =>
    cx(
        "status__light",
        tone && `tone-${tone}`,
        tone && "status__light--toned",
        pulse && "status__light--pulse",
    );
