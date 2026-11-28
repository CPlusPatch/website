<script lang="ts">
import type { Snippet } from "svelte";
import type { HTMLAttributes } from "svelte/elements";
import { nextTabIndex } from "../../behaviours/tabs.ts";
import {
    type TabItem,
    tabId,
    tabListClasses,
    tabPanelId,
} from "../../components/tab-list.ts";

export type { TabItem };

/**
 * A bar of tabs that choose which panel shows. The children are actions at
 * the right end of the bar, outside the tablist. Bind `value` and pass
 * `selected={value === "x"}` to each <TabPanel>, which can be anywhere in
 * the page. `onchange` is called with the new value when a tab is picked.
 *
 * Without JS the tabs stay hidden, so only the selected panel shows.
 */
interface Props
    extends Omit<HTMLAttributes<HTMLDivElement>, "id" | "onchange"> {
    /** Prefix of the tab and panel ids. Unique in the page. */
    id: string;
    /** Accessible name of the tablist. */
    label: string;
    items: TabItem[];
    /** The selected tab. Defaults to the first. */
    value?: string;
    onchange?: (value: string) => void;
    children?: Snippet;
}

let {
    id,
    label,
    items,
    value = $bindable(items[0]?.value),
    onchange,
    class: className,
    children,
    ...rest
}: Props = $props();

let tabList: HTMLDivElement | undefined = $state();
let ready = $state(false);

$effect(() => {
    ready = true;
});

const select = (index: number) => {
    const picked = items[index];
    if (!picked || picked.value === value) return;

    value = picked.value;
    onchange?.(picked.value);
};

const onkeydown = (event: KeyboardEvent, index: number) => {
    const next = nextTabIndex(event.key, index, items.length);
    if (next === undefined) return;

    event.preventDefault();
    tabList?.querySelectorAll<HTMLElement>("[role=tab]")[next]?.focus();
    select(next);
};
</script>

<!-- biome-ignore format: Svelte renders whitespace between siblings as text, which Astro doesn't -->
<div class={tabListClasses(className as string)} data-ready={ready ? "" : undefined} {...rest}
    ><div bind:this={tabList} class="tab-list__tabs" role="tablist" aria-label={label}
        >{#each items as item, index (item.value)}<button
                type="button"
                role="tab"
                class="tab-list__tab"
                id={tabId(id, item.value)}
                data-value={item.value}
                aria-controls={tabPanelId(id, item.value)}
                aria-selected={item.value === value ? "true" : "false"}
                tabindex={item.value === value ? 0 : -1}
                onclick={() => select(index)}
                onkeydown={(event) => onkeydown(event, index)}
                >{item.label}{#if item.changed}<span class="tab-list__dot" aria-hidden="true"></span
                    ><span class="visually-hidden">{" (changed)"}</span>{/if}</button
            >{/each}</div
    >{#if children}<div class="tab-list__actions">{@render children()}</div>{/if}</div
>
