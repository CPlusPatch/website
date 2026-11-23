/**
 * @module
 * The Orrery, an interactive model of the solar system drawn with three.js.
 */

import { alertClasses, alertPrefix } from "@cpluspatch/ui/components/alert.ts";
import { reducedMotion } from "@cpluspatch/ui/lib/motion.ts";
import {
    announcement,
    bareAnnouncement,
    chaseAnnouncement,
    noChaseAnnouncement,
    satelliteAnnouncement,
} from "./announce.ts";
import { cue } from "./audio/cues.ts";
import { createSound } from "./audio/sound.ts";
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
import { createHud } from "./ui/hud.ts";
import { createInspector, type Inspector } from "./ui/inspector/inspector.ts";
import { createKeys } from "./ui/keys.ts";
import { createLoading } from "./ui/loading.ts";
import { createNotices } from "./ui/notices.ts";
import { createSatelliteCard } from "./ui/satellite-card.ts";
import { createSatelliteMenu } from "./ui/satellite-menu.ts";
import { createScenarios } from "./ui/scenario-menu/scenario-menu.ts";
import { createSearch, type Search } from "./ui/search.ts";
import { bindShortcuts } from "./ui/shortcuts.ts";
import { createTimeBar } from "./ui/time-bar.ts";
import { createUnits } from "./units.ts";
import type { Band } from "./view/geometry/framing.ts";
import type { Rect } from "./view/geometry/labels.ts";
import { createView, type View } from "./view/scene.ts";
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

/** How long after mounting the loading state gives way, whatever is still loading, in ms. */
const REVEAL_AFTER_MS = 8000;

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
    let currentView: View | null = null;

    const loading = createLoading(root);

    // Points at the current view, as the menu outlives the views.
    let setSatellites: View["satelliteGroups"] | null = null;
    const satellites = createSatelliteMenu(
        storage,
        (groups) => setSatellites?.(groups),
        // `timeBar` is made below, and the menu only calls this once it's open.
        { now: () => world.clock.t, goLive: () => timeBar.goLive() },
    );
    const hasEarth = () =>
        world.scenario.bodies.some((body) => body.id === "earth");

    // The view and the panels that depend on the scenario. Only the first build reports loading.
    const build = (
        onLoading?: (done: number, total: number, fill: number) => void,
    ): {
        ready: Promise<void>;
        reveal: () => void;
        destroy: () => void;
    } | null => {
        const view = createView(
            container,
            world,
            blocked,
            band,
            units,
            onLoading,
        );
        if (!view) return null;

        setSatellites = view.satelliteGroups;
        view.satelliteGroups(satellites.groups());

        const current = createInspector(
            world,
            units,
            () => search?.toggle.focus(),
            view,
        );
        inspector = current;
        root.querySelector(".orrery__panel--right")?.append(current.element);

        const card = createSatelliteCard(view.satellite, () =>
            search?.toggle.focus(),
        );
        root.querySelector(".orrery__panel--right")?.append(card.element);

        currentView = view;
        view.bare(root.classList.contains("orrery--bare"));
        const offSatellite = view.satellite.on((event) => {
            const k = event.k;
            const name =
                k === null ? null : (view.satellite.facts(k)?.name ?? null);

            if (event.type === "focus") {
                crumbs.setSatellite(
                    k === null || name === null
                        ? null
                        : { name, onClick: () => view.satellite.focus(k) },
                );
            }
            if (event.type === "selection" && k !== null) {
                cue("select");
                // The keys card hides the orbit card, so a new pick would show nothing.
                keys.close();
            }

            // A body pick clears the satellite, and the world's "Selected ..." follows or comes first.
            if (
                event.type === "selection" &&
                k === null &&
                world.selected !== null
            ) {
                return;
            }

            const message = satelliteAnnouncement(event, name);
            if (message !== null) live.textContent = message;
        });

        let wasChasing = view.chasing();
        const offChase = view.onChase(({ chasing }) => {
            if (chasing === wasChasing) return;

            wasChasing = chasing;

            const k = view.satellite.focused();
            const name =
                (k === null ? null : view.satellite.facts(k)?.name) ??
                world.scenario.bodies.find((body) => body.id === world.focused)
                    ?.name ??
                world.focused;
            live.textContent = chaseAnnouncement(chasing, name);
        });

        const hudSlot = root.querySelector<HTMLElement>(".orrery__panel--hud");
        const removeHud = hudSlot
            ? createHud(hudSlot, view, units, narrow)
            : () => {};

        return {
            ready: view.ready,
            reveal: view.reveal,
            destroy: () => {
                if (inspector === current) inspector = null;
                if (currentView === view) {
                    currentView = null;
                    crumbs.setSatellite(null);
                }
                offSatellite();
                offChase();
                card.destroy();
                if (setSatellites === view.satelliteGroups) {
                    setSatellites = null;
                }
                removeHud();
                current.destroy();
                view.destroy();
            },
        };
    };

    // Drops the share link from the address bar, so a reload opens the saved copy.
    const stripHash = () => {
        history.replaceState(null, "", location.pathname + location.search);
    };

    const notices = createNotices(root);
    if (hashPayload(location.hash) !== null) stripHash();

    let parts = build(loading.progress);
    if (!parts) {
        loading.reveal();
        const alert = webglAlert();
        // The top panel stays hidden, so the notice goes beside the alert.
        container.append(alert, notices.element);
        if (opened.notice) notices.show("warning", opened.notice);

        return {
            focus: () => {},
            select: () => {},
            destroy: () => {
                satellites.destroy();
                alert.remove();
                live.remove();
                notices.destroy();
            },
        };
    }

    // Shown under the loading state, so the first frames are framed beside them.
    for (const panel of panels) {
        panel.hidden = false;
        panel.inert = true;
    }
    container.inert = true;

    const sound = createSound(storage);
    const timeBar = createTimeBar(world, storage, sound);
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
    top?.append(
        scenarios.toggle,
        satellites.element,
        keys.toggle,
        notices.element,
    );
    satellites.setAvailable(hasEarth());
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

    const setBare = (bare: boolean) => {
        if (root.classList.contains("orrery--bare") === bare) return;

        // Focus on a hidden control would fall to the body.
        if (bare && document.activeElement?.closest(".orrery__panel")) {
            // A focus ring around the whole view would spoil it.
            container.querySelector("canvas")?.focus({ focusVisible: false });
        }

        root.classList.toggle("orrery--bare", bare);
        currentView?.bare(bare);
        live.textContent = bareAnnouncement(bare);
    };
    // Shortcuts that open a panel's control show the interface first.
    const showInterface = () => setBare(false);

    const unbind = bindShortcuts(world, units, {
        closeKeys: keys.close,
        clearSatellite: () => {
            const satellite = currentView?.satellite;
            if (!satellite || satellite.selected() === null) return false;

            satellite.select(null);

            return true;
        },
        focusSatellite: () => {
            const satellite = currentView?.satellite;
            const k = satellite?.selected() ?? null;
            if (!satellite || k === null) return false;

            satellite.focus(k);

            return true;
        },
        goLive: timeBar.goLive,
        openSearch: () => {
            showInterface();
            search.open();
        },
        toggleChase: () => {
            const view = currentView;
            if (!view) return;

            if (view.canChase()) {
                view.chase(!view.chasing());
            } else {
                const name =
                    world.scenario.bodies.find(
                        (body) => body.id === world.focused,
                    )?.name ?? world.focused;
                live.textContent = noChaseAnnouncement(name);
            }
        },
        toggleBare: () => setBare(!root.classList.contains("orrery--bare")),
        toggleDate: () => {
            showInterface();
            timeBar.toggleDate();
        },
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
            parts?.destroy();
            parts = build();
            satellites.setAvailable(hasEarth());
            // A view built after the reveal has no loading state, so a sky that comes later fades in.
            if (revealed) parts?.reveal();
            else if (parts) revealWhenReady(parts);
            if (!parts) {
                notices.show("destructive", "The model can't be drawn.");
            }
        }
        if (event.type === "selection" && event.id !== null) cue("select");
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

        cue("load");
        world.load(result.scenario, startTime(result.scenario));
        saveNow();
    };
    const onHashChange = () => void loadHash();

    window.addEventListener("hashchange", onHashChange);
    window.addEventListener("pagehide", saveNow);
    document.addEventListener("visibilitychange", onVisibility);

    if (opened.source === "link") saveNow();
    if (opened.notice) notices.show("warning", opened.notice);

    let revealed = false;
    // A destroyed view's ready resolves too, so only the current one reveals.
    const revealWhenReady = (built: NonNullable<typeof parts>) => {
        void built.ready.then(() => {
            if (parts === built) reveal();
        });
    };
    const reveal = () => {
        if (revealed || destroyed) return;

        revealed = true;
        clearTimeout(revealTimer);
        for (const panel of panels) panel.inert = false;
        container.inert = false;
        loading.reveal();
        parts?.reveal();
    };
    const revealTimer = setTimeout(reveal, REVEAL_AFTER_MS);
    revealWhenReady(parts);

    return {
        focus: (id) => world.focus(id),
        select: (id) => world.select(id),
        destroy: () => {
            destroyed = true;
            clearTimeout(revealTimer);
            container.inert = false;
            for (const panel of panels) panel.inert = false;
            loading.destroy();
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
            satellites.destroy();
            search?.destroy();
            timeBar.destroy();
            sound.destroy();
            crumbs.destroy();
            keys.destroy();
            notices.destroy();
            parts?.destroy();
            for (const panel of panels) panel.hidden = true;
        },
    };
};
