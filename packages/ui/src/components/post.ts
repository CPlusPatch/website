import { type ClassValue, cx } from "../lib/classes.ts";

/**
 * `feed` is unframed and divided by a rule, so a timeline stays light;
 * `boxed` frames a single post in its own box, such as one embedded in a page.
 */
export type PostVariant = "boxed" | "feed";

export interface PostOptions {
    variant?: PostVariant;
    /** The post a page is about: larger text and the author above the body. */
    featured?: boolean;
    /** Whether a `context` row sits above the author (a boost, a reply). */
    context?: boolean;
    class?: ClassValue;
}

/** The classes of a <Post>. */
export const postClasses = ({
    variant = "feed",
    featured = false,
    context = false,
    class: className,
}: PostOptions = {}): string[] =>
    cx(
        "post",
        `post--${variant}`,
        featured && "post--featured",
        context && "post--context",
        className,
    );

export interface PostActionOptions {
    /** The reader has done this (favourited, boosted). */
    pressed?: boolean;
    /** Fill the icon while pressed, for shapes that hold it (a heart). */
    filled?: boolean;
    /** A utility (bookmark, share), set apart at the end of the row. */
    end?: boolean;
    class?: ClassValue;
}

/** The classes of a <PostAction>. */
export const postActionClasses = ({
    pressed = false,
    filled = false,
    end = false,
    class: className,
}: PostActionOptions = {}): string[] =>
    cx(
        "post-action",
        pressed && "post-action--pressed",
        filled && "post-action--filled",
        end && "post-action--end",
        className,
    );

const compact = new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
});
const full = new Intl.NumberFormat("en");

/**
 * A count as shown beside an action: "1.2K". Zero, and anything that is not
 * a count, shows nothing, as an action with no one on it needs no number.
 * Pass `compact: false` for the full figure ("1,204"), as the stats row does.
 */
export const formatCount = (
    count: number | undefined,
    { compact: short = true }: { compact?: boolean } = {},
): string => {
    if (count === undefined || !Number.isFinite(count) || count <= 0) return "";
    return (short ? compact : full).format(Math.floor(count));
};
