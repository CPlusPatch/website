import type { Readouts } from "../../readouts.ts";
import {
    apsisMarks,
    isFree,
    MAX_T,
    MIN_T,
    tickLabel,
    ticks,
} from "../../timeline.ts";

export type Colors = {
    rule: string;
    frame: string;
    dim: string;
    muted: string;
    go: string;
    text: string;
    signal: string;
    pick: string;
    ground: string;
    fontUi: string;
    fontData: string;
};

/** A saved scenario's or an apsis's x range in px on the events row, the time it marks and its tip. */
export type Hit = {
    from: number;
    to: number;
    x: number;
    t: number;
    tip: string;
};

/** A saved scenario's start time and name. */
export type Saved = { t: number; name: string };

/** The height of the ruler and of the events row; the marker tier takes the rest of the strip. */
const RULER = 16;
export const EVENTS = 24;

/** Where Now is on the strip, and whether the Now line is drawn there. */
export type NowMark = { x: number; inWindow: boolean };

/** What the strip shows: its size, colours, the clock, saved scenarios, the pointer and the picked body. */
export type View = {
    width: number;
    height: number;
    ratio: number;
    /** Phones get a narrower tick spacing, smaller marks and no window label. */
    phone: boolean;
    colors: Colors;
    clock: { t: number };
    /** The window's half-width in seconds and its label. */
    half: number;
    windowText: string;
    /** The real time in seconds since J2000. */
    nowT: number;
    saved: Saved[];
    /** The pointer's x on the strip, or none. */
    hover: number | null;
    /** The picked body's readouts and name, for its apsides. */
    readout: Readouts | null;
    bodyName: string | null;
};

/** The gap in px between the lines of the hatch over time past the limits. */
const HATCH_PX = 6;

/** The width at the left of the strip that the window label takes. */
const WINDOW_LABEL_PX = 76;

/** Draws the strip on `ctx`. Returns the boxes of the saved scenarios and apsides to hit-test, and Now's place. */
export const drawTimeline = (
    ctx: CanvasRenderingContext2D,
    view: View,
): { hits: Hit[]; now: NowMark } => {
    const { width, height, ratio, phone, clock, half, nowT, saved, hover } =
        view;
    const c = view.colors;
    const marker = height - RULER - EVENTS;
    const Y = marker + RULER;
    const ay = Y + EVENTS / 2;
    const mid = width / 2;
    const perSecond = width / (2 * half);
    const x = (t: number) => mid + (t - clock.t) * perSecond;
    const lo = clock.t - half;
    const hi = clock.t + half;
    const fontSize = phone ? 10 : 11;

    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.lineWidth = 1;
    ctx.textBaseline = "alphabetic";
    const hits: Hit[] = [];
    const nowX = x(nowT);
    const inWindow = nowX >= 3 && nowX <= width - 3;

    // Time past the date limits isn't valid, so it's hatched off.
    const past: [number, number][] = [
        [0, Math.min(width, x(MIN_T))],
        [Math.max(0, x(MAX_T)), width],
    ];
    for (const [from, to] of past) {
        if (to <= from) continue;

        ctx.save();
        ctx.beginPath();
        ctx.rect(from, 0, to - from, height);
        ctx.clip();
        ctx.strokeStyle = c.rule;
        ctx.beginPath();
        for (let hx = from - height; hx < to; hx += HATCH_PX) {
            ctx.moveTo(hx + height, 0);
            ctx.lineTo(hx, height);
        }
        ctx.stroke();
        ctx.restore();
    }

    for (const limit of [x(MIN_T), x(MAX_T)]) {
        if (limit < 0 || limit > width) continue;

        ctx.fillStyle = c.frame;
        ctx.fillRect(Math.round(limit), 0, 1, height);
    }

    ctx.fillStyle = c.rule;
    ctx.fillRect(0, Y - 1, width, 1);

    const labelled = ticks(
        lo,
        hi,
        Math.max(1, Math.floor(width / (phone ? 70 : 80))),
    );
    const windowEdge = phone ? 0 : WINDOW_LABEL_PX;
    ctx.font = `500 ${fontSize}px ${c.fontData}`;
    ctx.textAlign = "left";
    for (const t of labelled.ticks) {
        const px = x(t);
        if (t < MIN_T || t > MAX_T || px < windowEdge) continue;

        const tx = Math.round(px) + 0.5;
        ctx.strokeStyle = c.muted;
        ctx.beginPath();
        ctx.moveTo(tx, Y - 6);
        ctx.lineTo(tx, Y);
        ctx.stroke();

        const text = tickLabel(t, labelled.kind);
        const end = px + 4 + ctx.measureText(text).width;
        // The playhead and the Now line cross the ruler, so a label never sits under them.
        if (end > width - 4) continue;
        if (px - 4 < mid && mid < end + 4) continue;
        if (inWindow && px - 4 < nowX && nowX < end + 4) continue;

        ctx.fillStyle = c.muted;
        ctx.fillText(text, px + 4, Y - 4);
    }
    if (!phone) {
        ctx.fillStyle = c.dim;
        ctx.fillText(view.windowText, 8, Y - 4);
    }

    // The picked body's apsides: labelled when far apart, then squares, then thinned out.
    const sq = phone ? 8 : 9;
    const marks: {
        name: "Ap" | "Pe";
        x: number;
        t: number;
        labelled: boolean;
        from: number;
        to: number;
    }[] = [];
    const taken: [number, number][] = [];
    ctx.font = `600 ${fontSize}px ${c.fontUi}`;
    for (const { name, t, labelled } of apsisMarks(
        view.readout,
        clock.t,
        lo,
        hi,
        perSecond,
    )) {
        const ax = x(t);
        if (t < MIN_T || t > MAX_T || ax < 2 || ax > width - 2) continue;

        const flip = ax > width - 34;
        const label = labelled ? ctx.measureText(name).width + 4 : 0;
        const from = flip ? ax - sq / 2 - label : ax - sq / 2;
        const to = flip ? ax + sq / 2 : ax + sq / 2 + label;
        marks.push({ name, x: ax, t, labelled, from, to });
        // A bare square gives way to a scenario's flag, or names vanish at fast rates.
        if (labelled) taken.push([from, to]);
    }

    // Saved scenarios first, so a name steps aside for an apsis and not the other way round.
    // Left to right, so a name also steps aside for the one before it.
    ctx.font = `500 ${fontSize}px ${c.fontUi}`;
    const flags: [number, number][] = [];
    for (const { t, name } of saved.toSorted((a, b) => a.t - b.t)) {
        const px = x(t);
        if (t < MIN_T || t > MAX_T || px < -2 || px > width + 2) continue;

        const fx = Math.round(px);
        const textWidth = ctx.measureText(name).width;
        const flip = fx + 14 + textWidth > width - 4;
        const from = flip ? fx - 13 - textWidth : fx + 13;
        const named = isFree(taken, from, from + textWidth, 4);

        ctx.fillStyle = c.signal;
        ctx.fillRect(fx - 1, Y, 2, EVENTS - 4);
        ctx.fillRect(flip ? fx - 9 : fx + 1, ay - 4, 8, 8);
        flags.push(flip ? [fx - 9, fx + 1] : [fx - 1, fx + 9]);
        if (named) {
            taken.push([from, from + textWidth]);
            flags.push([from - 4, from + textWidth + 4]);
            ctx.fillStyle = c.muted;
            ctx.textAlign = flip ? "right" : "left";
            ctx.fillText(name, flip ? fx - 13 : fx + 13, ay + 4);
        }

        hits.unshift({
            from: flip ? (named ? from : fx - 9) : fx - 1,
            to: flip ? fx + 1 : named ? from + textWidth : fx + 9,
            x: px,
            t,
            tip: name,
        });
    }

    ctx.font = `600 ${fontSize}px ${c.fontUi}`;
    for (const { name, x: ax, t, labelled, from, to } of marks) {
        if (!labelled && !isFree(flags, ax - sq / 2, ax + sq / 2, 0)) continue;

        const flip = ax > width - 34;
        const left = Math.round(ax - sq / 2);
        const top = Math.round(ay - sq / 2);
        hits.push({
            from,
            to,
            x: ax,
            t,
            tip: `${name === "Pe" ? "Periapsis" : "Apoapsis"}${view.bodyName ? `, ${view.bodyName}` : ""}`,
        });

        ctx.fillStyle = name === "Pe" ? c.pick : c.ground;
        ctx.fillRect(left, top, sq, sq);
        if (name === "Ap") {
            ctx.strokeStyle = c.pick;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(left, top, sq, sq);
            ctx.lineWidth = 1;
        }

        if (!labelled) continue;

        ctx.fillStyle = c.pick;
        ctx.textAlign = flip ? "right" : "left";
        ctx.fillText(name, flip ? ax - sq / 2 - 4 : ax + sq / 2 + 4, ay + 4);
    }

    // Now is a line through the marker tier and the ruler, only when it's in the window.
    if (inWindow) {
        const nx = Math.round(nowX);
        ctx.strokeStyle = c.go;
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(nx, marker - 2);
        ctx.lineTo(nx, Y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineWidth = 1;
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

    ctx.fillStyle = c.text;
    ctx.fillRect(Math.round(mid) - 1, 0, 2, height);

    return { hits, now: { x: nowX, inWindow } };
};
