import { renderSeek } from "../../../lib/media.ts";
import { reducedMotion } from "../../../lib/motion.ts";
import type { Feed } from "./feed.ts";

/**
 * Plays a <Shorts> feed. The current short plays while the feed is on
 * screen and the tab is in view, unless it was paused by hand; the others
 * are paused and rewound, so each starts from the top, as on YouTube.
 */
export const bindPlayback = (root: HTMLElement, feed: Feed) => {
    const shorts = [...root.querySelectorAll<HTMLElement>("[data-short]")];
    const videos = shorts.map(
        (short) => short.querySelector("video") as HTMLVideoElement,
    );
    const feedElement = root.querySelector("[data-shorts-feed]");
    const muteButtons = root.querySelectorAll("[data-short-mute]");

    // Moving pictures wait for a press under reduced motion. After one, the
    // reader has asked for them.
    let autoplay = !reducedMotion();
    // Browsers only autoplay without sound, until the page is interacted
    // with. The mute buttons start pressed to match.
    let muted = true;
    let onScreen = false;
    // Paused by hand, so it stays paused until it is pressed again or left.
    let held = false;

    const setMuted = (value: boolean) => {
        muted = value;
        for (const video of videos) video.muted = muted;
        for (const button of muteButtons) {
            button.setAttribute("aria-pressed", String(muted));
        }
    };

    const play = (video: HTMLVideoElement) => {
        video.muted = muted;
        video.play().catch((error: DOMException) => {
            // Sound was refused: carry on without it, like YouTube does.
            if (error.name === "NotAllowedError" && !video.muted) {
                setMuted(true);
                void video.play();
            }
        });
    };

    /** Plays the current short if it should be, and pauses all the rest. */
    const sync = () => {
        const active = onScreen && !document.hidden ? feed.current : -1;
        for (const [i, video] of videos.entries()) {
            if (i === active && autoplay && !held) {
                if (video.paused) play(video);
            } else if (!video.paused) {
                video.pause();
            }
        }
    };

    const toggle = () => {
        const video = videos[feed.current];
        held = !video.paused;
        if (held) video.pause();
        else {
            autoplay = true;
            play(video);
        }
        // Restarted by setting it afresh, as it ends by itself.
        const short = shorts[feed.current];
        delete short.dataset.flash;
        void short.offsetWidth;
        short.dataset.flash = held ? "pause" : "play";
    };

    for (const [i, short] of shorts.entries()) {
        const video = videos[i];
        const playButton = short.querySelector(
            "[data-short-toggle]",
        ) as HTMLElement;
        const seek = short.querySelector(
            "[data-short-seek]",
        ) as HTMLInputElement;

        video.controls = false;
        // Clicks land on the overlay, so the picture is not a tab stop of its own.
        video.tabIndex = -1;
        video.addEventListener("click", toggle);
        playButton.addEventListener("click", toggle);
        short
            .querySelector("[data-short-mute]")
            ?.addEventListener("click", () => setMuted(!muted));

        // The seek bar follows each frame while playing; timeupdate alone
        // only moves it a few times a second, which a thin bar shows up.
        let frame = 0;
        const tick = () => {
            renderSeek(video, seek);
            frame = video.paused ? 0 : requestAnimationFrame(tick);
        };
        video.addEventListener("play", () => {
            playButton.setAttribute("aria-pressed", "true");
            playButton.setAttribute("aria-label", "Pause");
            if (!frame) tick();
        });
        video.addEventListener("pause", () => {
            playButton.setAttribute("aria-pressed", "false");
            playButton.setAttribute("aria-label", "Play");
        });
        for (const type of ["durationchange", "seeked", "emptied"]) {
            video.addEventListener(type, () => renderSeek(video, seek));
        }
        seek.addEventListener("input", () => {
            video.currentTime = seek.valueAsNumber;
            renderSeek(video, seek);
        });
        renderSeek(video, seek);
    }

    root.addEventListener("keydown", (event) => {
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        const key = event.key.toLowerCase();
        if (key === "k") toggle();
        else if (key === "m") setMuted(!muted);
        // Space already presses a focused button
        else if (key === " " && event.target === feedElement) toggle();
        else return;
        event.preventDefault();
    });

    feed.onChange((_, previous) => {
        if (previous !== -1) videos[previous].currentTime = 0;
        held = false;
        sync();
    });
    new IntersectionObserver(
        ([entry]) => {
            onScreen = entry.isIntersecting;
            sync();
        },
        { threshold: 0.6 },
    ).observe(feedElement as Element);
    document.addEventListener("visibilitychange", sync);
};
