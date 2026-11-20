/**
 * A window manager for a desktop of <Window>s. It turns the plain sections
 * into draggable, resizable windows that stack, open and close, and undoes
 * all of it on cleanup. Placing and clamping are in lib/window-layout.ts.
 *
 * Root: `.window-manager`, the desktop. Its direct `.window` children, each
 * with an `id`, are the windows. A `<a href="#id">` anywhere on the page
 * opens or raises the window with that id. At the start only the windows
 * marked `data-window-open` are open (the first one if none is), side by
 * side, the first in the document on top. Every other window starts
 * closed. If the URL's hash names a window, that one is open too, on top,
 * and has focus.
 *
 * Not in `initAll`: it changes how the whole desktop lays out, so a page
 * opts in, and only where there is room for windows.
 */
import {
    arrange,
    clamp,
    DEFAULT_CASCADE,
    place,
    type Rect,
    raise,
    remove,
    reveal,
    type Size,
    type Stack,
    top,
} from "../lib/window-layout.ts";
import { behaviour } from "./behaviour.ts";

type Managed = {
    id: string;
    el: HTMLElement;
    title: HTMLElement | null;
    body: HTMLElement | null;
    close: HTMLElement | null;
    /** What was there before, to put back on cleanup. */
    was: {
        framed: boolean;
        hidden: boolean;
        bodyTabindex: boolean;
        bodyRole: boolean;
        bodyLabel: boolean;
    };
};

type Drag = {
    id: string;
    pointerId: number;
    /** The pointer and the window where the drag began. */
    from: { x: number; y: number; rect: Rect };
};

/** The id a hash or `#href` names, or "" if it isn't valid percent-encoding. */
const idOf = (hash: string) => {
    try {
        return decodeURIComponent(hash.slice(1));
    } catch {
        return "";
    }
};

/** `focusVisible` is in Chromium and Firefox, but not yet in TypeScript's DOM types. */
type FocusOptionsWithVisible = FocusOptions & { focusVisible?: boolean };

const EDITABLE = "input, textarea, select, [contenteditable]";

const windowManager = behaviour(".window-manager", (root, signal) => {
    const managed = new Map<string, Managed>();
    for (const el of root.querySelectorAll<HTMLElement>(":scope > .window")) {
        if (!el.id) continue;
        const body = el.querySelector<HTMLElement>(":scope > .window__body");
        managed.set(el.id, {
            id: el.id,
            el,
            title: el.querySelector<HTMLElement>(".window__title"),
            body,
            close: el.querySelector<HTMLElement>(".window__close"),
            was: {
                framed: el.classList.contains("window--framed"),
                hidden: el.hasAttribute("hidden"),
                bodyTabindex: body?.hasAttribute("tabindex") ?? false,
                bodyRole: body?.hasAttribute("role") ?? false,
                bodyLabel: body?.hasAttribute("aria-labelledby") ?? false,
            },
        });
    }
    if (!managed.size) return;

    let stack: Stack = [];
    // Where each open window is meant to be: where it was placed, or the
    // reader dragged or resized it to. Only those change it. A smaller desk
    // never does, so a bigger one gives the windows back.
    const rects = new Map<string, Rect>();
    // Where each is now: the same, unless a smaller desk moved or shrank it.
    const shown = new Map<string, Rect>();
    // What `render` last wrote as a pixel size, to tell the reader's resize apart.
    const drawn = new Map<string, Size>();
    // Windows whose size is written as pixels: shrunk when placed, or resized.
    const sized = new Set<string>();
    let drag: Drag | undefined;
    // Whether a window was opened, closed, moved or resized since the start.
    // Until then, the desk resizing lays out the opening windows afresh.
    let touched = false;
    // Whether a pointer press is under way, or just was, so a focus it causes
    // isn't taken for the keyboard's.
    let pressed = false;
    let cascade = DEFAULT_CASCADE;
    // Whether the root's tabindex is ours to remove.
    let rootTabindex = false;

    const desk = () => ({ width: root.clientWidth, height: root.clientHeight });

    /** The margin the stylesheet asks for, in pixels, if it sets one. */
    const margin = () => {
        const probe = document.createElement("div");
        probe.style.cssText =
            "position:absolute;visibility:hidden;inline-size:var(--window-margin, 0px)";
        root.append(probe);
        const width = probe.offsetWidth;
        probe.remove();

        return width || DEFAULT_CASCADE.origin.x;
    };

    const render = () => {
        const active = top(stack);

        for (const { id, el } of managed.values()) {
            const rect = shown.get(id);
            el.hidden = !rect;
            el.classList.toggle("window--active", !!rect && id === active);
            if (!rect) {
                el.style.removeProperty("--window-max-width");
                el.style.removeProperty("--window-max-height");
                continue;
            }

            el.style.zIndex = String(stack.indexOf(id) + 1);
            el.style.setProperty("--window-x", `${rect.x}px`);
            el.style.setProperty("--window-y", `${rect.y}px`);
            // The room to the desk's far edges, less the margin, so resizing
            // stops where placement and drag do. Not less than it is now: a
            // window dragged partly off the desk keeps its size.
            const gap = cascade.origin;
            el.style.setProperty(
                "--window-max-width",
                `${Math.max(desk().width - gap.x - rect.x, rect.width)}px`,
            );
            el.style.setProperty(
                "--window-max-height",
                `${Math.max(desk().height - gap.y - rect.y, rect.height)}px`,
            );
            // A window shrunk by the desk needs a size too, but isn't sized.
            const meant = rects.get(id);
            const fixed =
                sized.has(id) ||
                meant?.width !== rect.width ||
                meant?.height !== rect.height;
            el.style.width = fixed ? `${rect.width}px` : "";
            el.style.height = fixed ? `${rect.height}px` : "";
            if (fixed)
                drawn.set(id, { width: rect.width, height: rect.height });
            else drawn.delete(id);
        }
    };

    /** Sets where a window is meant to be, and shows it there. */
    const setRect = (id: string, rect: Rect) => {
        rects.set(id, rect);
        shown.set(id, rect);
    };

    /**
     * Puts focus on a window's title. A pointer press passes `visible: false`
     * so it draws no ring, like a click on a button. Keys and links keep it.
     */
    const focusTitle = (id: string, visible = true) => {
        const options: FocusOptionsWithVisible = {
            preventScroll: true,
            focusVisible: visible,
        };
        managed.get(id)?.title?.focus(options);
    };

    /** Shows a closed window and measures it at its natural size. */
    const measure = (id: string): Size => {
        const el = managed.get(id)?.el;
        if (!el) return { width: 0, height: 0 };

        el.hidden = false;
        el.style.width = "";
        el.style.height = "";
        // The room left to the desk's edges, from where it was.
        el.style.removeProperty("--window-max-width");
        el.style.removeProperty("--window-max-height");

        return { width: el.offsetWidth, height: el.offsetHeight };
    };

    /** Records a new window's rect, and whether it was shrunk from `size`. */
    const add = (id: string, rect: Rect, size: Size) => {
        if (rect.width !== size.width || rect.height !== size.height) {
            sized.add(id);
        }
        setRect(id, rect);
    };

    /** Opens the window if it's closed, and puts it on top. */
    const open = (id: string) => {
        if (!managed.has(id)) return;

        if (!rects.has(id)) {
            const size = measure(id);
            // From bottom to top, so the last one is the top window.
            const others = stack.flatMap((w) => shown.get(w) ?? []);

            add(id, place(size, desk(), others, cascade), size);
            touched = true;
        }
        stack = raise(stack, id);
    };

    /**
     * Takes a window's id out of the URL once it's no longer the top one, so
     * a reload or a re-init doesn't bring it back.
     */
    const dropStaleHash = () => {
        const id = idOf(location.hash);
        if (!managed.has(id) || id === top(stack)) return;

        history.replaceState(null, "", location.pathname + location.search);
    };

    /** Raises a window the reader worked in. Focus is already there. */
    const touch = (target: EventTarget | null) => {
        const id = target instanceof Element ? windowOf(target) : undefined;
        if (!id || top(stack) === id) return;

        stack = raise(stack, id);
        render();
        dropStaleHash();
    };

    /** The id of the managed window holding `el`. */
    const windowOf = (el: Element) => {
        const win = el.closest<HTMLElement>(".window");
        return win && managed.get(win.id)?.el === win ? win.id : undefined;
    };

    /**
     * Moves a window fully onto the desk, inside the margins, and makes that
     * where it's meant to be. Tab and links can reach the parts of a window
     * dragged off the desk, which the desk's clip stops the page scrolling to.
     * The size it's meant to have is kept.
     */
    const bringIn = (id: string) => {
        const meant = rects.get(id);
        const current = shown.get(id);
        if (!meant || !current) return;

        const next = reveal(meant, desk(), cascade);
        if (next.x === current.x && next.y === current.y) return;

        shown.set(id, next);
        rects.set(id, { ...meant, x: next.x, y: next.y });
        touched = true;
    };

    const show = (id: string, visible = true) => {
        open(id);
        bringIn(id);
        render();
        focusTitle(id, visible);
    };

    /** Closes a window. `visible` is whether focus shows a ring, as for a key. */
    const close = (id: string, visible = true) => {
        const win = managed.get(id);
        if (!win) return;

        if (drag?.id === id) {
            drag = undefined;
            win.el.classList.remove("window--dragging");
        }
        stack = remove(stack, id);
        rects.delete(id);
        shown.delete(id);
        drawn.delete(id);
        sized.delete(id);
        touched = true;
        render();
        win.el.style.width = "";
        win.el.style.height = "";

        const next = top(stack);
        if (next) {
            focusTitle(next, visible);
        } else {
            if (!root.hasAttribute("tabindex")) {
                root.tabIndex = -1;
                rootTabindex = true;
            }
            root.focus({ preventScroll: true });
        }
        dropStaleHash();
    };

    // Set up
    root.classList.add("window-manager--on");
    const gap = margin();
    cascade = { ...DEFAULT_CASCADE, origin: { x: gap, y: gap } };
    for (const { el, body, close: button } of managed.values()) {
        el.classList.add("window--framed");
        if (button) button.hidden = false;
        if (body && !body.hasAttribute("tabindex")) body.tabIndex = 0;
        // A focusable body needs a name: the path, not the title, which would
        // double the region's name.
        const pathId = el.querySelector(".window__path")?.id;
        if (body && pathId) {
            if (!body.hasAttribute("role")) body.setAttribute("role", "group");
            if (!body.hasAttribute("aria-labelledby")) {
                body.setAttribute("aria-labelledby", pathId);
            }
        }
    }

    // Side by side in document order, then stacked with the first on top.
    const all = [...managed.keys()];
    const marked = all.filter((id) =>
        managed.get(id)?.el.hasAttribute("data-window-open"),
    );
    const first = marked.length ? marked : all.slice(0, 1);
    /** Measures the opening windows and lays them out, as at the start. */
    const arrangeFirst = () => {
        for (const id of first) sized.delete(id);

        // From bottom to top: the first in the document is on top.
        const order = [...first].reverse();
        const sizes = order.map(measure);
        const placed = arrange(sizes, desk(), cascade);
        for (const [i, id] of order.entries()) add(id, placed[i], sizes[i]);
    };
    arrangeFirst();
    for (const id of [...first].reverse()) stack = raise(stack, id);

    const linked = idOf(location.hash);
    if (managed.has(linked)) open(linked);
    render();
    // Focus stays where it is at load, unless the URL names a window. The
    // browser scrolls to the fragment as the page finishes loading, and that
    // moves focus to the (then hidden) target, so wait until it has.
    if (managed.has(linked)) {
        if (document.readyState === "complete") {
            focusTitle(linked);
        } else {
            addEventListener("load", () => focusTitle(linked), {
                once: true,
                signal,
            });
        }
    }

    // The native resize handle sits on the window's own box, not its bar or body.
    root.addEventListener(
        "pointerdown",
        (event) => {
            if (
                event.target instanceof Element &&
                windowOf(event.target) &&
                event.target.classList.contains("window")
            ) {
                touched = true;
            }
        },
        { capture: true, signal },
    );

    // Raising
    root.addEventListener("pointerdown", (event) => touch(event.target), {
        capture: true,
        signal,
    });
    root.addEventListener(
        "focusin",
        (event) => {
            // A press on a window partly off the desk mustn't move it, or
            // dragging it couldn't start.
            const id =
                event.target instanceof Element
                    ? windowOf(event.target)
                    : undefined;
            if (id && !pressed) bringIn(id);
            touch(event.target);
            render();
        },
        { signal },
    );
    const press = () => {
        pressed = true;
    };
    // After the press's own events, which include the focus it moves.
    const release = () => setTimeout(() => (pressed = false));
    root.addEventListener("pointerdown", press, { capture: true, signal });
    addEventListener("pointerup", release, { signal });
    addEventListener("pointercancel", release, { signal });
    // A key after a press is the keyboard's.
    addEventListener(
        "keydown",
        () => {
            pressed = false;
        },
        { capture: true, signal },
    );

    // Links
    document.addEventListener(
        "click",
        (event) => {
            if (
                event.defaultPrevented ||
                event.button !== 0 ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey ||
                !(event.target instanceof Element)
            ) {
                return;
            }

            const link =
                event.target.closest<HTMLAnchorElement>('a[href^="#"]');
            const href = link?.getAttribute("href");
            const id = href && idOf(href);
            if (!href || !id || !managed.has(id)) return;

            event.preventDefault();
            const wasOpen = rects.has(id);
            // A click with no pointer, from a key, keeps the focus ring.
            show(id, event.detail === 0);
            if (location.hash !== href) {
                // Raising a window that's already open isn't a place to go back to.
                if (wasOpen) history.replaceState(null, "", href);
                else history.pushState(null, "", href);
            }
        },
        { signal },
    );
    addEventListener(
        "hashchange",
        () => {
            const id = idOf(location.hash);
            if (managed.has(id)) show(id);
        },
        { signal },
    );

    // Closing
    root.addEventListener(
        "click",
        (event) => {
            if (!(event.target instanceof Element)) return;
            if (!event.target.closest(".window__close")) return;

            // A click with no pointer, from a key, keeps the focus ring.
            const id = windowOf(event.target);
            if (id) close(id, event.detail === 0);
        },
        { signal },
    );
    root.addEventListener(
        "keydown",
        (event) => {
            if (event.key !== "Escape" || event.defaultPrevented) return;
            if (!(event.target instanceof Element)) return;
            // Escape in a field is the field's, like cancelling an edit.
            if (event.target.closest(EDITABLE)) return;

            const id = windowOf(event.target);
            if (id) close(id);
        },
        { signal },
    );

    // Dragging
    root.addEventListener(
        "pointerdown",
        (event) => {
            if (event.button !== 0 || !event.isPrimary) return;
            if (!(event.target instanceof Element)) return;

            const bar = event.target.closest<HTMLElement>(".window__bar");
            if (!bar || event.target.closest("button, a, input")) return;

            const id = windowOf(bar);
            const rect = id && shown.get(id);
            if (!id || !rect) return;

            // Focus the title so Escape closes this window. The press would
            // otherwise move focus to the page, so it's cancelled.
            event.preventDefault();
            focusTitle(id, false);

            touched = true;
            bar.setPointerCapture(event.pointerId);
            managed.get(id)?.el.classList.add("window--dragging");
            drag = {
                id,
                pointerId: event.pointerId,
                from: { x: event.clientX, y: event.clientY, rect },
            };
        },
        { signal },
    );
    root.addEventListener(
        "pointermove",
        (event) => {
            if (event.pointerId !== drag?.pointerId) return;

            const { id, from } = drag;
            const meant = rects.get(id);
            if (!meant) return;

            const next = clamp(
                {
                    ...from.rect,
                    x: from.rect.x + event.clientX - from.x,
                    y: from.rect.y + event.clientY - from.y,
                },
                desk(),
            );
            // A window shrunk by the desk keeps the size it's meant to have.
            shown.set(id, next);
            rects.set(id, { ...meant, x: next.x, y: next.y });
            render();
        },
        { signal },
    );
    const drop = (event: PointerEvent) => {
        if (event.pointerId !== drag?.pointerId) return;

        const { id } = drag;
        drag = undefined;
        managed.get(id)?.el.classList.remove("window--dragging");
        render();
    };
    root.addEventListener("pointerup", drop, { signal });
    root.addEventListener("pointercancel", drop, { signal });

    // Resizing
    const deskObserver = new ResizeObserver(() => {
        // Nothing was changed by the reader: lay out as a load at this size would.
        if (!touched) {
            arrangeFirst();
            render();
            return;
        }

        // From where each is meant to be, not where it is now, so the windows
        // come back when the desk does.
        for (const [id, rect] of rects) {
            shown.set(id, reveal(rect, desk(), cascade));
        }
        render();
    });
    deskObserver.observe(root);

    // The native handle writes the window's own width and height as styles, so
    // only note them: rendering here would fight the drag of the handle.
    // It also fires on observe and on our own renders, which is harmless since
    // the size we wrote is skipped. A window with no size of ours is as big as
    // its content, which is what it's meant to be.
    const windowObserver = new ResizeObserver((entries) => {
        for (const { target } of entries) {
            if (!(target instanceof HTMLElement)) continue;

            const meant = rects.get(target.id);
            const written = drawn.get(target.id);
            if (!meant) continue;

            const size = {
                width: target.offsetWidth,
                height: target.offsetHeight,
            };
            const styled = target.style.width || target.style.height;
            const resized =
                styled &&
                (!written ||
                    Math.abs(
                        Number.parseFloat(target.style.width) - written.width,
                    ) > 0.5 ||
                    Math.abs(
                        Number.parseFloat(target.style.height) - written.height,
                    ) > 0.5);
            if (styled && !resized) continue;

            if (resized) {
                sized.add(target.id);
                touched = true;
            }
            const current = shown.get(target.id) ?? meant;
            rects.set(target.id, { ...meant, ...size });
            shown.set(target.id, { ...current, ...size });
        }
    });
    for (const { el } of managed.values()) windowObserver.observe(el);

    return () => {
        deskObserver.disconnect();
        windowObserver.disconnect();

        root.classList.remove("window-manager--on");
        if (rootTabindex) root.removeAttribute("tabindex");
        for (const { el, body, close: button, was } of managed.values()) {
            el.hidden = was.hidden;
            el.classList.remove("window--dragging");
            el.classList.remove("window--active");
            if (!was.framed) el.classList.remove("window--framed");
            el.style.removeProperty("z-index");
            el.style.removeProperty("--window-x");
            el.style.removeProperty("--window-y");
            el.style.removeProperty("width");
            el.style.removeProperty("height");
            el.style.removeProperty("--window-max-width");
            el.style.removeProperty("--window-max-height");
            if (button) button.hidden = true;
            if (body && !was.bodyTabindex) body.removeAttribute("tabindex");
            if (body && !was.bodyRole) body.removeAttribute("role");
            if (body && !was.bodyLabel) body.removeAttribute("aria-labelledby");
            if (!el.getAttribute("style")) el.removeAttribute("style");
        }
    };
});

export const initWindowManager = windowManager.init;
export const initWindowManagers = windowManager.initAll;
