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
 * With `data-window-list="<id>"` on the root, the element with that id (a
 * `<ul>`, see <Taskbar>) gets one `<li><button>` per open window, in the
 * order they were opened. The top window's button has `aria-current="true"`.
 * A click on it minimises the window if it's on top, and otherwise raises it,
 * or restores it if it was minimised. A minimised window is hidden but keeps
 * its place, and a link to it restores it.
 *
 * With focus on a window's title, the arrow keys move the window and
 * Ctrl with them resizes it (see `KEY_STEP`). The manager adds two hidden
 * elements to the root for screen readers: a hint that describes each title,
 * and a status that says where a key put the window.
 *
 * If the root sets `--window-manager-inset-end`, new windows keep that much
 * clear at the desk's right edge. Dragging and resizing don't.
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
    resize,
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
        /** The title's `aria-describedby`, or null if it had none. */
        titleDescribedby: string | null;
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

/** How far an arrow key moves or resizes a window, in pixels, and with Shift. */
const KEY_STEP = 16;
const KEY_STEP_SHIFT = 64;

const KEY_HINT =
    "Arrow keys move the window, with Shift further. Control and the arrow keys resize it. Escape closes it.";

/** The direction of each arrow key. */
const ARROWS: Record<string, { x: number; y: number } | undefined> = {
    ArrowLeft: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 },
    ArrowUp: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },
};

// Gives each manager's hint an id of its own.
let hints = 0;

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
                titleDescribedby:
                    el
                        .querySelector(".window__title")
                        ?.getAttribute("aria-describedby") ?? null,
            },
        });
    }
    if (!managed.size) return;

    let stack: Stack = [];
    // Where each open window is meant to be: where it was placed, or the
    // reader dragged or resized it to. Only those change it. A smaller desk
    // never does, so a bigger one gives the windows back.
    const rects = new Map<string, Rect>();
    // The open windows that are hidden. They keep their rects and leave the stack.
    const minimised = new Set<string>();
    // The open windows in the order they were opened, for the window list.
    let opened: string[] = [];
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

    /** A length the stylesheet sets on the root, in pixels, or 0 if it doesn't. */
    const length = (property: string) => {
        const probe = document.createElement("div");
        probe.style.cssText = `position:absolute;visibility:hidden;inline-size:var(${property}, 0px)`;
        root.append(probe);
        const width = probe.offsetWidth;
        probe.remove();

        return width;
    };

    /** The margin the stylesheet asks for, in pixels, if it sets one. */
    const margin = () => length("--window-margin") || DEFAULT_CASCADE.origin.x;

    // What new windows leave clear at the desk's right edge, like a column of
    // icons. Only placing keeps off it: a reader may drag a window over it.
    let inset = 0;
    const placing = () => ({
        width: Math.max(desk().width - inset, 0),
        height: desk().height,
    });

    const list = document.getElementById(root.dataset.windowList ?? "");
    const listWasHidden = list?.hidden ?? false;
    const items = new Map<
        string,
        { button: HTMLElement; state: HTMLElement }
    >();

    /** Makes a window's button: its icon, its title, and a note for when it's minimised. */
    const makeItem = (id: string) => {
        const win = managed.get(id);
        if (!win) return;

        const button = document.createElement("button");
        button.type = "button";
        button.className = "taskbar__item";
        button.dataset.window = id;

        const icon = win.el.querySelector(".window__icon")?.cloneNode(true);
        if (icon instanceof SVGElement) {
            icon.setAttribute("class", "taskbar__icon");
            icon.setAttribute("aria-hidden", "true");
            button.append(icon);
        }

        const label = document.createElement("span");
        label.className = "taskbar__label";
        label.textContent = win.title?.textContent?.trim() ?? id;
        // The full title, for when a crowded bar leaves only the icon.
        button.title = label.textContent;

        const state = document.createElement("span");
        state.className = "taskbar__state";
        state.textContent = " (minimised)";
        state.hidden = true;
        button.append(label, state);

        items.set(id, { button, state });
        const li = document.createElement("li");
        li.append(button);
        list?.append(li);
    };

    /** A crowded list scrolls: keeps the top window's button in view. */
    const keepInView = (button: HTMLElement) => {
        if (list && list.scrollWidth > list.clientWidth) {
            button.scrollIntoView({ block: "nearest", inline: "nearest" });
        }
    };

    /** Brings the window list in step with the windows. */
    const renderList = () => {
        if (!list) return;

        for (const [id, item] of items) {
            if (rects.has(id)) continue;

            item.button.closest("li")?.remove();
            items.delete(id);
        }

        const active = top(stack);
        let arrived: HTMLElement | undefined;
        for (const id of opened) {
            if (!items.has(id)) makeItem(id);

            const item = items.get(id);
            if (!item) continue;

            const hidden = minimised.has(id);
            item.button.classList.toggle("taskbar__item--minimised", hidden);
            item.state.hidden = !hidden;
            if (id === active) {
                if (item.button.getAttribute("aria-current") !== "true") {
                    arrived = item.button;
                }
                item.button.setAttribute("aria-current", "true");
            } else item.button.removeAttribute("aria-current");
        }

        // An empty list would be announced as one, so it's hidden.
        list.hidden = items.size === 0;

        if (arrived) keepInView(arrived);
    };

    const render = () => {
        const active = top(stack);

        for (const { id, el } of managed.values()) {
            const rect = shown.get(id);
            const visible = !!rect && !minimised.has(id);
            el.hidden = !visible;
            el.classList.toggle("window--active", visible && id === active);
            // A minimised window keeps its styles, as it comes back as it was.
            if (rect && !visible) continue;
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

        renderList();
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

    /**
     * The narrowest a measured window can be before its content overflows or
     * crops. Not its `min-content` width, which is 0 for a scroll container
     * and so gives back the window's minimum width. Instead the window starts
     * as narrow as it goes and grows by what its scroll containers overflow
     * by, until none does. Content reflows as it widens, so one step isn't
     * always enough. The window goes back to its natural width.
     */
    const floorOf = (id: string) => {
        const el = managed.get(id)?.el;
        const body = el?.querySelector<HTMLElement>(".window__body");
        if (!el || !body) return 0;

        const overflow = () => {
            let most = 0;

            for (const part of [
                body,
                ...body.querySelectorAll<HTMLElement>("*"),
            ]) {
                // Not `hidden`: that crops on purpose, like visually hidden text.
                if (!/auto|scroll/.test(getComputedStyle(part).overflowX)) {
                    continue;
                }

                most = Math.max(most, part.scrollWidth - part.clientWidth);
            }

            return most;
        };

        el.style.width = "min-content";
        let width = el.offsetWidth;
        for (let pass = 0; pass < 6; pass++) {
            const extra = overflow();
            if (extra <= 0) break;

            width += extra;
            el.style.width = `${width}px`;
        }
        el.style.width = "";

        return width;
    };

    /** Records a new window's rect, and whether it was shrunk from `size`. */
    const add = (id: string, rect: Rect, size: Size) => {
        if (rect.width !== size.width || rect.height !== size.height) {
            sized.add(id);
        }
        setRect(id, rect);
    };

    /**
     * Opens the window if it's closed, and puts it on top. `opener` is the
     * window the reader opened it from, if any.
     */
    const open = (id: string, opener?: string) => {
        if (!managed.has(id)) return;

        if (!rects.has(id)) {
            const size = measure(id);
            // From bottom to top, so the last one is the top window.
            const ids = stack.filter((w) => shown.has(w));
            const others = ids.flatMap((w) => shown.get(w) ?? []);
            const from = opener ? ids.indexOf(opener) : -1;

            add(
                id,
                place(
                    size,
                    placing(),
                    others,
                    cascade,
                    from < 0 ? undefined : from,
                ),
                size,
            );
            opened.push(id);
            touched = true;
        }
        minimised.delete(id);
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

    const show = (id: string, visible = true, opener?: string) => {
        open(id, opener);
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
        minimised.delete(id);
        opened = opened.filter((other) => other !== id);
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

    /** Hides a window and takes it out of the stack. Its place is kept. */
    const minimise = (id: string) => {
        const win = managed.get(id);
        if (!win || !rects.has(id) || minimised.has(id)) return;

        if (drag?.id === id) {
            drag = undefined;
            win.el.classList.remove("window--dragging");
        }
        minimised.add(id);
        stack = remove(stack, id);
        touched = true;
        render();
        dropStaleHash();
    };

    // Set up
    root.classList.add("window-manager--on");
    const gap = margin();
    cascade = { ...DEFAULT_CASCADE, origin: { x: gap, y: gap } };
    inset = length("--window-manager-inset-end");
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

    // Both sit outside every window, so `:scope > .window` doesn't find them.
    const hint = document.createElement("div");
    hint.className = "visually-hidden";
    hint.id = `window-manager-hint-${hints++}`;
    hint.textContent = KEY_HINT;
    const status = document.createElement("div");
    status.className = "visually-hidden";
    status.setAttribute("role", "status");
    root.append(hint, status);
    for (const { title, was } of managed.values()) {
        title?.setAttribute(
            "aria-describedby",
            [was.titleDescribedby, hint.id].filter(Boolean).join(" "),
        );
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
        const sizes = order.map((id) => ({
            ...measure(id),
            floor: floorOf(id),
        }));
        const placed = arrange(sizes, placing(), cascade);
        for (const [i, id] of order.entries()) add(id, placed[i], sizes[i]);
    };
    arrangeFirst();
    opened = [...first];
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
            show(id, event.detail === 0, windowOf(event.target));
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

    // The window list
    list?.addEventListener(
        "click",
        (event) => {
            if (!(event.target instanceof Element)) return;

            const id =
                event.target.closest<HTMLElement>("button")?.dataset.window;
            if (!id || !items.has(id)) return;

            // A click with no pointer, from a key, keeps the focus ring.
            const visible = event.detail === 0;
            if (id === top(stack)) {
                minimise(id);
                items.get(id)?.button.focus({ preventScroll: true });
            } else {
                show(id, visible);
                dropStaleHash();
            }
        },
        { signal },
    );

    // The browser only scrolls a focused button in once it's hidden entirely,
    // so this also scrolls one that's partly under an edge fade.
    list?.addEventListener(
        "focusin",
        (event) => {
            if (!(event.target instanceof HTMLElement)) return;
            if (list.scrollWidth <= list.clientWidth) return;

            event.target.scrollIntoView({
                block: "nearest",
                inline: "nearest",
            });
        },
        { signal },
    );

    // A wheel turns vertical scrolling into horizontal, as the list has no
    // vertical scroll of its own. Not at the end it's scrolling toward, so the
    // page isn't trapped.
    list?.addEventListener(
        "wheel",
        (event) => {
            if (event.ctrlKey || event.deltaX !== 0 || event.deltaY === 0)
                return;

            const room = list.scrollWidth - list.clientWidth;
            if (room <= 0) return;

            const unit =
                event.deltaMode === WheelEvent.DOM_DELTA_LINE
                    ? 16
                    : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
                      ? list.clientWidth
                      : 1;
            const delta = event.deltaY * unit;
            const atEnd =
                delta > 0 ? list.scrollLeft >= room - 1 : list.scrollLeft <= 0;
            if (atEnd) return;

            list.scrollLeft += delta;
            event.preventDefault();
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

    // Moving and resizing with the keys
    let announcing = 0;
    /** Says what a key did. The text is cleared first, so the same one is read again. */
    const announce = (text: string) => {
        cancelAnimationFrame(announcing);
        status.textContent = "";
        announcing = requestAnimationFrame(() => {
            status.textContent = text;
        });
    };
    root.addEventListener(
        "keydown",
        (event) => {
            const arrow = ARROWS[event.key];
            if (!arrow || event.altKey || event.metaKey) return;
            if (event.defaultPrevented) return;

            const win = [...managed.values()].find(
                ({ title }) => title === event.target,
            );
            const rect = win && shown.get(win.id);
            const meant = win && rects.get(win.id);
            if (!win || !rect || !meant) return;

            // The page would scroll otherwise.
            event.preventDefault();
            const step = event.shiftKey ? KEY_STEP_SHIFT : KEY_STEP;
            const name = win.title?.textContent?.trim() || win.id;
            const next = event.ctrlKey
                ? resize(
                      rect,
                      { width: arrow.x * step, height: arrow.y * step },
                      desk(),
                      cascade,
                  )
                : clamp(
                      {
                          ...rect,
                          x: rect.x + arrow.x * step,
                          y: rect.y + arrow.y * step,
                      },
                      desk(),
                  );
            const moved =
                next.x !== rect.x ||
                next.y !== rect.y ||
                next.width !== rect.width ||
                next.height !== rect.height;

            if (!moved) {
                announce(
                    `${name} can't ${event.ctrlKey ? "resize" : "move"} further that way`,
                );
                return;
            }

            if (event.ctrlKey) {
                // Like the native handle: a window moved in by a smaller
                // desk keeps the place it's meant to have.
                rects.set(win.id, {
                    ...meant,
                    width: next.width,
                    height: next.height,
                });
                sized.add(win.id);
            } else {
                // A window shrunk by the desk keeps the size it's meant to have.
                rects.set(win.id, { ...meant, x: next.x, y: next.y });
            }
            shown.set(win.id, next);
            touched = true;
            render();

            if (event.ctrlKey) {
                announce(`${name} resized to ${next.width} by ${next.height}`);
            } else {
                announce(`${name} moved to ${next.x}, ${next.y}`);
            }
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

    // A narrower list can push the top window's button out of view.
    const listObserver = new ResizeObserver(() => {
        const current = list?.querySelector<HTMLElement>("[aria-current]");
        if (current) keepInView(current);
    });
    if (list) listObserver.observe(list);

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
            // Hidden, so it has no size to note.
            if (!meant || minimised.has(target.id)) continue;

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
        listObserver.disconnect();
        windowObserver.disconnect();
        cancelAnimationFrame(announcing);
        hint.remove();
        status.remove();

        for (const { button } of items.values()) button.closest("li")?.remove();
        items.clear();
        if (list) list.hidden = listWasHidden;

        root.classList.remove("window-manager--on");
        if (rootTabindex) root.removeAttribute("tabindex");
        for (const {
            el,
            title,
            body,
            close: button,
            was,
        } of managed.values()) {
            if (was.titleDescribedby === null) {
                title?.removeAttribute("aria-describedby");
            } else {
                title?.setAttribute("aria-describedby", was.titleDescribedby);
            }
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
