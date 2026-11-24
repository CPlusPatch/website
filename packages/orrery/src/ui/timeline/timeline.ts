import { unixMsToJ2000s } from "@cpluspatch/orbit";
import { readList, type SavedStorage, startTime } from "../../persistence.ts";
import { readouts } from "../../readouts.ts";
import { isLive } from "../../time-text.ts";
import { clampT, tipText, windowHalf, windowLabel } from "../../timeline.ts";
import type { World } from "../../world.ts";
import { h } from "../dom.ts";
import {
    type Colors,
    drawTimeline,
    EVENTS,
    type Hit,
    type NowMark,
    type Saved,
} from "./draw.ts";

/** The timeline's element and how to remove it. */
export type Timeline = {
    element: HTMLElement;
    destroy: () => void;
};

/** The drag distance in px that makes a press a scrub and not a click. */
const DRAG_PX = 3;

/** A scrubbable strip of time around the clock, with the Now mark, saved scenarios and apsides. */
export const createTimeline = (
    world: World,
    storage: SavedStorage,
    onNow: (now: NowMark & { width: number }) => void,
): Timeline => {
    const { clock } = world;
    const phone = matchMedia("(max-width: 720px)");

    const canvas = h("canvas", { "aria-hidden": "true" });
    const tip = h("div", {
        class: "orrery__timeline-tip",
        "aria-hidden": "true",
    });
    tip.hidden = true;
    const element = h(
        "div",
        {
            class: "orrery__timeline",
            role: "slider",
            tabindex: "0",
            "aria-label": "Time",
        },
        canvas,
        tip,
    );
    const ctx = canvas.getContext("2d");

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
        /** The scrub scale, fixed for the drag since holding the clock ends live. */
        half: number;
    } | null = null;

    const readColors = (): Colors => {
        const style = getComputedStyle(element);
        const read = (name: string) => style.getPropertyValue(name).trim();

        return {
            rule: read("--orrery-rule"),
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
        const live = isLive(clock, nowT);

        return { nowT, live, half: windowHalf(clock.rate, live) };
    };

    const draw = (nowT: number, live: boolean, half: number) => {
        if (!ctx || !element.isConnected || width === 0) return;

        colors ??= readColors();
        const picked = world.selected;
        const readout =
            picked === null
                ? null
                : readouts(world.scenario, picked, world.states(), clock.t);
        const bodyName =
            world.scenario.bodies.find((body) => body.id === picked)?.name ??
            null;

        const drawn = drawTimeline(ctx, {
            width,
            height,
            ratio,
            phone: phone.matches,
            colors,
            clock,
            half,
            windowText: windowLabel(clock.rate, live),
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
        element.setAttribute(
            "aria-valuemin",
            String(Math.round(clock.t - half)),
        );
        element.setAttribute(
            "aria-valuemax",
            String(Math.round(clock.t + half)),
        );
        element.setAttribute("aria-valuenow", String(Math.round(clock.t)));
        // A running clock would make a focused slider announce its text over and over.
        if (!force && !clock.paused && document.activeElement === element)
            return;

        element.setAttribute("aria-valuetext", tipText(clock.t, half));
    };

    const frame = () => {
        frameId = requestAnimationFrame(frame);

        // The Now mark moves with real time, whatever the clock does.
        const { nowT, live, half } = windowNow();
        const nowPx = Math.round(((nowT - clock.t) * width) / (2 * half));
        const signature = `${clock.t} ${clock.rate} ${live} ${nowPx}`;
        if (!dirty && signature === shown) return;

        dirty = false;
        shown = signature;
        showAria(false, half);
        draw(nowT, live, half);
    };
    let frameId = requestAnimationFrame(frame);

    const resize = new ResizeObserver(() => {
        ratio = Math.min(devicePixelRatio || 1, 2);
        width = canvas.clientWidth;
        height = canvas.clientHeight;
        // Setting the size clears the canvas.
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
        dirty = true;
    });
    resize.observe(canvas);

    const canvasLeft = () => canvas.getBoundingClientRect().left;
    // The events row, with a few pixels of slack either side of a mark.
    const flagAt = (px: number, py: number) =>
        py >= height - EVENTS
            ? hits.find(({ from, to }) => px >= from - 2 && px <= to + 2)
            : undefined;
    const canvasTop = () => canvas.getBoundingClientRect().top;

    const showTip = (px: number, text: string) => {
        // The tip is placed from the padding box, inside the forced-colors border.
        const origin =
            element.getBoundingClientRect().left + element.clientLeft;

        tip.hidden = false;
        tip.textContent = text;
        const tipWidth = tip.offsetWidth;
        tip.style.left = `${Math.min(innerWidth - 4 - tipWidth, Math.max(4, origin + px - tipWidth / 2)) - origin}px`;
    };

    const onDown = (event: PointerEvent) => {
        if (event.button !== 0) return;

        element.setPointerCapture(event.pointerId);
        drag = {
            x: event.clientX,
            t: clock.t,
            paused: clock.paused,
            moved: false,
            flag: flagAt(
                event.clientX - canvasLeft(),
                event.clientY - canvasTop(),
            ),
            half: windowNow().half,
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
                world.setClock({ paused: true });
            }
            world.setClock({
                t: clampT(drag.t + (dx / width) * 2 * drag.half),
            });
            // The clock already shows the date being dragged to.
            tip.hidden = true;

            return;
        }
        if (event.pointerType === "touch") return;

        hover = px;
        dirty = true;
        const hit = flagAt(px, py);
        element.classList.toggle("orrery__timeline--flag", hit !== undefined);

        const { half } = windowNow();
        if (hit) showTip(hit.x, hit.tip);
        else
            showTip(
                px,
                tipText(
                    clampT(clock.t + ((px - width / 2) / width) * 2 * half),
                    half,
                ),
            );
    };

    const onEnd = (event: PointerEvent) => {
        const ended = drag;
        drag = null;
        if (!ended) return;

        if (ended.moved) world.setClock({ paused: ended.paused });
        else if (event.type === "pointerup" && ended.flag) {
            world.setClock({ t: clampT(ended.flag.t) });
        }
        if (event.pointerType === "touch") tip.hidden = true;
    };

    const onLeave = () => {
        hover = null;
        dirty = true;
        element.classList.remove("orrery__timeline--flag");
        if (!drag) tip.hidden = true;
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

        if (by !== undefined) world.setClock({ t: clampT(clock.t + by) });
        else if (event.key === "Home") {
            world.setClock({ t: clampT(unixMsToJ2000s(Date.now())) });
        } else return;

        event.preventDefault();
        showAria(true, windowNow().half);
    };

    element.addEventListener("pointerdown", onDown);
    element.addEventListener("pointermove", onMove);
    element.addEventListener("pointerup", onEnd);
    element.addEventListener("pointercancel", onEnd);
    element.addEventListener("pointerleave", onLeave);
    element.addEventListener("keydown", onKeyDown);
    // A scenario saved in another tab or in the dialog shows up on the next visit to the strip.
    element.addEventListener("pointerenter", readSaved);
    element.addEventListener("focus", readSaved);
    window.addEventListener("focus", readSaved);

    // The first frame can draw before the fonts load.
    document.fonts.ready.then(() => {
        dirty = true;
    });

    const off = world.on((event) => {
        dirty = true;
        if (event.type !== "scenario") return;

        colors = null;
        readSaved();
    });
    readSaved();

    return {
        element,
        destroy: () => {
            cancelAnimationFrame(frameId);
            resize.disconnect();
            off();
            window.removeEventListener("focus", readSaved);
            element.remove();
        },
    };
};
