<script lang="ts">
import Icon from "@cpluspatch/ui/svelte/icon.svelte";
import { onMount } from "svelte";
import { type Control, controlQuery, parseControls } from "./controls.ts";
import { isPlayMessage, readyMessage } from "./play-frame.ts";
import { PORTS } from "./ports.ts";
import type { PortName } from "./story.ts";

/**
 * A controlled story, live: its Svelte port with the story's props, icon and
 * slot, and the controls' values on top. The values come from the page's
 * query on load, then from `gallery-play` messages (play-frame.ts), which
 * the page mirrors into its URL. Nothing reloads.
 */
type Props = {
    port: PortName;
    props: Record<string, unknown>;
    controls: Control[];
    icon?: string;
    /** The story's slot text. Not `slot`, which Astro reads as a named slot. */
    text?: string;
};

const { port, props, controls, icon, text }: Props = $props();

const Port = $derived(PORTS[port]);
// Island props never change, so the defaults are read once.
// svelte-ignore state_referenced_locally
let values = $state(parseControls(controls, ""));

const portProps = $derived({
    ...props,
    ...Object.fromEntries(
        controls
            .filter(({ key }) => key !== "slot" && key !== "icon")
            .map(({ key }) => [key, values[key]]),
    ),
});
const iconName = $derived(
    typeof values.icon === "string" ? values.icon : (icon ?? ""),
);
const content = $derived(typeof values.slot === "string" ? values.slot : text);

// Other params (theme, scheme) are the page's own, so they stay.
const mirror = (query: string) => {
    const params = new URLSearchParams(location.search);
    for (const { key } of controls) params.delete(key);
    for (const [key, value] of new URLSearchParams(query)) {
        params.append(key, value);
    }

    const search = params.size > 0 ? `?${params}` : "";
    history.replaceState(
        history.state,
        "",
        `${location.pathname}${search}${location.hash}`,
    );
};

onMount(() => {
    values = parseControls(controls, location.search);

    const onMessage = (event: MessageEvent) => {
        if (event.origin !== location.origin || !isPlayMessage(event.data)) {
            return;
        }

        values = parseControls(controls, event.data.query);
        mirror(controlQuery(controls, values));
    };
    window.addEventListener("message", onMessage);
    // The bench holds its query until the page can take it.
    if (window.parent !== window) {
        window.parent.postMessage(readyMessage(), location.origin);
    }

    return () => window.removeEventListener("message", onMessage);
});
</script>

<Port {...portProps}>
    {#if iconName}
        <Icon name={iconName as `lucide:x`} aria-hidden="true" />
    {/if}
    {#if content}
        {content}
    {/if}
</Port>
