import { type ClassValue, cx } from "../lib/classes.ts";

export interface SwatchOption {
    value: string;
    /** The accessible name, and the tooltip. */
    label: string;
    /** Any CSS colour. */
    color: string;
    /** Adds an inner chip, which makes the swatch a two-colour one (a theme). */
    accent?: string;
}

/** The classes of a <SwatchPicker>. */
export const swatchPickerClasses = (className?: ClassValue): string[] =>
    cx("swatch-picker", className);

/** The classes of one swatch. */
export const swatchClasses = (option: SwatchOption): string[] =>
    cx("swatch-picker__option", option.accent && "swatch-picker__option--duo");

/** The colours go through custom properties, so the stylesheet can use them for the ring and chip. */
export const swatchStyle = (option: SwatchOption): string =>
    `--swatch-color: ${option.color}${option.accent ? `; --swatch-accent: ${option.accent}` : ""}`;
