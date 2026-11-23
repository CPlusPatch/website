import { scaleBar } from "../scale.ts";
import type { Units } from "../units.ts";
import type { ChaseState, View } from "../view/scene.ts";
import { h, setText } from "./dom.ts";

/** The scale bar's target length in px, which is shorter where the bar stacks over its label. */
const TARGET_PX = 70;
const TARGET_NARROW_PX = 110;

const svg = (paths: string): string =>
    `<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor">${paths}</svg>`;

const PLUS_ICON = svg('<path d="M8 3v10M3 8h10" stroke-width="1.8"/>');
const MINUS_ICON = svg('<path d="M3 8h10" stroke-width="1.8"/>');
const FIT_ICON = svg(
    '<path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" stroke-width="1.6"/>',
);
// A body with speed lines trailing it.
const CHASE_ICON = svg(
    '<circle cx="11" cy="8" r="3" fill="currentColor" stroke="none"/><path d="M3 5h3M1 8h5M3 11h3" stroke-width="2"/>',
);

const button = (label: string, icon: string, onClick: () => void) => {
    const element = h("button", {
        type: "button",
        class: "orrery__hud-button",
        "aria-label": label,
    });
    element.innerHTML = icon;
    element.addEventListener("click", onClick);

    return element;
};

/**
 * Fills the HUD panel `slot` with the zoom and chase buttons and the scale bar of `view`.
 * `narrow` picks the bar's target length. Returns a function that removes it all.
 */
export const createHud = (
    slot: HTMLElement,
    view: View,
    units: Units,
    narrow: MediaQueryList,
): (() => void) => {
    const bar = h("span", { class: "orrery__hud-bar" });
    const label = h("span", { class: "orrery__hud-label" });
    const chase = button("Chase the focus", CHASE_ICON, () => {
        view.chase(!view.chasing());
    });
    chase.setAttribute("aria-keyshortcuts", "C");
    const showChase = ({ chasing, canChase }: ChaseState) => {
        chase.setAttribute("aria-pressed", String(chasing));
        chase.disabled = !canChase;
    };
    showChase({ chasing: view.chasing(), canChase: view.canChase() });
    const offChase = view.onChase(showChase);
    const zoom = h(
        "div",
        { class: "orrery__hud-zoom", role: "group", "aria-label": "View" },
        button("Zoom in", PLUS_ICON, () => view.zoom(1)),
        button("Zoom out", MINUS_ICON, () => view.zoom(-1)),
        button("Fit the focus", FIT_ICON, () => view.fitFocus()),
        chase,
    );
    const scale = h(
        "div",
        { class: "orrery__hud-scale", "aria-hidden": "true" },
        bar,
        label,
    );
    slot.append(zoom, scale);

    let width = -1;
    const update = () => {
        const perPx = view.kmPerPx();
        if (!(perPx > 0)) return;

        const next = scaleBar(
            perPx,
            narrow.matches ? TARGET_NARROW_PX : TARGET_PX,
            units.get(),
        );
        // Only a change is written, so a steady view costs no style work.
        const rounded = Math.round(next.px);
        if (rounded !== width) {
            width = rounded;
            bar.style.inlineSize = `${rounded}px`;
        }
        setText(label, next.label);
    };

    let frame = 0;
    const tick = () => {
        update();
        frame = requestAnimationFrame(tick);
    };
    tick();

    return () => {
        cancelAnimationFrame(frame);
        offChase();
        zoom.remove();
        scale.remove();
    };
};
