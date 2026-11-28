<script lang="ts">
import Icon from "@cpluspatch/ui/svelte/icon.svelte";
import { PORTS } from "./ports.ts";
import type { PortName } from "./story.ts";

/**
 * A story's Svelte port with its props, then the icon and the text as its
 * content. The playground draws the story with it, and the bench's preview
 * tiles draw each choice.
 */
type Props = {
    port: PortName;
    props: Record<string, unknown>;
    icon?: string;
    /** Not `slot`, which Astro reads as a named slot. */
    text?: string;
};

const { port, props, icon, text }: Props = $props();

const Port = $derived(PORTS[port]);
</script>

<Port {...props}>
    {#if icon}
        <Icon name={icon as `lucide:x`} aria-hidden="true" />
    {/if}
    {#if text}
        {text}
    {/if}
</Port>
