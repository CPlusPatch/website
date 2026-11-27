<script lang="ts">
import { iconSvg } from "@cpluspatch/ui";
import { onMount, untrack } from "svelte";
import type { Sound } from "../audio/sound.ts";
import Menu from "./Menu.svelte";

type Props = {
    sound: Sound;
};

const { sound }: Props = $props();

// The sound doesn't change for the life of the component, so the first read is enough.
let settings = $state.raw(untrack(() => sound.settings));
let track = $state.raw(untrack(() => sound.track));

const show = () => {
    settings = sound.settings;
    track = sound.track;
};

onMount(() => sound.onChange(show));
</script>

<span class="orrery__sound">
    <Menu
        id="orrery-sound-menu"
        label="Sound"
        buttonClass="orrery__sound-button"
        buttonLabel="Sound"
        popupClass="orrery__sound-menu"
    >
        {#snippet button()}
            {@html iconSvg(
                settings.effects || settings.music ? "volume-2" : "volume-x",
            )}
        {/snippet}
        <!-- biome-ignore format: Whitespace between the elements would be rendered. -->
        {#snippet items()}
            <button type="button" class="orrery__rate-item" role="menuitemcheckbox" tabindex="-1" aria-checked={settings.effects} onclick={() => sound.setEffects(!sound.settings.effects)}>{@html iconSvg("check")}<span class="orrery__rate-word">Sound effects</span></button
            ><button type="button" class="orrery__rate-item" role="menuitemcheckbox" tabindex="-1" aria-checked={settings.music} onclick={() => sound.setMusic(!sound.settings.music)}>{@html iconSvg("check")}<span class="orrery__rate-word">Music</span></button>
        {/snippet}
        {#snippet extras()}
            <p
                class="orrery__sound-now"
                hidden={!settings.music || track === null}
            >
                {track ? `Playing ${track.title}, ${track.artist}` : ""}
            </p>
        {/snippet}
    </Menu>
</span>

<style>
.orrery__sound {
    position: relative;
}

/* Menu renders the button and the popup. */
:global(.orrery__sound-button) {
    display: grid;
    place-items: center;
    inline-size: var(--orrery-control);
    block-size: var(--orrery-control);
    padding: 0;
    border: 0;
    background: none;
    color: var(--orrery-text);
    cursor: pointer;

    &[aria-expanded="true"] {
        background-color: var(--orrery-panel-hover);
        outline: 1px solid var(--orrery-muted);
        outline-offset: -1px;
    }

    @media (hover: hover) {
        &:hover:not([aria-expanded="true"]) {
            background-color: var(--orrery-panel-raised);
        }
    }

    &:focus-visible {
        outline: 2px solid var(--orrery-text);
        outline-offset: 2px;
    }

    :global(svg) {
        inline-size: 16px;
        block-size: 16px;
    }
}

:global(.orrery__sound-menu) {
    position: absolute;
    z-index: 4;
    inset-inline-start: 0;
    /* Over the HUD, which is at the bottom left. */
    inset-block-end: calc(100% + 8px);
    inline-size: 200px;
    padding: 4px 0;
    border: 1px solid var(--orrery-frame);
    background-color: var(--orrery-panel-solid);
}

/* A word in the sound menu is sans, and only the rates are figures. */
.orrery__rate-word {
    font-family: var(--orrery-font-ui);
}

.orrery__sound-now {
    margin: 4px 0 0;
    padding: 4px var(--orrery-pad);
    border-block-start: 1px solid var(--orrery-rule);
    color: var(--orrery-muted);
    font: 400 var(--orrery-size-xs) var(--orrery-font-ui);
    overflow-wrap: anywhere;
}

@media (max-width: 720px) {
    :global(.orrery__sound-button) {
        inline-size: var(--control-height-md);
        block-size: var(--control-height-md);
    }

    /* The button is at the top right, so the menu opens down and stays on screen. */
    :global(.orrery__sound-menu) {
        inset-inline: auto 0;
        inset-block: calc(100% + 8px) auto;
    }
}
</style>
