/**
 * Shared script for the audio and media players: the play toggle, seek bar
 * and time readout work the same for any <audio> or <video>.
 */

/** `m:ss`, or `h:mm:ss` from an hour up. */
export const formatTime = (seconds: number) => {
    const s = Math.floor(seconds);
    const pad = (n: number) => String(n).padStart(2, "0");
    return s < 3600
        ? `${Math.floor(s / 60)}:${pad(s % 60)}`
        : `${Math.floor(s / 3600)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
};

/** Sets a <Slider>'s --progress from its value. */
export const fill = (range: HTMLInputElement) => {
    const max = Number(range.max);
    range.style.setProperty(
        "--progress",
        `${max ? (range.valueAsNumber / max) * 100 : 0}%`,
    );
};

/**
 * Sets a seek <Slider> from where `media` has got to, and returns the
 * duration it went by: 0 until the metadata loads, and for streams.
 */
export const renderSeek = (media: HTMLMediaElement, seek: HTMLInputElement) => {
    // Infinite for streams, NaN until the metadata loads
    const duration = Number.isFinite(media.duration) ? media.duration : 0;
    seek.max = String(duration);
    seek.value = String(media.currentTime);
    seek.setAttribute(
        "aria-valuetext",
        `${formatTime(media.currentTime)} of ${formatTime(duration)}`,
    );
    fill(seek);
    return duration;
};

/**
 * Turns `preload="none"` into "metadata" once the page has loaded and gone
 * idle, so the time readout gets its duration without the request competing
 * with the page's own. For an Ogg file, "metadata" can mean the whole file, as
 * the duration is only in its last page.
 */
const preloadWhenIdle = (media: HTMLMediaElement, signal: AbortSignal) => {
    if (media.preload !== "none") return;
    const upgrade = () => {
        if (signal.aborted || media.preload !== "none") return;
        media.preload = "metadata";
    };
    const idle = () =>
        "requestIdleCallback" in window
            ? requestIdleCallback(upgrade, { timeout: 3000 })
            : setTimeout(upgrade, 1000);
    if (document.readyState === "complete") idle();
    else window.addEventListener("load", idle, { once: true, signal });
};

/**
 * Swaps the browser's controls for ours and keeps them in sync. Returns a
 * function that stops that and gives the browser's controls back.
 *
 * Players render their <audio> with `preload="none"`, so it does not load
 * with the page; this asks for the metadata once the page is idle.
 */
export const bindTransport = (
    media: HTMLMediaElement,
    {
        controls,
        toggle,
        seek,
        time,
    }: {
        controls: HTMLElement;
        toggle: HTMLElement;
        seek: HTMLInputElement;
        time: HTMLElement;
    },
): (() => void) => {
    const controller = new AbortController();
    const { signal } = controller;
    const nativeControls = media.controls;
    media.controls = false;
    controls.hidden = false;

    const render = () => {
        const duration = renderSeek(media, seek);
        const { buffered } = media;
        const loaded = buffered.length ? buffered.end(buffered.length - 1) : 0;
        seek.style.setProperty(
            "--buffered",
            `${duration ? (loaded / duration) * 100 : 0}%`,
        );
        time.textContent = `${formatTime(media.currentTime)} / ${formatTime(duration)}`;
        toggle.setAttribute("aria-pressed", String(!media.paused));
    };

    for (const type of [
        "play",
        "pause",
        "timeupdate",
        "durationchange",
        "progress",
    ]) {
        media.addEventListener(type, render, { signal });
    }
    toggle.addEventListener(
        "click",
        () => {
            if (media.paused) void media.play();
            else media.pause();
        },
        { signal },
    );
    seek.addEventListener(
        "input",
        () => {
            media.currentTime = seek.valueAsNumber;
            render();
        },
        { signal },
    );
    render();
    preloadWhenIdle(media, signal);

    return () => {
        controller.abort();
        media.controls = nativeControls;
        controls.hidden = true;
    };
};
