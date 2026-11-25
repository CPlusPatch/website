<script lang="ts">
import { iconSvg } from "@cpluspatch/ui";
import { alertClasses, alertPrefix } from "@cpluspatch/ui/components/alert.ts";
import { buttonClasses } from "@cpluspatch/ui/components/button.ts";
import { onDestroy } from "svelte";
import type { NoticeVariant } from "./notices.ts";

type Props = {
    /** Called when dismissing with the keyboard, as the button that had focus goes away. */
    returnFocus: () => void;
};

type Notice = { variant: NoticeVariant; text: string };

const { returnFocus }: Props = $props();

let wrapper: HTMLElement | undefined;
let notice = $state.raw<Notice | null>(null);
let timer: ReturnType<typeof setTimeout> | undefined;

export const clear = (): void => {
    clearTimeout(timer);
    notice = null;
};

export const show = (
    variant: NoticeVariant,
    text: string,
    clearAfterMs?: number,
): void => {
    clear();
    notice = { variant, text };
    if (clearAfterMs !== undefined) timer = setTimeout(clear, clearAfterMs);
};

/** The live region. */
export const element = (): HTMLElement | undefined => wrapper;

const dismiss = (event: MouseEvent) => {
    const hadFocus = document.activeElement === event.currentTarget;

    clear();
    if (hadFocus) returnFocus();
};

onDestroy(() => clearTimeout(timer));
</script>

<!-- A live region from the start, as one added with its content isn't announced. -->
<div
    class="orrery__notices"
    role="status"
    aria-live="polite"
    bind:this={wrapper}
>
    <!-- A new key replaces the nodes, so the alert is announced again. -->
    {#key notice}
        {#if notice}
            {@const { variant, text } = notice}
            <!-- biome-ignore format: Whitespace between the elements would be rendered. -->
            <div
                class="{alertClasses({ variant }).join(" ")} orrery__alert"
                role={variant === "success" ? undefined : "alert"}
            ><div class="content"><p><span class="visually-hidden">{alertPrefix(variant) ?? ""}</span> {text}</p></div><button type="button" class={buttonClasses({ variant: "ghost", tone: "neutral", size: "icon-sm" }).join(" ")} aria-label="Dismiss" onclick={dismiss}>{@html iconSvg("x")}</button></div>
        {/if}
    {/key}
</div>
