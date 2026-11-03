import { type ClassValue, cx } from "../lib/classes.ts";
import type { Tone } from "../lib/tone.ts";

export interface CardOptions {
    tone?: Tone;
    /** Rises on hover. */
    lift?: boolean;
    class?: ClassValue;
}

/** The classes of a <Card>. */
export const cardClasses = ({
    tone = "primary",
    lift = true,
    class: className,
}: CardOptions = {}): string[] =>
    cx("card", "panel", lift && "lift", `tone-${tone}`, className);
