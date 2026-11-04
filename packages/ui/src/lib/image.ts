/**
 * An image the components can show: a URL, or a URL with the size it
 * decodes to (as bundlers and Astro hand out for an imported file).
 * `srcset` is for a source that has already been optimised into sizes.
 *
 * The components do not resize or convert anything. In Astro, the adapter
 * runs an `ImageMetadata` through `astro:assets` (which is assignable to the
 * object form here); in Vue and Svelte, optimising is the caller's job, and
 * a pre-built `srcset` is how to hand the result in.
 */
export type ImageSource =
    | string
    | { src: string; width: number; height: number; srcset?: string };

export interface ImageAttributes {
    src: string;
    width?: number;
    height?: number;
    srcset?: string;
}

/** The attributes of an `<img>` for a source, leaving out what it lacks. */
export const imageAttributes = (source: ImageSource): ImageAttributes => {
    if (typeof source === "string") return { src: source };
    const { src, width, height, srcset } = source;
    return { src, width, height, ...(srcset ? { srcset } : {}) };
};

/** Just the URL. */
export const imageUrl = (source: ImageSource): string =>
    typeof source === "string" ? source : source.src;

/** As a CSS `aspect-ratio`, if the source knows its size. */
export const imageRatio = (source: ImageSource): string | undefined =>
    typeof source === "string"
        ? undefined
        : `${source.width} / ${source.height}`;
