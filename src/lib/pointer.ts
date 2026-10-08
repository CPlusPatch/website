/**
 * Shared pointer tracking for the fx layers. Importing it is enough: it
 * writes the mouse's client position, in px and unitless, as --pointer-x and
 * --pointer-y on every [data-pointer] element, at most once per frame.
 *
 * Written on the subscribers rather than on :root, because an inherited
 * custom property changed on :root restyles the whole page on every move.
 *
 * Mouse only: touch and pen have no hover position to follow. Leaving the
 * window parks the position far off-screen, as does the CSS starting value
 * each subscriber should declare (`--pointer-x: -9999` and the same for y).
 */

const OFFSCREEN = -9999;

const targets = [...document.querySelectorAll<HTMLElement>("[data-pointer]")];
let x = OFFSCREEN;
let y = OFFSCREEN;
let raf = 0;

const schedule = () => {
    if (!raf) raf = requestAnimationFrame(flush);
};

function flush() {
    raf = 0;
    for (const el of targets) {
        el.style.setProperty("--pointer-x", String(x));
        el.style.setProperty("--pointer-y", String(y));
    }
}

if (targets.length) {
    addEventListener(
        "pointermove",
        (e) => {
            if (e.pointerType !== "mouse") return;
            x = Math.trunc(e.clientX);
            y = Math.trunc(e.clientY);
            schedule();
        },
        { passive: true },
    );

    document.documentElement.addEventListener("mouseleave", () => {
        x = y = OFFSCREEN;
        schedule();
    });
}
