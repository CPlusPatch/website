import { on } from "svelte/events";
import type { ViewState } from "../../state/view.svelte.ts";
import { clampT, tipText } from "../../timeline.ts";
import type { Hit } from "./draw.ts";
import { DRAG_PX, flagAt, hoverTime, scrubTime, tipLeft } from "./strip.ts";

/** What the scrubber reads from the strip it works on. */
export type ScrubberDeps = {
    view: ViewState;
    element: () => HTMLElement | undefined;
    canvas: () => HTMLCanvasElement | undefined;
    tip: () => HTMLElement | undefined;
    width: () => number;
    height: () => number;
    /** The window's half-width in seconds right now. */
    half: () => number;
    /** Called when what's drawn changes. */
    markDirty: () => void;
};

type Drag = {
    x: number;
    t: number;
    paused: boolean;
    moved: boolean;
    flag: Hit | undefined;
    /** The element holding the pointer, which gets the moves and the end. */
    source: HTMLElement;
    /** The scrub scale, fixed for the drag since holding the clock ends live. */
    half: number;
};

/** The pointer handling of the strip: scrubbing the clock, the hover tip and clicking a flag. */
export class Scrubber {
    /** The pointer's x in px on the strip, or null. */
    hover: number | null = null;
    /** The marks of the last draw. */
    hits: Hit[] = [];

    #deps: ScrubberDeps;
    #drag: Drag | null = null;

    constructor(deps: ScrubberDeps) {
        this.#deps = deps;
    }

    #canvasLeft = () => this.#deps.canvas()?.getBoundingClientRect().left ?? 0;
    #canvasTop = () => this.#deps.canvas()?.getBoundingClientRect().top ?? 0;

    #showTip(px: number, text: string) {
        const element = this.#deps.element();
        const tip = this.#deps.tip();
        if (!element || !tip) return;

        // The tip is placed from the padding box, inside the forced-colors border.
        const origin =
            element.getBoundingClientRect().left + element.clientLeft;

        tip.hidden = false;
        tip.textContent = text;
        tip.style.left = `${tipLeft(origin, px, tip.offsetWidth, innerWidth)}px`;
    }

    #hideTip() {
        const tip = this.#deps.tip();
        if (tip) tip.hidden = true;
    }

    begin = (event: PointerEvent, source: HTMLElement) => {
        if (event.button !== 0) return;

        const { view, element, height } = this.#deps;
        source.setPointerCapture(event.pointerId);
        this.#drag = {
            x: event.clientX,
            t: view.now(),
            paused: view.clock.paused,
            moved: false,
            // A handle's press never picks a flag.
            flag:
                source === element()
                    ? flagAt(
                          this.hits,
                          event.clientX - this.#canvasLeft(),
                          event.clientY - this.#canvasTop(),
                          height(),
                      )
                    : undefined,
            half: this.#deps.half(),
            source,
        };
    };

    onMove = (event: PointerEvent) => {
        const { view, element, width, height, half, markDirty } = this.#deps;
        const px = event.clientX - this.#canvasLeft();
        const py = event.clientY - this.#canvasTop();
        const drag = this.#drag;

        if (drag) {
            this.hover = null;
            const dx = event.clientX - drag.x;
            if (!drag.moved && Math.abs(dx) < DRAG_PX) return;

            if (!drag.moved) {
                drag.moved = true;
                view.setClock({ paused: true });
            }
            view.setClock({ t: scrubTime(drag.t, dx, width(), drag.half) });
            // The clock already shows the date being dragged to.
            this.#hideTip();

            return;
        }
        if (event.pointerType === "touch") return;

        this.hover = px;
        markDirty();
        const hit = flagAt(this.hits, px, py, height());
        element()?.classList.toggle(
            "orrery__timeline--flag",
            hit !== undefined,
        );

        if (hit) this.#showTip(hit.x, hit.tip);
        else {
            const span = half();
            this.#showTip(
                px,
                tipText(hoverTime(view.now(), px, width(), span), span),
            );
        }
    };

    onEnd = (event: PointerEvent) => {
        const ended = this.#drag;
        this.#drag = null;
        if (!ended) return;

        if (ended.moved) this.#deps.view.setClock({ paused: ended.paused });
        else if (event.type === "pointerup" && ended.flag) {
            this.#deps.view.setClock({ t: clampT(ended.flag.t) });
        }
        if (event.pointerType === "touch") this.#hideTip();
    };

    onLeave = () => {
        this.hover = null;
        this.#deps.markDirty();
        this.#deps.element()?.classList.remove("orrery__timeline--flag");
        if (!this.#drag) this.#hideTip();
    };

    /** Makes a press-and-drag on `handle` scrub like the strip. A press without a drag is a click. */
    grab = (handle: HTMLElement) => {
        let moved = false;

        const offs = [
            on(handle, "pointerdown", (event) => this.begin(event, handle)),
            on(handle, "pointermove", (event) => {
                if (this.#drag?.source === handle) this.onMove(event);
            }),
            ...(["pointerup", "pointercancel"] as const).map((type) =>
                on(handle, type, (event) => {
                    if (this.#drag?.source !== handle) return;

                    moved = this.#drag.moved;
                    this.onEnd(event);
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
}
