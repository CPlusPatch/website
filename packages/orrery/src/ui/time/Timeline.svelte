<script lang="ts">
import { unixMsToJ2000s } from "@cpluspatch/orbit";
import { isLive } from "@cpluspatch/render";
import { readouts, statesAt } from "@cpluspatch/sim";
import { untrack } from "svelte";
import type { Attachment } from "svelte/attachments";
import { on } from "svelte/events";
import {
    readList,
    SAVED_CHANGED,
    type SavedStorage,
    startTime,
} from "../../persistence.ts";
import { getDocument, getView } from "../../state/context.ts";
import { clampT, windowHalf, windowLabel } from "../../timeline.ts";
import { readColors } from "./colors.ts";
import { type Colors, drawTimeline, type NowMark, type Saved } from "./draw.ts";
import { Scrubber } from "./scrubber.ts";
import { ariaValues, keyStep, nowOffsetPx } from "./strip.ts";

type Props = {
    storage: SavedStorage;
    phone: MediaQueryList;
    /** Called after each draw with where the Now mark is. */
    onNow: (now: NowMark & { width: number }) => void;
};

const { storage, phone, onNow }: Props = $props();

const documents = getDocument();
const view = getView();

let element: HTMLElement | undefined;
let canvas: HTMLCanvasElement | undefined;
let tip: HTMLElement | undefined;

let width = 0;
let height = 0;
let ratio = 1;
// Read on the first draw and again for a new scenario, not every frame.
let colors: Colors | null = null;
let saved: Saved[] = [];
let dirty = true;
let shown = "";

const scrubber = new Scrubber({
    view,
    element: () => element,
    canvas: () => canvas,
    tip: () => tip,
    width: () => width,
    height: () => height,
    half: () => windowNow().half,
    markDirty: () => {
        dirty = true;
    },
});

/** Makes a press-and-drag on `handle` scrub like the strip. A press without a drag is a click. */
export const grab = scrubber.grab;

const readSaved = () => {
    saved = readList(storage).map(({ savedAt, doc }) => ({
        t: startTime(doc.scenario, savedAt),
        name: doc.scenario.name,
    }));
    dirty = true;
};

// The window is wider when live, so it follows the real time.
const windowNow = (nowT = unixMsToJ2000s(Date.now())) => {
    const live = isLive(
        { t: view.now(), rate: view.clock.rate, paused: view.clock.paused },
        nowT,
    );

    return { nowT, live, half: windowHalf(view.clock.rate, live) };
};

const draw = (nowT: number, live: boolean, half: number) => {
    if (!element?.isConnected || !canvas || width === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    colors ??= readColors(getComputedStyle(element));
    const picked = view.selected;
    const t = view.now();
    const { scenario } = documents.doc;
    const readout =
        picked === null
            ? null
            : readouts(
                  documents.system,
                  picked,
                  statesAt(documents.system, t),
                  t,
              );
    const bodyName =
        scenario.bodies.find((body) => body.id === picked)?.name ?? null;

    const drawn = drawTimeline(ctx, {
        width,
        height,
        ratio,
        phone: phone.matches,
        colors,
        clock: { t },
        half,
        windowText: windowLabel(view.clock.rate, live),
        nowT,
        saved,
        hover: scrubber.hover,
        readout,
        bodyName,
    });
    scrubber.hits = drawn.hits;
    onNow({ ...drawn.now, width });
};

const showAria = (force: boolean, half: number) => {
    if (!element) return;

    const values = ariaValues(view.now(), half);

    element.setAttribute("aria-valuemin", values.min);
    element.setAttribute("aria-valuemax", values.max);
    element.setAttribute("aria-valuenow", values.now);
    // A running clock would make a focused slider announce its text over and over.
    if (!force && !view.clock.paused && document.activeElement === element) {
        return;
    }

    element.setAttribute("aria-valuetext", values.text);
};

const frame = () => {
    const t = view.now();
    // The Now mark moves with real time, whatever the clock does.
    const { nowT, live, half } = windowNow();
    const nowPx = nowOffsetPx(nowT, t, width, half);
    const signature = `${t} ${view.clock.rate} ${live} ${nowPx}`;
    if (!dirty && signature === shown) return;

    dirty = false;
    shown = signature;
    showAria(false, half);
    draw(nowT, live, half);
};

const onKeyDown = (event: KeyboardEvent) => {
    if (event.ctrlKey || event.altKey || event.metaKey) return;

    const { half } = windowNow();
    const by = keyStep(event.key, half);

    if (by !== undefined) view.setClock({ t: clampT(view.now() + by) });
    else if (event.key === "Home") {
        view.setClock({ t: clampT(unixMsToJ2000s(Date.now())) });
    } else return;

    event.preventDefault();
    showAria(true, windowNow().half);
};

// Native listeners, so the pointer events and the keys behave as they did before the port.
const listen: Attachment<HTMLElement> = (node) => {
    const offs = [
        on(node, "pointerdown", (event) => scrubber.begin(event, node)),
        on(node, "pointermove", scrubber.onMove),
        on(node, "pointerup", scrubber.onEnd),
        on(node, "pointercancel", scrubber.onEnd),
        on(node, "pointerleave", scrubber.onLeave),
        on(node, "keydown", onKeyDown),
        // The dialog says so at once. Another tab's save shows up on the next visit to the strip.
        on(node, "pointerenter", readSaved),
        on(node, "focus", readSaved),
    ];

    return () => {
        for (const off of offs) off();
    };
};

// Any change to what's drawn.
$effect(() => {
    void documents.doc;
    void view.selected;
    void view.clock.sets;

    dirty = true;
});

// A new scenario brings its own theme and no saved list to trust.
$effect(() => {
    void documents.loads;

    untrack(() => {
        colors = null;
        readSaved();
    });
});

$effect(() => {
    let frameId = requestAnimationFrame(function loop() {
        frameId = requestAnimationFrame(loop);
        frame();
    });
    const offs = [
        on(window, "focus", readSaved),
        on(window, SAVED_CHANGED, readSaved),
    ];

    const resize = new ResizeObserver(() => {
        if (!canvas) return;

        ratio = Math.min(devicePixelRatio || 1, 2);
        width = canvas.clientWidth;
        height = canvas.clientHeight;
        // Setting the size clears the canvas.
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
        dirty = true;
    });
    if (canvas) resize.observe(canvas);

    // The first frame can draw before the fonts load.
    void document.fonts.ready.then(() => {
        dirty = true;
    });

    return () => {
        cancelAnimationFrame(frameId);
        resize.disconnect();
        for (const off of offs) off();
    };
});
</script>

<!-- The frame loop sets the slider's values and text, as they change every frame. -->
<div
    class="orrery__timeline"
    role="slider"
    tabindex="0"
    aria-label="Time"
    aria-valuenow="0"
    bind:this={element}
    {@attach listen}
>
    <canvas aria-hidden="true" bind:this={canvas}></canvas>
    <div
        class="orrery__timeline-tip"
        aria-hidden="true"
        hidden
        bind:this={tip}
    ></div>
</div>
