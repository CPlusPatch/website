import { type Body, unixMsToJ2000s } from "@cpluspatch/orbit";
import { PerspectiveCamera, Scene, WebGLRenderer } from "three";
import { CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import type { SatelliteGroup } from "../catalogue.ts";
import type { EditScene } from "../editing.ts";
import type { SatelliteFacts } from "../swarm.ts";
import { advanceClock } from "../time-text.ts";
import type { Units } from "../units.ts";
import type { World } from "../world.ts";
import type { Assets } from "./assets.ts";
import { createBodies } from "./bodies/bodies.ts";
import { createRig } from "./camera.ts";
import { type Band, centreShift } from "./geometry/framing.ts";
import type { Rect } from "./geometry/labels.ts";
import { createGrips } from "./grips/grips.ts";
import { createLoadingProgress } from "./loading-progress.ts";
import { createOrbits } from "./orbits/orbits.ts";
import { type PickPoint, pickBody } from "./picking.ts";
import { bindPointer } from "./pointer.ts";
import { createReadouts } from "./readouts.ts";
import {
    createSatelliteFocus,
    SATELLITE_PREFIX,
    type SatelliteEvent,
    satelliteIndex,
} from "./satellite-focus.ts";
import { createSky } from "./sky.ts";
import { createSwarm } from "./swarm.ts";
import { createTheme } from "./theme.ts";
import { neutralNoToe } from "./tone-mapping.ts";

/** How much brighter the mapped spheres are drawn, before tone mapping. */
const EXPOSURE = 2.0;

export type { SatelliteEvent };

/** What a listener of `View.onChase` is told: whether the camera chases, and whether it could. */
export type ChaseState = { chasing: boolean; canChase: boolean };

/** The 3D view drawn into a container. */
export type View = EditScene & {
    /** Dollies in for a positive `steps`, out for a negative one. */
    zoom: (steps: number) => void;
    /** Moves the camera to the focus's framing distance. */
    fitFocus: () => void;
    /** Turns the chase camera on or off. Returns false when `on` is asked of a focus that can't be chased. */
    chase: (on: boolean) => boolean;
    chasing: () => boolean;
    /** Whether the focus has a parent to chase against. */
    canChase: () => boolean;
    /** Calls `fn` whenever the chase turns on or off, or the focus's `canChase` changes. Returns a function that stops it. */
    onChase: (fn: (state: ChaseState) => void) => () => void;
    /** Hides the orbit lines and labels for a clear view, or shows them. */
    bare: (bare: boolean) => void;
    /** The km one CSS pixel spans at the focus, or 0 before the view has a size. */
    kmPerPx: () => number;
    /** Sets the satellite groups drawn around Earth. The first non-empty list loads the snapshot. */
    satelliteGroups: (groups: readonly SatelliteGroup[]) => void;
    /** Adds and removes bodies in place, without rebuilding the view. */
    patch: (change: { added: string[]; removed: string[] }) => void;
    /** Marks the loading state as gone; a sky that arrives later fades in. */
    reveal: () => void;
    /** The catalogue satellite that is selected or focused, by index. Selecting one clears the world's selection. */
    satellite: {
        selected: () => number | null;
        focused: () => number | null;
        select: (k: number | null) => void;
        /** Selects satellite `k` and follows it, framing its orbit. */
        focus: (k: number) => void;
        facts: (k: number) => SatelliteFacts | null;
        /** Calls `fn` on every change. Returns a function that stops it. */
        on: (fn: (e: SatelliteEvent) => void) => () => void;
    };
    /** Resolves once the first frame is drawn and the sky and every map asked for by then have settled. Never rejects. */
    ready: Promise<void>;
    destroy: () => void;
};

/**
 * The 3D view of `world` in `container`, or `null` if WebGL isn't available.
 * `blocked` gives the rects, in px from the container's top left, that labels keep out of.
 * `band` gives the rows the panels leave free, where the focus is centred.
 * `units` sets the unit of the distances in the notes.
 * `onLoading` hears the files done of the files started, for the sky and the maps, and how full the bar is, from 0 to 1.
 * The sky counts as one file, and fills the bar by the bytes it has received.
 * `assets` holds the sky, maps and satellites, which are fetched once for every view built on it.
 */
export const createView = (
    container: HTMLElement,
    world: World,
    blocked: () => Rect[],
    band: () => Band,
    units: Units,
    assets: Assets,
    onLoading?: (done: number, total: number, fill: number) => void,
): View | null => {
    let renderer: WebGLRenderer;
    try {
        renderer = new WebGLRenderer({
            antialias: true,
            logarithmicDepthBuffer: true,
            alpha: true,
        });
    } catch {
        return null;
    }

    const cleanup: (() => void)[] = [];
    try {
        return assemble(
            renderer,
            cleanup,
            container,
            world,
            blocked,
            band,
            units,
            assets,
            onLoading,
        );
    } catch (error) {
        for (const undo of cleanup.toReversed()) undo();

        throw error;
    }
};

/** Builds the view on `renderer`. Pushes each part's undo to `cleanup`, for a throw before it returns. */
const assemble = (
    renderer: WebGLRenderer,
    cleanup: (() => void)[],
    container: HTMLElement,
    world: World,
    blocked: () => Rect[],
    band: () => Band,
    units: Units,
    assets: Assets,
    onLoading?: (done: number, total: number, fill: number) => void,
): View => {
    cleanup.push(() => {
        renderer.forceContextLoss();
        renderer.dispose();
        renderer.domElement.remove();
    });

    // Only the mapped spheres are tone mapped; every flat colour sets `toneMapped: false`.
    // Neutral, not AgX: AgX shifts the hue of dark night sides.
    renderer.toneMapping = neutralNoToe();
    renderer.toneMappingExposure = EXPOSURE;

    const scene = new Scene();
    const camera = new PerspectiveCamera(50, 1, 1e-6, 1e12);
    const labels = new CSS2DRenderer();
    labels.domElement.classList.add("orrery__labels");
    // The canvas's label already names the focus.
    labels.domElement.setAttribute("aria-hidden", "true");
    const canvas = renderer.domElement;
    canvas.setAttribute("role", "img");
    canvas.tabIndex = 0;

    container.append(canvas, labels.domElement);
    cleanup.push(() => labels.domElement.remove());

    const theme = createTheme(container);
    cleanup.push(theme.stop);
    const colorOf = (body: Body) =>
        theme.color(
            body,
            world.scenario.bodies.find((other) => other.id === body.parent),
        );
    const orbits = createOrbits(
        scene,
        world.order,
        colorOf,
        theme.background(),
        theme.pick(),
    );
    cleanup.push(orbits.dispose);
    // Neither the sky nor the body maps are drawn where the user asks for more contrast.
    const plain =
        matchMedia("(forced-colors: active)").matches ||
        matchMedia("(prefers-contrast: more)").matches;
    const progress = createLoadingProgress({ sky: !plain, onLoading });
    cleanup.push(progress.destroy);
    const bodies = createBodies(
        scene,
        labels.domElement,
        world.order,
        colorOf,
        {
            maps: !plain,
            images: assets.map,
            anisotropy: renderer.capabilities.getMaxAnisotropy(),
            onMaps: progress.maps,
        },
    );
    cleanup.push(bodies.dispose);

    // The scene is rebuilt when a body with model "earth" comes or goes, so the host is fixed here.
    const host = world.scenario.hasSatellites
        ? world.scenario.bodies.find((body) => body.model === "earth")
        : undefined;
    const swarm = createSwarm(scene, theme, () => assets.swarm(host?.mu ?? 0));
    cleanup.push(swarm.dispose);
    const earthOffset = { x: 0, y: 0, z: 0 };

    const grips = createGrips(labels.domElement, units);
    cleanup.push(grips.dispose);
    const readouts = createReadouts(container, labels.domElement, world, units);
    cleanup.push(readouts.dispose);

    let size = { width: 0, height: 0 };
    let shift = 0;
    let ghostShown = false;
    // Moves the picture, so the focus sits in the free band rather than under a panel.
    const offset = (free: Band) => {
        const next = centreShift(size.height, free);
        if (next === shift) return;

        shift = next;
        if (shift === 0) camera.clearViewOffset();
        else {
            camera.setViewOffset(
                size.width,
                size.height,
                0,
                shift,
                size.width,
                size.height,
            );
        }
    };

    const resize = () => {
        const { clientWidth: width, clientHeight: height } = container;
        if (width === 0 || height === 0) return;

        size = { width, height };
        // The offset is in px of the old size, so it's set again next frame.
        camera.clearViewOffset();
        shift = 0;

        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(width, height);
        labels.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        orbits.resize(width, height);
        bodies.resize(camera, width, height);
        swarm.resize(renderer.getPixelRatio(), width, height);

        // The view keeps fitting while the container changes size.
        if (!rig.moved()) rig.fit();
    };

    let points: PickPoint[] = [];
    const unbindPointer = bindPointer(canvas, {
        // A visible label names its body, so it wins over a nearby marker, and bodies win over satellites.
        pick: (x, y) => {
            const body =
                bodies.labelAt(x, y, canvas.getBoundingClientRect()) ??
                pickBody(points, x, y);
            if (body) return body;

            const k = swarm.pick(x, y, size.width, size.height);

            return k === null ? null : `${SATELLITE_PREFIX}${k}`;
        },
        select: (id) => {
            const k = id === null ? null : satelliteIndex(id);
            if (k === null) {
                satellites.clear();
                world.select(id);
            } else {
                satellites.pick(k);
            }
        },
        focus: (id) => {
            const k = satelliteIndex(id);
            if (k === null) world.focus(id);
            else satellites.focus(k);
        },
        hover: (id) => {
            const k = id === null ? null : satelliteIndex(id);
            bodies.hover(k === null ? id : null);
            swarm.hover(k);
        },
    });
    cleanup.push(unbindPointer);
    orbits.highlight(world.selected);

    const rig = createRig(
        camera,
        canvas,
        () => world.scenario,
        world.states(),
        world.focused,
    );
    cleanup.push(rig.dispose);
    resize();

    const chaseListeners = new Set<(state: ChaseState) => void>();
    let chaseShown: ChaseState = {
        chasing: rig.chasing(),
        canChase: rig.canChase(),
    };
    // Called after anything that can change the rig's chase, and tells listeners only of a change.
    const notifyChase = () => {
        const next = { chasing: rig.chasing(), canChase: rig.canChase() };
        if (
            next.chasing === chaseShown.chasing &&
            next.canChase === chaseShown.canChase
        ) {
            return;
        }

        chaseShown = next;
        for (const fn of chaseListeners) fn(next);
    };

    const describe = () => {
        const focused = satellites.focused();
        const satellite =
            focused === null ? null : swarm.facts(focused, world.clock.t);

        canvas.setAttribute(
            "aria-label",
            `${world.scenario.name}, centred on ${
                satellite?.name ??
                world.scenario.bodies.find((body) => body.id === rig.focusId())
                    ?.name
            }. Arrow keys rotate, plus and minus zoom, 0 fits the focus, C chases it.`,
        );
    };
    const satellites = createSatelliteFocus({
        world,
        swarm,
        host,
        rig,
        camera,
        notifyChase,
        describe,
    });
    describe();

    const sky = createSky();
    cleanup.push(sky.dispose);
    progress.report();
    if (!plain) {
        assets
            .sky(progress.sky)
            .then((data) => {
                if (!progress.destroyed()) sky.show(data);
            })
            .catch((error: unknown) => {
                if (progress.destroyed()) return;

                // The only report of a failed optional asset, and the project has no logger.
                console.warn("Couldn't load the sky.", error);
            })
            .finally(progress.skyDone);
    }
    let skyCleared = false;

    let frame = 0;
    let last = performance.now();
    let lastNowT = unixMsToJ2000s(Date.now());
    const draw = (now: number) => {
        frame = requestAnimationFrame(draw);

        // Read before this frame's writes, so the layout isn't forced twice.
        const keepOut = blocked();
        const free = band();

        const dt = Math.min((now - last) / 1000, 0.1);
        last = now;

        const nowT = unixMsToJ2000s(Date.now());
        advanceClock(world.clock, dt, lastNowT, nowT);
        lastNowT = nowT;
        const states = world.states();

        satellites.check();

        offset(free);
        rig.update(dt, states);
        camera.updateMatrixWorld();
        orbits.update(
            rig.origin(),
            states,
            camera,
            world.clock.rate,
            world.clock.t,
        );
        const rooms = grips.update({
            camera,
            origin: rig.origin(),
            states,
            viewport: size,
            parentOf: (id) =>
                world.scenario.bodies.find((body) => body.id === id)?.parent,
        });
        points = bodies.update(
            camera,
            world.clock.t,
            rig.origin(),
            rig.focusId(),
            world.selected,
            states,
            [...keepOut, ...rooms],
        );
        const earth = host && states.get(host.id)?.r;
        if (earth) {
            const origin = rig.origin();
            earthOffset.x = (earth.x - origin.x) / 1000;
            earthOffset.y = (earth.y - origin.y) / 1000;
            earthOffset.z = (earth.z - origin.z) / 1000;
        }
        swarm.update(
            camera,
            world.clock.t,
            earth ? earthOffset : null,
            size.height,
        );
        grips.placeNote(bodies.placed());
        progress.drawn();
        readouts.update({
            camera,
            origin: rig.origin(),
            states,
            viewport: size,
            hidden: ghostShown || grips.shown(),
            labels: bodies.placed(),
            blocked: keepOut,
            footprint: world.selected
                ? bodies.footprint(world.selected)
                : undefined,
        });

        if (sky.shown()) {
            // The canvas is transparent, so the sky needs the ground colour under it.
            if (!skyCleared) {
                renderer.autoClear = false;
                renderer.setClearColor(theme.background(), 1);
                orbits.sky(true);
                skyCleared = true;
            }
            renderer.clear();
            sky.render(renderer, camera);
            renderer.clearDepth();
        }
        renderer.render(scene, camera);
        labels.render(scene, camera);
    };
    frame = requestAnimationFrame(draw);
    cleanup.push(() => cancelAnimationFrame(frame));

    const observer = new ResizeObserver(resize);
    cleanup.push(() => observer.disconnect());
    observer.observe(container);

    const unsubscribe = world.on((event) => {
        if (event.type === "selection") {
            orbits.highlight(event.id);
            satellites.onWorld(event);
        } else if (event.type === "focus") {
            rig.focus(event.id);
            notifyChase();
            satellites.onWorld(event);
            describe();
        } else if (event.type === "body") {
            const body = world.scenario.bodies.find((b) => b.id === event.id);
            if (body) {
                orbits.rebuild(body);
                bodies.recolor(body);
            }
            rig.rescale();
        }
    });
    cleanup.push(unsubscribe);

    return {
        ghost: (id, elements) => {
            const body = world.order.find((candidate) => candidate.id === id);
            if (body) orbits.ghost(body, elements);
            ghostShown = body !== undefined && elements !== null;
        },
        grips: grips.target,
        patch: ({ added, removed }) => {
            for (const id of removed) {
                orbits.remove(id);
                bodies.remove(id);
            }
            for (const id of added) {
                const body = world.scenario.bodies.find(
                    (candidate) => candidate.id === id,
                );
                if (!body) continue;

                orbits.add(body);
                bodies.add(body);
            }
            rig.rescale();
        },
        zoom: rig.zoom,
        fitFocus: rig.fitFocus,
        chase: (on) => {
            const done = rig.chase(on);
            notifyChase();

            return done;
        },
        chasing: rig.chasing,
        canChase: rig.canChase,
        onChase: (fn) => {
            chaseListeners.add(fn);

            return () => {
                chaseListeners.delete(fn);
            };
        },
        bare: (bare) => {
            orbits.show(!bare);
            labels.domElement.hidden = bare;
            bodies.bare(bare);
        },
        kmPerPx: () => (size.height > 0 ? rig.kmPerPx(size.height) : 0),
        satelliteGroups: swarm.groups,
        satellite: {
            selected: satellites.selected,
            focused: satellites.focused,
            select: satellites.select,
            focus: satellites.focus,
            facts: satellites.facts,
            on: satellites.on,
        },
        reveal: sky.reveal,
        ready: progress.ready,
        destroy: () => {
            progress.destroy();
            unsubscribe();
            unbindPointer();
            cancelAnimationFrame(frame);
            observer.disconnect();
            theme.stop();
            sky.dispose();
            swarm.dispose();
            rig.dispose();
            orbits.dispose();
            bodies.dispose();
            readouts.dispose();
            grips.dispose();
            renderer.forceContextLoss();
            renderer.dispose();
            canvas.remove();
            labels.domElement.remove();
        },
    };
};
