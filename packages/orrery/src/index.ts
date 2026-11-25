/**
 * @module
 * The Orrery, an interactive model of the solar system drawn with three.js.
 */

import { solarSystem } from "@cpluspatch/catalog";
import {
    type Band,
    Clock,
    createAssets,
    createUnits,
    createView,
    DEFAULT_RATE,
    h,
    NARROW_QUERY,
    type Rect,
    type View,
} from "@cpluspatch/render";
import { alertClasses, alertPrefix } from "@cpluspatch/ui/components/alert.ts";
import { reducedMotion } from "@cpluspatch/ui/lib/motion.ts";
import { mount as mountComponent, unmount } from "svelte";
import {
    announcement,
    bareAnnouncement,
    chaseAnnouncement,
    noChaseAnnouncement,
    satelliteAnnouncement,
} from "./announce.ts";
import { cue } from "./audio/cues.ts";
import { createSound } from "./audio/sound.ts";
import {
    hashPayload,
    openScenario,
    type SavedStorage,
    startTime,
} from "./persistence.ts";
import { createSession } from "./session.ts";
import { storeContext } from "./state/context.ts";
import { DocumentStore } from "./state/document.svelte.ts";
import { ViewState } from "./state/view.svelte.ts";
import Crumbs from "./ui/Crumbs.svelte";
import { createHud } from "./ui/hud.ts";
import Inspector from "./ui/inspector/Inspector.svelte";
import { createKeys } from "./ui/keys.ts";
import { createLoading } from "./ui/loading.ts";
import { createNotices } from "./ui/notices.ts";
import SatelliteCard from "./ui/SatelliteCard.svelte";
import SoundMenu from "./ui/SoundMenu.svelte";
import { createSatelliteMenu } from "./ui/satellite-menu.ts";
import ScenarioMenu from "./ui/scenario-menu/ScenarioMenu.svelte";
import Search from "./ui/search/Search.svelte";
import { sheetSpace } from "./ui/sheet.ts";
import { bindShortcuts } from "./ui/shortcuts.ts";
import TimeBar from "./ui/time/TimeBar.svelte";
import { World } from "./world.ts";

/** A mounted Orrery. */
export type Orrery = {
    /** Centres the view on a body. */
    focus: (id: string) => void;
    /** Selects a body, or clears the selection with `null`. */
    select: (id: string | null) => void;
    destroy: () => void;
};

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
    // Made before the inspector, whose forms read them.
    const documentStore = new DocumentStore(world);
    const viewState = new ViewState(world);

    const panels = root.querySelectorAll<HTMLElement>(".orrery__panel");
    const top = root.querySelector<HTMLElement>(".orrery__panel--top");
    const bottom = root.querySelector<HTMLElement>(".orrery__panel--bottom");
    const side = root.querySelector<HTMLElement>(".orrery__panel--right");

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
            ".orrery__panel--top > :not([hidden], dialog)",
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
    let search: ReturnType<typeof Search> | null = null;
    // Replaced with the view on each scenario.
    let inspector: ReturnType<typeof Inspector> | null = null;
    let currentView: View | null = null;

    const loading = createLoading(root);

    // Points at the current view, as the menu outlives the views.
    let setSatellites: View["satelliteGroups"] | null = null;
    const satellites = createSatelliteMenu(
        storage,
        (groups) => setSatellites?.(groups),
        // `timeBar` is made below, and the menu only calls this once it's open.
        { now: () => world.clock.t, goLive: () => timeBar?.goLive() },
    );
    // The body the satellites orbit, which is the first with model "earth".
    const satelliteHost = () =>
        world.scenario.hasSatellites
            ? world.scenario.bodies.find((body) => body.model === "earth")?.id
            : undefined;
    // The host the current view was built with.
    let builtHost: string | undefined;

    // Outlives the views, so a rebuilt one doesn't fetch the sky, maps and satellites again.
    const assets = createAssets(
        new URL("./assets/satellites.bin", import.meta.url),
    );

    // The view and the panels that depend on the scenario. Only the first build reports loading.
    const build = (
        onLoading?: (done: number, total: number, fill: number) => void,
    ): {
        ready: Promise<void>;
        reveal: () => void;
        destroy: () => void;
    } | null => {
        builtHost = satelliteHost();
        const view = createView(
            container,
            world,
            blocked,
            band,
            units,
            assets,
            onLoading,
            () => cue("tick"),
        );
        if (!view) return null;

        // Undoes the parts made so far, so a throw leaves nothing behind.
        const cleanup: (() => void)[] = [view.destroy];
        try {
            setSatellites = view.satelliteGroups;
            view.satelliteGroups(satellites.groups());

            const current = side
                ? mountComponent(Inspector, {
                      target: side,
                      context: storeContext(documentStore, viewState),
                      props: {
                          units,
                          restoreFocus: () => search?.focusToggle(),
                          scene: view,
                      },
                  })
                : null;
            if (current) {
                inspector = current;
                cleanup.push(() => {
                    if (inspector === current) inspector = null;
                    void unmount(current);
                });
            }

            const card = side
                ? mountComponent(SatelliteCard, {
                      target: side,
                      props: {
                          satellite: view.satellite,
                          restoreFocus: () => search?.focusToggle(),
                      },
                  })
                : null;
            if (card) cleanup.push(() => void unmount(card));

            currentView = view;
            view.bare(root.classList.contains("orrery--bare"));
            const offSatellite = view.satellite.on((event) => {
                const k = event.k;
                const name =
                    k === null ? null : (view.satellite.facts(k)?.name ?? null);

                if (event.type === "focus") {
                    crumbs?.setSatellite(
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
                    world.scenario.bodies.find(
                        (body) => body.id === world.focused,
                    )?.name ??
                    world.focused;
                live.textContent = chaseAnnouncement(chasing, name);
            });

            const hudSlot = root.querySelector<HTMLElement>(
                ".orrery__panel--hud",
            );
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
                        crumbs?.setSatellite(null);
                    }
                    offSatellite();
                    offChase();
                    if (card) void unmount(card);
                    if (setSatellites === view.satelliteGroups) {
                        setSatellites = null;
                    }
                    removeHud();
                    if (current) void unmount(current);
                    view.destroy();
                },
            };
        } catch (error) {
            if (currentView === view) {
                currentView = null;
                crumbs?.setSatellite(null);
            }
            if (setSatellites === view.satelliteGroups) setSatellites = null;
            for (const undo of cleanup.toReversed()) undo();

            throw error;
        }
    };

    // Drops the share link from the address bar, so a reload opens the saved copy.
    const stripHash = () => {
        history.replaceState(null, "", location.pathname + location.search);
    };

    const notices = createNotices(root);
    if (hashPayload(location.hash) !== null) stripHash();

    let fellBack = false;
    let parts: ReturnType<typeof build>;
    try {
        parts = build(loading.progress);
    } catch (error) {
        // A saved copy or link that can't be drawn mustn't lock the page out.
        if (world.scenario === solarSystem) throw error;

        world.load(solarSystem, startTime(solarSystem));
        parts = build(loading.progress);
        fellBack = true;
        if (parts) {
            const subject =
                opened.source === "saved"
                    ? "Your saved copy"
                    : "The shared link";
            notices.show(
                "warning",
                `${subject} can't be drawn, so the solar system opened.`,
            );
        }
    }

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
    // The views come and go, and the sound menu stays in the HUD panel beside them.
    const hud = root.querySelector<HTMLElement>(".orrery__panel--hud");
    const soundMenu = hud
        ? mountComponent(SoundMenu, { target: hud, props: { sound } })
        : null;
    const timeBar = bottom
        ? mountComponent(TimeBar, {
              target: bottom,
              context: storeContext(documentStore, viewState),
              props: { storage },
          })
        : null;
    // The page has the spacer between them. The notices come last.
    // Taken before the search is mounted so the crumbs and the search toggle stay first in the bar.
    const firstInTop = top?.firstChild ?? null;
    const crumbs = top
        ? mountComponent(Crumbs, {
              target: top,
              anchor: firstInTop ?? undefined,
              context: storeContext(documentStore, viewState),
          })
        : null;
    const keys = createKeys();
    const openAdd = (name?: string) => {
        // The keys card hides the orbit card, so the form wouldn't show.
        keys.close();
        inspector?.openAdd(name);
    };
    // The search panel isn't in a .orrery__panel, so it covers the scene without moving the labels.
    search = top
        ? mountComponent(Search, {
              target: top,
              anchor: firstInTop ?? undefined,
              context: storeContext(documentStore, viewState),
              props: { root, units, openAdd },
          })
        : null;
    top?.append(satellites.element, keys.toggle, notices.element);
    // Mounted last, so the toggle can go right before the satellites menu.
    const scenarios = top
        ? mountComponent(ScenarioMenu, {
              target: top,
              anchor: satellites.element,
              context: storeContext(documentStore, viewState),
              props: { storage, openAdd: () => openAdd() },
          })
        : null;
    satellites.setAvailable(satelliteHost() !== undefined);
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
        if (side) {
            const boxes = [...side.children].map((card) =>
                card.getBoundingClientRect(),
            );
            const space = sheetSpace(
                side.getBoundingClientRect().bottom,
                boxes,
            );
            root.style.setProperty("--orrery-sheet-space", `${space}px`);
        }
    });
    for (const panel of [top, bottom]) if (panel) measure.observe(panel);
    // The cards come and go, and the inspector arrives once the view is built.
    const watchSide = new MutationObserver(() => {
        for (const card of side?.children ?? []) measure.observe(card);
    });
    if (side) {
        for (const card of side.children) measure.observe(card);
        watchSide.observe(side, { childList: true });
    }

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
        goLive: () => timeBar?.goLive(),
        openSearch: () => {
            showInterface();
            search?.open();
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
            timeBar?.toggleDate();
        },
    });

    const rebuild = () => {
        parts?.destroy();
        parts = null;
        parts = build();
        satellites.setAvailable(satelliteHost() !== undefined);
        // A view built after the reveal has no loading state, so a sky that comes later fades in.
        if (revealed) parts?.reveal();
        else if (parts) revealWhenReady(parts);
        if (!parts) {
            notices.show("destructive", "The model can't be drawn.");
        }
    };

    const session = createSession({
        world,
        storage,
        notices,
        page: {
            hash: () => location.hash,
            stripHash,
            hidden: () => document.visibilityState === "hidden",
            window,
            document,
        },
        rebuild,
        update: (change) => {
            // The satellite swarm, its host's mu and the satellite menu are set once per build.
            const view = currentView;
            if (!view || satelliteHost() !== builtHost) {
                rebuild();
            } else {
                view.patch(change);
            }
        },
    });

    const off = world.on((event) => {
        if (event.type === "selection" && event.id !== null) cue("select");
        // The keys card hides the orbit card, so a new pick would show nothing.
        if (event.type === "selection" && event.id !== null) keys.close();

        // A rebuilt scenario isn't announced, as its view is new.
        const message = announcement(event, world.scenario.bodies);
        if (message !== null) live.textContent = message;
    });

    let destroyed = false;

    // A link that fell back mustn't replace the saved copy with the solar system.
    if (opened.source === "link" && !fellBack) session.saveNow();
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
            session.destroy();
            off();
            measure.disconnect();
            watchSide.disconnect();
            root.style.removeProperty("--orrery-top-space");
            root.style.removeProperty("--orrery-sheet-space");
            root.style.removeProperty("--orrery-bottom-space");
            live.remove();
            unbind();
            if (scenarios) void unmount(scenarios);
            satellites.destroy();
            if (search) void unmount(search);
            if (timeBar) void unmount(timeBar);
            if (soundMenu) void unmount(soundMenu);
            sound.destroy();
            if (crumbs) void unmount(crumbs);
            viewState.destroy();
            documentStore.destroy();
            keys.destroy();
            notices.destroy();
            parts?.destroy();
            assets.dispose();
            for (const panel of panels) panel.hidden = true;
        },
    };
};
