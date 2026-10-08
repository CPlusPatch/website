import type { SegmentedOption } from "../components/ui/segmented-control.astro";

/**
 * Preview widths for the gallery's stories. "desktop" is unconstrained; the
 * rest cap a group's grid at a typical viewport width. The CSS that applies
 * them lives in story-group.astro and must list the same ids.
 */
export const PREVIEW_WIDTHS = [
    { id: "desktop", label: "Desktop", icon: "lucide:monitor" },
    { id: "tablet", label: "Tablet, 48rem", icon: "lucide:tablet" },
    { id: "phone", label: "Phone, 32rem", icon: "lucide:smartphone" },
    { id: "tiny", label: "Tiny, 24rem", icon: "lucide:watch" },
] as const;

export type PreviewWidth = (typeof PREVIEW_WIDTHS)[number]["id"];

/** Name of the page-wide radio group; each group's own is this plus its id. */
export const PREVIEW_WIDTH_NAME = "preview-width";

/** The widths as SegmentedControl options, optionally led by "Auto". */
export const previewWidthOptions = (auto = false): SegmentedOption[] => [
    ...(auto ? [{ value: "auto", label: "Auto" }] : []),
    ...PREVIEW_WIDTHS.map(({ id, label, icon }) => ({
        value: id,
        label,
        icon,
    })),
];
