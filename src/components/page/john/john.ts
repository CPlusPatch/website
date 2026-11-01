/** Asks for fullscreen; browsers may refuse, which is fine. */
const goFullscreen = () =>
    document.documentElement.requestFullscreen?.().catch(() => {});

const reducedMotion = () =>
    matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Makes either button on the banner start the video over the whole screen,
 * after which the visitor can't easily leave. With reduced motion, nothing
 * plays: the banner just says thanks.
 */
export const bindJohn = (root: HTMLElement) => {
    const stage = root.querySelector<HTMLElement>("[data-john-stage]");
    const video = root.querySelector<HTMLVideoElement>("[data-john-video]");
    const thanks = root.querySelector<HTMLElement>("[data-john-thanks]");
    if (!stage || !video || !thanks) return;

    const choose = () => {
        if (reducedMotion()) {
            thanks.hidden = false;
            return;
        }
        stage.hidden = false;
        goFullscreen();
        video.play().catch(() => {});
        // From now on, closing the tab asks first.
        addEventListener("beforeunload", (event) => event.preventDefault());
        video.addEventListener("click", goFullscreen);
    };

    for (const button of root.querySelectorAll("[data-john-choice]")) {
        button.addEventListener("click", choose, { once: true });
    }
};
