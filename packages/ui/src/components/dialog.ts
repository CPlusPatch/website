import { type ClassValue, cx } from "../lib/classes.ts";

export type DialogSize = "sm" | "md";

export interface DialogOptions {
    size?: DialogSize;
    /** Shown in the flow of the page, not as a modal. */
    inline?: boolean;
    class?: ClassValue;
}

/** The classes of a <Dialog>. */
export const dialogClasses = ({
    size = "md",
    inline = false,
    class: className,
}: DialogOptions = {}): string[] =>
    cx(
        "dialog",
        "panel",
        // The sheet locks page scroll while open, which an inline dialog must not do.
        !inline && "sheet",
        `dialog--${size}`,
        inline && "dialog--inline",
        className,
    );
