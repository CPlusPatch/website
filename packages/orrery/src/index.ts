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
import { createCrumbs } from "./ui/crumbs.ts";
import { h } from "./ui/dom.ts";
import { createInspector, type Inspector } from "./ui/inspector.ts";
import { createKeys } from "./ui/keys.ts";
import { createNotices } from "./ui/notices.ts";
import { createScenarios } from "./ui/scenario-menu.ts";
import { createSearch, type Search } from "./ui/search.ts";
import { bindShortcuts } from "./ui/shortcuts.ts";
import { createTimeBar } from "./ui/time-bar.ts";
import { createUnits } from "./units.ts";
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
    const units = createUnits();

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

    // Below this width the inspector becomes a sheet.
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

    // Set once the top bar is filled, after the first build.
    let search: Search | null = null;
    // Replaced with the view on each scenario.
    let inspector: Inspector | null = null;

    // The view and the panels that depend on the scenario.
    const build = (): (() => void) | null => {
        const view = createView(container, world, blocked, band);
        if (!view) return null;

        const current = createInspector(
            world,
            units,
            () => search?.toggle.focus(),
            view.ghost,
        );
        inspector = current;
        root.querySelector(".orrery__panel--right")?.append(current.element);

        return () => {
            if (inspector === current) inspector = null;
            current.destroy();
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
                notices.destroy();
            },
        };
    }

    for (const panel of panels) panel.hidden = false;

    const timeBar = createTimeBar(world, storage);
    root.querySelector(".orrery__panel--bottom")?.append(timeBar.element);
    // The page has the spacer between them. The notices come last.
    const crumbs = createCrumbs(world);
    const keys = createKeys();
    const openAdd = (name?: string) => {
        // The keys card hides the orbit card, so the form wouldn't show.
        keys.close();
        inspector?.openAdd(name);
    };
    // The search panel isn't in a .orrery__panel, so it covers the scene without moving the labels.
    search = createSearch(root, world, units, openAdd);
    top?.prepend(crumbs.element, search.toggle);
    const scenarios = createScenarios(root, world, storage, () => openAdd());
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

    const unbind = bindShortcuts(world, units, {
        closeKeys: keys.close,
        goLive: timeBar.goLive,
        openSearch: search.open,
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
            live.remove();
            unbind();
            scenarios.destroy();
            search?.destroy();
            timeBar.destroy();
            crumbs.destroy();
            keys.destroy();
            notices.destroy();
            destroyParts?.();
            for (const panel of panels) panel.hidden = true;
        },
    };
};
