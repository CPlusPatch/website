/**
 * <Stat>: counts its number up from zero the first time it scrolls fully
 * into view, unless it sits inline or the reader prefers reduced motion.
 *
 * Root: `.stat`. Its `.stat__count` holds the text to animate and carries
 * `data-value` (the number), `data-decimals` and `data-locale` (for
 * Intl.NumberFormat).
 */
import { reducedMotion } from "../lib/motion.ts";
import { behaviour } from "./behaviour.ts";

const DURATION = 1500;

// Fast start, slow finish, so the last digits settle rather than stop dead
const easeOut = (t: number) => 1 - (1 - t) ** 4;

const formatter = (el: HTMLElement) =>
    new Intl.NumberFormat(el.dataset.locale, {
        minimumFractionDigits: Number(el.dataset.decimals),
        maximumFractionDigits: Number(el.dataset.decimals),
    });

const stat = behaviour(".stat", (root) => {
    // Inline, the number is a word in a sentence, which shouldn't change
    // under the reader (or read "0k" until it scrolls fully into view)
    if (reducedMotion() || root.classList.contains("stat--inline")) return;
    const el = root.querySelector<HTMLElement>(".stat__count");
    if (!el) return;

    const value = Number(el.dataset.value);
    const format = formatter(el);
    let frame = 0;

    const count = () => {
        // Updating the existing text node's data, rather than replacing it
        // with textContent, avoids a relayout of the whole stat every frame
        const text = el.firstChild as Text;
        let start: number | undefined;
        const step = (now: number) => {
            start ??= now;
            const t = Math.min((now - start) / DURATION, 1);
            text.data = format.format(value * easeOut(t));
            frame = t < 1 ? requestAnimationFrame(step) : 0;
        };
        frame = requestAnimationFrame(step);
    };

    const observer = new IntersectionObserver(
        (entries) => {
            for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                observer.disconnect();
                count();
            }
        },
        { threshold: 1 },
    );

    // Zeroed now rather than when it scrolls in, or stats already on
    // screen would flash their final number first
    el.textContent = format.format(0);
    observer.observe(el);

    return () => {
        observer.disconnect();
        cancelAnimationFrame(frame);
        el.textContent = format.format(value);
    };
});

export const initStat = stat.init;
export const initStats = stat.initAll;
