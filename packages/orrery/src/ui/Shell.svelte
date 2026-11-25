<script lang="ts">
import { solarSystem } from "@cpluspatch/catalog";
import {
    Clock,
    createAssets,
    createUnits,
    DEFAULT_RATE,
    NARROW_QUERY,
    type View,
} from "@cpluspatch/render";
import { reducedMotion } from "@cpluspatch/ui/lib/motion.ts";
import { onMount, untrack } from "svelte";
import {
    announcement,
    bareAnnouncement,
    chaseAnnouncement,
    noChaseAnnouncement,
    satelliteAnnouncement,
} from "../announce.ts";
import { cue } from "../audio/cues.ts";
import { createSound, type Sound } from "../audio/sound.ts";
import {
    hashPayload,
    type Opened,
    type SavedStorage,
    startTime,
} from "../persistence.ts";
import { readSatellites } from "../satellite-settings.ts";
import { createSession } from "../session.ts";
import { setStores } from "../state/context.ts";
import { createStores } from "../state/stores.svelte.ts";
import Crumbs from "./Crumbs.svelte";
import Hud from "./Hud.svelte";
import Inspector from "./inspector/Inspector.svelte";
import Keys from "./Keys.svelte";
import { showLoadFailed } from "./load-failed.ts";
import { createLoading } from "./loading.ts";
import { measure } from "./measure.ts";
import Notices from "./Notices.svelte";
import type { NoticeVariant } from "./notices.ts";
import SatelliteCard from "./SatelliteCard.svelte";
import SatelliteMenu from "./SatelliteMenu.svelte";
import SoundMenu from "./SoundMenu.svelte";
import ScenarioMenu from "./scenario-menu/ScenarioMenu.svelte";
import Search from "./search/Search.svelte";
import { bindShortcuts } from "./shortcuts.ts";
import TimeBar from "./time/TimeBar.svelte";
import Viewport from "./Viewport.svelte";

type Props = {
    /** The static `.orrery` element of the page. */
    root: HTMLElement;
    opened: Opened;
    storage: SavedStorage;
    /** Says `text` in the live region. */
    announce: (text: string) => void;
};

/** How long after mounting the loading state gives way, whatever is still loading, in ms. */
const REVEAL_AFTER_MS = 8000;

const { root, opened, storage, announce }: Props = $props();

// The scenario doesn't change for the life of the component, so the first read is enough.
const { scene, documentStore, viewState } = untrack(() =>
    createStores(
        opened.scenario,
        new Clock(startTime(opened.scenario), DEFAULT_RATE, reducedMotion()),
    ),
);
// Set before the components that read them are made.
setStores(documentStore, viewState);

const units = createUnits();
// Below this width the inspector becomes a sheet.
const narrow = matchMedia(NARROW_QUERY);
const loading = untrack(() => createLoading(root));
// Outlives the views, so a rebuilt one doesn't fetch the sky, maps and satellites again.
const assets = createAssets(
    new URL("../assets/satellites.bin", import.meta.url),
);

// Panels stay hidden until the first build succeeds, then inert until the reveal.
let shown = $state(false);
let inert = $state(false);
let unavailable = $state(false);
let view = $state.raw<View | null>(null);
let sound = $state.raw<Sound | null>(null);
let top = $state.raw<HTMLElement>();
let bottom = $state.raw<HTMLElement>();
let side = $state.raw<HTMLElement>();

let viewport: ReturnType<typeof Viewport> | undefined;
let notices: ReturnType<typeof Notices> | undefined;
let satellites: ReturnType<typeof SatelliteMenu> | undefined;
let crumbs = $state.raw<ReturnType<typeof Crumbs>>();
let search = $state.raw<ReturnType<typeof Search>>();
let scenarios = $state.raw<ReturnType<typeof ScenarioMenu>>();
let timeBar = $state.raw<ReturnType<typeof TimeBar>>();
let inspector = $state.raw<ReturnType<typeof Inspector>>();
let keys = $state.raw<ReturnType<typeof Keys>>();

const showNotice = (
    variant: NoticeVariant,
    text: string,
    clearAfterMs?: number,
) => notices?.show(variant, text, clearAfterMs);

const satelliteGroups = () => satellites?.groups() ?? readSatellites(storage);
// The body the satellites orbit, which is the first with model "earth".
const satelliteHost = () =>
    scene.scenario.hasSatellites
        ? scene.scenario.bodies.find((body) => body.model === "earth")?.id
        : undefined;
// The host the current view was built with.
let builtHost: string | undefined;

// The menu only calls `goLive` once it's open, long after the time bar is made.
const satelliteClock = {
    now: () => scene.clock.t,
    goLive: () => timeBar?.goLive(),
};

const openAdd = (name?: string) => {
    // The keys card hides the orbit card, so the form wouldn't show.
    keys?.close();
    inspector?.openAdd(name);
};

// The view and the panels that depend on the scenario. Only the first build reports loading.
const build = (
    onLoading?: (done: number, total: number, fill: number) => void,
): View | null => {
    if (!viewport) throw new Error("The Orrery needs its viewport.");

    view = null;
    builtHost = satelliteHost();
    const built = viewport.build(onLoading);
    if (!built) return null;

    try {
        built.satelliteGroups(satelliteGroups());
        built.bare(root.classList.contains("orrery--bare"));
    } catch (error) {
        // A throw leaves no view behind.
        viewport.destroy();

        throw error;
    }
    view = built;

    return built;
};

// Drops the share link from the address bar, so a reload opens the saved copy.
const stripHash = () => {
    history.replaceState(null, "", location.pathname + location.search);
};

const setBare = (bare: boolean) => {
    if (root.classList.contains("orrery--bare") === bare) return;

    // Focus on a hidden control would fall to the body.
    if (bare && document.activeElement?.closest(".orrery__panel")) {
        // A focus ring around the whole view would spoil it.
        viewport?.focusCanvas();
    }

    root.classList.toggle("orrery--bare", bare);
    view?.bare(bare);
    announce(bareAnnouncement(bare));
};
// Shortcuts that open a panel's control show the interface first.
const showInterface = () => setBare(false);

// The satellite and chase events of the current view, until it's replaced.
$effect(() => {
    const current = view;
    if (!current) return;

    const offSatellite = current.satellite.on((event) => {
        const k = event.k;
        const name =
            k === null ? null : (current.satellite.facts(k)?.name ?? null);

        if (event.type === "focus") {
            crumbs?.setSatellite(
                k === null || name === null
                    ? null
                    : { name, onClick: () => current.satellite.focus(k) },
            );
        }
        if (event.type === "selection" && k !== null) {
            cue("select");
            // The keys card hides the orbit card, so a new pick would show nothing.
            keys?.close();
        }

        // A body pick clears the satellite, and the scene's "Selected ..." follows or comes first.
        if (
            event.type === "selection" &&
            k === null &&
            scene.selected !== null
        ) {
            return;
        }

        const message = satelliteAnnouncement(event, name);
        if (message !== null) announce(message);
    });

    let wasChasing = untrack(() => current.chasing());
    const offChase = current.onChase(({ chasing }) => {
        if (chasing === wasChasing) return;

        wasChasing = chasing;

        const k = current.satellite.focused();
        const name =
            (k === null ? null : current.satellite.facts(k)?.name) ??
            scene.scenario.bodies.find((body) => body.id === scene.focused)
                ?.name ??
            scene.focused;
        announce(chaseAnnouncement(chasing, name));
    });

    return () => {
        offSatellite();
        offChase();
        crumbs?.setSatellite(null);
    };
});

onMount(() => {
    if (hashPayload(location.hash) !== null) stripHash();

    let fellBack = false;
    let first: View | null;
    try {
        try {
            first = build(loading.progress);
        } catch (error) {
            // A saved copy or link that can't be drawn mustn't lock the page out.
            if (scene.scenario === solarSystem) throw error;

            scene.load(solarSystem, startTime(solarSystem));
            first = build(loading.progress);
            fellBack = true;
            if (first) {
                const subject =
                    opened.source === "saved"
                        ? "Your saved copy"
                        : "The shared link";
                showNotice(
                    "warning",
                    `${subject} can't be drawn, so the solar system opened.`,
                );
            }
        }
    } catch (error) {
        showLoadFailed(root);

        throw error;
    }

    if (!first) {
        loading.reveal();
        unavailable = true;
        if (opened.notice) showNotice("warning", opened.notice);

        return () => {
            viewState.destroy();
        };
    }

    // Shown under the loading state, so the first frames are framed beside them.
    shown = true;
    inert = true;

    const created = createSound(storage);
    sound = created;
    satellites?.setAvailable(satelliteHost() !== undefined);

    let revealed = false;
    let destroyed = false;

    // A destroyed view's ready resolves too, so only the current one reveals.
    const revealWhenReady = (built: View) => {
        void built.ready.then(() => {
            if (view === built) reveal();
        });
    };
    const reveal = () => {
        if (revealed || destroyed) return;

        revealed = true;
        clearTimeout(revealTimer);
        inert = false;
        loading.reveal();
        view?.reveal();
    };

    const rebuild = () => {
        const built = build();
        satellites?.setAvailable(satelliteHost() !== undefined);
        // A view built after the reveal has no loading state, so a sky that comes later fades in.
        if (revealed) built?.reveal();
        else if (built) revealWhenReady(built);
        if (!built) showNotice("destructive", "The model can't be drawn.");
    };

    const unbind = bindShortcuts(scene, units, {
        closeKeys: () => keys?.close() ?? false,
        clearSatellite: () => {
            const satellite = view?.satellite;
            if (!satellite || satellite.selected() === null) return false;

            satellite.select(null);

            return true;
        },
        focusSatellite: () => {
            const satellite = view?.satellite;
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
            const current = view;
            if (!current) return;

            if (current.canChase()) {
                current.chase(!current.chasing());
            } else {
                const name =
                    scene.scenario.bodies.find(
                        (body) => body.id === scene.focused,
                    )?.name ?? scene.focused;
                announce(noChaseAnnouncement(name));
            }
        },
        toggleBare: () => setBare(!root.classList.contains("orrery--bare")),
        toggleDate: () => {
            showInterface();
            timeBar?.toggleDate();
        },
    });

    const session = createSession({
        scene,
        storage,
        notices: { show: showNotice },
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
            const current = view;
            if (!current || satelliteHost() !== builtHost) {
                rebuild();
            } else {
                current.patch(change);
            }
        },
    });

    const off = scene.on((event) => {
        if (event.type === "selection" && event.id !== null) cue("select");
        // The keys card hides the orbit card, so a new pick would show nothing.
        if (event.type === "selection" && event.id !== null) keys?.close();

        // A rebuilt scenario isn't announced, as its view is new.
        const message = announcement(event, scene.scenario.bodies);
        if (message !== null) announce(message);
    });

    // A link that fell back mustn't replace the saved copy with the solar system.
    if (opened.source === "link" && !fellBack) session.saveNow();
    if (opened.notice) showNotice("warning", opened.notice);

    const revealTimer = setTimeout(reveal, REVEAL_AFTER_MS);
    revealWhenReady(first);

    return () => {
        destroyed = true;
        clearTimeout(revealTimer);
        loading.destroy();
        session.destroy();
        off();
        unbind();
        created.destroy();
        viewState.destroy();
        viewport?.destroy();
        assets.dispose();
    };
});
</script>

<Viewport
    bind:this={viewport}
    {root}
    {scene}
    {units}
    {assets}
    {narrow}
    {unavailable}
    {inert}
    beside={() => notices?.element()}
/>
<div
    class="orrery__panel orrery__panel--top"
    hidden={!shown}
    {inert}
    bind:this={top}
>
    {#if shown}
        <Crumbs bind:this={crumbs} />
        <Search bind:this={search} {root} {units} {openAdd} />
    {/if}
    <span class="orrery__spacer"></span>
    {#if shown}
        <ScenarioMenu
            bind:this={scenarios}
            {storage}
            openAdd={() => openAdd()}
        />
    {/if}
    <SatelliteMenu
        bind:this={satellites}
        {storage}
        onChange={(groups) => view?.satelliteGroups(groups)}
        clock={satelliteClock}
    />
    {#if shown}
        <Keys bind:this={keys} host={side} />
    {/if}
    <Notices bind:this={notices} returnFocus={() => scenarios?.focusToggle()} />
</div>
<div
    class="orrery__panel orrery__panel--right"
    hidden={!shown}
    {inert}
    bind:this={side}
    {@attach shown && measure(root, top, bottom)}
>
    {#if view}
        {#key view}
            <Inspector
                bind:this={inspector}
                {units}
                restoreFocus={() => search?.focusToggle()}
                scene={view}
            />
            <SatelliteCard
                satellite={view.satellite}
                restoreFocus={() => search?.focusToggle()}
            />
        {/key}
    {/if}
</div>
<div class="orrery__panel orrery__panel--hud" hidden={!shown} {inert}>
    {#if view}
        {#key view}
            <Hud {view} {units} {narrow} />
        {/key}
    {/if}
    {#if sound}
        <SoundMenu {sound} />
    {/if}
</div>
<div
    class="orrery__panel orrery__panel--bottom"
    hidden={!shown}
    {inert}
    bind:this={bottom}
>
    {#if shown}
        <TimeBar bind:this={timeBar} {storage} />
    {/if}
</div>
