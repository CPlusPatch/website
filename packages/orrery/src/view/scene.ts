import type { Scenario } from "@cpluspatch/orbit";
import { sortByDepth, unixMsToJ2000s, worldStates } from "@cpluspatch/orbit";
import { PerspectiveCamera, Scene, WebGLRenderer } from "three";
import { CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import { createBodies } from "./bodies.ts";
import { createRig } from "./camera.ts";
import { createOrbits } from "./orbits.ts";
import { createTheme } from "./theme.ts";

/** The 3D view drawn into a container. */
export type View = {
    /** Centres the view on a body. */
    focus: (id: string) => void;
    destroy: () => void;
};

/** The 3D view of `scenario` in `container`, or `null` if WebGL isn't available. */
export const createView = (
    container: HTMLElement,
    scenario: Scenario,
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

    const names = new Map(scenario.bodies.map((body) => [body.id, body.name]));
    const order = sortByDepth(scenario);
    const states = worldStates(scenario, order, unixMsToJ2000s(Date.now()));

    const scene = new Scene();
    const camera = new PerspectiveCamera(50, 1, 1e-6, 1e12);
    const labels = new CSS2DRenderer();
    labels.domElement.classList.add("orrery__labels");
    // The canvas's label already names the focus.
    labels.domElement.setAttribute("aria-hidden", "true");
    const canvas = renderer.domElement;
    canvas.setAttribute("role", "img");

    container.append(canvas, labels.domElement);

    const theme = createTheme(container, () => {
        orbits.recolor(theme.color, theme.background());
        bodies.recolor(theme.color);
    });
    const orbits = createOrbits(
        scene,
        order,
        states,
        theme.color,
        theme.background(),
    );
    const bodies = createBodies(
        scene,
        labels.domElement,
        order,
        states,
        theme.color,
    );

    const resize = () => {
        const { clientWidth: width, clientHeight: height } = container;
        if (width === 0 || height === 0) return;

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

    const rig = createRig(camera, canvas, scenario, states);
    resize();

    const describe = () =>
        canvas.setAttribute(
            "aria-label",
            `The solar system, centred on ${names.get(rig.focusId())}`,
        );
    describe();

    let frame = 0;
    let last = performance.now();
    const draw = (now: number) => {
        frame = requestAnimationFrame(draw);

        const dt = Math.min((now - last) / 1000, 0.1);
        last = now;

        rig.update(dt);
        camera.updateMatrixWorld();
        orbits.update(rig.origin());
        bodies.update(camera, rig.origin(), rig.focusId());

        renderer.render(scene, camera);
        labels.render(scene, camera);
    };
    frame = requestAnimationFrame(draw);

    const observer = new ResizeObserver(resize);
    observer.observe(container);

    return {
        focus: (id) => {
            rig.focus(id);
            describe();
        },
        destroy: () => {
            cancelAnimationFrame(frame);
            observer.disconnect();
            theme.stop();
            rig.dispose();
            orbits.dispose();
            bodies.dispose();
            renderer.forceContextLoss();
            renderer.dispose();
            canvas.remove();
            labels.domElement.remove();
        },
    };
};
