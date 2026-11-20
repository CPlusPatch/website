import { type ClassValue, cx } from "../lib/classes.ts";

export interface WindowOptions {
    /** The chrome a window manager shows: a border, a ruled bar and a shadow. In the flow either way. */
    framed?: boolean;
    class?: ClassValue;
}

/** The classes of a <Window>. */
export const windowClasses = ({
    framed = false,
    class: className,
}: WindowOptions = {}): string[] =>
    cx("window", framed && "window--framed", className);
