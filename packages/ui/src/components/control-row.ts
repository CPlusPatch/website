import { type ClassValue, cx } from "../lib/classes.ts";

export interface ControlRowOptions {
    disabled?: boolean;
    class?: ClassValue;
}

/** The classes of a <ControlRow>. */
export const controlRowClasses = ({
    disabled = false,
    class: className,
}: ControlRowOptions = {}): string[] =>
    cx("control-row", disabled && "control-row--disabled", className);

/** The classes of its label. `mono` is for names from code, like a prop. */
export const controlRowLabelClasses = (mono = false): string[] =>
    cx("control-row__label", mono && "control-row__label--mono");
