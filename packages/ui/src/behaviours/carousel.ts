/**
 * <Carousel>: a scroll-snapping track with previous/next buttons, a row of
 * pips, a slide counter and optional autoplay.
 *
 * Root: `.carousel`. Parts inside it, found by `data-carousel-<part>`:
 * `track` (required, its children are the slides), `footer` (required,
 * hidden until script runs), and optionally `prev`, `next`, `pips` (with a
 * `template[data-carousel-pip]` holding one pip button), `index`, `total`
 * and `status` (a live region). A `.carousel__pause` button and
 * `data-autoplay="<seconds>"` on the root turn rotation on.
 */
import { behaviour } from "./behaviour.ts";
import { bindAutoplay } from "./carousel/autoplay.ts";
import { bindPips } from "./carousel/pips.ts";
import { bindTrack } from "./carousel/track.ts";

const pad = (n: number) => String(n).padStart(2, "0");

const carousel = behaviour(".carousel", (root, signal) => {
    const part = (name: string) =>
        root.querySelector<HTMLElement>(`[data-carousel-${name}]`);
    const items = part("track");
    const footer = part("footer");
    if (!items?.children.length || !footer) return;

    const track = bindTrack(items, signal);
    footer.hidden = false;

    const pips = part("pips");
    if (pips) bindPips(pips, track, signal);

    const prev = part("prev");
    const next = part("next");
    prev?.addEventListener("click", () => track.goTo(track.current - 1), {
        signal,
    });
    next?.addEventListener("click", () => track.goTo(track.current + 1), {
        signal,
    });

    const index = part("index");
    const total = part("total");
    const status = part("status");
    if (total) total.textContent = pad(track.count);
    let first = true;
    track.onChange((current) => {
        prev?.setAttribute("aria-disabled", String(current === 0));
        next?.setAttribute(
            "aria-disabled",
            String(current === track.count - 1),
        );
        if (index) index.textContent = pad(current + 1);
        // Not on load: only a change is news.
        if (status && !first) {
            status.textContent = `Slide ${current + 1} of ${track.count}`;
        }
        first = false;
    });

    const pause = root.querySelector<HTMLElement>(".carousel__pause");
    if (pause && pips)
        bindAutoplay(root, track, { pause, timer: pips, status, signal });

    return () => {
        footer.hidden = true;
    };
});

export const initCarousel = carousel.init;
export const initCarousels = carousel.initAll;
