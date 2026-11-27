<script lang="ts">
import type { PartName, stampParts } from "@cpluspatch/render";
import type { Attachment } from "svelte/attachments";

type Props = {
    stamp: ReturnType<typeof stampParts>;
    /** Whether the clock is live. */
    on: boolean;
    /** The button element, for the bar's measuring, the focus and the editor. */
    button: HTMLButtonElement | undefined;
    onclick: () => void;
    /** Lets the timeline take drags that start on the button. */
    grab: Attachment<HTMLElement>;
};

let { stamp, on, button = $bindable(), onclick, grab }: Props = $props();

const stampIso = $derived(
    `${stamp.y.text}-${stamp.mo.text}-${stamp.d.text}T${stamp.h.text}:${stamp.mi.text}:${stamp.s.text}Z`,
);
</script>

<button
    type="button"
    class="orrery__date"
    title="Set the date (T)"
    aria-expanded="false"
    aria-controls="orrery-date-editor"
    bind:this={button}
    {onclick}
    {@attach grab}
>
    <span class="orrery__date-live" aria-hidden="true" hidden={!on}>Live</span>
    <!-- The name holds the visible date, so voice control can say what's shown. -->
    <span class="visually-hidden">{"Set the date, "}</span>
    <!-- biome-ignore format: Whitespace inside the time is rendered. -->
    <time datetime={stampIso}>{@render part("y")}-{@render part("mo")}-{@render part("d")}<span class="orrery__tod">{" "}{@render part("h")}:{@render part("mi")}<span class="orrery__secs">:{@render part("s")}</span><span class="orrery__utc">{" UTC"}</span></span></time>
</button>

<!-- biome-ignore format: Whitespace inside the snippet is rendered. -->
{#snippet part(
    name: PartName,
)}<span class="orrery__date-digits" class:orrery__fast={stamp[name].fast} data-part={name}>{stamp[name].text}</span>{/snippet}
