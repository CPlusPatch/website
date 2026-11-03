import { type ClassValue, cx } from "../lib/classes.ts";
import type { Tone } from "../lib/tone.ts";

export type BadgeVariant = "solid" | "outline" | "ghost";

export type BadgeSize = "sm" | "default" | "lg";

export interface BadgeOptions {
    variant?: BadgeVariant;
    tone?: Tone;
    size?: BadgeSize;
    class?: ClassValue;
}

/** The classes of a <Badge>. */
export const badgeClasses = ({
    variant = "solid",
    tone = "primary",
    size = "default",
    class: className,
}: BadgeOptions = {}): string[] =>
    cx(
        "badge",
        `badge--${variant}`,
        `tone-${tone}`,
        `badge--size-${size}`,
        className,
    );
