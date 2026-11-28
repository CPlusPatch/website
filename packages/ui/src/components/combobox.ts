import { type ClassValue, cx } from "../lib/classes.ts";

export interface ComboboxOption {
    value: string;
    label: string;
    /** A toolkit icon name, such as `lucide:heart`. */
    icon?: string;
}

/** The classes of a <Combobox>. */
export const comboboxClasses = (className?: ClassValue): string[] =>
    cx("combobox", className);

/** The prefix of the listbox and option ids: `id`, or one made from `name` so renders match. */
export const comboboxPrefix = (id: string | undefined, name: string): string =>
    id ?? `combobox-${name}`;

/** The id of the listbox: the input's `aria-controls` points at it. */
export const comboboxListId = (prefix: string): string => `${prefix}-listbox`;

/** The id of an option, by its place in all the options: `aria-activedescendant` points at it. */
export const comboboxOptionId = (prefix: string, index: number): string =>
    `${prefix}-option-${index}`;

/** Whether an option shows its value beside its label: not when they only differ in case. */
export const showsValue = (option: ComboboxOption): boolean =>
    option.value.toLowerCase() !== option.label.toLowerCase();
