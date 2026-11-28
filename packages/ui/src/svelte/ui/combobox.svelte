<script lang="ts">
import type { ComponentProps } from "svelte";
import type { HTMLAttributes } from "svelte/elements";
import {
    filterOptions,
    nextActiveIndex,
    startIndex,
} from "../../behaviours/combobox.ts";
import {
    type ComboboxOption,
    comboboxClasses,
    comboboxListId,
    comboboxOptionId,
    comboboxPrefix,
    showsValue,
} from "../../components/combobox.ts";
import Icon from "../icon.svelte";

export type { ComboboxOption };

/**
 * A text field with a list of options to pick from, which narrows as you
 * type. Only an option can be the value: leaving the field puts the last
 * pick back. The input holds the option's value, so it submits with a form.
 * Bind `value`; `onchange` is called with the new value when an option is
 * picked.
 *
 * Without JS it's a plain text field.
 */
interface Props
    extends Omit<HTMLAttributes<HTMLDivElement>, "id" | "onchange"> {
    name: string;
    /** Accessible name. Comboboxes have no visible label of their own. */
    label: string;
    options: ComboboxOption[];
    /** The picked option's value. */
    value?: string;
    placeholder?: string;
    /** Prefix of the listbox and option ids. Unique in the page; made from `name` if left out. */
    id?: string;
    onchange?: (value: string) => void;
}

let {
    name,
    label,
    options,
    value = $bindable(),
    placeholder,
    id,
    onchange,
    class: className,
    ...rest
}: Props = $props();

type IconName = ComponentProps<typeof Icon>["name"];

let input: HTMLInputElement | undefined = $state();
let list: HTMLUListElement | undefined = $state();
let ready = $state(false);
let open = $state(false);
let query = $state("");
let active = $state(-1);
// The text being typed, while it differs from the pick.
let draft: string | undefined = $state();

$effect(() => {
    ready = true;
});

const prefix = $derived(comboboxPrefix(id, name));
const picked = $derived(options.find((option) => option.value === value));
const shown = $derived(filterOptions(options, query));
const expanded = $derived(open && shown.length > 0);
const current = $derived(expanded ? shown[active] : undefined);
// Blank it has no box (see the CSS), so it can't have so much as a space in it.
const emptyText = $derived(open && shown.length === 0 ? "No matches" : "");

// Set when the pointer made an option active: it's under the pointer already.
let skipScroll = false;

$effect(() => {
    if (expanded && active >= 0) {
        if (skipScroll) {
            skipScroll = false;
            return;
        }

        list?.querySelector("[data-active]")?.scrollIntoView({
            block: "nearest",
        });
    }
});

const close = () => {
    open = false;
    query = "";
    active = -1;
};

const pick = (option: ComboboxOption) => {
    const changed = option.value !== value;

    value = option.value;
    draft = undefined;
    close();
    if (changed) onchange?.(option.value);
};

const oninput = (event: Event) => {
    draft = (event.currentTarget as HTMLInputElement).value;
    open = true;
    query = draft;
    active = startIndex(shown, value, draft);
};

// A pointermove, not a hover: the list scrolling under a still pointer mustn't steal the active option.
const onpointermove = (index: number) => {
    if (index === active) return;

    skipScroll = true;
    active = index;
};

const onkeydown = (event: KeyboardEvent) => {
    if (event.key === "Enter") {
        const option = shown[active];
        if (!open || !option) return;

        event.preventDefault();
        pick(option);
        return;
    }

    if (event.key === "Escape") {
        event.preventDefault();
        if (open) close();
        else draft = undefined;
        return;
    }

    const next = nextActiveIndex(event.key, active, shown.length, open);
    if (next === undefined) return;

    event.preventDefault();
    if (open) {
        active = next;
        return;
    }

    open = true;
    // The arrow that opens the list only lands on the pick.
    const start = startIndex(shown, value, undefined);
    active = start >= 0 ? start : next;
};

// Keeps the focus in the input, so picking an option isn't a blur.
const onpointerdown = (event: PointerEvent) => {
    const target = event.target as Element;
    if (
        target.closest("[role=listbox]") ||
        target.closest(".combobox__chevron")
    ) {
        event.preventDefault();
    }
};

const toggle = () => {
    input?.focus();
    if (open) {
        close();
        return;
    }

    open = true;
    active = startIndex(shown, value, undefined);
};

const onfocusout = (event: FocusEvent) => {
    if (
        (event.currentTarget as Node).contains(
            event.relatedTarget as Node | null,
        )
    )
        return;

    draft = undefined;
    close();
};
</script>

<!-- biome-ignore-start lint/a11y/useKeyWithClickEvents: the input is the keyboard path -->
<!-- biome-ignore-start lint/a11y/noStaticElementInteractions: the events bubble up from the input and the options -->
<!-- biome-ignore-start lint/a11y/noNoninteractiveElementToInteractiveRole: it's a <ul> so the list keeps its semantics -->
<!-- biome-ignore-start lint/a11y/useFocusableInteractive: the options are never focused; the input points at them with aria-activedescendant -->
<!-- biome-ignore format: Svelte renders whitespace between sibling elements as text, which Astro doesn't -->
<div class={comboboxClasses(className as string)} data-ready={ready ? "" : undefined} {onpointerdown} {onfocusout} {...rest}
    >{#if picked?.icon}<span class="combobox__icon" aria-hidden="true"
            ><Icon name={picked.icon as IconName} aria-hidden="true" /></span
        >{/if}<input
        bind:this={input}
        class="field combobox__input"
        type="text"
        role="combobox"
        aria-label={label}
        aria-autocomplete="list"
        aria-expanded={expanded ? "true" : "false"}
        aria-controls={comboboxListId(prefix)}
        aria-activedescendant={current ? comboboxOptionId(prefix, options.indexOf(current)) : undefined}
        autocomplete="off"
        spellcheck="false"
        {name}
        value={draft ?? picked?.value ?? ""}
        {placeholder}
        {oninput}
        {onkeydown}
    ><span class="combobox__chevron" aria-hidden="true" onclick={toggle}
        ><Icon name="lucide:chevron-down" aria-hidden="true" /></span
    ><ul
        bind:this={list}
        class="combobox__listbox"
        role="listbox"
        id={comboboxListId(prefix)}
        aria-label={label}
        hidden={!expanded}
        >{#each shown as option, index (option.value)}<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
            <li
                class="combobox__option"
                role="option"
                id={comboboxOptionId(prefix, options.indexOf(option))}
                data-value={option.value}
                data-active={index === active ? "" : undefined}
                aria-selected={option === picked ? "true" : "false"}
                onclick={() => pick(option)}
                onpointermove={() => onpointermove(index)}
                >{#if option.icon}<Icon name={option.icon as IconName} aria-hidden="true" />{/if}<span class="combobox__label">{option.label}</span
                >{#if showsValue(option)}<span class="combobox__value" aria-hidden="true">{option.value}</span>{/if}</li
            >{/each}</ul
    ><div class="combobox__empty" role="status">{emptyText}</div
></div>
<!-- biome-ignore-end lint/a11y/useKeyWithClickEvents: see above -->
<!-- biome-ignore-end lint/a11y/useFocusableInteractive: see above -->
<!-- biome-ignore-end lint/a11y/noNoninteractiveElementToInteractiveRole: see above -->
<!-- biome-ignore-end lint/a11y/noStaticElementInteractions: see above -->
