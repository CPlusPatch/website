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

/** Swaps the browser's controls for ours and keeps them in sync. */
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
) => {
    media.controls = false;
    controls.hidden = false;

    const render = () => {
        // Infinite for streams, NaN until the metadata loads
        const duration = Number.isFinite(media.duration) ? media.duration : 0;
        const { buffered } = media;
        const loaded = buffered.length ? buffered.end(buffered.length - 1) : 0;
        seek.max = String(duration);
        seek.value = String(media.currentTime);
        seek.setAttribute(
            "aria-valuetext",
            `${formatTime(media.currentTime)} of ${formatTime(duration)}`,
        );
        fill(seek);
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
        media.addEventListener(type, render);
    }
    toggle.addEventListener("click", () => {
        if (media.paused) void media.play();
        else media.pause();
    });
    seek.addEventListener("input", () => {
        media.currentTime = seek.valueAsNumber;
        render();
    });
    render();
};
