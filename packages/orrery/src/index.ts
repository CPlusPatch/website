/**
 * @module
 * The Orrery, an interactive model of the solar system drawn with three.js.
 */

import { alertClasses, alertPrefix } from "@cpluspatch/ui/components/alert.ts";
import { reducedMotion } from "@cpluspatch/ui/lib/motion.ts";
import { announcement } from "./announce.ts";
import { Clock, DEFAULT_RATE } from "./clock.ts";
import {
    decodeScenario,
    hashPayload,
    openScenario,
    type SavedStorage,
    startTime,
    writeSaved,
} from "./persistence.ts";
import { type BodyList, createBodyList } from "./ui/body-list.ts";
import { createCrumbs } from "./ui/crumbs.ts";
import { h } from "./ui/dom.ts";
import { createInspector } from "./ui/inspector.ts";
import { createKeys } from "./ui/keys.ts";
import { createNotices } from "./ui/notices.ts";
import { createScenarios } from "./ui/scenario-menu.ts";
import { bindShortcuts } from "./ui/shortcuts.ts";
import { createTimeBar } from "./ui/time-bar.ts";
import type { Band, Rect } from "./view/geometry.ts";
import { createView } from "./view/scene.ts";
import { World } from "./world.ts";

/** A mounted Orrery. */
export type Orrery = {
    /** Centres the view on a body. */
    focus: (id: string) => void;
    /** Selects a body, or clears the selection with `null`. */
    select: (id: string | null) => void;
    destroy: () => void;
};

/** How long the autosave waits for more changes, in ms. */
const SAVE_DELAY_MS = 500;

/**
 * The width in px at and below which the narrow layout applies. Keep in step with the narrow
 * queries under `styles/`.
 */
const NARROW_QUERY = "(max-width: 720px)";

/** The browser's `localStorage`, which can throw on any access. */
const storage: SavedStorage = {
    getItem: (key) => localStorage.getItem(key),
    setItem: (key, value) => localStorage.setItem(key, value),
};

const webglAlert = (): HTMLElement =>
    h(
        "div",
        {
            class: alertClasses({ variant: "warning" }).join(" "),
            role: "status",
        },
        h(
            "div",
            { class: "content" },
            h(
                "span",
                { class: "visually-hidden" },
                alertPrefix("warning") ?? "",
            ),
            " WebGL isn't available, so the model can't be drawn.",
        ),
    );

/** Draws the Orrery into the `.orrery` root of `src/pages/orbits.astro`. */
export const mount = async (root: HTMLElement): Promise<Orrery> => {
    const container = root.querySelector<HTMLElement>(".orrery__canvas");
    if (!container) throw new Error("The Orrery needs a .orrery__canvas.");

    const opened = await openScenario(location.hash, storage);
    const clock = new Clock(
        startTime(opened.scenario),
        DEFAULT_RATE,
        reducedMotion(),
    );
    const world = new World(opened.scenario, clock);

    const panels = root.querySelectorAll<HTMLElement>(".orrery__panel");
    const top = root.querySelector<HTMLElement>(".orrery__panel--top");
    const bottom = root.querySelector<HTMLElement>(".orrery__panel--bottom");

    // Created before the view, so a screen reader watches it before its text changes.
    const live = h("div", {
        class: "visually-hidden",
        "aria-live": "polite",
        "aria-atomic": "true",
    });
    root.append(live);

    // The cards on top of the canvas, in px from its top left.
    const blocked = (): Rect[] => {
        const origin = container.getBoundingClientRect();
        const rects: Rect[] = [];

        for (const card of root.querySelectorAll(
            ".orrery__panel > :not([hidden])",
        )) {
            const box = card.getBoundingClientRect();
            // Hidden cards have no box.
            if (box.width === 0 || box.height === 0) continue;

            rects.push({
                left: box.left - origin.left,
                top: box.top - origin.top,
                right: box.right - origin.left,
                bottom: box.bottom - origin.top,
            });
        }

        return rects;
    };

    // Below this width the body list moves into the top bar and the inspector into a sheet.
    const narrow = matchMedia(NARROW_QUERY);

    // Between the top bar and the time bar, or the sheet that sits on it.
    const band = (): Band => {
        const origin = container.getBoundingClientRect();
        const free = { top: 0, bottom: origin.height };
        const below = narrow.matches
            ? ".orrery__panel--bottom > :not([hidden]), .orrery__panel--right > :not([hidden])"
            : ".orrery__panel--bottom > :not([hidden])";

        for (const card of root.querySelectorAll(
            ".orrery__panel--top > :not([hidden])",
        )) {
            const box = card.getBoundingClientRect();
            if (box.height > 0) {
                free.top = Math.max(free.top, box.bottom - origin.top);
            }
        }
        for (const card of root.querySelectorAll(below)) {
            const box = card.getBoundingClientRect();
            if (box.height > 0) {
                free.bottom = Math.min(free.bottom, box.top - origin.top);
            }
        }

        return free;
    };
    let bodyList: BodyList | null = null;
    const placeBodyList = () => {
        if (!bodyList) return;

        // Otherwise widening leaves the Bodies menu open and empty.
        if (!narrow.matches) {
            bodyList.element
                .closest<HTMLElement>("[popover]:popover-open")
                ?.hidePopover();
        }
        // Moving the list, or hiding the Bodies button, would drop focus to <body>.
        const active = document.activeElement;
        const inList = bodyList.element.contains(active);
        const onMenu = !!active?.closest(".orrery__bodies-menu");

        bodyList.embed(narrow.matches);
        root.querySelector(
            narrow.matches ? "[data-orrery-bodies]" : ".orrery__panel--left",
        )?.append(bodyList.element);
        root.querySelector(".orrery__inspector-body")?.scrollTo(0, 0);

        if (!inList && !onMenu) return;
        const target = narrow.matches
            ? root.querySelector(".orrery__bodies-menu .dropdown__trigger")
            : inList
              ? active
              : bodyList.element.querySelector("button");
        if (target instanceof HTMLElement) target.focus();
    };
    narrow.addEventListener("change", placeBodyList);

    // The view and the panels that depend on the scenario.
    const build = (): (() => void) | null => {
        const view = createView(container, world, blocked, band);
        if (!view) return null;

        const list = createBodyList(world);
        bodyList = list;
        placeBodyList();
        const inspector = createInspector(
            world,
            (id) => list.focusRow(id),
            view.ghost,
        );
        root.querySelector(".orrery__panel--right")?.append(inspector.element);

        return () => {
            list.destroy();
            bodyList = null;
            inspector.destroy();
            view.destroy();
        };
    };

    // Drops the share link from the address bar, so a reload opens the saved copy.
    const stripHash = () => {
        history.replaceState(null, "", location.pathname + location.search);
    };

    const notices = createNotices(root);
    if (hashPayload(location.hash) !== null) stripHash();

    let destroyParts = build();
    if (!destroyParts) {
        const alert = webglAlert();
        // The top panel stays hidden, so the notice goes beside the alert.
        container.append(alert, notices.element);
        if (opened.notice) notices.show("warning", opened.notice);

        return {
            focus: () => {},
            select: () => {},
            destroy: () => {
                alert.remove();
                live.remove();
                narrow.removeEventListener("change", placeBodyList);
                notices.destroy();
            },
        };
    }

    for (const panel of panels) panel.hidden = false;

    const timeBar = createTimeBar(world, storage);
    root.querySelector(".orrery__panel--bottom")?.append(timeBar.element);
    // The page has the spacer and the dropdowns between them. The notices come last.
    const crumbs = createCrumbs(world);
    const keys = createKeys();
    top?.prepend(crumbs.element);
    const scenarios = createScenarios(root, world, storage);
    top?.append(scenarios.toggle, keys.toggle, notices.element);
    root.querySelector(".orrery__panel--right")?.append(keys.card);
    // The side panels sit between the top and bottom ones, which wrap to different heights.
    const measure = new ResizeObserver(() => {
        if (top) {
            root.style.setProperty(
                "--orrery-top-space",
                `${top.offsetHeight}px`,
            );
        }
        if (bottom) {
            root.style.setProperty(
                "--orrery-bottom-space",
                `${bottom.offsetHeight}px`,
            );
        }
    });
    for (const panel of [top, bottom]) if (panel) measure.observe(panel);

    const unbind = bindShortcuts(world, {
        closeKeys: keys.close,
        goLive: timeBar.goLive,
        toggleDate: timeBar.toggleDate,
    });

    const save = () => {
        writeSaved(storage, { ...world.scenario, time: world.clock.t });
    };

    let saveTimer: ReturnType<typeof setTimeout> | undefined;
    const saveNow = () => {
        clearTimeout(saveTimer);
        saveTimer = undefined;
        save();
    };
    const saveSoon = () => {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(saveNow, SAVE_DELAY_MS);
    };

    // A running clock emits nothing, so its time is saved when the page goes.
    const onVisibility = () => {
        if (document.visibilityState === "hidden") saveNow();
    };

    // Each load takes an id, so a decode that finishes late can tell it's stale.
    let loadId = 0;

    const off = world.on((event) => {
        if (event.type === "scenario") {
            // Any new scenario, even an Import or Reset, cancels a pending link.
            loadId++;
            destroyParts?.();
            destroyParts = build();
            if (!destroyParts) {
                notices.show("destructive", "The model can't be drawn.");
            }
        }
        // The keys card hides the orbit card, so a new pick would show nothing.
        if (event.type === "selection" && event.id !== null) keys.close();

        // A rebuilt scenario isn't announced, as its view is new.
        const message = announcement(event, world.scenario.bodies);
        if (message !== null) live.textContent = message;

        // Neither is saved, so they don't need a write.
        if (event.type !== "selection" && event.type !== "focus") saveSoon();
    });

    let destroyed = false;
    const loadHash = async () => {
        const payload = hashPayload(location.hash);
        if (payload === null) return;

        stripHash();

        const id = ++loadId;
        const result = await decodeScenario(payload);
        if (destroyed || id !== loadId) return;

        if (!result.ok) {
            notices.show(
                "destructive",
                "The shared link isn't a valid scenario, so nothing changed.",
            );
            return;
        }

        world.load(result.scenario, startTime(result.scenario));
        saveNow();
    };
    const onHashChange = () => void loadHash();

    window.addEventListener("hashchange", onHashChange);
    window.addEventListener("pagehide", saveNow);
    document.addEventListener("visibilitychange", onVisibility);

    if (opened.source === "link") saveNow();
    if (opened.notice) notices.show("warning", opened.notice);

    return {
        focus: (id) => world.focus(id),
        select: (id) => world.select(id),
        destroy: () => {
            destroyed = true;
            if (saveTimer !== undefined) saveNow();
            window.removeEventListener("hashchange", onHashChange);
            window.removeEventListener("pagehide", saveNow);
            document.removeEventListener("visibilitychange", onVisibility);
            off();
            measure.disconnect();
            root.style.removeProperty("--orrery-top-space");
            root.style.removeProperty("--orrery-bottom-space");
            narrow.removeEventListener("change", placeBodyList);
            live.remove();
            unbind();
            scenarios.destroy();
            timeBar.destroy();
            crumbs.destroy();
            keys.destroy();
            notices.destroy();
            destroyParts?.();
            for (const panel of panels) panel.hidden = true;
        },
    };
};
