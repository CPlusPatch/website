<script lang="ts">
import {
    type Band,
    type createAssets,
    createRenderer,
    type Rect,
    type Units,
    type View,
} from "@cpluspatch/render";
import { alertClasses, alertPrefix } from "@cpluspatch/ui/components/alert.ts";
import { onDestroy } from "svelte";
import type { Attachment } from "svelte/attachments";
import { cue } from "../audio/cues.ts";
import { getView } from "../state/context.ts";
import type { Scene } from "../state/scene.ts";

type Props = {
    /** The `.orrery` element, whose panels the view is framed beside. */
    root: HTMLElement;
    scene: Scene;
    units: Units;
    /** Outlives the views, so a rebuilt one doesn't fetch its files again. */
    assets: ReturnType<typeof createAssets>;
    /** Picks the band between the top bar and the bottom cards. */
    narrow: MediaQueryList;
    /** Whether to show that WebGL isn't there, in place of the model. */
    unavailable: boolean;
    inert: boolean;
    /** The element to place right after the alert, if there is one. */
    beside: () => HTMLElement | undefined;
};

const {
    root,
    scene,
    units,
    assets,
    narrow,
    unavailable,
    inert,
    beside,
}: Props = $props();

const viewState = getView();

let container: HTMLElement | undefined;
let current: View | null = null;

// The cards on top of the canvas, in px from its top left.
const blocked = (): Rect[] => {
    const origin = container?.getBoundingClientRect();
    const rects: Rect[] = [];
    if (!origin) return rects;

    for (const card of root.querySelectorAll(
        ".orrery__panel > :not([hidden])",
    )) {
        const box = card.getBoundingClientRect();
        // Hidden cards have no box.
        if (box.width === 0 || box.height === 0) continue;

        rects.push({
            left: box.left - origin.left,
            top: box.top - origin.top,
            right: box.right - origin.left,
            bottom: box.bottom - origin.top,
        });
    }

    return rects;
};

// Between the top bar and the time bar, or the sheet that sits on it.
const band = (): Band => {
    const origin = container?.getBoundingClientRect();
    const free = { top: 0, bottom: origin?.height ?? 0 };
    if (!origin) return free;

    const below = narrow.matches
        ? ".orrery__panel--bottom > :not([hidden]), .orrery__panel--right > :not([hidden])"
        : ".orrery__panel--bottom > :not([hidden])";

    for (const card of root.querySelectorAll(
        ".orrery__panel--top > :not([hidden], dialog)",
    )) {
        const box = card.getBoundingClientRect();
        if (box.height > 0) {
            free.top = Math.max(free.top, box.bottom - origin.top);
        }
    }
    for (const card of root.querySelectorAll(below)) {
        const box = card.getBoundingClientRect();
        if (box.height > 0) {
            free.bottom = Math.min(free.bottom, box.top - origin.top);
        }
    }

    return free;
};

// The top panel stays hidden, so the notices go beside the alert.
const place: Attachment<HTMLElement> = (alert) => {
    const notices = beside();
    if (notices) alert.after(notices);
};

/** Destroys the current view, if there is one. */
export const destroy = (): void => {
    current?.destroy();
    current = null;
};

/**
 * Replaces the view with a new one, or returns `null` without WebGL.
 * It throws, with no view left, if the scenario can't be drawn.
 * This isn't reactive, as the session needs a throw from its `rebuild`.
 */
export const build = (
    onLoading?: (done: number, total: number, fill: number) => void,
): View | null => {
    if (!container) throw new Error("The Orrery needs a canvas container.");

    destroy();
    current = createRenderer(container, {
        source: scene,
        blocked,
        band,
        units,
        assets,
        onLoading,
        onTick: () => cue("tick"),
        onSelect: (id) => viewState.select(id),
        onFocus: (id) => viewState.setFocus(id),
    });

    return current;
};

/** Focuses the canvas without a focus ring, which would frame the whole view. */
export const focusCanvas = (): void => {
    container?.querySelector("canvas")?.focus({ focusVisible: false });
};

onDestroy(destroy);
</script>

<div class="orrery__canvas" {inert} bind:this={container}>
    {#if unavailable}
        <!-- biome-ignore format: Whitespace between the elements would be rendered. -->
        <div class={alertClasses({ variant: "warning" }).join(" ")} role="status" {@attach place}><div class="content"><span class="visually-hidden">{alertPrefix("warning") ?? ""}</span> WebGL isn't available, so the model can't be drawn.</div></div>
    {/if}
</div>
