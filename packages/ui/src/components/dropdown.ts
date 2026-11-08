import { type ClassValue, cx } from "../lib/classes.ts";

export type DropdownAlign = "start" | "end";

/** Container widths below which a <Dropdown> can drop its chevron and label. */
export type DropdownCollapse = "30rem" | "52rem";

export interface DropdownOptions {
    collapseBelow?: DropdownCollapse;
    class?: ClassValue;
}

/** The classes of a <Dropdown>. */
export const dropdownClasses = ({
    collapseBelow,
    class: className,
}: DropdownOptions = {}): string[] =>
    cx(
        "dropdown",
        collapseBelow && `dropdown--collapse-${collapseBelow}`,
        className,
    );

/** The classes of a <Dropdown>'s panel. */
export const dropdownPanelClasses = (
    align: DropdownAlign = "start",
): string[] => cx("dropdown__panel", `dropdown__panel--align-${align}`);
