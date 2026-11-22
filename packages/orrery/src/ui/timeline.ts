import { unixMsToJ2000s } from "@cpluspatch/orbit";
import { readList, type SavedStorage, startTime } from "../persistence.ts";
import { readouts } from "../readouts.ts";
import {
    apsides,
    clampT,
    isFree,
    tickLabel,
    tickLabelFree,
    ticks,
    tipText,
    windowHalf,
} from "../timeline.ts";
import type { World } from "../world.ts";
import { h } from "./dom.ts";

/** The timeline's element and how to remove it. */
export type Timeline = {
    element: HTMLElement;
    destroy: () => void;
};

type Colors = {
    frame: string;
    rule: string;
    dim: string;
    go: string;
    text: string;
    signal: string;
    signalInk: string;
    fontUi: string;
    fontData: string;
};

type Hit = { from: number; to: number; t: number };

type Square = { x: number; name: string };

/** A saved scenario's start time and name. */
type Saved = { t: number; name: string };

/** The baseline's y, and where the labels sit under it. */
const BASE = 9.5;
const LABEL_Y = 21;
/** The width kept free of labels either side of the playhead. */
const KEEP = 28;
/** The width at each end that fades out, so a label there would be half gone. */
const FADE = 24;
/** The drag distance in px that makes a press a scrub and not a click. */
const DRAG_PX = 3;

/** A scrubbable strip of time around the clock, with the Now mark, saved scenarios and apsides. */
export const createTimeline = (
    world: World,
    storage: SavedStorage,
): Timeline => {
    const { clock } = world;

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
    let squares: Square[] = [];
    let dirty = true;
    let shown = "";
    let drag: {
        x: number;
        t: number;
        paused: boolean;
        moved: boolean;
        flag: Hit | undefined;
    } | null = null;

    const readColors = (): Colors => {
        const style = getComputedStyle(element);
        const read = (name: string) => style.getPropertyValue(name).trim();

        return {
            frame: read("--orrery-frame"),
            rule: read("--orrery-rule"),
            dim: read("--orrery-dim"),
            go: read("--orrery-go"),
            text: read("--orrery-text"),
            signal: read("--orrery-signal"),
            signalInk: read("--orrery-signal-ink"),
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

    const draw = () => {
        if (!ctx || !element.isConnected || width === 0) return;

        colors ??= readColors();
        const c = colors;
        const half = windowHalf(clock.rate);
        const lo = clock.t - half;
        const hi = clock.t + half;
        const mid = width / 2;
        const perSecond = width / (2 * half);
        const x = (t: number) => mid + (t - clock.t) * perSecond;

        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        ctx.clearRect(0, 0, width, height);
        ctx.lineWidth = 1;
        ctx.textBaseline = "middle";
        hits = [];
        squares = [];

        ctx.strokeStyle = c.frame;
        ctx.beginPath();
        ctx.moveTo(0, BASE);
        ctx.lineTo(width, BASE);
        ctx.stroke();

        // The playhead's neighbourhood is kept clear of labels, the Now label included.
        const taken: [number, number][] = [[mid - KEEP, mid + KEEP]];

        // Minor ticks are on a finer step than the labelled ones.
        ctx.strokeStyle = c.rule;
        for (const t of ticks(lo, hi, Math.max(6, Math.floor(width / 15)))
            .ticks) {
            const tx = Math.round(x(t)) + 0.5;
            ctx.beginPath();
            ctx.moveTo(tx, BASE);
            ctx.lineTo(tx, BASE + 3);
            ctx.stroke();
        }

        for (const { t, name } of saved) {
            if (t < lo || t > hi) continue;

            const sx = Math.round(x(t));
            ctx.fillStyle = c.dim;
            ctx.fillRect(sx - 2, Math.floor(BASE) - 2, 5, 5);
            squares.push({ x: sx, name });
        }

        // Now is a mark in the window, else an arrow at the edge it lies past.
        const nowX = x(unixMsToJ2000s(Date.now()));
        ctx.font = `600 10px ${c.fontUi}`;
        const nowWidth = ctx.measureText("Now").width;
        let nowLeft: number;
        ctx.fillStyle = c.go;
        if (nowX >= 0 && nowX <= width) {
            ctx.fillRect(Math.round(nowX) - 1, 3, 2, 12);
            nowLeft = Math.min(
                width - nowWidth,
                Math.max(0, nowX - nowWidth / 2),
            );
        } else {
            const left = nowX < 0;
            const edge = left ? 3 : width - 3;
            const dir = left ? 1 : -1;
            ctx.beginPath();
            ctx.moveTo(edge, BASE);
            ctx.lineTo(edge + dir * 6, BASE - 4);
            ctx.lineTo(edge + dir * 6, BASE + 4);
            ctx.closePath();
            ctx.fill();
            nowLeft = left ? edge + 9 : edge - 9 - nowWidth;
        }
        let nowRange: [number, number] | null = null;
        if (isFree(taken, nowLeft, nowLeft + nowWidth, 4)) {
            nowRange = [nowLeft, nowLeft + nowWidth];
            ctx.textAlign = "left";
            ctx.fillText("Now", nowLeft, LABEL_Y);
            taken.push([nowLeft - 3, nowLeft + nowWidth + 3]);
        }

        // The flags of the picked body, only when they're far enough apart to read.
        const flags: {
            name: string;
            x: number;
            width: number;
            left: number;
            t: number;
            label: boolean;
        }[] = [];
        const picked = world.selected;
        const readout =
            picked === null
                ? null
                : readouts(world.scenario, picked, world.states(), clock.t);
        if (readout && (readout.period / 2) * perSecond >= 30) {
            ctx.font = `700 10px ${c.fontUi}`;
            for (const { name, t } of apsides(readout, clock.t)) {
                const fx = x(t);
                if (fx < 0 || fx > width) continue;

                const fw = ctx.measureText(name).width + 8;
                const left = Math.min(width - 1 - fw, Math.max(1, fx - fw / 2));
                // The label takes its room before the tick labels do, and is dropped if it has none.
                const label = isFree(taken, left, left + fw, 4);
                if (label) taken.push([left - 3, left + fw + 3]);
                flags.push({ name, x: fx, width: fw, left, t, label });
            }
        }

        const labelled = ticks(
            lo,
            hi,
            Math.max(1, Math.min(6, Math.floor(width / 80))),
        );
        ctx.font = `400 10px ${c.fontData}`;
        ctx.textAlign = "left";
        for (const t of labelled.ticks) {
            const tx = Math.round(x(t)) + 0.5;
            ctx.strokeStyle = c.dim;
            ctx.beginPath();
            ctx.moveTo(tx, BASE);
            ctx.lineTo(tx, BASE + 6);
            ctx.stroke();
            if (width < 160) continue;

            const text = tickLabel(t, labelled.kind);
            const textWidth = ctx.measureText(text).width;
            const left = tx - textWidth / 2;
            if (
                left < FADE ||
                left + textWidth > width - FADE ||
                !tickLabelFree(taken, nowRange, left, left + textWidth)
            ) {
                continue;
            }

            ctx.fillStyle = c.dim;
            ctx.fillText(text, left, LABEL_Y);
            taken.push([left, left + textWidth]);
        }

        ctx.textAlign = "center";
        ctx.font = `700 10px ${c.fontUi}`;
        for (const flag of flags) {
            const fx = Math.round(flag.x) + 0.5;
            ctx.strokeStyle = c.signal;
            ctx.beginPath();
            ctx.moveTo(fx, 2);
            ctx.lineTo(fx, flag.label ? 15 : BASE + 6);
            ctx.stroke();
            // A dropped label leaves its tick, which stays clickable.
            if (flag.label) {
                ctx.fillStyle = c.signal;
                ctx.fillRect(Math.round(flag.left), 15, flag.width, 11);
                ctx.fillStyle = c.signalInk;
                ctx.fillText(flag.name, flag.left + flag.width / 2, 20.5);
                hits.push({
                    from: flag.left,
                    to: flag.left + flag.width,
                    t: flag.t,
                });
            } else {
                hits.push({ from: flag.x - 4, to: flag.x + 4, t: flag.t });
            }
        }

        // A faint line at the pointer shows where a click would land.
        if (hover !== null && Math.abs(hover - mid) > 3) {
            const hx = Math.round(hover) + 0.5;
            ctx.globalAlpha = 0.5;
            ctx.strokeStyle = c.dim;
            ctx.beginPath();
            ctx.moveTo(hx, 0);
            ctx.lineTo(hx, height);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }

        const px = Math.round(mid) + 0.5;
        ctx.strokeStyle = c.text;
        ctx.beginPath();
        ctx.moveTo(px, 0);
        ctx.lineTo(px, height);
        ctx.stroke();
        ctx.fillStyle = c.text;
        ctx.fillRect(Math.round(mid) - 2, 7, 5, 5);
    };

    const showAria = (force: boolean) => {
        const half = windowHalf(clock.rate);

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
        const nowPx = Math.round(
            ((unixMsToJ2000s(Date.now()) - clock.t) * width) /
                (2 * windowHalf(clock.rate)),
        );
        const signature = `${clock.t} ${clock.rate} ${nowPx}`;
        if (!dirty && signature === shown) return;

        dirty = false;
        shown = signature;
        showAria(false);
        draw();
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
    const flagAt = (px: number) =>
        hits.find(({ from, to }) => px >= from - 2 && px <= to + 2);
    // The squares are 5px, so a few pixels of slack make them hoverable.
    const squareAt = (px: number, py: number) =>
        Math.abs(py - BASE) <= 6
            ? squares.find((square) => Math.abs(px - square.x) <= 5)
            : undefined;

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
            flag: flagAt(event.clientX - canvasLeft()),
        };
    };

    const onMove = (event: PointerEvent) => {
        const px = event.clientX - canvasLeft();

        if (drag) {
            hover = null;
            const dx = event.clientX - drag.x;
            if (!drag.moved && Math.abs(dx) < DRAG_PX) return;

            if (!drag.moved) {
                drag.moved = true;
                world.setClock({ paused: true });
            }
            world.setClock({
                t: clampT(drag.t + (dx / width) * 2 * windowHalf(clock.rate)),
            });
            // The clock already shows the date being dragged to.
            tip.hidden = true;

            return;
        }
        if (event.pointerType === "touch") return;

        hover = px;
        dirty = true;
        element.classList.toggle(
            "orrery__timeline--flag",
            flagAt(px) !== undefined,
        );

        const half = windowHalf(clock.rate);
        const square = squareAt(
            px,
            event.clientY - canvas.getBoundingClientRect().top,
        );
        if (square) showTip(square.x, square.name);
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

        const span = 2 * windowHalf(clock.rate);
        const by = {
            ArrowLeft: -span / 60,
            ArrowRight: span / 60,
            PageUp: span / 6,
            PageDown: -span / 6,
        }[event.key];

        if (by !== undefined) world.setClock({ t: clampT(clock.t + by) });
        else if (event.key === "Home") {
            world.setClock({ t: clampT(unixMsToJ2000s(Date.now())) });
        } else return;

        event.preventDefault();
        showAria(true);
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
