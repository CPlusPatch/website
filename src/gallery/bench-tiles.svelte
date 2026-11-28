<script lang="ts">
import Tile from "@cpluspatch/ui/svelte/ui/tile.svelte";
import TilePicker from "@cpluspatch/ui/svelte/ui/tile-picker.svelte";
import type { Preview } from "./bench.ts";
import PortView from "./port-view.svelte";
import type { PortName } from "./story.ts";

/**
 * A choice as tiles in one frame: each draws the story's component with
 * that value (`preview`), or an outlined box that grows with the value's
 * place in the list (`sizes`, the first being the biggest). The tiles are
 * plain radios, so a change bubbles up for the row to read.
 */
type Props = {
    /** The radios' name, and the picker's accessible name. */
    name: string;
    label: string;
    /** The prop the choice sets. */
    prop: string;
    values: string[];
    value: string;
    widget: "preview" | "sizes";
    /** What a preview draws; the tiles aren't previews without one. */
    preview?: Preview;
};

const { name, label, prop, values, value, widget, preview }: Props = $props();

// A <button> in a tile's <label> is invalid, and an <a> with no href isn't focusable.
const STATIC_PROPS: Partial<Record<PortName, Record<string, unknown>>> = {
    button: { as: "a" },
};

// An <a> doesn't drop a false boolean as a <button> does, so leave those off.
const previewProps = (
    { port, props }: Preview,
    option: string,
): Record<string, unknown> =>
    Object.fromEntries(
        Object.entries({
            ...props,
            ...STATIC_PROPS[port],
            size: "sm",
            [prop]: option,
        }).filter(([, v]) => v !== false),
    );

// Sizes read smallest first, but the values keep their order: the first is the biggest.
const shown = $derived(widget === "sizes" ? [...values].reverse() : values);

// 0.75 x 0.5rem at the smallest, 1.5 x 1rem at the biggest (see the aspect ratio below).
const boxStyle = (option: string) => {
    const grow =
        values.length > 1
            ? (values.length - 1 - values.indexOf(option)) / (values.length - 1)
            : 1;

    return `width: ${0.75 + 0.75 * grow}rem`;
};
</script>

<TilePicker {label} variant="joined" class="bench-tiles">
    {#each shown as option (option)}
        <Tile {name} value={option} label={option} checked={option === value}>
            {#if widget === "preview" && preview}
                <!-- inert: the preview is a picture, so a click goes to the tile. -->
                <span inert>
                    <PortView
                        port={preview.port}
                        props={previewProps(preview, option)}
                        text="Aa"
                    />
                </span>
            {:else}
                <span class="bench-tiles__box" style={boxStyle(option)}></span>
            {/if}
        </Tile>
    {/each}
</TilePicker>

<style>
.bench-tiles__box {
    aspect-ratio: 3 / 2;
    border: 1.5px solid currentColor;
}
</style>
