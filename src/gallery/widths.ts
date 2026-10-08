import type { SegmentedOption } from "../components/ui/segmented-control.astro";

/**
 * Preview widths for the gallery's stories, and the single source of their
 * values: the pickers' options and the CSS that applies them (PREVIEW_CSS)
 * are both built from this list. "desktop" is unconstrained; the rest cap a
 * group's grid at a typical viewport width.
 */
export const PREVIEW_WIDTHS = [
    { id: "desktop", name: "Desktop", icon: "lucide:monitor" },
    { id: "tablet", name: "Tablet", icon: "lucide:tablet", width: "48rem" },
    { id: "phone", name: "Phone", icon: "lucide:smartphone", width: "32rem" },
    { id: "tiny", name: "Tiny", icon: "lucide:watch", width: "24rem" },
] as const;

export type PreviewWidth = (typeof PREVIEW_WIDTHS)[number]["id"];

/** Name of the page-wide radio group; each group's own is this plus its id. */
export const PREVIEW_WIDTH_NAME = "preview-width";

/** The widths as SegmentedControl options, optionally led by "Auto". */
export const previewWidthOptions = (auto = false): SegmentedOption[] => [
    ...(auto ? [{ value: "auto", label: "Auto" }] : []),
    ...PREVIEW_WIDTHS.map((width) => ({
        value: width.id,
        label: "width" in width ? `${width.name}, ${width.width}` : width.name,
        icon: width.icon,
    })),
];

/**
 * The CSS that sets each .story-group's --preview-width and --preview-frame
 * (consumed in story-group.astro). The page-wide picker sets a default; a
 * group's own picker, unless on Auto, overrides it. The page-wide half sits
 * in :where() so it carries no weight against the override, and "desktop"
 * is spelled out so a group can opt back out of a narrower default.
 *
 * Inlined once by the page, so it skips the CSS build: flat rather than
 * nested, for the engines that build would otherwise compile nesting for.
 */
export const PREVIEW_CSS = PREVIEW_WIDTHS.map((width) => {
    const own = `.story-group:has(.story-group__width input[value="${width.id}"]:checked)`;
    if (!("width" in width)) {
        return `${own} { --preview-width: initial; --preview-frame: initial; }`;
    }
    const page = `:where(html:has(input[name="${PREVIEW_WIDTH_NAME}"][value="${width.id}"]:checked)) .story-group`;
    return `${page}, ${own} { --preview-width: ${width.width}; --preview-frame: dotted; }`;
}).join("\n");
