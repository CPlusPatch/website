import { type ClassValue, cx } from "../lib/classes.ts";

/** The classes of a <Tile>. */
export const tileClasses = (className?: ClassValue): string[] =>
    cx("tile", className);

/**
 * The `title` of a tile. A caption names the tile, so `label` only adds a
 * tooltip when it says something else. Without a caption it's the tooltip too.
 */
export const tileTitle = (
    label: string,
    caption?: string,
): string | undefined => (label === caption ? undefined : label);
