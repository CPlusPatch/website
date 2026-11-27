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

<style>
/* The one light block in the bar, over the playhead. */
.orrery__date {
    position: absolute;
    z-index: 2;
    inset-block-start: 2px;
    inset-inline-start: 50%;
    translate: -50% 0;
    display: flex;
    align-items: center;
    block-size: 20px;
    padding: 0 0.625rem;
    border: 0;
    border-radius: 0;
    background-color: var(--orrery-text);
    color: var(--orrery-tag-ink);
    cursor: pointer;
    /* A drag on the tag scrubs the strip. */
    touch-action: none;

    &:focus-visible {
        outline: 2px solid var(--orrery-tag-ink);
        outline-offset: -3px;
    }

    time {
        font: 500 var(--orrery-size-md) / 1 var(--orrery-font-data);
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
    }
}

.orrery__date-live {
    align-self: stretch;
    display: flex;
    align-items: center;
    margin-inline: -0.625rem 0.5rem;
    padding: 0 0.5rem;
    background-color: var(--orrery-go);
    color: var(--orrery-go-ink);
    font: 600 var(--orrery-size-label) / 1 var(--orrery-font-ui);

    &[hidden] {
        display: none;
    }
}

.orrery__secs,
.orrery__utc {
    color: var(--orrery-tag-muted);
    font-size: var(--orrery-size-label);
}

/* Digits changing faster than twice a second are faded, but legible, so the clock doesn't look off. */
.orrery__fast {
    color: var(--orrery-tag-fade);
}

@media (max-width: 720px) {
    .orrery__secs {
        display: none;
    }

    .orrery__date {
        block-size: 18px;
        padding: 0 0.5rem;

        /* The tag is small, so the touch target reaches down the timeline. */
        &::after {
            content: "";
            position: absolute;
            inset: -2px -6px -26px;
        }

        time {
            font-size: var(--orrery-size-label);
        }
    }

    .orrery__date-live {
        margin-inline-start: -0.5rem;
    }

    .orrery__utc {
        font-size: var(--orrery-size-xs);
    }
}

@media (forced-colors: active) {
    .orrery__date {
        border: 1px solid ButtonText;
    }
}
</style>
