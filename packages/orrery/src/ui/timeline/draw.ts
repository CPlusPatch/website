import type { Readouts } from "@cpluspatch/sim";
import {
    apsisMarks,
    FADE_PX,
    isFree,
    labelLeft,
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

/** The left edge in px of the window label and of the picked body's name. */
const LABEL_X = 8;

/** `text` cut short with an ellipsis to fit `max` px. */
const fit = (ctx: CanvasRenderingContext2D, text: string, max: number) => {
    if (ctx.measureText(text).width <= max) return text;

    let n = text.length;
    while (n > 1 && ctx.measureText(`${text.slice(0, n)}…`).width > max) n--;

    return `${text.slice(0, n)}…`;
};

/** Fills `text` at `LABEL_X` in `color` on a patch of `ground`, so a line behind it stays out. */
const knockout = (
    ctx: CanvasRenderingContext2D,
    text: string,
    baseline: number,
    fontSize: number,
    color: string,
    ground: string,
) => {
    ctx.fillStyle = ground;
    ctx.fillRect(
        LABEL_X - 3,
        baseline - fontSize,
        ctx.measureText(text).width + 6,
        fontSize + 3,
    );
    ctx.fillStyle = color;
    ctx.fillText(text, LABEL_X, baseline);
};

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

    const windowWidth = phone ? 0 : ctx.measureText(view.windowText).width;
    // The playhead and the Now line cross the ruler, so a label keeps 4 px off them.
    const centre: [number, number] = [mid - 4, mid + 4];
    const barred: [number, number][] = [centre];
    if (inWindow) barred.push([nowX - 4, nowX + 4]);
    if (!phone) barred.push([0, LABEL_X + windowWidth + 4]);

    for (const t of labelled.ticks) {
        const px = x(t);
        if (t < MIN_T || t > MAX_T || px < windowEdge) continue;

        const tx = Math.round(px) + 0.5;
        ctx.strokeStyle = c.muted;
        ctx.beginPath();
        ctx.moveTo(tx, Y - 6);
        ctx.lineTo(tx, Y);
        ctx.stroke();

        // Flip rather than drop, so a collision doesn't leave a gap of two ticks.
        const text = tickLabel(t, labelled.kind);
        const textWidth = ctx.measureText(text).width;
        const from = labelLeft(
            [px + 4, px - 4 - textWidth],
            textWidth,
            barred,
            FADE_PX,
            width - FADE_PX,
        );
        if (from === null) continue;

        barred.push([from - 4, from + textWidth + 4]);
        ctx.fillStyle = c.muted;
        ctx.fillText(text, from, Y - 4);
    }

    // Names the pink squares, so they aren't linked to the body by colour alone.
    ctx.font = `600 ${fontSize}px ${c.fontUi}`;
    const bodyName =
        view.bodyName === null
            ? null
            : fit(ctx, view.bodyName, width / 3 - LABEL_X);
    const nameEnd =
        bodyName === null ? 0 : LABEL_X + ctx.measureText(bodyName).width + 4;
    const reserved: [number, number][] =
        bodyName === null ? [] : [[0, nameEnd]];

    // The picked body's apsides: labelled when far apart, then squares, then thinned out.
    const sq = phone ? 8 : 9;
    const marks: {
        name: "Ap" | "Pe";
        x: number;
        t: number;
        labelled: boolean;
        /** The label's left edge, or null if there's no room for it. */
        text: number | null;
        from: number;
        to: number;
    }[] = [];
    const taken: [number, number][] = [...reserved];
    for (const { name, t, labelled } of apsisMarks(
        view.readout,
        clock.t,
        lo,
        hi,
        perSecond,
    )) {
        const ax = x(t);
        if (t < MIN_T || t > MAX_T || ax < 2 || ax > width - 2) continue;
        if (!isFree(reserved, ax - sq / 2, ax + sq / 2, 0)) continue;

        marks.push({
            name,
            x: ax,
            t,
            labelled,
            text: null,
            from: ax - sq / 2,
            to: ax + sq / 2,
        });
    }

    // A label must clear every square, or "Ap Pe" reads as one mark's name.
    const placed: [number, number][] = [];
    for (const mark of marks) {
        if (mark.labelled) {
            const { x: ax } = mark;
            const textWidth = ctx.measureText(mark.name).width;
            const right = ax + sq / 2 + 4;
            const left = ax - sq / 2 - 4 - textWidth;
            const others = marks
                .filter((other) => other !== mark)
                .map((other): [number, number] => [
                    other.from - 1,
                    other.to + 1,
                ]);
            mark.text = labelLeft(
                ax > width - 34 ? [left, right] : [right, left],
                textWidth,
                [centre, ...reserved, ...others, ...placed],
                0,
                width,
            );
            if (mark.text !== null) {
                placed.push([mark.text - 1, mark.text + textWidth + 1]);
                mark.from = Math.min(mark.from, mark.text);
                mark.to = Math.max(mark.to, mark.text + textWidth);
            }
        }
        // A bare square gives way to a scenario's flag, or names vanish at fast rates.
        if (mark.labelled) taken.push([mark.from, mark.to]);
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
        if (
            !isFree(reserved, flip ? fx - 9 : fx - 1, flip ? fx + 1 : fx + 9, 0)
        ) {
            continue;
        }

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
    for (const { name, x: ax, t, labelled, text, from, to } of marks) {
        if (!labelled && !isFree(flags, ax - sq / 2, ax + sq / 2, 0)) continue;

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

        if (text === null) continue;

        ctx.fillStyle = c.pick;
        ctx.textAlign = "left";
        ctx.fillText(name, text, ay + 4);
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

    // Last, so the Now line passes under the labels' knockout.
    ctx.textAlign = "left";
    if (!phone) {
        ctx.font = `500 ${fontSize}px ${c.fontData}`;
        knockout(ctx, view.windowText, Y - 4, fontSize, c.dim, c.ground);
    }
    if (bodyName !== null) {
        ctx.font = `600 ${fontSize}px ${c.fontUi}`;
        knockout(ctx, bodyName, ay + 4, fontSize, c.pick, c.ground);
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
