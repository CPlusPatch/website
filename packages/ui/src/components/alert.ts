import { type ClassValue, cx } from "../lib/classes.ts";

export type AlertVariant = "default" | "success" | "warning" | "destructive";

export interface AlertOptions {
    variant?: AlertVariant;
    /** Whether it has an icon, which makes room for one. */
    icon?: string | boolean;
    class?: ClassValue;
}

/** The classes of an <Alert>. */
export const alertClasses = ({
    variant = "default",
    icon = false,
    class: className,
}: AlertOptions = {}): string[] =>
    cx(
        "alert",
        "panel",
        "lift",
        icon && "alert--icon",
        `alert--${variant}`,
        `tone-${variant === "default" ? "primary" : variant}`,
        className,
    );

const PREFIXES: Record<AlertVariant, string | null> = {
    default: null,
    success: "Success:",
    warning: "Warning:",
    destructive: "Error:",
};

/**
 * The visually hidden prefix naming the variant, or null for the default.
 * Without it, the only cue that an alert is a warning rather than a success
 * is its colour, which screen readers can't convey.
 */
export const alertPrefix = (variant: AlertVariant = "default") =>
    PREFIXES[variant];
