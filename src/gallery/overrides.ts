import type { SegmentedOption } from "../components/ui/segmented-control.astro";

/**
 * Gallery overrides for the theme's spacing, radius and font size tokens.
 * Each control is a radio group read through :has(), like the theme select;
 * the "default" option sets nothing, so the theme's own values apply. As
 * with PREVIEW_CSS, the options and the CSS are built from one list.
 */

interface Override {
    /** Radio group name. */
    name: string;
    label: string;
    options: {
        value: string;
        label: string;
        tokens?: Record<string, string>;
    }[];
}

const rem = (n: number) => `${+n.toFixed(4)}rem`;

/** The base values from tokens.css, scaled; the clamped sizes scale each bound. */
const scale = (factor: number) => ({
    spacing: {
        "--space-xs": rem(0.25 * factor),
        "--space-sm": rem(0.5 * factor),
        "--space-md": rem(1 * factor),
        "--space-md-lg": rem(1.5 * factor),
        "--space-lg": rem(2 * factor),
        "--space-xl": rem(4 * factor),
    },
    font: {
        "--font-size-xs": rem(0.75 * factor),
        "--font-size-sm": rem(0.8125 * factor),
        "--font-size-base": rem(0.9375 * factor),
        "--font-size-lg": rem(1.0625 * factor),
        "--font-size-xl": rem(1.25 * factor),
        "--font-size-2xl": rem(1.5 * factor),
        "--font-size-3xl": `clamp(${rem(1.25 * factor)}, 2vw + ${rem(0.75 * factor)}, ${rem(1.75 * factor)})`,
        "--font-size-4xl": `clamp(${rem(2 * factor)}, 4vw + ${rem(1 * factor)}, ${rem(3.25 * factor)})`,
    },
});

export const OVERRIDES: Override[] = [
    {
        name: "override-spacing",
        label: "Spacing",
        options: [
            { value: "default", label: "Theme" },
            { value: "compact", label: "Compact", tokens: scale(0.75).spacing },
            { value: "roomy", label: "Roomy", tokens: scale(1.25).spacing },
        ],
    },
    {
        name: "override-radius",
        label: "Radius",
        options: [
            { value: "default", label: "Theme" },
            { value: "square", label: "Square", tokens: { "--radius": "0" } },
            { value: "soft", label: "Soft", tokens: { "--radius": "0.25rem" } },
            {
                value: "round",
                label: "Round",
                tokens: { "--radius": "0.75rem" },
            },
        ],
    },
    {
        name: "override-font-size",
        label: "Font size",
        options: [
            { value: "default", label: "Theme" },
            { value: "small", label: "Small", tokens: scale(0.875).font },
            { value: "large", label: "Large", tokens: scale(1.125).font },
        ],
    },
];

export const overrideOptions = (override: Override): SegmentedOption[] =>
    override.options.map(({ value, label }) => ({ value, label }));

/**
 * `html:root` and :has() give a specificity above a theme's own
 * `html:has([data-theme-select] ...)` block, so an override wins whichever
 * theme is selected. Component-level declarations still win, as intended.
 * Inlined by the page, so flat rather than nested.
 */
export const OVERRIDES_CSS = OVERRIDES.flatMap(({ name, options }) =>
    options.flatMap(({ value, tokens }) =>
        tokens
            ? [
                  `html:root:has(input[name="${name}"][value="${value}"]:checked) { ${Object.entries(
                      tokens,
                  )
                      .map(([k, v]) => `${k}: ${v};`)
                      .join(" ")} }`,
              ]
            : [],
    ),
).join("\n");
