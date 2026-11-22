import { PerspectiveCamera, Scene, WebGLRenderer } from "three";
import { CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import type { EditScene } from "../editing.ts";
import type { Units } from "../units.ts";
import type { World } from "../world.ts";
import { createBodies } from "./bodies.ts";
import { createRig } from "./camera.ts";
import { type Band, centreShift, type Rect } from "./geometry.ts";
import { createGrips } from "./grips.ts";
import { createOrbits } from "./orbits.ts";
import { type PickPoint, pickBody } from "./picking.ts";
import { bindPointer } from "./pointer.ts";
import { createReadouts } from "./readouts.ts";
import { createSky } from "./sky.ts";
import { createTheme } from "./theme.ts";

/** The 3D view drawn into a container. */
export type View = EditScene & {
    /** Dollies in for a positive `steps`, out for a negative one. */
    zoom: (steps: number) => void;
    /** Moves the camera to the focus's framing distance. */
    fitFocus: () => void;
    /** The km one CSS pixel spans at the focus, or 0 before the view has a size. */
    kmPerPx: () => number;
    destroy: () => void;
};

/**
 * The 3D view of `world` in `container`, or `null` if WebGL isn't available.
 * `blocked` gives the rects, in px from the container's top left, that labels keep out of.
 * `band` gives the rows the panels leave free, where the focus is centred.
 * `units` sets the unit of the distances in the notes.
 */
export const createView = (
    container: HTMLElement,
    world: World,
    blocked: () => Rect[],
    band: () => Band,
    units: Units,
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
    const bodies = createBodies(
        scene,
        labels.domElement,
        world.order,
        theme.color,
    );

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

        // The view keeps fitting while the container changes size.
        if (!rig.moved()) rig.fit();
    };

    let points: PickPoint[] = [];
    const unbindPointer = bindPointer(canvas, {
        // A visible label names its body, so it wins over a nearby marker.
        pick: (x, y) =>
            bodies.labelAt(x, y, canvas.getBoundingClientRect()) ??
            pickBody(points, x, y),
        select: (id) => world.select(id),
        focus: (id) => world.focus(id),
        hover: (id) => bodies.hover(id),
    });
    orbits.highlight(world.selected);

    const rig = createRig(camera, canvas, () => world.scenario, world.states());
    resize();

    const describe = () =>
        canvas.setAttribute(
            "aria-label",
            `The solar system, centred on ${names.get(
                rig.focusId(),
            )}. Arrow keys rotate, plus and minus zoom, 0 fits the focus.`,
        );
    describe();

    // The sky isn't drawn where the user asks for more contrast.
    const plain =
        matchMedia("(forced-colors: active)").matches ||
        matchMedia("(prefers-contrast: more)").matches;
    const sky = createSky();
    const loading = new AbortController();
    if (!plain) {
        sky.load(loading.signal).catch((error: unknown) => {
            if (loading.signal.aborted) return;

            console.warn("The Orrery couldn't load the sky.", error);
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

        offset(free);
        rig.update(dt, states);
        camera.updateMatrixWorld();
        orbits.update(rig.origin(), states, camera, world.clock.rate);
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
            rig.origin(),
            rig.focusId(),
            world.selected,
            states,
            [...keepOut, ...rooms],
        );
        grips.placeNote(bodies.placed());
        readouts.update({
            camera,
            origin: rig.origin(),
            states,
            viewport: size,
            hidden: ghostShown || grips.shown(),
            labels: bodies.placed(),
            blocked: keepOut,
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
        } else if (event.type === "focus") {
            rig.focus(event.id);
            describe();
        } else if (event.type === "body") {
            const body = world.scenario.bodies.find((b) => b.id === event.id);
            if (body) orbits.rebuild(body);
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
        kmPerPx: () => (size.height > 0 ? rig.kmPerPx(size.height) : 0),
        destroy: () => {
            unsubscribe();
            unbindPointer();
            cancelAnimationFrame(frame);
            observer.disconnect();
            theme.stop();
            loading.abort();
            sky.dispose();
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
