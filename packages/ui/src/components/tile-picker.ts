import { type ClassValue, cx } from "../lib/classes.ts";

export type TilePickerSize = "sm" | "default";
export type TilePickerVariant = "cards" | "joined";

export interface TilePickerOptions {
    size?: TilePickerSize;
    variant?: TilePickerVariant;
    class?: ClassValue;
}

/** The classes of a <TilePicker>. */
export const tilePickerClasses = ({
    size = "default",
    variant = "cards",
    class: className,
}: TilePickerOptions = {}): string[] =>
    cx(
        "tile-picker",
        `tile-picker--size-${size}`,
        `tile-picker--${variant}`,
        className,
    );
