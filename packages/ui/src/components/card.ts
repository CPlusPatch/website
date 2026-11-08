import { type ClassValue, cx } from "../lib/classes.ts";
import type { Tone } from "../lib/tone.ts";

export interface CardOptions {
    tone?: Tone;
    /** A coloured rule along the top edge, in the tone's accent. Off by default. */
    rule?: boolean;
    class?: ClassValue;
}

/** The classes of a <Card>. */
export const cardClasses = ({
    tone = "primary",
    rule = false,
    class: className,
}: CardOptions = {}): string[] =>
    cx("card", "panel", rule && "card--rule", `tone-${tone}`, className);
