import { type ClassValue, cx } from "../lib/classes.ts";
import type { Tone } from "../lib/tone.ts";

export interface CardOptions {
    tone?: Tone;
    /** Rises on hover. */
    lift?: boolean;
    /** A coloured rule along the top edge, in the tone's accent. Off by default. */
    rule?: boolean;
    class?: ClassValue;
}

/** The classes of a <Card>. */
export const cardClasses = ({
    tone = "primary",
    lift = true,
    rule = false,
    class: className,
}: CardOptions = {}): string[] =>
    cx(
        "card",
        "panel",
        lift && "lift",
        rule && "card--rule",
        `tone-${tone}`,
        className,
    );
