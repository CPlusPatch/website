/**
 * @module
 * The interface cues, played through the Web Audio API.
 * Modelled on `packages/destructor/src/sfx.ts`.
 */

import type { Cue } from "./cues.ts";

type Sound = { url: string; volume: number };

// Literal `new URL(..., import.meta.url)` calls, so the bundler emits the files
const SOUNDS: Record<Cue, Sound> = {
    select: {
        url: new URL("../assets/sounds/select.mp3", import.meta.url).href,
        volume: 0.1,
    },
    play: {
        url: new URL("../assets/sounds/play.mp3", import.meta.url).href,
        volume: 0.1,
    },
    pause: {
        url: new URL("../assets/sounds/pause.mp3", import.meta.url).href,
        volume: 0.1,
    },
    rate: {
        url: new URL("../assets/sounds/rate.mp3", import.meta.url).href,
        volume: 0.1,
    },
    edit: {
        url: new URL("../assets/sounds/edit.mp3", import.meta.url).href,
        volume: 0.1,
    },
    add: {
        url: new URL("../assets/sounds/add.mp3", import.meta.url).href,
        volume: 0.1,
    },
    remove: {
        url: new URL("../assets/sounds/remove.mp3", import.meta.url).href,
        volume: 0.1,
    },
    load: {
        url: new URL("../assets/sounds/load.mp3", import.meta.url).href,
        volume: 0.1,
    },
    tick: {
        url: new URL("../assets/sounds/tick.mp3", import.meta.url).href,
        volume: 0.05,
    },
};

/** A cue still loading after this long, in ms, is dropped instead of played late. */
const STALE_AFTER_MS = 500;

let warned = false;

/** Reports a failure once in total, as a missing file would otherwise warn for every sound. */
const warnOnce = (message: string, error: unknown) => {
    if (warned) return;

    warned = true;
    console.warn(message, error);
};

class Track {
    private readonly buffer: Promise<AudioBuffer | null>;
    private readonly gain: GainNode;
    private source: AudioBufferSourceNode | null = null;

    constructor(
        private readonly context: AudioContext,
        private readonly sound: Sound,
    ) {
        this.gain = context.createGain();
        this.gain.gain.value = sound.volume;
        this.gain.connect(context.destination);
        this.buffer = this.load();
    }

    private async load(): Promise<AudioBuffer | null> {
        try {
            const response = await fetch(this.sound.url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            return await this.context.decodeAudioData(
                await response.arrayBuffer(),
            );
        } catch (error) {
            warnOnce(`The Orrery couldn't load ${this.sound.url}.`, error);

            return null;
        }
    }

    async play(): Promise<void> {
        const requestedAt = performance.now();
        const buffer = await this.buffer;

        if (!buffer || this.context.state === "closed") return;
        if (performance.now() - requestedAt > STALE_AFTER_MS) return;

        try {
            this.source?.stop();
            const source = this.context.createBufferSource();
            source.buffer = buffer;
            source.connect(this.gain);
            source.addEventListener("ended", () => {
                if (this.source === source) this.source = null;
            });
            source.start();
            this.source = source;
        } catch (error) {
            warnOnce("The Orrery couldn't play a sound.", error);
        }
    }
}

/** The cue player. Nothing is created until the first play. */
export type Effects = {
    play: (name: Cue) => void;
    destroy: () => void;
};

/** Plays the interface cues. */
export const createEffects = (): Effects => {
    let context: AudioContext | null = null;
    let tracks: Map<Cue, Track> | null = null;
    let broken = false;
    // Without `userActivation`, the first press or key stands in for it.
    let pressed = false;
    const onGesture = () => {
        pressed = true;
    };
    document.addEventListener("pointerdown", onGesture, { once: true });
    document.addEventListener("keydown", onGesture, { once: true });

    // A context made before a gesture is suspended, and mount-time cues come before one.
    const activated = (): boolean =>
        navigator.userActivation?.hasBeenActive ?? pressed;

    const start = () => {
        try {
            context = new AudioContext();
            const made = new Map<Cue, Track>();
            for (const [name, sound] of Object.entries(SOUNDS)) {
                made.set(name as Cue, new Track(context, sound));
            }
            tracks = made;
        } catch (error) {
            broken = true;
            warnOnce("The Orrery couldn't start its sounds.", error);
        }
    };

    return {
        play: (name) => {
            if (broken || !activated()) return;
            if (!context) start();
            if (!context || !tracks) return;

            // A context made before a gesture starts suspended. Cues come from gestures.
            if (context.state === "suspended") {
                context.resume().catch(() => {});
            }
            void tracks.get(name)?.play();
        },
        destroy: () => {
            const closing = context;

            context = null;
            tracks = null;
            broken = false;
            document.removeEventListener("pointerdown", onGesture);
            document.removeEventListener("keydown", onGesture);
            closing?.close().catch(() => {});
        },
    };
};
