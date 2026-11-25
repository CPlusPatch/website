<script lang="ts">
import { flushSync, onMount, type Snippet } from "svelte";
import type { Attachment } from "svelte/attachments";
import { on } from "svelte/events";
import { menuTarget } from "./time/rate-menu.ts";

type Props = {
    /** The id of the `role="menu"` element, which the button controls. */
    id: string;
    /** The name of the menu. */
    label: string;
    buttonClass: string;
    /** The button's name, if its content doesn't give one. */
    buttonLabel?: string;
    popupClass: string;
    /** The id of the element that describes the menu. */
    describedby?: string;
    /** Called when the menu opens or closes. */
    onToggle?: (open: boolean) => void;
    /** What the button shows. */
    button: Snippet;
    /** The menu items, which are `role="menuitem*"` elements. */
    items: Snippet;
    /** What sits beside the menu inside the popup. */
    extras?: Snippet;
};

const {
    id,
    label,
    buttonClass,
    buttonLabel,
    popupClass,
    describedby,
    onToggle,
    button,
    items,
    extras,
}: Props = $props();

let buttonEl: HTMLButtonElement | undefined;
let popup: HTMLElement | undefined;
let menu: HTMLElement | undefined;

let expanded = $state(false);

const menuItems = (): HTMLElement[] =>
    Array.from(
        menu?.querySelectorAll<HTMLElement>(':scope > [role^="menuitem"]') ??
            [],
    );

/** Opens the menu and focuses its first item. */
const open = () => {
    if (expanded) return;

    // A hidden item can't take focus.
    flushSync(() => {
        expanded = true;
    });
    menuItems()[0]?.focus();
    onToggle?.(true);
};

/** Closes the menu, and puts focus back on the button if `refocus`. */
export const close = (refocus: boolean) => {
    if (!expanded) return;

    expanded = false;
    onToggle?.(false);
    if (refocus) buttonEl?.focus();
};

// Native listeners, as the shortcuts handler on the document would see a delegated one too late.
const buttonKeys: Attachment<HTMLElement> = (node) =>
    on(node, "keydown", (event) => {
        if (event.key === "Escape" && expanded) {
            // Otherwise the shortcut clears the selection and the menu stays.
            event.preventDefault();
            event.stopPropagation();
            close(true);

            return;
        }
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;

        event.preventDefault();
        if (expanded) menuItems()[0]?.focus();
        else open();
    });

const menuKeys: Attachment<HTMLElement> = (node) =>
    on(node, "keydown", (event) => {
        const all = menuItems();
        const k =
            event.target instanceof HTMLElement
                ? all.indexOf(event.target)
                : -1;
        const to = menuTarget(event.key, k, all.length);

        if (to !== undefined) {
            event.preventDefault();
            all[to]?.focus();
        } else if (event.key === "Escape") {
            event.preventDefault();
            close(true);
        } else if (event.key === "Tab") {
            close(true);
        } else if (event.key !== "Enter" && event.key !== " ") {
            return;
        }

        // Space and Esc must not also reach the shortcuts.
        event.stopPropagation();
    });

onMount(() =>
    on(document, "pointerdown", (event) => {
        const target = event.target;
        if (
            target instanceof Node &&
            (popup?.contains(target) || buttonEl?.contains(target))
        ) {
            return;
        }

        close(false);
    }),
);
</script>

<!-- biome-ignore format: Whitespace between the elements would be rendered. -->
<button type="button" class={buttonClass} aria-label={buttonLabel} aria-haspopup="menu" aria-expanded={expanded} aria-controls={id} bind:this={buttonEl} onclick={() => (expanded ? close(true) : open())} {@attach buttonKeys}>{@render button()}</button
><!-- biome-ignore format: Same. --><div class={popupClass} hidden={!expanded} bind:this={popup}><div {id} role="menu" aria-label={label} aria-describedby={describedby} bind:this={menu} {@attach menuKeys}>{@render items()}</div
>{@render extras?.()}</div>
