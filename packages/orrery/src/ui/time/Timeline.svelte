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
import { clampT, tipText, windowHalf, windowLabel } from "../../timeline.ts";
import {
    type Colors,
    drawTimeline,
    EVENTS,
    type Hit,
    type NowMark,
    type Saved,
} from "./draw.ts";

type Props = {
    storage: SavedStorage;
    phone: MediaQueryList;
    /** Called after each draw with where the Now mark is. */
    onNow: (now: NowMark & { width: number }) => void;
};

/** The drag distance in px that makes a press a scrub and not a click. */
const DRAG_PX = 3;

const { storage, phone, onNow }: Props = $props();

const documents = getDocument();
const view = getView();

let element: HTMLElement | undefined;
let canvas: HTMLCanvasElement | undefined;
let tip: HTMLElement | undefined;

let width = 0;
let height = 0;
let ratio = 1;
let hover: number | null = null;
// Read on the first draw and again for a new scenario, not every frame.
let colors: Colors | null = null;
let saved: Saved[] = [];
let hits: Hit[] = [];
let dirty = true;
let shown = "";
let drag: {
    x: number;
    t: number;
    paused: boolean;
    moved: boolean;
    flag: Hit | undefined;
    /** The element holding the pointer, which gets the moves and the end. */
    source: HTMLElement;
    /** The scrub scale, fixed for the drag since holding the clock ends live. */
    half: number;
} | null = null;

const readColors = (target: HTMLElement): Colors => {
    const style = getComputedStyle(target);
    const read = (name: string) => style.getPropertyValue(name).trim();

    return {
        rule: read("--orrery-rule"),
        frame: read("--orrery-frame"),
        dim: read("--orrery-dim"),
        muted: read("--orrery-muted"),
        go: read("--orrery-go"),
        text: read("--orrery-text"),
        signal: read("--orrery-signal"),
        pick: read("--orrery-pick"),
        ground: read("--orrery-ground"),
        fontUi: read("--orrery-font-ui"),
        fontData: read("--orrery-font-data"),
    };
};

const readSaved = () => {
    saved = readList(storage).map(({ savedAt, scenario }) => ({
        t: startTime(scenario, savedAt),
        name: scenario.name,
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

    colors ??= readColors(element);
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
        hover,
        readout,
        bodyName,
    });
    hits = drawn.hits;
    onNow({ ...drawn.now, width });
};

const showAria = (force: boolean, half: number) => {
    if (!element) return;

    const t = view.now();

    element.setAttribute("aria-valuemin", String(Math.round(t - half)));
    element.setAttribute("aria-valuemax", String(Math.round(t + half)));
    element.setAttribute("aria-valuenow", String(Math.round(t)));
    // A running clock would make a focused slider announce its text over and over.
    if (!force && !view.clock.paused && document.activeElement === element) {
        return;
    }

    element.setAttribute("aria-valuetext", tipText(t, half));
};

const frame = () => {
    const t = view.now();
    // The Now mark moves with real time, whatever the clock does.
    const { nowT, live, half } = windowNow();
    const nowPx = Math.round(((nowT - t) * width) / (2 * half));
    const signature = `${t} ${view.clock.rate} ${live} ${nowPx}`;
    if (!dirty && signature === shown) return;

    dirty = false;
    shown = signature;
    showAria(false, half);
    draw(nowT, live, half);
};

const canvasLeft = () => canvas?.getBoundingClientRect().left ?? 0;
const canvasTop = () => canvas?.getBoundingClientRect().top ?? 0;
// The events row, with a few pixels of slack either side of a mark.
const flagAt = (px: number, py: number) =>
    py >= height - EVENTS
        ? hits.find(({ from, to }) => px >= from - 2 && px <= to + 2)
        : undefined;

const showTip = (px: number, text: string) => {
    if (!element || !tip) return;

    // The tip is placed from the padding box, inside the forced-colors border.
    const origin = element.getBoundingClientRect().left + element.clientLeft;

    tip.hidden = false;
    tip.textContent = text;
    const tipWidth = tip.offsetWidth;
    tip.style.left = `${Math.min(innerWidth - 4 - tipWidth, Math.max(4, origin + px - tipWidth / 2)) - origin}px`;
};

const hideTip = () => {
    if (tip) tip.hidden = true;
};

const begin = (event: PointerEvent, source: HTMLElement) => {
    if (event.button !== 0) return;

    source.setPointerCapture(event.pointerId);
    drag = {
        x: event.clientX,
        t: view.now(),
        paused: view.clock.paused,
        moved: false,
        // A handle's press never picks a flag.
        flag:
            source === element
                ? flagAt(
                      event.clientX - canvasLeft(),
                      event.clientY - canvasTop(),
                  )
                : undefined,
        half: windowNow().half,
        source,
    };
};

const onMove = (event: PointerEvent) => {
    const px = event.clientX - canvasLeft();
    const py = event.clientY - canvasTop();

    if (drag) {
        hover = null;
        const dx = event.clientX - drag.x;
        if (!drag.moved && Math.abs(dx) < DRAG_PX) return;

        if (!drag.moved) {
            drag.moved = true;
            view.setClock({ paused: true });
        }
        view.setClock({
            t: clampT(drag.t + (dx / width) * 2 * drag.half),
        });
        // The clock already shows the date being dragged to.
        hideTip();

        return;
    }
    if (event.pointerType === "touch") return;

    hover = px;
    dirty = true;
    const hit = flagAt(px, py);
    element?.classList.toggle("orrery__timeline--flag", hit !== undefined);

    const { half } = windowNow();
    if (hit) showTip(hit.x, hit.tip);
    else {
        showTip(
            px,
            tipText(
                clampT(view.now() + ((px - width / 2) / width) * 2 * half),
                half,
            ),
        );
    }
};

const onEnd = (event: PointerEvent) => {
    const ended = drag;
    drag = null;
    if (!ended) return;

    if (ended.moved) view.setClock({ paused: ended.paused });
    else if (event.type === "pointerup" && ended.flag) {
        view.setClock({ t: clampT(ended.flag.t) });
    }
    if (event.pointerType === "touch") hideTip();
};

/** Makes a press-and-drag on `handle` scrub like the strip. A press without a drag is a click. */
export const grab = (handle: HTMLElement) => {
    let moved = false;

    const offs = [
        on(handle, "pointerdown", (event) => begin(event, handle)),
        on(handle, "pointermove", (event) => {
            if (drag?.source === handle) onMove(event);
        }),
        ...(["pointerup", "pointercancel"] as const).map((type) =>
            on(handle, type, (event) => {
                if (drag?.source !== handle) return;

                moved = drag.moved;
                onEnd(event);
                // The click that ends a drag comes right after, and mustn't open the editor.
                if (moved) setTimeout(() => (moved = false));
            }),
        ),
        // In the capture phase, so it runs before the handle's own click listeners.
        on(
            handle,
            "click",
            (event) => {
                if (moved) event.stopImmediatePropagation();
            },
            { capture: true },
        ),
    ];

    return () => {
        for (const off of offs) off();
    };
};

const onLeave = () => {
    hover = null;
    dirty = true;
    element?.classList.remove("orrery__timeline--flag");
    if (!drag) hideTip();
};

const onKeyDown = (event: KeyboardEvent) => {
    if (event.ctrlKey || event.altKey || event.metaKey) return;

    const { half } = windowNow();
    const tick = half / 60;
    const by = {
        ArrowLeft: -tick,
        ArrowRight: tick,
        PageUp: 10 * tick,
        PageDown: -10 * tick,
    }[event.key];

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
        on(node, "pointerdown", (event) => begin(event, node)),
        on(node, "pointermove", onMove),
        on(node, "pointerup", onEnd),
        on(node, "pointercancel", onEnd),
        on(node, "pointerleave", onLeave),
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
