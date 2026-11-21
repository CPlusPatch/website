import { PerspectiveCamera, Scene, WebGLRenderer } from "three";

/** The 3D view drawn into a container. */
export type View = { destroy: () => void };

/** The 3D view in `container`, or `null` if WebGL isn't available. */
export const createView = (container: HTMLElement): View | null => {
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

    const scene = new Scene();
    const camera = new PerspectiveCamera(50, 1, 1e-6, 1e12);
    const observer = new ResizeObserver(() => {
        const { clientWidth: width, clientHeight: height } = container;
        if (width === 0 || height === 0) return;

        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.render(scene, camera);
    });

    container.append(renderer.domElement);
    observer.observe(container);

    return {
        destroy: () => {
            observer.disconnect();
            renderer.dispose();
            renderer.domElement.remove();
        },
    };
};
