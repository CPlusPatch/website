/**
 * <SidebarNav>'s scroll spy. A link with data-section gets
 * aria-current="location" while its section is the one being read: the last
 * whose top has passed a line a third of the way down the viewport, or, once
 * scrolled to the bottom, the last one in view (short final sections never
 * reach the line). Links the page marked aria-current="page" are left alone.
 *
 * Root: `.sidebar-nav`. Its `a[data-section="<id>"]` links point at sections
 * of the page by id.
 */
import { behaviour } from "./behaviour.ts";

const LINE = 1 / 3;

/** The nearest box the link scrolls within, short of the page itself. */
const scrollerOf = (link: HTMLElement) => {
    for (
        let el = link.parentElement;
        el && el !== document.body;
        el = el.parentElement
    ) {
        if (el.scrollHeight > el.clientHeight) {
            const { overflowY } = getComputedStyle(el);
            if (overflowY === "auto" || overflowY === "scroll") return el;
        }
    }
    return null;
};

/** Scrolls the nav (or whatever it sits in), never the page, to show the link. */
const reveal = (link: HTMLElement) => {
    const scroller = scrollerOf(link);
    if (!scroller) return;
    const box = scroller.getBoundingClientRect();
    const row = link.getBoundingClientRect();
    const pad = row.height * 2;
    if (row.top < box.top + pad) scroller.scrollTop -= box.top + pad - row.top;
    else if (row.bottom > box.bottom - pad)
        scroller.scrollTop += row.bottom - (box.bottom - pad);
};

const sidebarNav = behaviour(".sidebar-nav", (nav, signal) => {
    const entries = [
        ...nav.querySelectorAll<HTMLAnchorElement>("a[data-section]"),
    ].flatMap((link) => {
        const section = document.getElementById(link.dataset.section ?? "");
        return section ? [{ link, section }] : [];
    });
    if (!entries.length) return;

    let active: HTMLAnchorElement | null = null;
    let raf = 0;

    const update = () => {
        raf = 0;
        const line = innerHeight * LINE;
        const atBottom =
            scrollY + innerHeight >= document.documentElement.scrollHeight - 2;

        // Read every position first, then write.
        const tops = entries.map(
            ({ section }) => section.getBoundingClientRect().top,
        );
        let index = -1;
        tops.forEach((top, i) => {
            if (top <= line || (atBottom && top < innerHeight)) index = i;
        });
        const next = index >= 0 ? entries[index].link : null;
        if (next === active) return;

        if (active?.getAttribute("aria-current") === "location")
            active.removeAttribute("aria-current");
        if (next && !next.hasAttribute("aria-current")) {
            next.setAttribute("aria-current", "location");
            reveal(next);
        }
        active = next;
    };

    const schedule = () => {
        if (!raf) raf = requestAnimationFrame(update);
    };

    addEventListener("scroll", schedule, { passive: true, signal });
    addEventListener("resize", schedule, { passive: true, signal });
    update();

    return () => {
        cancelAnimationFrame(raf);
        if (active?.getAttribute("aria-current") === "location")
            active.removeAttribute("aria-current");
    };
});

export const initSidebarNav = sidebarNav.init;
export const initSidebarNavs = sidebarNav.initAll;
