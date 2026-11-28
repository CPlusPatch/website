<script lang="ts">
import ControlRow from "@cpluspatch/ui/svelte/ui/control-row.svelte";
import SegmentedControl from "@cpluspatch/ui/svelte/ui/segmented-control.svelte";
import SwatchPicker from "@cpluspatch/ui/svelte/ui/swatch-picker.svelte";
import Tile from "@cpluspatch/ui/svelte/ui/tile.svelte";
import TilePicker from "@cpluspatch/ui/svelte/ui/tile-picker.svelte";
import type { CompareMode } from "./compare.ts";
import { LOOK_OPTIONS, type Look } from "./look.ts";

/**
 * The inspector's look settings: the theme, mode, style, spacing, radius and
 * font size of the stage and the compare copies. Each is a row of the
 * toolkit's control-row, and the bench applies the look in the frames only.
 * The mode is the compare strip's while it shows light and dark.
 */
type Props = {
    look: Look;
    compare: CompareMode;
    /** The look after a change, or a reset. */
    onchange: (look: Look) => void;
    /** Prefix of the radio names and the note id. Unique among the looks in a page. */
    name?: string;
};

const { look, compare, onchange, name = "bench-look" }: Props = $props();

// Each style's display font, as its stylesheet sets it (styles/styles/).
const STYLE_FONTS: Record<string, string> = {
    poster: "var(--font-big-shoulders, var(--font-base))",
    soft: "var(--font-nunito, system-ui, sans-serif)",
    print: "var(--font-source-serif, Georgia, serif)",
    mono: "var(--font-mono)",
};

// The glyphs' values, in the order they read: closer to wider, small to large.
const SPACING_GAPS: Record<string, number> = {
    compact: 2.5,
    default: 4,
    roomy: 5.5,
};
const FONT_SIZES: Record<string, string> = {
    small: "var(--font-size-sm)",
    default: "var(--font-size-lg)",
    large: "var(--font-size-2xl)",
};
// Corner radii in the glyph's 16px box. The default's is dashed, as it's the style's own.
const CORNERS: Record<string, number> = {
    default: 5,
    square: 0,
    soft: 3,
    round: 8,
};

const inOrder = (key: keyof Look, values: string[]) =>
    values.flatMap((value) =>
        LOOK_OPTIONS[key].filter((o) => o.value === value),
    );

const spacings = inOrder("spacing", Object.keys(SPACING_GAPS));
const radii = inOrder("radius", Object.keys(CORNERS));
const fontSizes = inOrder("fontSize", Object.keys(FONT_SIZES));

const themes = LOOK_OPTIONS.theme.map(({ value, label }) => ({
    value,
    label,
    color: "var(--color-bg)",
    accent: "var(--color-primary)",
    attributes: { "data-theme-preview": value },
}));

const labelOf = (key: keyof Look) =>
    LOOK_OPTIONS[key].find((o) => o.value === look[key])?.label;

const schemes = $derived(compare === "schemes");

// The native widgets' changes bubble up from the radios.
const pick = (key: keyof Look) => (event: Event) =>
    onchange({ ...look, [key]: (event.target as HTMLInputElement).value });

// A corner of the box, from its bottom edge round to its right edge.
const corner = (radius: number) =>
    radius === 0
        ? "M2 14V2H14"
        : `M2 14V${2 + radius}A${radius} ${radius} 0 0 1 ${2 + radius} 2H14`;
</script>

<div class="bench-look">
    <ControlRow label="Theme" value={labelOf("theme")} onchange={pick("theme")}>
        <SwatchPicker
            name={`${name}-theme`}
            label="Theme"
            options={themes}
            value={look.theme}
        />
    </ControlRow>

    <ControlRow
        label="Mode"
        value={labelOf("scheme")}
        note={schemes ? "Set by Compare" : undefined}
        noteId={`${name}-scheme-note`}
        disabled={schemes}
        onchange={pick("scheme")}
    >
        <SegmentedControl
            name={`${name}-scheme`}
            label="Mode"
            options={LOOK_OPTIONS.scheme}
            value={look.scheme}
            size="sm"
            variant="subtle"
            disabled={schemes}
            aria-describedby={schemes ? `${name}-scheme-note` : undefined}
        />
    </ControlRow>

    <ControlRow label="Style" value={labelOf("style")} onchange={pick("style")}>
        <TilePicker label="Style" variant="joined">
            {#each LOOK_OPTIONS.style as option (option.value)}
                <Tile
                    name={`${name}-style`}
                    value={option.value}
                    label={option.label}
                    caption={option.label}
                    checked={option.value === look.style}
                >
                    <span
                        class="bench-look__aa"
                        style:font-family={STYLE_FONTS[option.value]}
                    >
                        Aa
                    </span>
                </Tile>
            {/each}
        </TilePicker>
    </ControlRow>

    <div class="bench-look__pair">
        <ControlRow
            class="bench-look__half"
            label="Spacing"
            value={labelOf("spacing")}
            onchange={pick("spacing")}
        >
            <TilePicker label="Spacing" variant="joined">
                {#each spacings as option (option.value)}
                    <Tile
                        name={`${name}-spacing`}
                        value={option.value}
                        label={option.label}
                        checked={option.value === look.spacing}
                    >
                        <svg
                            class="bench-look__glyph"
                            aria-hidden="true"
                            viewBox="0 0 16 16"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.5"
                            stroke-linecap="round"
                        >
                            {#each [-1, 0, 1] as step (step)}
                                <path
                                    d={`M3 ${8 + step * (SPACING_GAPS[option.value] ?? 4)}H13`}
                                />
                            {/each}
                        </svg>
                    </Tile>
                {/each}
            </TilePicker>
        </ControlRow>

        <ControlRow
            class="bench-look__half"
            label="Radius"
            value={labelOf("radius")}
            onchange={pick("radius")}
        >
            <TilePicker label="Radius" variant="joined">
                {#each radii as option (option.value)}
                    <Tile
                        name={`${name}-radius`}
                        value={option.value}
                        label={option.label}
                        checked={option.value === look.radius}
                    >
                        <svg
                            class="bench-look__glyph"
                            aria-hidden="true"
                            viewBox="0 0 16 16"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.5"
                            stroke-dasharray={option.value === "default"
                                ? "2 2"
                                : undefined}
                        >
                            <path d={corner(CORNERS[option.value] ?? 0)} />
                        </svg>
                    </Tile>
                {/each}
            </TilePicker>
        </ControlRow>
    </div>

    <ControlRow
        label="Font size"
        value={labelOf("fontSize")}
        onchange={pick("fontSize")}
    >
        <TilePicker label="Font size" variant="joined">
            {#each fontSizes as option (option.value)}
                <Tile
                    name={`${name}-font-size`}
                    value={option.value}
                    label={option.label}
                    checked={option.value === look.fontSize}
                >
                    <span style:font-size={FONT_SIZES[option.value]}>A</span>
                </Tile>
            {/each}
        </TilePicker>
    </ControlRow>

    <p class="bench-look__note text-meta">
        Look styles the stage only. The page keeps the default look.
    </p>
</div>

<style>
.bench-look {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    min-width: 0;
    /* Keeps the tile pickers from stretching when the inspector is full width. */
    max-inline-size: 24rem;
}

.bench-look__note {
    margin: 0;
}

/* Side by side, or one under the other where the column is too narrow. */
.bench-look__pair {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-md);
}

.bench-look__pair > :global(.bench-look__half) {
    flex: 1 1 8rem;
}

.bench-look__aa {
    font-size: var(--font-size-xl);
}

.bench-look__glyph {
    display: block;
    width: 1rem;
    height: 1rem;
}
</style>
