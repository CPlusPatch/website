import { type ClassValue, cx } from "../lib/classes.ts";
import type { Tone } from "../lib/tone.ts";

export type ButtonVariant = "solid" | "outline" | "ghost" | "link";

/** `neutral` is for chrome that should not compete with content. */
export type ButtonTone = Tone | "neutral";

/**
 * `icon-sm` is a compact square, for actions inside a row or under content;
 * `icon-lg` a larger one, for a control that stands alone.
 */
export type ButtonSize =
    | "sm"
    | "default"
    | "lg"
    | "icon"
    | "icon-sm"
    | "icon-lg";

export interface ButtonOptions {
    variant?: ButtonVariant;
    tone?: ButtonTone;
    size?: ButtonSize;
    /** Rises on hover. Never on a link, which has its underline instead. */
    lift?: boolean;
    class?: ClassValue;
}

/** The classes of a <Button>. */
export const buttonClasses = ({
    variant = "solid",
    tone = "primary",
    size = "default",
    lift = true,
    class: className,
}: ButtonOptions = {}): string[] =>
    cx(
        "button",
        lift && variant !== "link" && "lift",
        `button--${variant}`,
        `tone-${tone}`,
        `button--size-${size}`,
        className,
    );

/**
 * Whether a <Button> renders as a link: when asked to, or, if not told
 * either way, when it has somewhere to go.
 */
export const isAnchor = (as?: "button" | "a", href?: unknown): boolean =>
    as === "a" || (as === undefined && Boolean(href));
