/**
 * @module
 * The background music: one audio element that plays the tracks in a shuffled order.
 */

import { nextRound } from "./shuffle.ts";

/** A track's name and who made it. */
export type TrackInfo = { title: string; artist: string };

type Music = TrackInfo & { url: string };

// Literal `new URL(..., import.meta.url)` calls, so the bundler emits the files
/** The tracks, in the order that the credits list them. */
export const TRACKS: readonly Music[] = [
    {
        title: "Biome Fest",
        artist: "C418",
        url: new URL("../assets/music/c418-biome-fest.webm", import.meta.url)
            .href,
    },
    {
        title: "Blood on the Dancefloor",
        artist: "Chris Christodoulou",
        url: new URL(
            "../assets/music/chris-christodoulou-blood-on-the-dancefloor.webm",
            import.meta.url,
        ).href,
    },
    {
        title: "If I'm Wrong",
        artist: "Release",
        url: new URL(
            "../assets/music/release-if-im-wrong.webm",
            import.meta.url,
        ).href,
    },
    {
        title: "Polygone",
        artist: "Oddscure",
        url: new URL("../assets/music/oddscure-polygone.webm", import.meta.url)
            .href,
    },
    {
        title: "Research And Development",
        artist: "Luke Richards",
        url: new URL(
            "../assets/music/luke-richards-research-and-development.webm",
            import.meta.url,
        ).href,
    },
    {
        title: "Something Felt Off About Him",
        artist: "Luke Richards",
        url: new URL(
            "../assets/music/luke-richards-something-felt-off-about-him.webm",
            import.meta.url,
        ).href,
    },
];

const VOLUME = 0.5;

/** The music player. */
export type MusicPlayer = {
    start: () => void;
    stop: () => void;
    /** The track that's playing or about to, or `null` before the first one is picked. */
    track: () => TrackInfo | null;
    /** Sets the function called when the track changes. */
    onTrack: (callback: (track: TrackInfo | null) => void) => void;
    destroy: () => void;
};

/** Makes the music player. It loads nothing until `start`. */
export const createMusic = (): MusicPlayer => {
    let audio: HTMLAudioElement | null = null;
    let on = false;
    let queue: number[] = [];
    let current: number | null = null;
    let callback: (track: TrackInfo | null) => void = () => {};
    let unblock: (() => void) | null = null;
    // Tracks that failed in a row, so a lost connection doesn't spin through the list.
    let failures = 0;

    const info = (): TrackInfo | null => {
        const entry = current === null ? null : TRACKS[current];

        return entry ? { title: entry.title, artist: entry.artist } : null;
    };

    const clearUnblock = () => {
        unblock?.();
        unblock = null;
    };

    // Autoplay is blocked until a gesture, so a refused play waits for the first one.
    const retryOnGesture = () => {
        if (unblock) return;

        const retry = () => {
            clearUnblock();
            if (on && document.visibilityState === "visible") attempt();
        };

        document.addEventListener("pointerdown", retry);
        document.addEventListener("keydown", retry);
        unblock = () => {
            document.removeEventListener("pointerdown", retry);
            document.removeEventListener("keydown", retry);
        };
    };

    // The next track, unless they all failed in a row.
    const skip = () => {
        if (++failures < TRACKS.length) advance();
    };

    const attempt = () => {
        // The visibility handler plays it when the page comes back.
        if (document.visibilityState === "hidden") return;

        // Playing before a gesture is refused, so don't ask.
        if (navigator.userActivation?.hasBeenActive === false) {
            retryOnGesture();

            return;
        }

        audio?.play().catch((error: unknown) => {
            if (!on) return;
            // An abort comes from a new source, which plays by itself.
            if (error instanceof DOMException && error.name === "AbortError") {
                return;
            }

            if (
                error instanceof DOMException &&
                error.name === "NotAllowedError"
            ) {
                retryOnGesture();
            } else {
                skip();
            }
        });
    };

    const advance = () => {
        if (!audio || !on) return;

        if (queue.length === 0) {
            queue = nextRound(TRACKS.length, Math.random, current ?? undefined);
        }
        current = queue.shift() ?? 0;
        audio.src = TRACKS[current]?.url ?? "";
        callback(info());
        attempt();
    };

    const onVisibility = () => {
        if (!audio || !on) return;

        if (document.visibilityState === "hidden") audio.pause();
        else attempt();
    };

    const create = (): HTMLAudioElement => {
        const element = new Audio();
        element.preload = "none";
        element.volume = VOLUME;
        element.addEventListener("ended", advance);
        element.addEventListener("playing", () => {
            failures = 0;
        });
        element.addEventListener("error", () => {
            // The element has no source before the first track.
            if (element.getAttribute("src")) skip();
        });
        document.addEventListener("visibilitychange", onVisibility);

        return element;
    };

    return {
        start: () => {
            if (on) return;

            on = true;
            failures = 0;
            audio ??= create();
            if (current === null || !audio.getAttribute("src")) advance();
            else attempt();
        },
        stop: () => {
            if (!on) return;

            on = false;
            clearUnblock();
            audio?.pause();
        },
        track: info,
        onTrack: (next) => {
            callback = next;
        },
        destroy: () => {
            on = false;
            clearUnblock();
            document.removeEventListener("visibilitychange", onVisibility);
            if (audio) {
                audio.pause();
                audio.removeAttribute("src");
                audio.load();
            }
            audio = null;
        },
    };
};
