/**
 * <PreviewFrame>: a box whose width the reader sets, by dragging its right
 * edge or with the range input above it, in rem.
 *
 * Root: `.preview-frame`, with `data-min` (rem), `data-value` (rem or
 * "fill") and optionally `data-storage-key`. Inside it:
 *
 * - `.preview-frame__range`, the `<input type="range">` for the width
 * - `.preview-frame__readout`, which gets the width as text
 * - `.preview-frame__tick[data-rem][data-name]`, one per snap width
 * - `.preview-frame__body`, holding `.preview-frame__content` and
 *   `.preview-frame__edge`, the drag target
 *
 * The range's max is the body's width, kept current. At max the frame
 * fills the body and follows it. The root gets `data-ready`, which the CSS
 * waits for to show the controls. Changes are the range's own `input` and
 * `change` events, fired on it for the edge and the keys too.
 */
import {
    clamp,
    DEFAULT_MIN,
    isFill,
    keyWidth,
    type PreviewWidth,
    parseWidth,
    snap,
    widthText,
} from "../lib/preview-width.ts";
import { behaviour } from "./behaviour.ts";

const remPixels = () =>
    Number.parseFloat(getComputedStyle(document.documentElement).fontSize) ||
    16;

const read = (key: string): string | null => {
    try {
        return sessionStorage.getItem(key);
    } catch {
        // Storage can be blocked (private mode): the width is just not kept.
        return null;
    }
};

const write = (key: string, value: string) => {
    try {
        sessionStorage.setItem(key, value);
    } catch {
        // Same as read(): losing the saved width is harmless.
    }
};

const previewFrame = behaviour(".preview-frame", (root, signal) => {
    const range = root.querySelector<HTMLInputElement>(".preview-frame__range");
    const body = root.querySelector<HTMLElement>(".preview-frame__body");
    const content = root.querySelector<HTMLElement>(".preview-frame__content");
    const edge = root.querySelector<HTMLElement>(".preview-frame__edge");
    if (!range || !body || !content || !edge) return;

    const readout = root.querySelector<HTMLElement>(".preview-frame__readout");
    const ticks = [
        ...root.querySelectorAll<HTMLElement>(".preview-frame__tick"),
    ];
    const widths: PreviewWidth[] = ticks.map((tick) => ({
        name: tick.dataset.name ?? "",
        rem: Number(tick.dataset.rem),
    }));
    const min = Number(root.dataset.min) || DEFAULT_MIN;
    const storageKey = root.dataset.storageKey;
    const saved = storageKey ? parseWidth(read(storageKey)) : undefined;

    // What the reader chose: "fill" follows the body, a width is kept even
    // when the body is briefly narrower than it.
    let chosen: number | "fill" =
        saved ?? parseWidth(root.dataset.value) ?? "fill";
    let max = min;
    let dragging = false;

    root.style.setProperty("--preview-frame-min", String(min));
    range.min = String(min);
    for (const tick of ticks) {
        tick.style.setProperty("--at", tick.dataset.rem ?? "");
    }

    const render = () => {
        const value = chosen === "fill" ? max : clamp(chosen, min, max);

        range.max = String(max);
        range.value = String(value);
        if (isFill(value, max)) {
            root.style.removeProperty("--preview-frame-width");
        } else {
            root.style.setProperty("--preview-frame-width", `${value}rem`);
        }

        const text = widthText(value, widths, max);
        range.setAttribute("aria-valuetext", text);
        if (readout) readout.textContent = text;
        for (const tick of ticks) {
            const rem = Number(tick.dataset.rem);
            tick.hidden = rem < min || rem > max;
        }
    };

    const measure = () => {
        max = Math.max(min, body.clientWidth / remPixels());
        render();
    };

    root.toggleAttribute("data-ready", true);
    measure();

    range.addEventListener(
        "input",
        () => {
            let value = Number(range.value);
            if (dragging) value = snap(value, widths, min, max);
            chosen = isFill(value, max) ? "fill" : value;
            render();
            if (storageKey) write(storageKey, String(chosen));
        },
        { signal },
    );

    const set = (value: number) => {
        range.value = String(value);
        range.dispatchEvent(new Event("input", { bubbles: true }));
    };

    range.addEventListener(
        "keydown",
        (event) => {
            if (event.ctrlKey || event.altKey || event.metaKey) return;
            const next = keyWidth(
                event.key,
                Number(range.value),
                widths,
                min,
                max,
            );
            if (next === undefined) return;

            event.preventDefault();
            set(next);
            range.dispatchEvent(new Event("change", { bubbles: true }));
        },
        { signal },
    );

    // The range snaps while its thumb is held. The edge does too (below).
    range.addEventListener(
        "pointerdown",
        () => {
            dragging = true;
            root.setAttribute("data-dragging", "");
        },
        { signal },
    );
    const release = () => {
        dragging = false;
        root.removeAttribute("data-dragging");
    };
    window.addEventListener("pointerup", release, { signal });
    window.addEventListener("pointercancel", release, { signal });

    // Where the pointer is on the edge when grabbed, so the frame doesn't jump.
    let grab = 0;
    let moved = false;

    edge.addEventListener(
        "pointerdown",
        (event) => {
            if (event.button !== 0) return;

            event.preventDefault();
            edge.setPointerCapture(event.pointerId);
            grab = event.clientX - content.getBoundingClientRect().right;
            moved = false;
            dragging = true;
            root.toggleAttribute("data-dragging", true);
        },
        { signal },
    );

    edge.addEventListener(
        "pointermove",
        (event) => {
            if (!edge.hasPointerCapture(event.pointerId)) return;

            const x = event.clientX - grab - body.getBoundingClientRect().left;
            moved = true;
            set(clamp(x / remPixels(), min, max));
        },
        { signal },
    );

    const drop = (event: PointerEvent) => {
        if (!edge.hasPointerCapture(event.pointerId)) return;

        edge.releasePointerCapture(event.pointerId);
        dragging = false;
        root.removeAttribute("data-dragging");
        if (moved) range.dispatchEvent(new Event("change", { bubbles: true }));
    };
    edge.addEventListener("pointerup", drop, { signal });
    edge.addEventListener("pointercancel", drop, { signal });
    // Capture can go without a pointerup (the edge removed, another capture).
    edge.addEventListener(
        "lostpointercapture",
        () => {
            dragging = false;
            root.removeAttribute("data-dragging");
        },
        { signal },
    );

    const observer = new ResizeObserver(measure);
    observer.observe(body);

    return () => {
        observer.disconnect();
        root.removeAttribute("data-ready");
        root.removeAttribute("data-dragging");
        root.style.removeProperty("--preview-frame-min");
        root.style.removeProperty("--preview-frame-width");
        range.removeAttribute("aria-valuetext");
        if (readout) readout.textContent = "";
        for (const tick of ticks) {
            tick.style.removeProperty("--at");
            tick.hidden = false;
        }
    };
});

export const initPreviewFrame = previewFrame.init;
export const initPreviewFrames = previewFrame.initAll;
