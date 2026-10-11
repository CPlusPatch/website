import { bindTransport } from "../../../lib/media.ts";
import { reducedMotion } from "../../../lib/motion.ts";

/**
 * Plays a <Radio>'s tracklist. The transport (play, seek, time) is the
 * shared one from lib/media.ts; this adds moving between tracks, and keeps
 * the "now playing" part and the OS's media controls up to date.
 */
export const bindRadio = (root: HTMLElement) => {
    const part = <T extends HTMLElement = HTMLElement>(name: string) =>
        root.querySelector(`[data-radio-${name}]`) as T;
    const audio = root.querySelector("audio") as HTMLAudioElement;
    const title = part("title");
    const artist = part("artist");
    const cover = part<HTMLImageElement>("cover");
    const air = part("air");
    // Always at least one, as the tracklist is there (if hidden) for one.
    // In the list's order, which shuffling changes.
    let tracks = [
        ...root.querySelectorAll<HTMLAnchorElement>("[data-radio-track]"),
    ];

    bindTransport(audio, {
        controls: part("controls"),
        toggle: part("toggle"),
        seek: part<HTMLInputElement>("seek"),
        time: part("time"),
    });
    if (air) air.hidden = false;

    let current = 0;

    /** Shows the track in the OS's media controls, which can skip too. */
    const announce = () => {
        if (!("mediaSession" in navigator)) return;
        navigator.mediaSession.metadata = new MediaMetadata({
            title: title.textContent ?? "",
            artist: artist.textContent ?? "",
            album: root.getAttribute("aria-label") ?? "",
            artwork: cover.hidden ? [] : [{ src: cover.src }],
        });
    };

    /** Loads a track, playing it if asked or if one was already playing. */
    const select = (index: number, play = !audio.paused) => {
        // Round again from the end to the top, and back.
        current = (index + tracks.length) % tracks.length;
        const track = tracks[current] as HTMLAnchorElement;
        for (const other of tracks) other.removeAttribute("aria-current");
        track.setAttribute("aria-current", "true");
        title.textContent = track.dataset.title ?? "";
        artist.textContent = track.dataset.artist ?? "";
        cover.hidden = !track.dataset.cover;
        if (track.dataset.cover) cover.src = track.dataset.cover;
        audio.src = track.href;
        if (play) void audio.play();
        track.scrollIntoView({ block: "nearest" });
        announce();
    };

    const next = () => select(current + 1);
    // Back to the start first, as players do, then to the one before.
    const previous = () => {
        if (audio.currentTime > 3) audio.currentTime = 0;
        else select(current - 1);
    };

    // Shuffles the list itself, so what is shown is what plays: the playing
    // track stays on top and the rest follow in a new random order. The rows
    // slide to their places (FLIP: measured, moved, then animated from where
    // they were).
    const rowOf = (track: HTMLElement) => track.closest("li") as HTMLLIElement;
    part("shuffle").addEventListener("click", () => {
        const list = rowOf(tracks[0]).parentElement as HTMLElement;
        const before = new Map(
            tracks.map((track) => [track, track.getBoundingClientRect().top]),
        );
        const rest = tracks.filter((_, index) => index !== current);
        for (let i = rest.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [rest[i], rest[j]] = [rest[j], rest[i]];
        }
        tracks = [tracks[current], ...rest];
        current = 0;
        list.append(...tracks.map(rowOf));
        list.scrollTop = 0;
        for (const [index, track] of tracks.entries()) {
            const number = track.querySelector("[data-radio-number]");
            if (number) number.textContent = String(index + 1);
            const moved =
                (before.get(track) ?? 0) - track.getBoundingClientRect().top;
            if (moved && !reducedMotion()) {
                rowOf(track).animate(
                    [{ translate: `0 ${moved}px` }, { translate: "0 0" }],
                    { duration: 300, easing: "ease-out" },
                );
            }
        }
    });

    part("next").addEventListener("click", next);
    part("previous").addEventListener("click", previous);
    for (const track of tracks) {
        track.addEventListener("click", (event) => {
            event.preventDefault();
            select(tracks.indexOf(track), true);
        });
    }
    // A single track stops at its end, rather than looping.
    audio.addEventListener("ended", () => {
        if (tracks.length > 1) select(current + 1, true);
    });

    for (const type of ["play", "pause"]) {
        audio.addEventListener(type, () =>
            root.toggleAttribute("data-playing", !audio.paused),
        );
    }
    audio.addEventListener("play", () => {
        if (!("mediaSession" in navigator)) return;
        announce();
        navigator.mediaSession.setActionHandler("nexttrack", next);
        navigator.mediaSession.setActionHandler("previoustrack", previous);
    });
};
