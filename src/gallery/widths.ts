import type { PreviewWidth } from "@cpluspatch/ui/components/preview-frame.ts";

/**
 * Typical viewport widths, for the `?width=` of a story's page
 * (story-page.astro) and the preview frame's snap widths (PREVIEW_SNAPS).
 */
export const PREVIEW_WIDTHS = [
    { id: "tablet", name: "Tablet", width: "48rem" },
    { id: "phone", name: "Phone", width: "32rem" },
    { id: "tiny", name: "Tiny", width: "24rem" },
] as const;

/** The widths as a preview frame's snap widths. */
export const PREVIEW_SNAPS: PreviewWidth[] = PREVIEW_WIDTHS.map((width) => ({
    name: width.name,
    rem: Number.parseFloat(width.width),
}));
