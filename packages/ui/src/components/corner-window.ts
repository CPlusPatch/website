import { type ClassValue, cx } from "../lib/classes.ts";

export type CornerWindowCorner = "end" | "start";

export interface CornerWindowOptions {
    corner?: CornerWindowCorner;
    /** In the flow of the page, rather than pinned to the viewport. */
    inline?: boolean;
    class?: ClassValue;
}

/** The classes of a <CornerWindow>. */
export const cornerWindowClasses = ({
    corner = "end",
    inline = false,
    class: className,
}: CornerWindowOptions = {}): string[] =>
    cx(
        "corner-window",
        `corner-window--${corner}`,
        !inline && "corner-window--pinned",
        className,
    );
