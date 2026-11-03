/**
 * <MediaPlayer>: swaps the browser's controls for ours (see bindTransport in
 * lib/media.ts), and adds volume, captions, fullscreen and keyboard
 * shortcuts (K play, M mute, C captions, F fullscreen, J and L skip 10s).
 *
 * Root: `.media-player`, containing the <video> (with optional <track>s) and
 * `.media-player__<part>` elements: `controls` (hidden until script runs),
 * `toggle`, `seek`, `time`, `mute`, `volume`, `fullscreen` and optionally
 * `captions`.
 */
import { bindTransport, fill } from "../lib/media.ts";
import { behaviour } from "./behaviour.ts";

const mediaPlayer = behaviour(".media-player", (root, signal) => {
    const video = root.querySelector("video");
    const part = <T extends HTMLElement = HTMLElement>(name: string) =>
        root.querySelector<T>(`.media-player__${name}`);
    const controls = part("controls");
    const toggle = part("toggle");
    const seek = part<HTMLInputElement>("seek");
    const time = part("time");
    const mute = part("mute");
    const volume = part<HTMLInputElement>("volume");
    const captions = part("captions");
    const fullscreen = part("fullscreen");
    if (
        !video ||
        !controls ||
        !toggle ||
        !seek ||
        !time ||
        !mute ||
        !volume ||
        !fullscreen
    )
        return;

    const releaseTransport = bindTransport(video, {
        controls,
        toggle,
        seek,
        time,
    });

    // Clicking the picture plays it, and focuses it (but not by Tab) so the
    // shortcuts work after
    const tabindex = video.getAttribute("tabindex");
    video.tabIndex = -1;
    video.addEventListener("click", () => toggle.click(), { signal });

    const renderVolume = () => {
        mute.setAttribute("aria-pressed", String(video.muted));
        volume.value = String(video.muted ? 0 : video.volume);
        fill(volume);
    };
    video.addEventListener("volumechange", renderVolume, { signal });
    mute.addEventListener(
        "click",
        () => {
            video.muted = !video.muted;
            if (!video.muted && !video.volume) video.volume = 1;
        },
        { signal },
    );
    volume.addEventListener(
        "input",
        () => {
            video.volume = volume.valueAsNumber;
            video.muted = !video.volume;
        },
        { signal },
    );
    renderVolume();

    const track = (
        video.querySelector<HTMLTrackElement>("track[default]") ??
        video.querySelector<HTMLTrackElement>("track")
    )?.track;
    if (captions && track) {
        const renderCaptions = () =>
            captions.setAttribute(
                "aria-pressed",
                String(track.mode === "showing"),
            );
        video.textTracks.addEventListener("change", renderCaptions, {
            signal,
        });
        captions.addEventListener(
            "click",
            () => {
                track.mode = track.mode === "showing" ? "hidden" : "showing";
            },
            { signal },
        );
        renderCaptions();
    }

    // Fullscreen on the figure keeps our controls. iPhone Safari can only
    // take the <video> itself, with its own controls.
    const ios = video as HTMLVideoElement & {
        webkitEnterFullscreen?: () => void;
    };
    let restoreFullscreen: (() => void) | undefined;
    if (document.fullscreenEnabled) {
        fullscreen.addEventListener(
            "click",
            () => {
                if (document.fullscreenElement === root)
                    void document.exitFullscreen();
                else void root.requestFullscreen();
            },
            { signal },
        );
        document.addEventListener(
            "fullscreenchange",
            () =>
                fullscreen.setAttribute(
                    "aria-pressed",
                    String(document.fullscreenElement === root),
                ),
            { signal },
        );
    } else if (ios.webkitEnterFullscreen) {
        fullscreen.addEventListener(
            "click",
            () => ios.webkitEnterFullscreen?.(),
            {
                signal,
            },
        );
    } else {
        // Nothing to do it with
        const { parentNode, nextSibling } = fullscreen;
        fullscreen.remove();
        restoreFullscreen = () =>
            parentNode?.insertBefore(fullscreen, nextSibling);
    }

    root.addEventListener(
        "keydown",
        (event) => {
            if (event.ctrlKey || event.metaKey || event.altKey) return;
            const key = event.key.toLowerCase();
            const button = {
                k: toggle,
                m: mute,
                c: captions,
                f: fullscreen,
                // Space already presses a focused button
                " ": event.target === video ? toggle : null,
            }[key];
            if (button) button.click();
            else if (key === "j") video.currentTime -= 10;
            else if (key === "l") video.currentTime += 10;
            else return;
            event.preventDefault();
        },
        { signal },
    );

    return () => {
        releaseTransport();
        if (tabindex === null) video.removeAttribute("tabindex");
        else video.setAttribute("tabindex", tabindex);
        restoreFullscreen?.();
    };
});

export const initMediaPlayer = mediaPlayer.init;
export const initMediaPlayers = mediaPlayer.initAll;
