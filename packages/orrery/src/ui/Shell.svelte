<script lang="ts">
import { loadSatellites } from "@cpluspatch/catalog";
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
import { presenceAnnouncement } from "../announce.ts";
import { createSound, type Sound } from "../audio/sound.ts";
import {
    hashPayload,
    type Opened,
    type SavedStorage,
    startTime,
} from "../persistence.ts";
import { readSatellites } from "../satellite-settings.ts";
import { createSession } from "../session.ts";
import { setAnnouncer, setStores } from "../state/context.ts";
import { createStores } from "../state/stores.svelte.ts";
import { createBare } from "./bare.ts";
import Crumbs from "./Crumbs.svelte";
import { startClockLoop } from "./clock-loop.ts";
import { buildFirst, type FirstBuild } from "./first-build.ts";
import History from "./History.svelte";
import Hud from "./Hud.svelte";
import Inspector from "./inspector/Inspector.svelte";
import Keys from "./Keys.svelte";
import { showLoadFailed } from "./load-failed.ts";
import { createLoading } from "./loading.ts";
import { measure } from "./measure.ts";
import Notices from "./Notices.svelte";
import type { NoticeVariant } from "./notices.ts";
import { createReveal } from "./reveal.ts";
import SatelliteCard from "./SatelliteCard.svelte";
import SatelliteMenu from "./SatelliteMenu.svelte";
import SoundMenu from "./SoundMenu.svelte";
import ScenarioMenu from "./scenario-menu/ScenarioMenu.svelte";
import Search from "./search/Search.svelte";
import { bindShortcuts } from "./shortcuts.ts";
import TimeBar from "./time/TimeBar.svelte";
import { travel } from "./travel.ts";
import Viewport from "./Viewport.svelte";
import {
    bindSceneEvents,
    bindViewEvents,
    viewShortcuts,
} from "./view-bindings.ts";

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
        opened.doc,
        new Clock(
            startTime(opened.doc.scenario),
            DEFAULT_RATE,
            reducedMotion(),
        ),
    ),
);
// Set before the components that read them are made.
setStores(documentStore, viewState);
setAnnouncer((text) => announce(text));

const units = createUnits();
// Below this width the inspector becomes a sheet.
const narrow = matchMedia(NARROW_QUERY);
const loading = untrack(() => createLoading(root));
// Outlives the views, so a rebuilt one doesn't fetch the sky, maps and satellites again.
const assets = createAssets(loadSatellites);

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
// The body the satellites orbit, which is the first cloud's host.
const satelliteHost = () => scene.scenario.clouds?.[0]?.host;
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

const bare = untrack(() =>
    createBare(
        root,
        () => view,
        () => viewport?.focusCanvas(),
        announce,
    ),
);

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
        built.bare(bare.is());
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

// Shortcuts that open a panel's control show the interface first.
const showInterface = () => bare.set(false);

const undo = () =>
    travel(documentStore, "undo", () => void inspector?.closeForms(), announce);
const redo = () =>
    travel(documentStore, "redo", () => void inspector?.closeForms(), announce);

// The satellite and chase events of the current view, until it's replaced.
$effect(() => {
    const current = view;
    if (!current) return;

    return untrack(() =>
        bindViewEvents(current, scene, {
            setSatellite: (crumb) => crumbs?.setSatellite(crumb),
            closeKeys: () => keys?.close(),
            announce,
        }),
    );
});

onMount(() => {
    // Started before the build, so the clock ticks before the view's draw every frame.
    const clock = startClockLoop(scene, (departure) =>
        announce(presenceAnnouncement(departure, scene.scenario.bodies)),
    );

    if (hashPayload(location.hash) !== null) stripHash();

    let result: FirstBuild;
    try {
        result = buildFirst(
            scene,
            opened.source,
            () => build(loading.progress),
            (text) => showNotice("warning", text),
        );
    } catch (error) {
        clock.stop();
        showLoadFailed(root);

        throw error;
    }
    const first = result.view;

    if (!first) {
        // With no view the clock stood still before, and nothing shows it moving.
        clock.stop();
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

    const reveal = createReveal(
        loading,
        () => view,
        () => {
            inert = false;
        },
    );

    const rebuild = () => {
        const built = build();
        satellites?.setAvailable(satelliteHost() !== undefined);
        // A view built after the reveal has no loading state, so a sky that comes later fades in.
        if (reveal.revealed()) built?.reveal();
        else if (built) reveal.whenReady(built);
        if (!built) showNotice("destructive", "The model can't be drawn.");
    };

    const unbind = bindShortcuts(scene, units, {
        closeKeys: () => keys?.close() ?? false,
        ...viewShortcuts(scene, () => view, announce),
        goLive: () => timeBar?.goLive(),
        openSearch: () => {
            showInterface();
            search?.open();
        },
        toggleBare: bare.toggle,
        toggleDate: () => {
            showInterface();
            timeBar?.toggleDate();
        },
        undo,
        redo,
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

    const off = bindSceneEvents(scene, clock.settling, {
        closeKeys: () => keys?.close(),
        announce,
    });

    // A link that fell back mustn't replace the saved copy with the solar system.
    if (opened.source === "link" && !result.fellBack) session.saveNow();
    if (opened.notice) showNotice("warning", opened.notice);

    reveal.start(first, REVEAL_AFTER_MS);

    return () => {
        reveal.destroy();
        clock.stop();
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
        <History onUndo={undo} onRedo={redo} />
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
