<script lang="ts">
import type { Snippet } from "svelte";
import type { HTMLAttributes } from "svelte/elements";
import { tabId, tabPanelId } from "../../components/tab-list.ts";
import { tabPanelClasses } from "../../components/tab-panel.ts";

/**
 * The content of one tab of a <TabList>. Shown only while `selected`: bind
 * the list's `value` and pass `selected={value === "x"}`.
 */
interface Props extends HTMLAttributes<HTMLDivElement> {
    /** The `id` of the <TabList> that controls this panel. */
    tabs: string;
    /** The value of its tab. */
    value: string;
    selected?: boolean;
    children?: Snippet;
}

const {
    tabs,
    value,
    selected = false,
    class: className,
    children,
    ...rest
}: Props = $props();
</script>

<!-- biome-ignore-start lint/a11y/noNoninteractiveTabindex: a panel with no focusable content must be reachable by keyboard -->
<!-- biome-ignore format: Svelte renders whitespace around the children as text, which Astro doesn't -->
<div
    class={tabPanelClasses(className as string)}
    role="tabpanel"
    id={tabPanelId(tabs, value)}
    aria-labelledby={tabId(tabs, value)}
    tabindex="0"
    hidden={!selected}
    {...rest}
>{@render children?.()}</div>
<!-- biome-ignore-end lint/a11y/noNoninteractiveTabindex: see above -->
