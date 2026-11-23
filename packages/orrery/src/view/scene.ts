import { EARTH_RADIUS } from "@cpluspatch/orbit";
import { PerspectiveCamera, Scene, WebGLRenderer } from "three";
import { CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import type { SatelliteGroup } from "../catalogue.ts";
import type { EditScene } from "../editing.ts";
import type { SatelliteFacts } from "../swarm.ts";
import type { Units } from "../units.ts";
import type { World } from "../world.ts";
import { createBodies } from "./bodies/bodies.ts";
import { createRig } from "./camera.ts";
import {
    type Band,
    centreShift,
    pointFrameDistanceKm,
} from "./geometry/framing.ts";
import type { Rect } from "./geometry/labels.ts";
import { createGrips } from "./grips/grips.ts";
import { createOrbits } from "./orbits/orbits.ts";
import { type PickPoint, pickBody } from "./picking.ts";
import { bindPointer } from "./pointer.ts";
import { createReadouts } from "./readouts.ts";
import { createSky } from "./sky.ts";
import { createSwarm } from "./swarm.ts";
import { createTheme } from "./theme.ts";
import { neutralNoToe } from "./tone-mapping.ts";

/** How much brighter the mapped spheres are drawn, before tone mapping. */
const EXPOSURE = 2.0;

/** What a listener of `View.satellite` is told about. */
export type SatelliteEvent =
    | { type: "selection"; k: number | null }
    | { type: "focus"; k: number | null };

/** What a listener of `View.onChase` is told: whether the camera chases, and whether it could. */
export type ChaseState = { chasing: boolean; canChase: boolean };

/** The seconds either side of now that a satellite's velocity is taken over. */
const VELOCITY_HALF_SPAN = 1;

/** The pointer's id for satellite `k`, which can't clash with a body's. */
const SATELLITE_PREFIX = "sat:";

const satelliteIndex = (id: string): number | null =>
    id.startsWith(SATELLITE_PREFIX)
        ? Number(id.slice(SATELLITE_PREFIX.length))
        : null;

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
 */
export const createView = (
    container: HTMLElement,
    world: World,
    blocked: () => Rect[],
    band: () => Band,
    units: Units,
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
    // Only the mapped spheres are tone mapped; every flat colour sets `toneMapped: false`.
    // Neutral, not AgX: AgX shifts the hue of dark night sides.
    renderer.toneMapping = neutralNoToe();
    renderer.toneMappingExposure = EXPOSURE;

    const names = new Map(
        world.scenario.bodies.map((body) => [body.id, body.name]),
    );

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

    const theme = createTheme(container);
    const orbits = createOrbits(
        scene,
        world.order,
        theme.color,
        theme.background(),
        theme.pick(),
    );
    // Neither the sky nor the body maps are drawn where the user asks for more contrast.
    const plain =
        matchMedia("(forced-colors: active)").matches ||
        matchMedia("(prefers-contrast: more)").matches;
    // The sky counts as one file, the stars and the Milky Way together.
    let skyDone = 0;
    let skyFraction = 0;
    let mapsDone = 0;
    let mapsTotal = 0;
    let drawn = false;
    const { promise: ready, resolve: resolveReady } =
        Promise.withResolvers<void>();
    const skyTotal = plain ? 0 : 1;
    let destroyed = false;
    const report = () => {
        // The sky and maps of a destroyed view can still settle.
        if (destroyed) return;

        const total = skyTotal + mapsTotal;
        if (total > 0) {
            onLoading?.(
                skyDone + mapsDone,
                total,
                (skyFraction + mapsDone) / total,
            );
        }
        // The maps of the first frame are started by then.
        if (drawn && skyDone === skyTotal && mapsDone === mapsTotal) {
            resolveReady();
        }
    };
    const bodies = createBodies(
        scene,
        labels.domElement,
        world.order,
        theme.color,
        {
            maps: !plain,
            anisotropy: renderer.capabilities.getMaxAnisotropy(),
            onMaps: (done, total) => {
                mapsDone = done;
                mapsTotal = total;
                report();
            },
        },
    );

    const earthMu = world.scenario.bodies.find(
        (body) => body.id === "earth",
    )?.mu;
    const swarm = createSwarm(scene, theme, earthMu ?? 0);
    const earthOffset = { x: 0, y: 0, z: 0 };
    // Passed as Earth's position, which gives a satellite's position relative to Earth.
    const earthCentre = { x: 0, y: 0, z: 0 };

    let satelliteSelected: number | null = null;
    let satelliteFocused: number | null = null;
    // Set while the view's own `world.focus` runs, so its event isn't taken for a user's.
    let focusingSatellite = false;
    const satelliteListeners = new Set<(e: SatelliteEvent) => void>();
    const emitSatellite = (event: SatelliteEvent) => {
        for (const fn of satelliteListeners) fn(event);
    };
    const selectSatellite = (k: number | null) => {
        if (k === satelliteSelected) return;

        satelliteSelected = k;
        swarm.select(k);
        emitSatellite({ type: "selection", k });
    };
    // A satellite and a body are never selected together.
    const pickSatellite = (k: number) => {
        if (world.selected !== null) world.select(null);
        selectSatellite(k);
    };

    const grips = createGrips(labels.domElement, units);
    const readouts = createReadouts(container, labels.domElement, world, units);

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
                selectSatellite(null);
                world.select(id);
            } else {
                pickSatellite(k);
            }
        },
        focus: (id) => {
            const k = satelliteIndex(id);
            if (k === null) world.focus(id);
            else focusSatellite(k);
        },
        hover: (id) => {
            const k = id === null ? null : satelliteIndex(id);
            bodies.hover(k === null ? id : null);
            swarm.hover(k);
        },
    });
    orbits.highlight(world.selected);

    const rig = createRig(camera, canvas, () => world.scenario, world.states());
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
        const satellite =
            satelliteFocused === null
                ? null
                : swarm.facts(satelliteFocused, world.clock.t);

        canvas.setAttribute(
            "aria-label",
            `The solar system, centred on ${
                satellite?.name ?? names.get(rig.focusId())
            }. Arrow keys rotate, plus and minus zoom, 0 fits the focus, C chases it.`,
        );
    };
    describe();

    const focusSatellite = (k: number) => {
        pickSatellite(k);

        const facts = swarm.facts(k, world.clock.t);
        if (!facts) return;

        focusingSatellite = true;
        world.focus("earth");
        focusingSatellite = false;

        const fov = (camera.fov * Math.PI) / 180;
        const apogeeKm = facts.apogeeKm + EARTH_RADIUS / 1000;
        rig.focusPoint(
            () => {
                const earth = world.states().get("earth")?.r ?? rig.origin();

                return swarm.positionOf(k, world.clock.t, earth) ?? earth;
            },
            pointFrameDistanceKm(apogeeKm, fov, camera.aspect),
            () => {
                const t = world.clock.t;
                const before = swarm.positionOf(
                    k,
                    t - VELOCITY_HALF_SPAN,
                    earthCentre,
                );
                const now = swarm.positionOf(k, t, earthCentre);
                const after = swarm.positionOf(
                    k,
                    t + VELOCITY_HALF_SPAN,
                    earthCentre,
                );
                if (!before || !now || !after) return null;

                const span = 2 * VELOCITY_HALF_SPAN;

                return {
                    r: now,
                    v: {
                        x: (after.x - before.x) / span,
                        y: (after.y - before.y) / span,
                        z: (after.z - before.z) / span,
                    },
                };
            },
        );
        notifyChase();

        // Emitted even on a refocus, so its announcement follows Earth's.
        satelliteFocused = k;
        emitSatellite({ type: "focus", k });
        describe();
    };

    const sky = createSky();
    const loading = new AbortController();
    report();
    if (!plain) {
        sky.load(loading.signal, (fraction) => {
            skyFraction = fraction;
            report();
        })
            .catch((error: unknown) => {
                if (loading.signal.aborted) return;

                console.warn("The Orrery couldn't load the sky.", error);
            })
            .finally(() => {
                skyDone = skyTotal;
                skyFraction = 1;
                report();
            });
    }
    let skyCleared = false;

    let frame = 0;
    let last = performance.now();
    const draw = (now: number) => {
        frame = requestAnimationFrame(draw);

        // Read before this frame's writes, so the layout isn't forced twice.
        const keepOut = blocked();
        const free = band();

        const dt = Math.min((now - last) / 1000, 0.1);
        last = now;

        world.clock.tick(dt);
        const states = world.states();

        // A satellite leaves when its group is turned off or the clock leaves the snapshot.
        if (satelliteFocused !== null && !swarm.available(satelliteFocused)) {
            world.focus("earth");
        }
        if (satelliteSelected !== null && !swarm.available(satelliteSelected)) {
            selectSatellite(null);
        }

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
        const earth = states.get("earth")?.r;
        if (earth) {
            const origin = rig.origin();
            earthOffset.x = (earth.x - origin.x) / 1000;
            earthOffset.y = (earth.y - origin.y) / 1000;
            earthOffset.z = (earth.z - origin.z) / 1000;
        }
        swarm.update(
            camera,
            world.clock.t,
            earth && earthMu !== undefined ? earthOffset : null,
            size.height,
        );
        grips.placeNote(bodies.placed());
        if (!drawn) {
            drawn = true;
            report();
        }
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

    const observer = new ResizeObserver(resize);
    observer.observe(container);

    const unsubscribe = world.on((event) => {
        if (event.type === "selection") {
            orbits.highlight(event.id);
            if (event.id !== null) selectSatellite(null);
        } else if (event.type === "focus") {
            rig.focus(event.id);
            notifyChase();
            if (!focusingSatellite && satelliteFocused !== null) {
                satelliteFocused = null;
                emitSatellite({ type: "focus", k: null });
            }
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

    return {
        ghost: (id, elements) => {
            const body = world.order.find((candidate) => candidate.id === id);
            if (body) orbits.ghost(body, elements);
            ghostShown = body !== undefined && elements !== null;
        },
        grips: grips.target,
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
        },
        kmPerPx: () => (size.height > 0 ? rig.kmPerPx(size.height) : 0),
        satelliteGroups: swarm.groups,
        satellite: {
            selected: () => satelliteSelected,
            focused: () => satelliteFocused,
            select: (k) =>
                k === null ? selectSatellite(null) : pickSatellite(k),
            focus: focusSatellite,
            facts: (k) => swarm.facts(k, world.clock.t),
            on: (fn) => {
                satelliteListeners.add(fn);

                return () => {
                    satelliteListeners.delete(fn);
                };
            },
        },
        reveal: sky.reveal,
        ready,
        destroy: () => {
            // A view that goes before it's ready doesn't hold the reveal.
            destroyed = true;
            resolveReady();
            unsubscribe();
            unbindPointer();
            cancelAnimationFrame(frame);
            observer.disconnect();
            theme.stop();
            loading.abort();
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
