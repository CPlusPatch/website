/** The seconds a slide shows for in an autoplaying carousel, if it plays. */
export const DEFAULT_AUTOPLAY = 6;

/**
 * Seconds per slide from a <Carousel>'s `autoplay` prop: `true` is the
 * default, a number is that many, and anything else is off (undefined).
 */
export const autoplaySeconds = (
    autoplay: boolean | number | undefined,
): number | undefined =>
    (autoplay === true ? DEFAULT_AUTOPLAY : autoplay) || undefined;
