/**
 * <AudioPlayer>: swaps the browser's controls for ours (see bindTransport in
 * lib/media.ts).
 *
 * Root: `.audio-player`, containing the <audio>, a `.audio-player__controls`
 * wrapper (hidden until script runs) with `.audio-player__toggle`,
 * `.audio-player__seek` (a <Slider>) and `.audio-player__time`.
 */
import { bindTransport } from "../lib/media.ts";
import { behaviour } from "./behaviour.ts";

const audioPlayer = behaviour(".audio-player", (root) => {
    const audio = root.querySelector("audio");
    const controls = root.querySelector<HTMLElement>(".audio-player__controls");
    const toggle = root.querySelector<HTMLElement>(".audio-player__toggle");
    const seek = root.querySelector<HTMLInputElement>(".audio-player__seek");
    const time = root.querySelector<HTMLElement>(".audio-player__time");
    if (!audio || !controls || !toggle || !seek || !time) return;

    return bindTransport(audio, { controls, toggle, seek, time });
});

export const initAudioPlayer = audioPlayer.init;
export const initAudioPlayers = audioPlayer.initAll;
