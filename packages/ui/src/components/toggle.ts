import { type ClassValue, cx } from "../lib/classes.ts";

export interface ToggleOptions {
    /** Whether it has visible text beside the switch. */
    text?: boolean;
    class?: ClassValue;
}

/** The classes of a <Toggle>. */
export const toggleClasses = ({
    text = false,
    class: className,
}: ToggleOptions = {}): string[] =>
    cx("toggle", text && "toggle--text", className);
