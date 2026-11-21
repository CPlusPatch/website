/**
 * @module
 * The Orrery, an interactive model of the solar system drawn with three.js.
 */

import { alertClasses, alertPrefix } from "@cpluspatch/ui/components/alert.ts";
import { reducedMotion } from "@cpluspatch/ui/lib/motion.ts";
import { Clock, DEFAULT_RATE } from "./clock.ts";
import {
    decodeScenario,
    hashPayload,
    openScenario,
    type SavedStorage,
    startTime,
    writeSaved,
} from "./persistence.ts";
import { createBodyList } from "./ui/body-list.ts";
import { h } from "./ui/dom.ts";
import { createInspector } from "./ui/inspector.ts";
import { createNotices } from "./ui/notices.ts";
import { bindScenarioMenu } from "./ui/scenario-menu.ts";
import { bindShortcuts } from "./ui/shortcuts.ts";
import { createTimeBar } from "./ui/time-bar.ts";
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
    const top = root.querySelector(".orrery__panel--top");

    // The view and the panels that depend on the scenario.
    const build = (): (() => void) | null => {
        const view = createView(container, world);
        if (!view) return null;

        const bodyList = createBodyList(world);
        root.querySelector(".orrery__panel--left")?.append(bodyList.element);
        const inspector = createInspector(
            world,
            (id) => bodyList.focusRow(id),
            view.ghost,
        );
        root.querySelector(".orrery__panel--right")?.append(inspector.element);

        return () => {
            bodyList.destroy();
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
                notices.destroy();
            },
        };
    }

    for (const panel of panels) panel.hidden = false;

    const timeBar = createTimeBar(world);
    root.querySelector(".orrery__panel--bottom")?.append(timeBar.element);
    top?.append(notices.element);
    const unbind = bindShortcuts(world);
    const unbindMenu = bindScenarioMenu(root, world, notices);

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
            unbind();
            unbindMenu();
            timeBar.destroy();
            notices.destroy();
            destroyParts?.();
            for (const panel of panels) panel.hidden = true;
        },
    };
};
