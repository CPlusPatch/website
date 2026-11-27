<script lang="ts">
import type { Component } from "svelte";

type Props = {
    component: Component<Record<string, unknown>>;
    props: Record<string, unknown>;
    /** Raw HTML, so the children add no wrapper element to the output. */
    html: string;
};

const { component: Port, props, html }: Props = $props();
</script>

<Port {...props}>{@html html}</Port>
