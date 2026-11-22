import { unixMsToJ2000s } from "@cpluspatch/orbit";
import type { Readouts } from "../../readouts.ts";
import {
    apsides,
    isFree,
    tickLabel,
    tickLabelFree,
    ticks,
    windowHalf,
} from "../../timeline.ts";

export type Colors = {
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

export type Hit = { from: number; to: number; t: number };

export type Square = { x: number; name: string };

/** A saved scenario's start time and name. */
export type Saved = { t: number; name: string };

/** The baseline's y, and where the labels sit under it. */
export const BASE = 9.5;
const LABEL_Y = 21;
/** The width kept free of labels either side of the playhead. */
const KEEP = 28;
/** The width at each end that fades out, so a label there would be half gone. */
const FADE = 24;

/** What the strip shows: its size, colours, the clock, saved scenarios, the pointer and the picked body. */
export type View = {
    width: number;
    height: number;
    ratio: number;
    colors: Colors;
    clock: { t: number; rate: number };
    saved: Saved[];
    /** The pointer's x on the strip, or none. */
    hover: number | null;
    /** The picked body's readouts, for its apsides flags. */
    readout: Readouts | null;
};

/** Draws the strip on `ctx`. Returns the boxes of the apsides flags and saved scenarios to hit-test. */
export const drawTimeline = (
    ctx: CanvasRenderingContext2D,
    view: View,
): { hits: Hit[]; squares: Square[] } => {
    const { width, height, ratio, clock, saved, hover, readout } = view;
    const c = view.colors;
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
    const hits: Hit[] = [];
    const squares: Square[] = [];

    ctx.strokeStyle = c.frame;
    ctx.beginPath();
    ctx.moveTo(0, BASE);
    ctx.lineTo(width, BASE);
    ctx.stroke();

    // The playhead's neighbourhood is kept clear of labels, the Now label included.
    const taken: [number, number][] = [[mid - KEEP, mid + KEEP]];

    // Minor ticks are on a finer step than the labelled ones.
    ctx.strokeStyle = c.rule;
    for (const t of ticks(lo, hi, Math.max(6, Math.floor(width / 15))).ticks) {
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
        nowLeft = Math.min(width - nowWidth, Math.max(0, nowX - nowWidth / 2));
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

    return { hits, squares };
};
