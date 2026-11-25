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
